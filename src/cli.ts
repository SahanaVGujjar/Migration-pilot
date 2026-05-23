import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { MigrationConfig, MigrationType } from './types';
import { CodebaseScanner } from './scanner';
import { MigrationPlanner } from './planner';
import { MigrationExecutor } from './executor';
import { Dashboard } from './dashboard';
import { TestRunner } from './utils/test-runner';

const BANNER = `
${chalk.cyan.bold('  ╔═══════════════════════════════════════════════╗')}
${chalk.cyan.bold('  ║')}  ${chalk.bold.white('✈  migration-pilot')}                           ${chalk.cyan.bold('║')}
${chalk.cyan.bold('  ║')}  ${chalk.gray('Automated Language/Framework Migration')}        ${chalk.cyan.bold('║')}
${chalk.cyan.bold('  ╚═══════════════════════════════════════════════╝')}
`;

export function createCLI(): Command {
  const program = new Command();

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
    .action(async (type: string, options) => {
      console.log(BANNER);

      // Validate migration type
      const validTypes: MigrationType[] = ['js-to-ts', 'class-to-hooks'];
      if (!validTypes.includes(type as MigrationType)) {
        console.error(
          chalk.red(
            `\n  Invalid migration type: "${type}"\n  Valid types: ${validTypes.join(', ')}\n`
          )
        );
        process.exit(1);
      }

      const targetDir = path.resolve(options.dir);
      if (!fs.existsSync(targetDir)) {
        console.error(chalk.red(`\n  Directory not found: ${targetDir}\n`));
        process.exit(1);
      }

      // Auto-detect test command
      let testCommand = options.testCommand;
      if (!testCommand && options.tests !== false) {
        const testRunner = new TestRunner(targetDir, '');
        const detected = testRunner.detectTestCommand();
        if (detected) {
          console.log(chalk.gray(`  Auto-detected test command: ${detected}\n`));
          testCommand = detected;
        } else {
          console.log(
            chalk.gray('  No test command detected. Use --test-command to specify one.\n')
          );
        }
      }

      const config: MigrationConfig = {
        type: type as MigrationType,
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
        console.log(chalk.bold('  Phase 1: Scanning codebase\n'));
        const scanner = new CodebaseScanner(targetDir, config.type);
        const graph = await scanner.scan();

        if (graph.migrationOrder.length === 0) {
          console.log(
            chalk.yellow('\n  No files found to migrate. Check your target directory.\n')
          );
          process.exit(0);
        }

        // Phase 2: Plan
        console.log(chalk.bold('\n  Phase 2: Creating migration plan\n'));
        const planner = new MigrationPlanner(config);
        const plan = planner.createPlan(graph);
        console.log(planner.formatPlan(plan));

        if (config.dryRun) {
          console.log(
            chalk.yellow('  Dry run mode — no files were modified.\n')
          );
          console.log(chalk.bold('  Files to be migrated:\n'));
          for (const file of graph.migrationOrder) {
            const node = graph.nodes.get(file)!;
            const deps = node.imports.length;
            const depLabel = deps > 0 ? chalk.gray(` (${deps} imports)`) : '';
            console.log(`    ${chalk.cyan('→')} ${file}${depLabel}`);
          }
          console.log('');
          process.exit(0);
        }

        // Phase 3: Execute
        console.log(chalk.bold('  Phase 3: Executing migration\n'));
        const executor = new MigrationExecutor(config);
        const report = await executor.execute(plan);

        // Phase 4: Report
        const dashboard = new Dashboard();
        console.log(dashboard.formatReport(report));

        // Save report
        const reportDir = path.join(targetDir, '.migration-pilot');
        fs.mkdirSync(reportDir, { recursive: true });
        fs.writeFileSync(
          path.join(reportDir, 'report.json'),
          JSON.stringify(report, null, 2)
        );

        // Exit code
        if (report.failedFiles > 0) {
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(`\n  Error: ${error.message}\n`));
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
    .action(async (type: string, options) => {
      console.log(BANNER);

      const targetDir = path.resolve(options.dir);
      const scanner = new CodebaseScanner(targetDir, type as MigrationType);
      const graph = await scanner.scan();

      console.log(chalk.bold('\n  Dependency Graph:\n'));

      const maxDepth = Math.max(
        ...Array.from(graph.nodes.values()).map((n) => n.depth)
      );

      for (let depth = 0; depth <= maxDepth; depth++) {
        const filesAtDepth = Array.from(graph.nodes.values()).filter(
          (n) => n.depth === depth
        );
        if (filesAtDepth.length > 0) {
          console.log(chalk.bold(`  Depth ${depth}:`));
          for (const node of filesAtDepth) {
            const imported = node.importedBy.length;
            const imports = node.imports.length;
            const badge =
              imported === 0
                ? chalk.green(' [root]')
                : imports === 0
                  ? chalk.blue(' [leaf]')
                  : '';
            console.log(
              `    ${'  '.repeat(depth)}${chalk.cyan('→')} ${node.relativePath}${badge} ${chalk.gray(`(→${imports} ←${imported})`)}`
            );
          }
        }
      }

      console.log(
        `\n  ${chalk.bold('Migration order:')} ${graph.migrationOrder.length} files (leaves first)\n`
      );
    });

  program
    .command('report')
    .description('View the last migration report')
    .option('-d, --dir <path>', 'Target directory', '.')
    .action((options) => {
      console.log(BANNER);

      const reportPath = path.join(
        path.resolve(options.dir),
        '.migration-pilot',
        'report.json'
      );

      if (!fs.existsSync(reportPath)) {
        console.log(
          chalk.yellow('\n  No migration report found. Run a migration first.\n')
        );
        process.exit(0);
      }

      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      report.startTime = new Date(report.startTime);
      report.endTime = new Date(report.endTime);

      const dashboard = new Dashboard();
      console.log(dashboard.formatReport(report));
    });

  return program;
}
