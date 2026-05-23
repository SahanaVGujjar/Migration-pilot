import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import * as fs from 'fs';
import * as path from 'path';
import { buildConfig, CLIOptions } from './core/config';
import { MigrationPipeline } from './core/pipeline';
import { MigrationPlanner } from './core/planner';
import { listProfileIds } from './profiles/registry';
import { Dashboard } from './report/dashboard';
import { MigrationReport } from './core/types';

const BANNER = boxen(
  chalk.bold.cyan('migration-pilot') +
    '\n' +
    chalk.gray('Source → destination migration (never modifies source or this repo)'),
  { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
);

function addPathOptions(cmd: Command): Command {
  return cmd
    .requiredOption('--from <path>', 'Source project root (read only)')
    .requiredOption('--to <path>', 'Destination project root (all output written here)');
}

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option('-b, --batch-size <n>', 'Batch size', '5')
    .option('--max-context-tokens <n>', 'Max context tokens per file', '4000');
}

function addMigrateOptions(cmd: Command): Command {
  return cmd
    .option('--max-tokens <n>', 'Total token budget', '50000')
    .option('--clean', 'Remove destination folder before migrating')
    .option('--no-copy-static', 'Do not copy non-source files (package.json, etc.)')
    .option('--git', 'Create git backup/commits in destination repo (off by default)')
    .option('-t, --test-command <cmd>', 'Test command (runs in destination)')
    .option('--no-tests', 'Skip tests and validators')
    .option('--dry-run', 'Preview plan only')
    .option('--no-ai', 'Rules-only mode')
    .option('--provider <name>', 'LLM: ollama|openai|openrouter|groq (or LLM_PROVIDER env)')
    .option('--model <name>', 'Model name (or LLM_MODEL env)')
    .option('--api-key <key>', 'API key')
    .option('--base-url <url>', 'API base URL')
    .option('--cache-dir <path>', 'LLM cache (default: <to>/.migration-pilot/cache)')
    .option('--verbose', 'Show token/debug info', false)
    .option('--expand-context', 'Expand dependency context on retry', false);
}

export function createCLI(): Command {
  const program = new Command();

  program
    .name('migration-pilot')
    .description('Migrate source project to destination (separate folders only)')
    .version('2.0.0');

  const scanCmd = program
    .command('scan')
    .description('Scan source and show dependency graph + token estimates')
    .argument('<profile>', `Migration profile (${listProfileIds().join(', ')})`)
    .option('--verbose', 'Verbose output', false);

  addPathOptions(addCommonOptions(scanCmd)).action(async (profile: string, options: CLIOptions) => {
    console.log(BANNER);
    const config = buildConfig(profile as 'js-to-ts', { ...options, ai: false, dryRun: true });
    config.profileId = profile as typeof config.profileId;

    const pipeline = new MigrationPipeline();
    const plan = await pipeline.scan(config);
    const planner = new MigrationPlanner();
    planner.displayScanResults(plan.graph, profile);
    planner.displayPlan(plan, config);
  });

  const migrateCmd = program
    .command('migrate')
    .description('Migrate source → destination (writes only under --to)')
    .argument('<profile>', `Migration profile (${listProfileIds().join(', ')})`);

  addPathOptions(addCommonOptions(addMigrateOptions(migrateCmd))).action(
    async (profile: string, options: CLIOptions) => {
      console.log(BANNER);
      const config = buildConfig(profile as 'js-to-ts', options);
      config.profileId = profile as typeof config.profileId;

      const pipeline = new MigrationPipeline();
      await pipeline.migrate(config, { clean: options.clean });
    }
  );

  program
    .command('report')
    .description('Show last migration report from a destination folder')
    .requiredOption('--to <path>', 'Destination root where report was written')
    .action((options: { to: string }) => {
      const reportDir = path.resolve(options.to);
      const reportPath = path.join(reportDir, '.migration-pilot', 'report.json');
      if (!fs.existsSync(reportPath)) {
        console.log(chalk.yellow(`No report found at ${reportPath}`));
        return;
      }

      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as MigrationReport;
      report.startTime = new Date(report.startTime);
      report.endTime = new Date(report.endTime);
      const dashboard = new Dashboard();
      console.log(dashboard.formatReport(report));
    });

  program
    .command('profiles')
    .description('List available migration profiles')
    .action(() => {
      console.log(BANNER);
      console.log(chalk.bold('\n  Available profiles:\n'));
      for (const id of listProfileIds()) {
        console.log(`  ${chalk.cyan(id)}`);
      }
      console.log('');
    });

  return program;
}
