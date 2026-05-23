import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class GitManager {
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  isGitRepo(): boolean {
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.cwd,
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  initRepo(): void {
    execSync('git init', { cwd: this.cwd, stdio: 'pipe' });
  }

  createBackupBranch(name: string): string {
    const branchName = `migration-pilot/backup/${name}-${Date.now()}`;
    try {
      execSync(`git checkout -b ${branchName}`, {
        cwd: this.cwd,
        stdio: 'pipe',
      });
      execSync('git checkout -', { cwd: this.cwd, stdio: 'pipe' });
    } catch {
      // If working tree is not clean, stash first
      execSync('git stash', { cwd: this.cwd, stdio: 'pipe' });
      execSync(`git checkout -b ${branchName}`, {
        cwd: this.cwd,
        stdio: 'pipe',
      });
      execSync('git checkout -', { cwd: this.cwd, stdio: 'pipe' });
      execSync('git stash pop', { cwd: this.cwd, stdio: 'pipe' });
    }
    return branchName;
  }

  createMigrationBranch(): string {
    const branchName = `migration-pilot/migrate-${Date.now()}`;
    execSync(`git checkout -b ${branchName}`, {
      cwd: this.cwd,
      stdio: 'pipe',
    });
    return branchName;
  }

  commitBatch(batchId: number, files: string[]): void {
    for (const file of files) {
      try {
        execSync(`git add "${file}"`, { cwd: this.cwd, stdio: 'pipe' });
      } catch {
        // file may not exist if it was renamed
      }
    }
    execSync(
      `git commit -m "migration-pilot: batch ${batchId} - migrated ${files.length} files"`,
      { cwd: this.cwd, stdio: 'pipe' }
    );
  }

  rollbackLastCommit(): void {
    execSync('git reset --hard HEAD~1', { cwd: this.cwd, stdio: 'pipe' });
  }

  stageFile(filePath: string): void {
    execSync(`git add "${filePath}"`, { cwd: this.cwd, stdio: 'pipe' });
  }

  removeFile(filePath: string): void {
    execSync(`git rm "${filePath}"`, { cwd: this.cwd, stdio: 'pipe' });
  }

  getTrackedFiles(): string[] {
    const output = execSync('git ls-files', {
      cwd: this.cwd,
      encoding: 'utf-8',
    });
    return output.trim().split('\n').filter(Boolean);
  }

  hasUncommittedChanges(): boolean {
    const output = execSync('git status --porcelain', {
      cwd: this.cwd,
      encoding: 'utf-8',
    });
    return output.trim().length > 0;
  }

  saveSnapshot(label: string): string {
    const snapshotDir = path.join(this.cwd, '.migration-pilot', 'snapshots');
    fs.mkdirSync(snapshotDir, { recursive: true });

    const hash = execSync('git rev-parse HEAD', {
      cwd: this.cwd,
      encoding: 'utf-8',
    }).trim();

    const snapshotFile = path.join(snapshotDir, `${label}.json`);
    fs.writeFileSync(
      snapshotFile,
      JSON.stringify({ label, hash, timestamp: new Date().toISOString() })
    );
    return hash;
  }

  restoreSnapshot(label: string): void {
    const snapshotFile = path.join(
      this.cwd,
      '.migration-pilot',
      'snapshots',
      `${label}.json`
    );
    const data = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8'));
    execSync(`git reset --hard ${data.hash}`, {
      cwd: this.cwd,
      stdio: 'pipe',
    });
  }
}
