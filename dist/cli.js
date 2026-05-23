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
exports.createCLI = createCLI;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const scanner_1 = require("./scanner");
const planner_1 = require("./planner");
const executor_1 = require("./executor");
const dashboard_1 = require("./dashboard");
const test_runner_1 = require("./utils/test-runner");
const BANNER = `
${chalk_1.default.cyan.bold('  ╔═══════════════════════════════════════════════╗')}
${chalk_1.default.cyan.bold('  ║')}  ${chalk_1.default.bold.white('✈  migration-pilot')}                           ${chalk_1.default.cyan.bold('║')}
${chalk_1.default.cyan.bold('  ║')}  ${chalk_1.default.gray('Automated Language/Framework Migration')}        ${chalk_1.default.cyan.bold('║')}
${chalk_1.default.cyan.bold('  ╚═══════════════════════════════════════════════╝')}
`;
function createCLI() {
    const program = new commander_1.Command();
    program
        .name('migration-pilot')
        .description('Automated Language/Framework Migration Assistant')
        .version('1.0.0');
    program
        .command('migrate')
        .description('Start a migration')
        .argument('<type>', 'Migration type: js-to-ts, class-to-hooks')
        .option('-d, --dir <path>', 'Target directory', '.')
        .option('-b, --batch-size <number>', 'Files per batch', '10')
        .option('-t, --test-command <command>', 'Test command to run after each batch')
        .option('--no-tests', 'Skip running tests between batches')
        .option('--dry-run', 'Show migration plan without executing')
        .option('--ai', 'Enable AI-assisted type inference (requires Ollama)')
        .option('--ai-model <model>', 'Ollama model to use', 'codellama')
        .option('--ai-url <url>', 'Ollama API URL', 'http://localhost:11434')
        .action(async (type, options) => {
        console.log(BANNER);
        // Validate migration type
        const validTypes = ['js-to-ts', 'class-to-hooks'];
        if (!validTypes.includes(type)) {
            console.error(chalk_1.default.red(`\n  Invalid migration type: "${type}"\n  Valid types: ${validTypes.join(', ')}\n`));
            process.exit(1);
        }
        const targetDir = path.resolve(options.dir);
        if (!fs.existsSync(targetDir)) {
            console.error(chalk_1.default.red(`\n  Directory not found: ${targetDir}\n`));
            process.exit(1);
        }
        // Auto-detect test command
        let testCommand = options.testCommand;
        if (!testCommand && options.tests !== false) {
            const testRunner = new test_runner_1.TestRunner(targetDir, '');
            const detected = testRunner.detectTestCommand();
            if (detected) {
                console.log(chalk_1.default.gray(`  Auto-detected test command: ${detected}\n`));
                testCommand = detected;
            }
            else {
                console.log(chalk_1.default.gray('  No test command detected. Use --test-command to specify one.\n'));
            }
        }
        const config = {
            type: type,
            targetDir,
            batchSize: parseInt(options.batchSize, 10),
            runTests: options.tests !== false && !!testCommand,
            testCommand: testCommand || '',
            dryRun: options.dryRun || false,
            aiAssisted: options.ai || false,
            ollamaModel: options.aiModel || 'codellama',
            ollamaUrl: options.aiUrl || 'http://localhost:11434',
        };
        try {
            // Phase 1: Scan
            console.log(chalk_1.default.bold('  Phase 1: Scanning codebase\n'));
            const scanner = new scanner_1.CodebaseScanner(targetDir, config.type);
            const graph = await scanner.scan();
            if (graph.migrationOrder.length === 0) {
                console.log(chalk_1.default.yellow('\n  No files found to migrate. Check your target directory.\n'));
                process.exit(0);
            }
            // Phase 2: Plan
            console.log(chalk_1.default.bold('\n  Phase 2: Creating migration plan\n'));
            const planner = new planner_1.MigrationPlanner(config);
            const plan = planner.createPlan(graph);
            console.log(planner.formatPlan(plan));
            if (config.dryRun) {
                console.log(chalk_1.default.yellow('  Dry run mode — no files were modified.\n'));
                console.log(chalk_1.default.bold('  Files to be migrated:\n'));
                for (const file of graph.migrationOrder) {
                    const node = graph.nodes.get(file);
                    const deps = node.imports.length;
                    const depLabel = deps > 0 ? chalk_1.default.gray(` (${deps} imports)`) : '';
                    console.log(`    ${chalk_1.default.cyan('→')} ${file}${depLabel}`);
                }
                console.log('');
                process.exit(0);
            }
            // Phase 3: Execute
            console.log(chalk_1.default.bold('  Phase 3: Executing migration\n'));
            const executor = new executor_1.MigrationExecutor(config);
            const report = await executor.execute(plan);
            // Phase 4: Report
            const dashboard = new dashboard_1.Dashboard();
            console.log(dashboard.formatReport(report));
            // Save report
            const reportDir = path.join(targetDir, '.migration-pilot');
            fs.mkdirSync(reportDir, { recursive: true });
            fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
            // Exit code
            if (report.failedFiles > 0) {
                process.exit(1);
            }
        }
        catch (error) {
            console.error(chalk_1.default.red(`\n  Error: ${error.message}\n`));
            if (process.env.DEBUG) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    });
    program
        .command('scan')
        .description('Scan codebase and show dependency graph')
        .argument('<type>', 'Migration type: js-to-ts, class-to-hooks')
        .option('-d, --dir <path>', 'Target directory', '.')
        .action(async (type, options) => {
        console.log(BANNER);
        const targetDir = path.resolve(options.dir);
        const scanner = new scanner_1.CodebaseScanner(targetDir, type);
        const graph = await scanner.scan();
        console.log(chalk_1.default.bold('\n  Dependency Graph:\n'));
        const maxDepth = Math.max(...Array.from(graph.nodes.values()).map((n) => n.depth));
        for (let depth = 0; depth <= maxDepth; depth++) {
            const filesAtDepth = Array.from(graph.nodes.values()).filter((n) => n.depth === depth);
            if (filesAtDepth.length > 0) {
                console.log(chalk_1.default.bold(`  Depth ${depth}:`));
                for (const node of filesAtDepth) {
                    const imported = node.importedBy.length;
                    const imports = node.imports.length;
                    const badge = imported === 0
                        ? chalk_1.default.green(' [root]')
                        : imports === 0
                            ? chalk_1.default.blue(' [leaf]')
                            : '';
                    console.log(`    ${'  '.repeat(depth)}${chalk_1.default.cyan('→')} ${node.relativePath}${badge} ${chalk_1.default.gray(`(→${imports} ←${imported})`)}`);
                }
            }
        }
        console.log(`\n  ${chalk_1.default.bold('Migration order:')} ${graph.migrationOrder.length} files (leaves first)\n`);
    });
    program
        .command('report')
        .description('View the last migration report')
        .option('-d, --dir <path>', 'Target directory', '.')
        .action((options) => {
        console.log(BANNER);
        const reportPath = path.join(path.resolve(options.dir), '.migration-pilot', 'report.json');
        if (!fs.existsSync(reportPath)) {
            console.log(chalk_1.default.yellow('\n  No migration report found. Run a migration first.\n'));
            process.exit(0);
        }
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
        report.startTime = new Date(report.startTime);
        report.endTime = new Date(report.endTime);
        const dashboard = new dashboard_1.Dashboard();
        console.log(dashboard.formatReport(report));
    });
    return program;
}
//# sourceMappingURL=cli.js.map