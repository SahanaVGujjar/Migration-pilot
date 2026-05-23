import chalk from 'chalk';
import { MigrationPlan, MigrationReport } from '../types';

export class Dashboard {
  private plan: MigrationPlan | null = null;
  private startTime: number = 0;

  init(plan: MigrationPlan): void {
    this.plan = plan;
    this.startTime = Date.now();
  }

  updateProgress(report: MigrationReport): void {
    if (!this.plan) return;

    const total = report.totalFiles;
    const migrated = report.migratedFiles;
    const failed = report.failedFiles;
    const rolledBack = report.rolledBackFiles;
    const remaining = total - migrated - failed;
    const elapsed = Date.now() - this.startTime;
    const percentage = Math.round((migrated / total) * 100);

    const barWidth = 30;
    const filledWidth = Math.round((migrated / total) * barWidth);
    const failedWidth = Math.round((failed / total) * barWidth);
    const emptyWidth = barWidth - filledWidth - failedWidth;

    const progressBar =
      chalk.green('█'.repeat(filledWidth)) +
      chalk.red('█'.repeat(failedWidth)) +
      chalk.gray('░'.repeat(Math.max(0, emptyWidth)));

    console.log('');
    console.log(chalk.bold.cyan('  ─── Migration Progress ───────────────────'));
    console.log('');
    console.log(`  ${progressBar} ${chalk.bold(`${percentage}%`)}`);
    console.log('');
    console.log(
      `  ${chalk.green('✓')} Migrated:    ${chalk.green.bold(migrated.toString().padStart(4))} / ${total}`
    );
    if (failed > 0) {
      console.log(
        `  ${chalk.red('✗')} Failed:      ${chalk.red.bold(failed.toString().padStart(4))} / ${total}`
      );
    }
    if (rolledBack > 0) {
      console.log(
        `  ${chalk.yellow('↺')} Rolled back: ${chalk.yellow.bold(rolledBack.toString().padStart(4))} / ${total}`
      );
    }
    console.log(
      `  ${chalk.gray('○')} Remaining:   ${chalk.gray(remaining.toString().padStart(4))} / ${total}`
    );
    console.log('');
    console.log(
      `  ${chalk.gray('Elapsed: ' + this.formatDuration(elapsed))}`
    );

    if (migrated > 0) {
      const msPerFile = elapsed / migrated;
      const eta = msPerFile * remaining;
      console.log(`  ${chalk.gray('ETA:     ' + this.formatDuration(eta))}`);
    }

    console.log(chalk.cyan('  ─────────────────────────────────────────'));
  }

  formatReport(report: MigrationReport): string {
    const duration = report.endTime.getTime() - report.startTime.getTime();
    const lines: string[] = [];

    lines.push('');
    lines.push(chalk.bold.cyan('╔══════════════════════════════════════════════════╗'));
    lines.push(chalk.bold.cyan('║           📊 MIGRATION REPORT                   ║'));
    lines.push(chalk.bold.cyan('╚══════════════════════════════════════════════════╝'));
    lines.push('');

    // Summary
    const successRate = Math.round(
      (report.migratedFiles / report.totalFiles) * 100
    );
    const statusColor =
      successRate === 100 ? chalk.green : successRate > 80 ? chalk.yellow : chalk.red;

    lines.push(`  ${chalk.bold('Status:')}       ${statusColor(successRate === 100 ? 'COMPLETE ✓' : `${successRate}% COMPLETE`)}`);
    lines.push(`  ${chalk.bold('Migration:')}    ${chalk.cyan(report.type)}`);
    lines.push(`  ${chalk.bold('Duration:')}     ${this.formatDuration(duration)}`);
    lines.push('');

    // Stats
    lines.push(chalk.bold('  Files:'));
    lines.push(`    ${chalk.green('✓')} Migrated:     ${chalk.green.bold(report.migratedFiles.toString())}`);
    lines.push(`    ${chalk.red('✗')} Failed:        ${chalk.red.bold(report.failedFiles.toString())}`);
    lines.push(`    ${chalk.yellow('↺')} Rolled back:   ${chalk.yellow.bold(report.rolledBackFiles.toString())}`);
    lines.push(`    ${chalk.gray('○')} Total:         ${chalk.bold(report.totalFiles.toString())}`);
    lines.push('');

    // Batch details
    lines.push(chalk.bold('  Batches:'));
    for (const batch of report.batches) {
      const batchSuccess = batch.results.filter((r) => r.success).length;
      const batchTotal = batch.results.length;
      const batchStatus = batch.rolledBack
        ? chalk.yellow('↺ rolled back')
        : !batch.testsPass
          ? chalk.red('✗ tests failed')
          : chalk.green('✓ complete');

      lines.push(
        `    Batch ${batch.batchId}: ${batchSuccess}/${batchTotal} files ${batchStatus}`
      );
    }

    // Files needing manual review
    if (report.needsManualReview.length > 0) {
      lines.push('');
      lines.push(chalk.bold.yellow('  ⚠ Files needing manual review:'));
      for (const file of report.needsManualReview) {
        lines.push(`    ${chalk.yellow('→')} ${file}`);
      }
    }

    lines.push('');
    lines.push(chalk.gray('  Report saved to .migration-pilot/report.json'));
    lines.push('');

    return lines.join('\n');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
}
