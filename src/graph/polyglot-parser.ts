import * as path from 'path';
import { SymbolStub } from '../core/types';

const PY_EXT = ['.py'];
const JAVA_EXT = ['.java'];
const ANGULAR_COMPONENT_EXTS = ['.ts'];
const ANGULAR_TEMPLATE_EXT = '.html';
const ANGULAR_STYLE_EXTS = ['.css', '.scss'];

export function isPythonFile(filePath: string): boolean {
  return PY_EXT.includes(path.extname(filePath));
}

export function isJavaFile(filePath: string): boolean {
  return JAVA_EXT.includes(path.extname(filePath));
}

export function extractPythonImports(
  content: string,
  fromFile: string,
  allFiles: Set<string>
): string[] {
  const dir = path.dirname(fromFile).replace(/\\/g, '/');
  const imports: string[] = [];

  const importModule = /^import\s+([\w.]+)/gm;
  let m;
  while ((m = importModule.exec(content)) !== null) {
    const resolved = resolvePythonModule(m[1], dir, allFiles);
    if (resolved) imports.push(resolved);
  }

  const fromImport = /^from\s+([\w.]+)\s+import/gm;
  while ((m = fromImport.exec(content)) !== null) {
    const resolved = resolvePythonModule(m[1], dir, allFiles);
    if (resolved) imports.push(resolved);
  }

  const relativeFrom = /^from\s+(\.+)\s*([\w.]*)\s+import/gm;
  while ((m = relativeFrom.exec(content)) !== null) {
    const dots = m[1];
    const modulePath = m[2] || '';
    const resolved = resolvePythonRelative(dots, modulePath, dir, allFiles);
    if (resolved) imports.push(resolved);
  }

  return [...new Set(imports)];
}

export function extractJavaImports(
  content: string,
  fromFile: string,
  allFiles: Set<string>
): string[] {
  const dir = path.dirname(fromFile).replace(/\\/g, '/');
  const imports: string[] = [];

  const importRegex = /^import\s+(?:static\s+)?([\w.]+);/gm;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const resolved = resolveJavaImport(m[1], dir, allFiles);
    if (resolved) imports.push(resolved);
  }

  return [...new Set(imports)];
}

export function extractPythonExports(content: string, filePath: string): SymbolStub[] {
  const exports: SymbolStub[] = [];

  const classRegex = /^class\s+(\w+)/gm;
  let m;
  while ((m = classRegex.exec(content)) !== null) {
    exports.push({ name: m[1], kind: 'class', signature: `class ${m[1]}` });
  }

  const defRegex = /^def\s+(\w+)\s*\(/gm;
  while ((m = defRegex.exec(content)) !== null) {
    exports.push({ name: m[1], kind: 'function', signature: `${m[1]}()` });
  }

  if (exports.length === 0) {
    const base = path.basename(filePath, '.py');
    exports.push({ name: base, kind: 'const', signature: `module ${base}` });
  }

  return exports;
}

export function extractJavaExports(content: string, _filePath: string): SymbolStub[] {
  const exports: SymbolStub[] = [];

  const patterns = [
    /^public\s+(?:abstract\s+)?class\s+(\w+)/gm,
    /^public\s+interface\s+(\w+)/gm,
    /^public\s+enum\s+(\w+)/gm,
  ];

  for (const regex of patterns) {
    let m;
    while ((m = regex.exec(content)) !== null) {
      exports.push({ name: m[1], kind: 'class', signature: `class ${m[1]}` });
    }
  }

  const methodRegex = /^public\s+static\s+[\w<>,\[\]]+\s+(\w+)\s*\(/gm;
  let m;
  while ((m = methodRegex.exec(content)) !== null) {
    exports.push({ name: m[1], kind: 'function', signature: `${m[1]}()` });
  }

  return exports;
}

function resolvePythonModule(moduleName: string, fromDir: string, allFiles: Set<string>): string | null {
  const asPath = moduleName.replace(/\./g, '/');
  const fromRelative = resolveWithExtensions(asPath, fromDir, allFiles, ['.py']);
  if (fromRelative) return fromRelative;

  const suffix = `${asPath}.py`;
  for (const file of allFiles) {
    if (file === suffix || file.endsWith(`/${suffix}`)) return file;
  }

  return null;
}

function resolvePythonRelative(
  dots: string,
  modulePath: string,
  fromDir: string,
  allFiles: Set<string>
): string | null {
  const depth = dots.length - 1;
  const parts = fromDir.split('/').filter(Boolean);
  const baseParts = parts.slice(0, Math.max(0, parts.length - depth));
  const base = baseParts.join('/');
  const asPath = modulePath ? `${base}/${modulePath.replace(/\./g, '/')}` : base;
  return resolveWithExtensions(asPath, '', allFiles, ['.py'], true);
}

function resolveJavaImport(importPath: string, fromDir: string, allFiles: Set<string>): string | null {
  const simple = importPath.split('.').pop()!;
  const asPath = importPath.replace(/\./g, '/');

  const candidates = [
    resolveWithExtensions(asPath, fromDir, allFiles, ['.java']),
    resolveWithExtensions(simple, fromDir, allFiles, ['.java']),
    findFileEndingWith(allFiles, `/${simple}.java`),
    findFileEndingWith(allFiles, `${simple}.java`),
  ];

  return candidates.find(Boolean) || null;
}

function resolveWithExtensions(
  spec: string,
  fromDir: string,
  allFiles: Set<string>,
  extensions: string[],
  absoluteBase = false
): string | null {
  if (spec.startsWith('.')) {
    const base = path.posix.normalize(path.posix.join(fromDir, spec));
    return tryCandidates(base, allFiles, extensions);
  }

  const base = absoluteBase ? spec : path.posix.join(fromDir, spec).replace(/^\.\//, '');
  return tryCandidates(base, allFiles, extensions);
}

function tryCandidates(base: string, allFiles: Set<string>, extensions: string[]): string | null {
  const normalized = base.replace(/\\/g, '/').replace(/^\.\//, '');
  const candidates = [
    normalized,
    ...extensions.map((e) => `${normalized}${e}`),
    ...extensions.map((e) => `${normalized}/__init__${e}`),
    ...extensions.map((e) => `${normalized}/index${e}`),
  ];

  for (const c of candidates) {
    const clean = c.replace(/^\.\//, '');
    if (allFiles.has(clean)) return clean;
  }

  for (const file of allFiles) {
    if (file.replace(/\.[^.]+$/, '') === normalized) return file;
  }

  return null;
}

function findFileEndingWith(allFiles: Set<string>, suffix: string): string | null {
  for (const file of allFiles) {
    if (file.endsWith(suffix) || file.replace(/\\/g, '/').endsWith(suffix)) {
      return file;
    }
  }
  return null;
}

export function isAngularFile(filePath: string): boolean {
  return /\.component\.ts$|\.service\.ts$|\.pipe\.ts$|\.guard\.ts$|\.directive\.ts$|\.module\.ts$/.test(filePath);
}

export function isAngularTemplateFile(filePath: string): boolean {
  return /\.component\.html$/.test(filePath);
}

export function isAngularStyleFile(filePath: string): boolean {
  return /\.component\.css$|\.component\.scss$/.test(filePath);
}

export function extractAngularImports(
  content: string,
  fromFile: string,
  allFiles: Set<string>
): string[] {
  const dir = path.dirname(fromFile).replace(/\\/g, '/');
  const imports: string[] = [];

  const importRegex = /^import\s+.*?\s+from\s+['"]([^'"]+)['"]/gm;
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;
    const resolved = resolveAngularImport(spec, dir, allFiles);
    if (resolved) imports.push(resolved);
  }

  const templateUrl = /templateUrl\s*:\s*['"]([^'"]+)['"]/;
  const templateMatch = content.match(templateUrl);
  if (templateMatch) {
    const resolved = resolveAngularImport(templateMatch[1], dir, allFiles);
    if (resolved) imports.push(resolved);
  }

  const styleUrls = /styleUrls\s*:\s*\[([^\]]*)\]/;
  const styleMatch = content.match(styleUrls);
  if (styleMatch) {
    const urls = styleMatch[1].match(/['"]([^'"]+)['"]/g);
    if (urls) {
      for (const url of urls) {
        const clean = url.replace(/['"]/g, '');
        const resolved = resolveAngularImport(clean, dir, allFiles);
        if (resolved) imports.push(resolved);
      }
    }
  }

  return [...new Set(imports)];
}

export function extractAngularExports(content: string, filePath: string): SymbolStub[] {
  const exports: SymbolStub[] = [];

  const componentRegex = /export\s+class\s+(\w+)/g;
  let m;
  while ((m = componentRegex.exec(content)) !== null) {
    const name = m[1];
    let kind: 'class' | 'function' | 'interface' = 'class';

    if (/@Component/.test(content)) kind = 'class';
    else if (/@Injectable/.test(content)) kind = 'class';
    else if (/@Pipe/.test(content)) kind = 'function';

    exports.push({ name, kind, signature: `class ${name}` });
  }

  const interfaceRegex = /export\s+interface\s+(\w+)/g;
  while ((m = interfaceRegex.exec(content)) !== null) {
    exports.push({ name: m[1], kind: 'interface', signature: `interface ${m[1]}` });
  }

  const fnRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
  while ((m = fnRegex.exec(content)) !== null) {
    exports.push({ name: m[1], kind: 'function', signature: `${m[1]}()` });
  }

  if (exports.length === 0) {
    const base = path.basename(filePath, path.extname(filePath));
    exports.push({ name: base, kind: 'const', signature: `module ${base}` });
  }

  return exports;
}

function resolveAngularImport(spec: string, fromDir: string, allFiles: Set<string>): string | null {
  if (!spec.startsWith('.')) return null;

  const base = path.posix.normalize(path.posix.join(fromDir, spec));
  const extensions = ['.ts', '.html', '.css', '.scss'];
  const normalized = base.replace(/\\/g, '/').replace(/^\.\//, '');

  const candidates = [
    normalized,
    ...extensions.map((e) => `${normalized}${e}`),
  ];

  for (const c of candidates) {
    const clean = c.replace(/^\.\//, '');
    if (allFiles.has(clean)) return clean;
  }

  for (const file of allFiles) {
    if (file.replace(/\.[^.]+$/, '') === normalized) return file;
  }

  return null;
}

export function resolveImportExtensions(profileExtensions: string[]): string[] {
  return profileExtensions;
}
