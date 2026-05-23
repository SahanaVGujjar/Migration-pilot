import chalk from 'chalk';
import {
  DependencyGraph,
  MigrationBatch,
  MigrationConfig,
  MigrationPlan,
} from '../types';

export class MigrationPlanner {
  private config: MigrationConfig;

  constructor(config: MigrationConfig) {
    this.config = config;
  }

  createPlan(graph: DependencyGraph): MigrationPlan {
    const files = graph.migrationOrder;
    const batches = this.createBatches(files, this.config.batchSize);
    const estimatedTime = this.estimateTime(files.length, batches.length);

    return {
      totalFiles: files.length,
      batches,
      graph,
      estimatedTime,
    };
  }

  private createBatches(files: string[], batchSize: number): MigrationBatch[] {
    const batches: MigrationBatch[] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push({
        id: batches.length + 1,
        files: files.slice(i, i + batchSize),
        status: 'pending',
      });
    }

    return batches;
  }

  private estimateTime(totalFiles: number, totalBatches: number): string {
    // ~2 seconds per file for transformation, ~10 seconds per batch for tests
    const transformTime = totalFiles * 2;
    const testTime = totalBatches * 10;
    const totalSeconds = transformTime + testTime;

    if (totalSeconds < 60) return `~${totalSeconds} seconds`;
    if (totalSeconds < 3600) return `~${Math.ceil(totalSeconds / 60)} minutes`;
    return `~${(totalSeconds / 3600).toFixed(1)} hours`;
  }

  formatPlan(plan: MigrationPlan): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(chalk.bold.cyan('╔══════════════════════════════════════════╗'));
    lines.push(chalk.bold.cyan('║        📋 MIGRATION PLAN                ║'));
    lines.push(chalk.bold.cyan('╚══════════════════════════════════════════╝'));
    lines.push('');

    lines.push(
      `  ${chalk.bold('Migration Type:')}  ${chalk.yellow(this.config.type)}`
    );
    lines.push(
      `  ${chalk.bold('Total Files:')}     ${chalk.cyan(plan.totalFiles.toString())}`
    );
    lines.push(
      `  ${chalk.bold('Total Batches:')}   ${chalk.cyan(plan.batches.length.toString())}`
    );
    lines.push(
      `  ${chalk.bold('Batch Size:')}      ${chalk.cyan(this.config.batchSize.toString())} files`
    );
    lines.push(
      `  ${chalk.bold('Est. Time:')}       ${chalk.yellow(plan.estimatedTime)}`
    );
    lines.push(
      `  ${chalk.bold('Test Command:')}    ${chalk.gray(this.config.testCommand || 'none')}`
    );
    lines.push(
      `  ${chalk.bold('AI Assisted:')}     ${this.config.aiAssisted ? chalk.green('Yes (Ollama)') : chalk.gray('No')}`
    );
    lines.push('');

    lines.push(chalk.bold('  Batch Breakdown:'));
    for (const batch of plan.batches.slice(0, 5)) {
      lines.push(
        `    ${chalk.gray(`Batch ${batch.id}:`)} ${batch.files.length} files — ${batch.files.slice(0, 3).map((f) => chalk.gray(f)).join(', ')}${batch.files.length > 3 ? chalk.gray(` +${batch.files.length - 3} more`) : ''}`
      );
    }
    if (plan.batches.length > 5) {
      lines.push(
        chalk.gray(`    ... and ${plan.batches.length - 5} more batches`)
      );
    }

    lines.push('');
    return lines.join('\n');
  }
}
