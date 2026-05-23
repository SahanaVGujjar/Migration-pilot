import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import {
  BatchResult,
  MigrationConfig,
  MigrationPlan,
  MigrationReport,
  MigrationResult,
  TokenUsage,
} from '../core/types';
import { SymbolRegistry } from '../graph/symbol-registry';
import { createLLMProviderFromSettings } from '../llm/provider';
import { resolveLLMFromEnv } from '../llm/env-config';
import { getProfile } from '../profiles/registry';
import { LLMTransformer } from '../transform/llm-transformer';
import { GitManager } from '../utils/git';
import { TestRunner } from '../utils/test-runner';
import { Dashboard } from '../report/dashboard';
import { RollbackManager } from './rollback';
import { Validator, formatValidatorResult } from './validator';

export class MigrationExecutor {
  private registry = new SymbolRegistry();
  private rollback = new RollbackManager();
  private dashboard = new Dashboard();
  private git: GitManager;

  constructor(private config: MigrationConfig) {
    this.git = new GitManager(config.outputDir);
  }

  async execute(plan: MigrationPlan): Promise<MigrationReport> {
    const profile = getProfile(this.config.profileId);
    const report: MigrationReport = {
      profileId: this.config.profileId,
      startTime: new Date(),
      endTime: new Date(),
      totalFiles: plan.totalFiles,
      migratedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      rolledBackFiles: 0,
      batches: [],
      needsManualReview: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cached: false },
      stoppedByTokenLimit: false,
    };

    let llm = null;
    if (this.config.aiEnabled) {
      const llmSettings = resolveLLMFromEnv({
        provider: this.config.provider,
        model: this.config.model,
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
      });
      llm = createLLMProviderFromSettings(llmSettings);
      const spinner = ora(`Checking ${llmSettings.provider} availability...`).start();
      const available = await llm.checkAvailability();
      if (available) {
        spinner.succeed(chalk.green(`${llmSettings.provider} connected (${this.config.model})`));
      } else {
        spinner.warn(chalk.yellow(`${llmSettings.provider} unavailable — using rules-only mode`));
        llm = null;
      }
    }

    if (profile.id === 'js-to-ts' || profile.id === 'ts-to-js') {
      new Validator(this.config.outputDir, profile).ensureTsConfig();
    }

    if (this.config.useGit && this.git.isGitRepo()) {
      const spinner = ora('Creating git backup in destination...').start();
      try {
        const branch = this.git.createBackupBranch('pre-migration');
        spinner.succeed(`Backup branch: ${chalk.gray(branch)}`);
      } catch {
        spinner.warn('Could not create backup branch in destination');
      }
    }

    const transformer = new LLMTransformer(this.config, profile, llm);
    let testCommand = this.config.testCommand;
    if (this.config.runTests && !testCommand) {
      testCommand = new TestRunner(this.config.outputDir, '').detectTestCommand() || '';
    }
    const testRunner =
      this.config.runTests && testCommand
        ? new TestRunner(this.config.outputDir, testCommand)
        : null;

    this.dashboard.init(plan);

    for (const batch of plan.batches) {
      if (report.tokenUsage.totalTokens >= this.config.maxTokens) {
        report.stoppedByTokenLimit = true;
        console.log(chalk.yellow(`\n  Token limit reached (${this.config.maxTokens}). Stopping.`));
        break;
      }

      batch.status = 'in_progress';
      const batchResult = await this.executeBatch(batch, plan, transformer, testRunner, profile.validators.length > 0);
      report.batches.push(batchResult);

      this.mergeTokenUsage(report.tokenUsage, batchResult.tokenUsage);

      for (const result of batchResult.results) {
        if (batchResult.rolledBack) {
          report.rolledBackFiles += result.success ? 1 : 0;
        } else if (result.success) {
          report.migratedFiles++;
        } else {
          report.failedFiles++;
        }
      }

      batch.status = batchResult.rolledBack ? 'rolled_back' : batchResult.results.every((r) => r.success) ? 'completed' : 'failed';
      this.dashboard.updateProgress(report);
    }

    report.endTime = new Date();
    report.tokenUsage = transformer.getTokenUsage();

    this.saveReport(report);

    if (report.migratedFiles > 0) {
      console.log(chalk.green(`\n  Output written to: ${chalk.bold(this.config.outputDir)}`));
    }

    console.log(this.dashboard.formatReport(report));

    return report;
  }

  private sourcePath(relativePath: string): string {
    return path.join(this.config.sourceDir, relativePath.replace(/\\/g, '/'));
  }

  private outputPath(relativePath: string): string {
    return path.join(this.config.outputDir, relativePath.replace(/\\/g, '/'));
  }

  private async executeBatch(
    batch: MigrationPlan['batches'][0],
    plan: MigrationPlan,
    transformer: LLMTransformer,
    testRunner: TestRunner | null,
    runValidators: boolean
  ): Promise<BatchResult> {
    const profile = getProfile(this.config.profileId);
    const results: MigrationResult[] = [];
    const batchTokenUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cached: false,
    };

    this.rollback.snapshotBatch(batch.id, batch.files, this.config.outputDir);

    for (const file of batch.files) {
      const node = plan.graph.nodes.get(file)!;
      const spinner = ora(`Migrating ${chalk.cyan(file)}`).start();

      try {
        const content = fs.readFileSync(this.sourcePath(file), 'utf-8');
        const result = await transformer.transformFile(file, content, this.registry);

        const targetFullPath = this.outputPath(result.targetPath);
        fs.mkdirSync(path.dirname(targetFullPath), { recursive: true });
        fs.writeFileSync(targetFullPath, result.code);

        this.rollback.trackCreatedFile(batch.id, result.targetPath, this.config.outputDir);
        this.updateImportPaths(plan, file, result.targetPath);

        const updatedNode = {
          ...node,
          relativePath: result.targetPath,
          filePath: targetFullPath,
        };
        plan.graph.nodes.delete(file);
        plan.graph.nodes.set(result.targetPath, updatedNode);

        this.registry.register(file, result.targetPath, result.exports);
        node.status = 'migrated';

        results.push({
          file,
          targetFile: result.targetPath,
          success: true,
          changes: result.changes,
          tokenUsage: result.tokenUsage,
          usedLLM: result.usedLLM,
          cacheHit: result.cacheHit,
        });

        this.mergeTokenUsage(batchTokenUsage, result.tokenUsage || batchTokenUsage);

        const mode = result.cacheHit ? 'cached' : result.usedLLM ? 'LLM' : 'rules';
        spinner.succeed(`${chalk.green('✓')} ${file} → ${result.targetPath} (${mode})`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        node.status = 'failed';
        node.error = message;
        results.push({
          file,
          targetFile: file,
          success: false,
          changes: [],
          error: message,
          usedLLM: false,
          cacheHit: false,
        });
        spinner.fail(`${chalk.red('✗')} ${file}: ${message}`);
      }
    }

    let validatorsPass = true;
    let testsPass = true;

    if (this.config.runTests && runValidators && results.some((r) => r.success)) {
      const validator = new Validator(this.config.outputDir, profile);
      const validation = await validator.runValidators();
      validatorsPass = validation.passed;
      console.log(`  ${formatValidatorResult(validatorsPass, validation.output)}`);
    }

    if (testRunner && results.some((r) => r.success)) {
      const spinner = ora('Running tests...').start();
      const testResult = await testRunner.runTests();
      testsPass = testResult.passed;
      spinner.info(testRunner.formatResult(testResult));
    }

    let rolledBack = false;
    if (!validatorsPass || !testsPass) {
      this.rollback.rollbackBatch(batch.id);
      rolledBack = true;
      for (const r of results) {
        const key = r.targetFile || r.file;
        const n = plan.graph.nodes.get(key) || plan.graph.nodes.get(r.file);
        if (n && r.success) n.status = 'rolled_back';
      }
      console.log(chalk.yellow(`  ↺ Batch ${batch.id} rolled back`));
    } else if (this.config.useGit && this.git.isGitRepo()) {
      try {
        this.git.commitBatch(
          batch.id,
          results.filter((r) => r.success).map((r) => r.targetFile)
        );
      } catch {
        // non-fatal
      }
    }

    return {
      batchId: batch.id,
      results,
      testsPass,
      validatorsPass,
      rolledBack,
      tokenUsage: batchTokenUsage,
    };
  }

  private updateImportPaths(plan: MigrationPlan, oldPath: string, newPath: string): void {
    const oldNoExt = oldPath.replace(/\.[^.]+$/, '');
    const newNoExt = newPath.replace(/\.[^.]+$/, '');

    for (const [, node] of plan.graph.nodes) {
      if (!node.imports.includes(oldPath)) continue;

      node.imports = node.imports.map((imp) => (imp === oldPath ? newPath : imp));

      const fileOnDisk = this.outputPath(node.relativePath);

      if (!fs.existsSync(fileOnDisk)) continue;

      try {
        let content = fs.readFileSync(fileOnDisk, 'utf-8');
        const escaped = oldNoExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        content = content.replace(
          new RegExp(`(['"\`])(${escaped})(\\.\\w+)?\\1`, 'g'),
          `$1${newNoExt}$1`
        );
        fs.writeFileSync(fileOnDisk, content);
      } catch {
        // skip unreadable files
      }
    }
  }

  private mergeTokenUsage(target: TokenUsage, source: TokenUsage): void {
    target.promptTokens += source.promptTokens;
    target.completionTokens += source.completionTokens;
    target.totalTokens += source.totalTokens;
  }

  private saveReport(report: MigrationReport): void {
    const dir = path.join(this.config.outputDir, '.migration-pilot');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));
  }
}
