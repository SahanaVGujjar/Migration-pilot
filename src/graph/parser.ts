import * as path from 'path';
import { Project, SourceFile, SyntaxKind } from 'ts-morph';
import { SymbolStub } from '../core/types';
import {
  extractJavaExports,
  extractJavaImports,
  extractPythonExports,
  extractPythonImports,
  isJavaFile,
  isPythonFile,
} from './polyglot-parser';

export class CodeParser {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        allowJs: true,
        jsx: 2,
      },
    });
  }

  extractImports(content: string, fromFile: string, allFiles: Set<string>): string[] {
    const normalizedFile = fromFile.replace(/\\/g, '/');
    const normalizedFiles = new Set([...allFiles].map((f) => f.replace(/\\/g, '/')));

    if (isPythonFile(normalizedFile)) {
      return extractPythonImports(content, normalizedFile, normalizedFiles);
    }
    if (isJavaFile(normalizedFile)) {
      return extractJavaImports(content, normalizedFile, normalizedFiles);
    }

    return this.extractTsImports(content, normalizedFile, normalizedFiles);
  }

  extractExports(content: string, filePath: string): SymbolStub[] {
    const normalized = filePath.replace(/\\/g, '/');

    if (isPythonFile(normalized)) {
      return extractPythonExports(content, normalized);
    }
    if (isJavaFile(normalized)) {
      return extractJavaExports(content, normalized);
    }

    return this.extractTsExports(content, normalized);
  }

  private extractTsImports(
    content: string,
    fromFile: string,
    allFiles: Set<string>
  ): string[] {
    const sf = this.createSourceFile(fromFile, content);
    const dir = path.dirname(fromFile).replace(/\\/g, '/');
    const imports: string[] = [];

    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      const resolved = this.resolveTsImport(spec, dir, allFiles);
      if (resolved) imports.push(resolved);
    }

    for (const req of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expr = req.getExpression();
      if (expr.getText() === 'require') {
        const arg = req.getArguments()[0];
        if (arg && arg.getKind() === SyntaxKind.StringLiteral) {
          const resolved = this.resolveTsImport(arg.getText().slice(1, -1), dir, allFiles);
          if (resolved) imports.push(resolved);
        }
      }
    }

    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      const resolved = this.resolveTsImport(match[1], dir, allFiles);
      if (resolved) imports.push(resolved);
    }

    return [...new Set(imports)];
  }

  private extractTsExports(content: string, filePath: string): SymbolStub[] {
    const sf = this.createSourceFile(filePath, content);
    const exports: SymbolStub[] = [];

    for (const fn of sf.getFunctions()) {
      if (fn.isExported()) {
        exports.push({
          name: fn.getName() || 'anonymous',
          kind: 'function',
          signature: this.getFunctionSignature(fn),
        });
      }
    }

    for (const cls of sf.getClasses()) {
      if (cls.isExported()) {
        exports.push({
          name: cls.getName() || 'AnonymousClass',
          kind: 'class',
          signature: `class ${cls.getName() || 'Anonymous'}`,
        });
      }
    }

    for (const iface of sf.getInterfaces()) {
      if (iface.isExported()) {
        exports.push({
          name: iface.getName()!,
          kind: 'interface',
          signature: `interface ${iface.getName()}`,
        });
      }
    }

    for (const typeAlias of sf.getTypeAliases()) {
      if (typeAlias.isExported()) {
        exports.push({
          name: typeAlias.getName(),
          kind: 'type',
          signature: `type ${typeAlias.getName()}`,
        });
      }
    }

    for (const variable of sf.getVariableDeclarations()) {
      const statement = variable.getVariableStatement();
      if (statement?.isExported()) {
        exports.push({
          name: variable.getName(),
          kind: 'const',
          signature: `const ${variable.getName()}`,
        });
      }
    }

    const defaultExport = sf.getDefaultExportSymbol();
    if (defaultExport) {
      exports.push({
        name: 'default',
        kind: 'default',
        signature: 'default export',
      });
    }

    return exports;
  }

  private createSourceFile(filePath: string, content: string): SourceFile {
    return this.project.createSourceFile(filePath, content, {
      overwrite: true,
    });
  }

  private getFunctionSignature(fn: ReturnType<SourceFile['getFunctions']>[0]): string {
    const name = fn.getName() || 'fn';
    const params = fn.getParameters().map((p) => {
      const type = p.getTypeNode()?.getText() || 'any';
      return `${p.getName()}: ${type}`;
    });
    const ret = fn.getReturnTypeNode()?.getText() || 'unknown';
    return `${name}(${params.join(', ')}): ${ret}`;
  }

  private resolveTsImport(spec: string, fromDir: string, allFiles: Set<string>): string | null {
    if (!spec.startsWith('.')) return null;

    const base = path.posix.normalize(path.posix.join(fromDir.replace(/\\/g, '/'), spec));
    const candidates = [
      base,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}/index.js`,
      `${base}/index.jsx`,
      `${base}/index.ts`,
      `${base}/index.tsx`,
    ];

    for (const c of candidates) {
      const normalized = c.replace(/^\.\//, '');
      if (allFiles.has(normalized)) return normalized;
    }

    for (const file of allFiles) {
      const fileNoExt = file.replace(/\.[^.]+$/, '');
      const baseNoExt = base.replace(/\.[^.]+$/, '');
      if (fileNoExt === baseNoExt || fileNoExt.endsWith('/' + baseNoExt.split('/').pop())) {
        return file;
      }
    }

    return null;
  }
}
