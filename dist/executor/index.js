"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationExecutor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const transformers_1 = require("../transformers");
const git_1 = require("../utils/git");
const test_runner_1 = require("../utils/test-runner");
const ai_1 = require("../utils/ai");
const dashboard_1 = require("../dashboard");
class MigrationExecutor {
    constructor(config) {
        this.ai = null;
        this.config = config;
        if (config.aiAssisted) {
            this.ai = new ai_1.AIAssistant(config.ollamaModel, config.ollamaUrl);
        }
        this.transformer = (0, transformers_1.createTransformer)(config.type, this.ai || undefined);
        this.git = new git_1.GitManager(config.targetDir);
        this.testRunner = config.runTests
            ? new test_runner_1.TestRunner(config.targetDir, config.testCommand)
            : null;
        this.dashboard = new dashboard_1.Dashboard();
    }
    async execute(plan) {
        const report = {
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
            const spinner = (0, ora_1.default)('Checking Ollama AI availability...').start();
            const available = await this.ai.checkAvailability();
            if (available) {
                spinner.succeed(chalk_1.default.green('Ollama AI connected — enhanced type inference enabled'));
            }
            else {
                spinner.warn(chalk_1.default.yellow('Ollama not available — falling back to rule-based inference'));
                this.ai = null;
            }
        }
        // Set up git backup if available
        if (this.git.isGitRepo()) {
            const spinner = (0, ora_1.default)('Creating git backup...').start();
            try {
                const branch = this.git.createBackupBranch('pre-migration');
                spinner.succeed(`Backup branch created: ${chalk_1.default.gray(branch)}`);
            }
            catch {
                spinner.warn('Could not create backup branch — proceeding without backup');
            }
        }
        this.dashboard.init(plan);
        console.log('');
        console.log(chalk_1.default.bold('  Starting migration...\n'));
        for (const batch of plan.batches) {
            const batchResult = await this.executeBatch(batch.id, batch.files, plan);
            report.batches.push(batchResult);
            for (const result of batchResult.results) {
                if (result.success) {
                    report.migratedFiles++;
                }
                else {
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
    async executeBatch(batchId, files, plan) {
        const results = [];
        const originalContents = new Map();
        const batchSpinner = (0, ora_1.default)(`Batch ${batchId}/${plan.batches.length}: Migrating ${files.length} files...`).start();
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
                    this.updateImportReferences(plan, file, this.getRelativePath(transformResult.newFilePath));
                }
                results.push({
                    file,
                    success: true,
                    changes: transformResult.changes,
                    linesAdded: transformResult.linesAdded,
                    linesRemoved: transformResult.linesRemoved,
                });
            }
            catch (error) {
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
                batchSpinner.fail(`Batch ${batchId}: ${chalk_1.default.red('Tests failed')} — rolling back`);
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
                    const newPath = r.file.replace(/\.(js|jsx)$/, (m) => m === '.jsx' ? '.tsx' : '.ts');
                    return [original, path.join(this.config.targetDir, newPath)];
                });
                this.git.commitBatch(batchId, allFiles);
            }
            catch {
                // git commit is best-effort
            }
        }
        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;
        batchSpinner.succeed(`Batch ${batchId}: ${chalk_1.default.green(`${successCount} migrated`)}${failCount > 0 ? `, ${chalk_1.default.red(`${failCount} failed`)}` : ''} ${chalk_1.default.gray(`(tests: ${testsPass ? 'passed' : 'skipped'})`)}`);
        return { batchId, results, testsPass, rolledBack: false };
    }
    rollbackBatch(files, originalContents) {
        for (const file of files) {
            const original = originalContents.get(file);
            if (original) {
                // Remove any new files created
                const newPath = original.path.replace(/\.(js|jsx)$/, (m) => m === '.jsx' ? '.tsx' : '.ts');
                if (fs.existsSync(newPath) && newPath !== original.path) {
                    fs.unlinkSync(newPath);
                }
                // Restore original
                fs.writeFileSync(original.path, original.content);
            }
        }
    }
    updateImportReferences(plan, oldFile, newFile) {
        const oldName = oldFile.replace(/\.(js|jsx)$/, '');
        const newName = newFile.replace(/\.(ts|tsx)$/, '');
        if (oldName === newName)
            return;
        for (const [, node] of plan.graph.nodes) {
            if (node.importedBy.includes(oldFile) || node.imports.includes(oldFile)) {
                const filePath = node.filePath;
                if (fs.existsSync(filePath)) {
                    let content = fs.readFileSync(filePath, 'utf-8');
                    content = content.replace(new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newName);
                    fs.writeFileSync(filePath, content);
                }
            }
        }
    }
    getRelativePath(absolutePath) {
        return path.relative(this.config.targetDir, absolutePath);
    }
}
exports.MigrationExecutor = MigrationExecutor;
//# sourceMappingURL=index.js.map