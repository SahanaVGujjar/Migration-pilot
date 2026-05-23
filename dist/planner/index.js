"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationPlanner = void 0;
const chalk_1 = __importDefault(require("chalk"));
class MigrationPlanner {
    constructor(config) {
        this.config = config;
    }
    createPlan(graph) {
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
    createBatches(files, batchSize) {
        const batches = [];
        for (let i = 0; i < files.length; i += batchSize) {
            batches.push({
                id: batches.length + 1,
                files: files.slice(i, i + batchSize),
                status: 'pending',
            });
        }
        return batches;
    }
    estimateTime(totalFiles, totalBatches) {
        // ~2 seconds per file for transformation, ~10 seconds per batch for tests
        const transformTime = totalFiles * 2;
        const testTime = totalBatches * 10;
        const totalSeconds = transformTime + testTime;
        if (totalSeconds < 60)
            return `~${totalSeconds} seconds`;
        if (totalSeconds < 3600)
            return `~${Math.ceil(totalSeconds / 60)} minutes`;
        return `~${(totalSeconds / 3600).toFixed(1)} hours`;
    }
    formatPlan(plan) {
        const lines = [];
        lines.push('');
        lines.push(chalk_1.default.bold.cyan('╔══════════════════════════════════════════╗'));
        lines.push(chalk_1.default.bold.cyan('║        📋 MIGRATION PLAN                ║'));
        lines.push(chalk_1.default.bold.cyan('╚══════════════════════════════════════════╝'));
        lines.push('');
        lines.push(`  ${chalk_1.default.bold('Migration Type:')}  ${chalk_1.default.yellow(this.config.type)}`);
        lines.push(`  ${chalk_1.default.bold('Total Files:')}     ${chalk_1.default.cyan(plan.totalFiles.toString())}`);
        lines.push(`  ${chalk_1.default.bold('Total Batches:')}   ${chalk_1.default.cyan(plan.batches.length.toString())}`);
        lines.push(`  ${chalk_1.default.bold('Batch Size:')}      ${chalk_1.default.cyan(this.config.batchSize.toString())} files`);
        lines.push(`  ${chalk_1.default.bold('Est. Time:')}       ${chalk_1.default.yellow(plan.estimatedTime)}`);
        lines.push(`  ${chalk_1.default.bold('Test Command:')}    ${chalk_1.default.gray(this.config.testCommand || 'none')}`);
        lines.push(`  ${chalk_1.default.bold('AI Assisted:')}     ${this.config.aiAssisted ? chalk_1.default.green('Yes (Ollama)') : chalk_1.default.gray('No')}`);
        lines.push('');
        lines.push(chalk_1.default.bold('  Batch Breakdown:'));
        for (const batch of plan.batches.slice(0, 5)) {
            lines.push(`    ${chalk_1.default.gray(`Batch ${batch.id}:`)} ${batch.files.length} files — ${batch.files.slice(0, 3).map((f) => chalk_1.default.gray(f)).join(', ')}${batch.files.length > 3 ? chalk_1.default.gray(` +${batch.files.length - 3} more`) : ''}`);
        }
        if (plan.batches.length > 5) {
            lines.push(chalk_1.default.gray(`    ... and ${plan.batches.length - 5} more batches`));
        }
        lines.push('');
        return lines.join('\n');
    }
}
exports.MigrationPlanner = MigrationPlanner;
//# sourceMappingURL=index.js.map