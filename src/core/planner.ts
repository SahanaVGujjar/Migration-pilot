import chalk from 'chalk';
import Table from 'cli-table3';
import { DependencyGraph, MigrationBatch, MigrationPlan, MigrationProfile } from '../core/types';
import { computeBatchTokenBudget, estimateTokens } from '../token/budget';

export class MigrationPlanner {
  createPlan(
    graph: DependencyGraph,
    profile: MigrationProfile,
    batchSize: number,
    maxContextTokens: number
  ): MigrationPlan {
    const order = graph.migrationOrder;
    const batches: MigrationBatch[] = [];
    const tokenBudget = computeBatchTokenBudget(maxContextTokens, batchSize);

    let currentBatch: string[] = [];
    let currentTokens = 0;
    let batchId = 1;

    for (const file of order) {
      const node = graph.nodes.get(file)!;
      const fileTokens = node.estimatedTokens + estimateTokens(JSON.stringify(profile.rules));

      if (currentBatch.length >= batchSize || currentTokens + fileTokens > tokenBudget) {
        if (currentBatch.length > 0) {
          batches.push({
            id: batchId++,
            files: currentBatch,
            estimatedTokens: currentTokens,
            status: 'pending',
          });
        }
        currentBatch = [file];
        currentTokens = fileTokens;
      } else {
        currentBatch.push(file);
        currentTokens += fileTokens;
      }
    }

    if (currentBatch.length > 0) {
      batches.push({
        id: batchId,
        files: currentBatch,
        estimatedTokens: currentTokens,
        status: 'pending',
      });
    }

    const totalEstimatedTokens = order.reduce(
      (sum, f) => sum + (graph.nodes.get(f)?.estimatedTokens ?? 0),
      0
    );

    return {
      profileId: profile.id,
      totalFiles: order.length,
      totalEstimatedTokens,
      batches,
      graph,
      estimatedTime: this.estimateTime(order.length, batches.length),
    };
  }

  displayPlan(plan: MigrationPlan, config?: { sourceDir: string; outputDir: string }): void {
    console.log('');
    console.log(chalk.bold.cyan('  ─── Migration Plan ───────────────────────'));
    console.log('');
    if (config) {
      console.log(`  Source:           ${chalk.gray(config.sourceDir)}`);
      console.log(`  Destination:      ${chalk.gray(config.outputDir)}`);
    }
    console.log(`  Profile:          ${chalk.cyan(plan.profileId)}`);
    console.log(`  Total files:      ${chalk.bold(plan.totalFiles.toString())}`);
    console.log(`  Est. tokens:      ${chalk.bold(plan.totalEstimatedTokens.toLocaleString())}`);
    console.log(`  Batches:          ${chalk.bold(plan.batches.length.toString())}`);
    console.log(`  Est. duration:    ${chalk.gray(plan.estimatedTime)}`);
    console.log('');

    const table = new Table({
      head: [
        chalk.cyan('Batch'),
        chalk.cyan('Files'),
        chalk.cyan('Est. Tokens'),
        chalk.cyan('Sample Files'),
      ],
      colWidths: [8, 8, 14, 40],
    });

    for (const batch of plan.batches) {
      const sample = batch.files.slice(0, 2).join(', ') + (batch.files.length > 2 ? '...' : '');
      table.push([
        batch.id.toString(),
        batch.files.length.toString(),
        batch.estimatedTokens.toLocaleString(),
        sample,
      ]);
    }

    console.log(table.toString());
    console.log('');
  }

  displayScanResults(graph: DependencyGraph, profileId: string): void {
    console.log('');
    console.log(chalk.bold.cyan('  ─── Dependency Graph ─────────────────────'));
    console.log('');
    console.log(`  Profile:     ${chalk.cyan(profileId)}`);
    console.log(`  Files:       ${chalk.bold(graph.migrationOrder.length.toString())}`);
    console.log(`  Roots:       ${chalk.bold(graph.roots.length.toString())}`);
    console.log('');

    const table = new Table({
      head: [chalk.cyan('Order'), chalk.cyan('Depth'), chalk.cyan('Est. Tokens'), chalk.cyan('File')],
      colWidths: [8, 8, 14, 50],
    });

    graph.migrationOrder.forEach((file, i) => {
      const node = graph.nodes.get(file)!;
      table.push([
        (i + 1).toString(),
        node.depth.toString(),
        node.estimatedTokens.toLocaleString(),
        file,
      ]);
    });

    console.log(table.toString());
    console.log('');
  }

  private estimateTime(totalFiles: number, batchCount: number): string {
    const seconds = totalFiles * 2 + batchCount * 10;
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }
}
