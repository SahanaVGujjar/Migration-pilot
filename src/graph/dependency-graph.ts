import * as path from 'path';
import { DependencyGraph, FileNode } from '../core/types';

export function topologicalSort(nodes: Map<string, FileNode>, files: string[]): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(file: string): void {
    if (visited.has(file)) return;
    visited.add(file);

    const node = nodes.get(file);
    if (node) {
      for (const imp of node.imports) {
        visit(imp);
      }
    }

    order.push(file);
  }

  const sortedByDepth = [...files].sort((a, b) => {
    const depthA = nodes.get(a)?.depth ?? 0;
    const depthB = nodes.get(b)?.depth ?? 0;
    return depthB - depthA;
  });

  for (const file of sortedByDepth) {
    visit(file);
  }

  return order;
}

export function calculateDepths(nodes: Map<string, FileNode>): void {
  const memo = new Map<string, number>();

  function depth(file: string, visiting: Set<string>): number {
    if (memo.has(file)) return memo.get(file)!;
    if (visiting.has(file)) return 0;

    visiting.add(file);
    const node = nodes.get(file);
    if (!node || node.imports.length === 0) {
      memo.set(file, 0);
      visiting.delete(file);
      return 0;
    }

    const maxChild = Math.max(...node.imports.map((imp) => depth(imp, visiting)));
    const d = maxChild + 1;
    memo.set(file, d);
    node.depth = d;
    visiting.delete(file);
    return d;
  }

  for (const file of nodes.keys()) {
    depth(file, new Set());
  }
}

export function buildGraph(
  files: string[],
  targetDir: string,
  readImports: (file: string) => string[]
): DependencyGraph {
  const nodes = new Map<string, FileNode>();

  for (const file of files) {
    nodes.set(file, {
      filePath: path.join(targetDir, file),
      relativePath: file,
      imports: [],
      importedBy: [],
      depth: 0,
      status: 'pending',
      estimatedTokens: 0,
    });
  }

  for (const file of files) {
    const imports = readImports(file).filter((imp) => nodes.has(imp));
    const node = nodes.get(file)!;
    node.imports = imports;

    for (const imp of imports) {
      nodes.get(imp)!.importedBy.push(file);
    }
  }

  calculateDepths(nodes);

  const roots = files.filter((f) => nodes.get(f)!.importedBy.length === 0);
  const migrationOrder = topologicalSort(nodes, files);

  return { nodes, roots, migrationOrder };
}
