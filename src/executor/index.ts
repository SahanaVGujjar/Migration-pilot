import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  MigrationConfig,
  MigrationPlan,
  MigrationResult,
  BatchResult,
  MigrationReport,
} from '../types';
import { createTransformer, Transformer } from '../transformers';
import { GitManager } from '../utils/git';
import { TestRunner } from '../utils/test-runner';
import { AIAssistant } from '../utils/ai';
import { Dashboard } from '../dashboard';

export class MigrationExecutor {
  private config: MigrationConfig;
  private transformer: Transformer;
  private git: GitManager;
  private testRunner: TestRunner | null;
  private dashboard: Dashboard;
  private ai: AIAssistant | null = null;

  constructor(config: MigrationConfig) {
    this.config = config;

    if (config.aiAssisted) {
      this.ai = new AIAssistant(config.ollamaModel, config.ollamaUrl);
    }

    this.transformer = createTransformer(config.type, this.ai || undefined);
    this.git = new GitManager(config.targetDir);
    this.testRunner = config.runTests
      ? new TestRunner(config.targetDir, config.testCommand)
      : null;
    this.dashboard = new Dashboard();
  }

  async execute(plan: MigrationPlan): Promise<MigrationReport> {
    const report: MigrationReport = {
      type: this.config.type,
      startTime: new Date(),
      endTime: new Date(),
      totalFiles: plan.totalFiles,
      migratedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      rolledBackFiles: 0,
      batches: [],
      needsManualReview: [],
    };

    // Check AI availability
    if (this.ai) {
      const spinner = ora('Checking Ollama AI availability...').start();
      const available = await this.ai.checkAvailability();
      if (available) {
        spinner.succeed(chalk.green('Ollama AI connected — enhanced type inference enabled'));
      } else {
        spinner.warn(chalk.yellow('Ollama not available — falling back to rule-based inference'));
        this.ai = null;
      }
    }

    // Set up git backup if available
    if (this.git.isGitRepo()) {
      const spinner = ora('Creating git backup...').start();
      try {
        const branch = this.git.createBackupBranch('pre-migration');
        spinner.succeed(`Backup branch created: ${chalk.gray(branch)}`);
      } catch {
        spinner.warn('Could not create backup branch — proceeding without backup');
      }
    }

    this.dashboard.init(plan);

    console.log('');
    console.log(chalk.bold('  Starting migration...\n'));

    for (const batch of plan.batches) {
      const batchResult = await this.executeBatch(batch.id, batch.files, plan);

      report.batches.push(batchResult);

      for (const result of batchResult.results) {
        if (result.success) {
          report.migratedFiles++;
        } else {
          report.failedFiles++;
          report.needsManualReview.push(result.file);
        }
      }

      if (batchResult.rolledBack) {
        report.rolledBackFiles += batch.files.length;
      }

      this.dashboard.updateProgress(report);
    }

    report.endTime = new Date();
    return report;
  }

  private async executeBatch(
    batchId: number,
    files: string[],
    plan: MigrationPlan
  ): Promise<BatchResult> {
    const results: MigrationResult[] = [];
    const originalContents = new Map<string, { content: string; path: string }>();

    const batchSpinner = ora(
      `Batch ${batchId}/${plan.batches.length}: Migrating ${files.length} files...`
    ).start();

    // Save originals for rollback
    for (const file of files) {
      const fullPath = path.join(this.config.targetDir, file);
      if (fs.existsSync(fullPath)) {
        originalContents.set(file, {
          content: fs.readFileSync(fullPath, 'utf-8'),
          path: fullPath,
        });
      }
    }

    // Transform each file
    for (const file of files) {
      const fullPath = path.join(this.config.targetDir, file);
      try {
        const transformResult = await this.transformer.transform(fullPath);

        // Write transformed content
        fs.writeFileSync(transformResult.newFilePath, transformResult.newContent);

        // If file was renamed (e.g., .js → .ts), remove the original
        if (transformResult.newFilePath !== fullPath) {
          fs.unlinkSync(fullPath);

          // Update imports in other files that reference this file
          this.updateImportReferences(
            plan,
            file,
            this.getRelativePath(transformResult.newFilePath)
          );
        }

        results.push({
          file,
          success: true,
          changes: transformResult.changes,
          linesAdded: transformResult.linesAdded,
          linesRemoved: transformResult.linesRemoved,
        });
      } catch (error: any) {
        results.push({
          file,
          success: false,
          changes: [],
          error: error.message,
          linesAdded: 0,
          linesRemoved: 0,
        });
      }
    }

    // Run tests if configured
    let testsPass = true;
    if (this.testRunner && this.config.runTests) {
      batchSpinner.text = `Batch ${batchId}: Running tests...`;
      const testResult = await this.testRunner.runTests();
      testsPass = testResult.passed;

      if (!testsPass) {
        batchSpinner.fail(
          `Batch ${batchId}: ${chalk.red('Tests failed')} — rolling back`
        );

        // Rollback
        this.rollbackBatch(files, originalContents);

        return {
          batchId,
          results: results.map((r) => ({ ...r, success: false })),
          testsPass: false,
          rolledBack: true,
        };
      }
    }

    // Git commit if available
    if (this.git.isGitRepo()) {
      try {
        const allFiles = results
          .filter((r) => r.success)
          .flatMap((r) => {
            const original = path.join(this.config.targetDir, r.file);
            const newPath = r.file.replace(/\.(js|jsx)$/, (m) =>
              m === '.jsx' ? '.tsx' : '.ts'
            );
            return [original, path.join(this.config.targetDir, newPath)];
          });
        this.git.commitBatch(batchId, allFiles);
      } catch {
        // git commit is best-effort
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    batchSpinner.succeed(
      `Batch ${batchId}: ${chalk.green(`${successCount} migrated`)}${failCount > 0 ? `, ${chalk.red(`${failCount} failed`)}` : ''} ${chalk.gray(`(tests: ${testsPass ? 'passed' : 'skipped'})`)}`
    );

    return { batchId, results, testsPass, rolledBack: false };
  }

  private rollbackBatch(
    files: string[],
    originalContents: Map<string, { content: string; path: string }>
  ): void {
    for (const file of files) {
      const original = originalContents.get(file);
      if (original) {
        // Remove any new files created
        const newPath = original.path.replace(/\.(js|jsx)$/, (m) =>
          m === '.jsx' ? '.tsx' : '.ts'
        );
        if (fs.existsSync(newPath) && newPath !== original.path) {
          fs.unlinkSync(newPath);
        }
        // Restore original
        fs.writeFileSync(original.path, original.content);
      }
    }
  }

  private updateImportReferences(
    plan: MigrationPlan,
    oldFile: string,
    newFile: string
  ): void {
    const oldName = oldFile.replace(/\.(js|jsx)$/, '');
    const newName = newFile.replace(/\.(ts|tsx)$/, '');

    if (oldName === newName) return;

    for (const [, node] of plan.graph.nodes) {
      if (node.importedBy.includes(oldFile) || node.imports.includes(oldFile)) {
        const filePath = node.filePath;
        if (fs.existsSync(filePath)) {
          let content = fs.readFileSync(filePath, 'utf-8');
          content = content.replace(
            new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            newName
          );
          fs.writeFileSync(filePath, content);
        }
      }
    }
  }

  private getRelativePath(absolutePath: string): string {
    return path.relative(this.config.targetDir, absolutePath);
  }
}
