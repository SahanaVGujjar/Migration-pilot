import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import { DependencyGraph, MigrationProfile } from '../core/types';
import { buildGraph } from './dependency-graph';
import { CodeParser } from './parser';
import { estimateTokens } from '../token/budget';

const IGNORE_DIRS = [
  'node_modules',
  'dist',
  'build',
  'target',
  'out',
  '.git',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv',
  '.migration-pilot',
];

export class CodebaseScanner {
  private sourceDir: string;
  private profile: MigrationProfile;
  private parser: CodeParser;

  constructor(sourceDir: string, profile: MigrationProfile) {
    this.sourceDir = path.resolve(sourceDir);
    this.profile = profile;
    this.parser = new CodeParser();
  }

  async scan(): Promise<DependencyGraph> {
    const spinner = ora('Scanning codebase...').start();

    const patterns = this.profile.fileGlobs;
    let files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.sourceDir,
        ignore: IGNORE_DIRS.map((d) => `${d}/**`),
        absolute: false,
      });
      files.push(...matches);
    }

    files = [...new Set(files)].sort().map((f) => f.replace(/\\/g, '/'));
    const fileSet = new Set(files);

    spinner.text = `Found ${files.length} files. Building dependency graph with AST parser...`;

    const graph = buildGraph(files, this.sourceDir, (file) => {
      const fullPath = path.join(this.sourceDir, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return this.parser.extractImports(content, file, fileSet);
      } catch {
        return [];
      }
    });

    for (const file of files) {
      const node = graph.nodes.get(file)!;
      const content = fs.readFileSync(node.filePath, 'utf-8');
      node.estimatedTokens = estimateTokens(content) + estimateTokens(JSON.stringify(node.imports));
    }

    spinner.succeed(
      `Scanned ${chalk.cyan(files.length.toString())} files, ${chalk.cyan(graph.roots.length.toString())} roots, ${chalk.cyan(graph.migrationOrder.length.toString())} in migration order`
    );

    return graph;
  }
}
