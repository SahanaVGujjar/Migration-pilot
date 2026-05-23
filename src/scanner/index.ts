import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import { DependencyGraph, FileNode, MigrationType } from '../types';

const IGNORE_DIRS = [
  'node_modules', 'dist', 'build', '.git', 'coverage',
  '.next', '.nuxt', '__pycache__', '.migration-pilot',
];

const EXTENSION_MAP: Record<MigrationType, string[]> = {
  'js-to-ts': ['.js', '.jsx'],
  'class-to-hooks': ['.jsx', '.tsx', '.js', '.ts'],
};

export class CodebaseScanner {
  private targetDir: string;
  private migrationType: MigrationType;

  constructor(targetDir: string, migrationType: MigrationType) {
    this.targetDir = path.resolve(targetDir);
    this.migrationType = migrationType;
  }

  async scan(): Promise<DependencyGraph> {
    const spinner = ora('Scanning codebase...').start();

    const extensions = EXTENSION_MAP[this.migrationType];
    const patterns = extensions.map(
      (ext) => `**/*${ext}`
    );

    let files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.targetDir,
        ignore: IGNORE_DIRS.map((d) => `${d}/**`),
        absolute: false,
      });
      files.push(...matches);
    }

    // Deduplicate
    files = [...new Set(files)];

    spinner.text = `Found ${files.length} files. Building dependency graph...`;

    const graph = this.buildDependencyGraph(files);

    spinner.succeed(
      `Scanned ${chalk.cyan(files.length.toString())} files, found ${chalk.cyan(graph.roots.length.toString())} root files`
    );

    return graph;
  }

  private buildDependencyGraph(files: string[]): DependencyGraph {
    const nodes = new Map<string, FileNode>();

    // Create nodes for all files
    for (const file of files) {
      const fullPath = path.join(this.targetDir, file);
      nodes.set(file, {
        filePath: fullPath,
        relativePath: file,
        imports: [],
        importedBy: [],
        depth: 0,
        status: 'pending',
      });
    }

    // Parse imports for each file
    for (const file of files) {
      const fullPath = path.join(this.targetDir, file);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const imports = this.extractImports(content, file);

        const node = nodes.get(file)!;
        node.imports = imports.filter((imp) => nodes.has(imp));

        for (const imp of node.imports) {
          const importedNode = nodes.get(imp);
          if (importedNode) {
            importedNode.importedBy.push(file);
          }
        }
      } catch {
        // skip unreadable files
      }
    }

    // Calculate depth (distance from leaves)
    this.calculateDepths(nodes);

    // Find root files (not imported by anything)
    const roots = files.filter((f) => {
      const node = nodes.get(f)!;
      return node.importedBy.length === 0;
    });

    // Topological sort for migration order (leaves first)
    const migrationOrder = this.topologicalSort(nodes, files);

    return { nodes, roots, migrationOrder };
  }

  private extractImports(content: string, fromFile: string): string[] {
    const imports: string[] = [];
    const dir = path.dirname(fromFile);

    // ES module imports: import X from './path'
    const esImportRegex = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = esImportRegex.exec(content)) !== null) {
      const resolved = this.resolveImportPath(match[1], dir);
      if (resolved) imports.push(resolved);
    }

    // CommonJS require: const X = require('./path')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const resolved = this.resolveImportPath(match[1], dir);
      if (resolved) imports.push(resolved);
    }

    // Dynamic imports: import('./path')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const resolved = this.resolveImportPath(match[1], dir);
      if (resolved) imports.push(resolved);
    }

    return [...new Set(imports)];
  }

  private resolveImportPath(importPath: string, fromDir: string): string | null {
    // Skip node_modules / package imports
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    const resolved = path.normalize(path.join(fromDir, importPath));
    const extensions = ['.js', '.jsx', '.ts', '.tsx', ''];

    for (const ext of extensions) {
      const candidate = resolved + ext;
      const fullPath = path.join(this.targetDir, candidate);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return candidate;
      }
    }

    // Try index files
    for (const ext of extensions) {
      const candidate = path.join(resolved, `index${ext}`);
      const fullPath = path.join(this.targetDir, candidate);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        return candidate;
      }
    }

    return null;
  }

  private calculateDepths(nodes: Map<string, FileNode>): void {
    const visited = new Set<string>();

    const calcDepth = (file: string): number => {
      if (visited.has(file)) return nodes.get(file)!.depth;
      visited.add(file);

      const node = nodes.get(file)!;
      if (node.imports.length === 0) {
        node.depth = 0;
        return 0;
      }

      let maxDepth = 0;
      for (const imp of node.imports) {
        if (nodes.has(imp)) {
          maxDepth = Math.max(maxDepth, calcDepth(imp) + 1);
        }
      }
      node.depth = maxDepth;
      return maxDepth;
    };

    for (const file of nodes.keys()) {
      calcDepth(file);
    }
  }

  private topologicalSort(
    nodes: Map<string, FileNode>,
    files: string[]
  ): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const inProgress = new Set<string>();

    const visit = (file: string) => {
      if (visited.has(file) || inProgress.has(file)) return;
      inProgress.add(file);

      const node = nodes.get(file)!;
      for (const imp of node.imports) {
        if (nodes.has(imp)) {
          visit(imp);
        }
      }

      inProgress.delete(file);
      visited.add(file);
      order.push(file);
    };

    for (const file of files) {
      visit(file);
    }

    return order;
  }
}
