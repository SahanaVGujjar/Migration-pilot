import chalk from 'chalk';
import { MigrationPlan, MigrationReport } from '../core/types';

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
    const remaining = total - migrated - failed;
    const elapsed = Date.now() - this.startTime;
    const percentage = total > 0 ? Math.round((migrated / total) * 100) : 0;

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
    console.log(`  ${progressBar} ${chalk.bold(`${percentage}%`)}`);
    console.log(
      `  ${chalk.green('✓')} Migrated: ${chalk.green.bold(migrated.toString())} / ${total}  ` +
        `${chalk.gray('○')} Remaining: ${remaining}`
    );
    console.log(
      `  ${chalk.gray('Tokens:')} ${report.tokenUsage.totalTokens.toLocaleString()}  ` +
        `${chalk.gray('Elapsed:')} ${this.formatDuration(elapsed)}`
    );
    console.log(chalk.cyan('  ─────────────────────────────────────────'));
  }

  formatReport(report: MigrationReport): string {
    const duration = report.endTime.getTime() - report.startTime.getTime();
    const lines: string[] = [];

    lines.push('');
    lines.push(chalk.bold.cyan('╔══════════════════════════════════════════════════╗'));
    lines.push(chalk.bold.cyan('║           MIGRATION REPORT                       ║'));
    lines.push(chalk.bold.cyan('╚══════════════════════════════════════════════════╝'));
    lines.push('');
    lines.push(`  ${chalk.bold('Profile:')}     ${chalk.cyan(report.profileId)}`);
    lines.push(`  ${chalk.bold('Duration:')}    ${this.formatDuration(duration)}`);
    lines.push(`  ${chalk.bold('Migrated:')}    ${chalk.green(report.migratedFiles.toString())} / ${report.totalFiles}`);
    lines.push(`  ${chalk.bold('Failed:')}       ${chalk.red(report.failedFiles.toString())}`);
    lines.push(`  ${chalk.bold('Rolled back:')} ${chalk.yellow(report.rolledBackFiles.toString())}`);
    lines.push('');
    lines.push(chalk.bold('  Token Usage:'));
    lines.push(`    Prompt:      ${report.tokenUsage.promptTokens.toLocaleString()}`);
    lines.push(`    Completion:  ${report.tokenUsage.completionTokens.toLocaleString()}`);
    lines.push(`    Total:       ${report.tokenUsage.totalTokens.toLocaleString()}`);
    if (report.stoppedByTokenLimit) {
      lines.push(chalk.yellow('    Stopped: token limit reached'));
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
    return `${minutes}m ${seconds % 60}s`;
  }
}
