import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { MigrationProfile } from './types';

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

function matchesGlob(filePath: string, pattern: string): boolean {
  const regex = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '(?:.*/)?');
  return new RegExp(`^${regex}$`).test(filePath);
}

export function resolveDirs(options: {
  from?: string;
  to?: string;
}): { sourceDir: string; outputDir: string } {
  if (!options.from?.trim()) {
    throw new Error('--from <source-root> is required.');
  }
  if (!options.to?.trim()) {
    throw new Error('--to <destination-root> is required.');
  }

  const sourceDir = path.resolve(options.from);
  const outputDir = path.resolve(options.to);

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  if (path.normalize(sourceDir) === path.normalize(outputDir)) {
    throw new Error(
      'Source and destination must be different paths. This tool only writes to a separate destination; it does not modify the source tree in place.'
    );
  }

  assertOutsidePackageRoot(sourceDir, 'Source');
  assertOutsidePackageRoot(outputDir, 'Destination');

  return { sourceDir, outputDir };
}

/** Prevent accidental reads/writes inside the migration-pilot tool repository. */
function assertOutsidePackageRoot(dir: string, label: string): void {
  const pkgRoot = findPackageRoot();
  if (!pkgRoot) return;

  const normalizedDir = path.normalize(dir);
  const normalizedPkg = path.normalize(pkgRoot);

  const insidePkg =
    normalizedDir === normalizedPkg || normalizedDir.startsWith(normalizedPkg + path.sep);

  if (!insidePkg) return;

  const fixturesRoot = path.join(normalizedPkg, 'test', 'fixtures');
  if (label === 'Source' && normalizedDir.startsWith(fixturesRoot)) {
    return;
  }

  throw new Error(
    `${label} path must not be inside the migration-pilot installation (${normalizedPkg}). ` +
      'Use --from and --to on your own project directories. Destination must always be outside this repo.'
  );
}

function findPackageRoot(): string | null {
  let dir = path.resolve(__dirname, '..', '..');
  if (fs.existsSync(path.join(dir, 'package.json'))) return dir;

  let current = process.cwd();
  while (current) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf-8'));
      if (pkg.name === 'migration-pilot') return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export async function copyStaticFiles(
  sourceDir: string,
  outputDir: string,
  profile: MigrationProfile
): Promise<number> {
  const allFiles = await glob('**/*', {
    cwd: sourceDir,
    ignore: IGNORE_DIRS.map((d) => `${d}/**`),
    nodir: true,
    absolute: false,
  });

  const migratePatterns = profile.fileGlobs;
  let copied = 0;

  for (const file of allFiles) {
    const normalized = file.replace(/\\/g, '/');
    const shouldMigrate = migratePatterns.some((pattern) => matchesGlob(normalized, pattern));

    if (shouldMigrate) continue;

    const src = path.join(sourceDir, normalized);
    const dest = path.join(outputDir, normalized);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied++;
  }

  return copied;
}

export function ensureOutputDir(outputDir: string, clean: boolean): void {
  if (clean && fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });
}
