import chalk from 'chalk';
import { MigrationConfig, MigrationPlan, MigrationReport } from './types';
import { CodebaseScanner } from '../graph/scanner';
import { MigrationPlanner } from './planner';
import { MigrationExecutor } from '../execute/executor';
import { getProfile } from '../profiles/registry';
import { copyStaticFiles, ensureOutputDir } from './paths';

export class MigrationPipeline {
  async scan(config: MigrationConfig): Promise<MigrationPlan> {
    const profile = getProfile(config.profileId);
    const scanner = new CodebaseScanner(config.sourceDir, profile);
    const graph = await scanner.scan();
    const planner = new MigrationPlanner();
    return planner.createPlan(graph, profile, config.batchSize, config.maxContextTokens);
  }

  async migrate(config: MigrationConfig, options?: { clean?: boolean }): Promise<MigrationReport> {
    console.log(chalk.gray(`  Source:      ${config.sourceDir}`));
    console.log(chalk.gray(`  Destination: ${config.outputDir}\n`));

    const plan = await this.scan(config);

    if (config.dryRun) {
      const planner = new MigrationPlanner();
      planner.displayPlan(plan, config);
      return emptyReport(config);
    }

    ensureOutputDir(config.outputDir, options?.clean ?? false);

    const executor = new MigrationExecutor(config);
    const report = await executor.execute(plan);

    if (config.copyStaticFiles && report.migratedFiles > 0) {
      const profile = getProfile(config.profileId);
      const copied = await copyStaticFiles(config.sourceDir, config.outputDir, profile);
      console.log(chalk.gray(`  Copied ${copied} non-migrated files into destination`));
    }

    return report;
  }
}

function emptyReport(config: MigrationConfig): MigrationReport {
  return {
    profileId: config.profileId,
    startTime: new Date(),
    endTime: new Date(),
    totalFiles: 0,
    migratedFiles: 0,
    failedFiles: 0,
    skippedFiles: 0,
    rolledBackFiles: 0,
    batches: [],
    needsManualReview: [],
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cached: false },
    stoppedByTokenLimit: false,
  };
}
