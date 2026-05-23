"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dashboard = void 0;
const chalk_1 = __importDefault(require("chalk"));
class Dashboard {
    constructor() {
        this.plan = null;
        this.startTime = 0;
    }
    init(plan) {
        this.plan = plan;
        this.startTime = Date.now();
    }
    updateProgress(report) {
        if (!this.plan)
            return;
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
        const progressBar = chalk_1.default.green('█'.repeat(filledWidth)) +
            chalk_1.default.red('█'.repeat(failedWidth)) +
            chalk_1.default.gray('░'.repeat(Math.max(0, emptyWidth)));
        console.log('');
        console.log(chalk_1.default.bold.cyan('  ─── Migration Progress ───────────────────'));
        console.log('');
        console.log(`  ${progressBar} ${chalk_1.default.bold(`${percentage}%`)}`);
        console.log('');
        console.log(`  ${chalk_1.default.green('✓')} Migrated:    ${chalk_1.default.green.bold(migrated.toString().padStart(4))} / ${total}`);
        if (failed > 0) {
            console.log(`  ${chalk_1.default.red('✗')} Failed:      ${chalk_1.default.red.bold(failed.toString().padStart(4))} / ${total}`);
        }
        if (rolledBack > 0) {
            console.log(`  ${chalk_1.default.yellow('↺')} Rolled back: ${chalk_1.default.yellow.bold(rolledBack.toString().padStart(4))} / ${total}`);
        }
        console.log(`  ${chalk_1.default.gray('○')} Remaining:   ${chalk_1.default.gray(remaining.toString().padStart(4))} / ${total}`);
        console.log('');
        console.log(`  ${chalk_1.default.gray('Elapsed: ' + this.formatDuration(elapsed))}`);
        if (migrated > 0) {
            const msPerFile = elapsed / migrated;
            const eta = msPerFile * remaining;
            console.log(`  ${chalk_1.default.gray('ETA:     ' + this.formatDuration(eta))}`);
        }
        console.log(chalk_1.default.cyan('  ─────────────────────────────────────────'));
    }
    formatReport(report) {
        const duration = report.endTime.getTime() - report.startTime.getTime();
        const lines = [];
        lines.push('');
        lines.push(chalk_1.default.bold.cyan('╔══════════════════════════════════════════════════╗'));
        lines.push(chalk_1.default.bold.cyan('║           📊 MIGRATION REPORT                   ║'));
        lines.push(chalk_1.default.bold.cyan('╚══════════════════════════════════════════════════╝'));
        lines.push('');
        // Summary
        const successRate = Math.round((report.migratedFiles / report.totalFiles) * 100);
        const statusColor = successRate === 100 ? chalk_1.default.green : successRate > 80 ? chalk_1.default.yellow : chalk_1.default.red;
        lines.push(`  ${chalk_1.default.bold('Status:')}       ${statusColor(successRate === 100 ? 'COMPLETE ✓' : `${successRate}% COMPLETE`)}`);
        lines.push(`  ${chalk_1.default.bold('Migration:')}    ${chalk_1.default.cyan(report.type)}`);
        lines.push(`  ${chalk_1.default.bold('Duration:')}     ${this.formatDuration(duration)}`);
        lines.push('');
        // Stats
        lines.push(chalk_1.default.bold('  Files:'));
        lines.push(`    ${chalk_1.default.green('✓')} Migrated:     ${chalk_1.default.green.bold(report.migratedFiles.toString())}`);
        lines.push(`    ${chalk_1.default.red('✗')} Failed:        ${chalk_1.default.red.bold(report.failedFiles.toString())}`);
        lines.push(`    ${chalk_1.default.yellow('↺')} Rolled back:   ${chalk_1.default.yellow.bold(report.rolledBackFiles.toString())}`);
        lines.push(`    ${chalk_1.default.gray('○')} Total:         ${chalk_1.default.bold(report.totalFiles.toString())}`);
        lines.push('');
        // Batch details
        lines.push(chalk_1.default.bold('  Batches:'));
        for (const batch of report.batches) {
            const batchSuccess = batch.results.filter((r) => r.success).length;
            const batchTotal = batch.results.length;
            const batchStatus = batch.rolledBack
                ? chalk_1.default.yellow('↺ rolled back')
                : !batch.testsPass
                    ? chalk_1.default.red('✗ tests failed')
                    : chalk_1.default.green('✓ complete');
            lines.push(`    Batch ${batch.batchId}: ${batchSuccess}/${batchTotal} files ${batchStatus}`);
        }
        // Files needing manual review
        if (report.needsManualReview.length > 0) {
            lines.push('');
            lines.push(chalk_1.default.bold.yellow('  ⚠ Files needing manual review:'));
            for (const file of report.needsManualReview) {
                lines.push(`    ${chalk_1.default.yellow('→')} ${file}`);
            }
        }
        lines.push('');
        lines.push(chalk_1.default.gray('  Report saved to .migration-pilot/report.json'));
        lines.push('');
        return lines.join('\n');
    }
    formatDuration(ms) {
        if (ms < 1000)
            return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60)
            return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        if (minutes < 60)
            return `${minutes}m ${remainingSeconds}s`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
}
exports.Dashboard = Dashboard;
//# sourceMappingURL=index.js.map