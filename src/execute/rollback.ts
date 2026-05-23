import * as fs from 'fs';
import * as path from 'path';

export interface FileSnapshot {
  path: string;
  content: string | null;
  existed: boolean;
}

export class RollbackManager {
  private snapshots: Map<number, FileSnapshot[]> = new Map();

  snapshotBatch(batchId: number, outputRelativePaths: string[], outputDir: string): void {
    const snaps: FileSnapshot[] = [];

    for (const rel of outputRelativePaths) {
      const outputPath = path.join(outputDir, rel.replace(/\\/g, '/'));
      snaps.push({
        path: outputPath,
        content: fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf-8') : null,
        existed: fs.existsSync(outputPath),
      });
    }

    this.snapshots.set(batchId, snaps);
  }

  trackCreatedFile(batchId: number, targetPath: string, targetDir: string): void {
    const snaps = this.snapshots.get(batchId) || [];
    const fullPath = path.join(targetDir, targetPath.replace(/\\/g, '/'));
    if (!snaps.find((s) => s.path === fullPath)) {
      snaps.push({
        path: fullPath,
        content: null,
        existed: false,
      });
    }
    this.snapshots.set(batchId, snaps);
  }

  rollbackBatch(batchId: number): void {
    const snaps = this.snapshots.get(batchId);
    if (!snaps) return;

    for (const snap of snaps) {
      if (snap.existed && snap.content !== null) {
        fs.mkdirSync(path.dirname(snap.path), { recursive: true });
        fs.writeFileSync(snap.path, snap.content);
      } else if (fs.existsSync(snap.path)) {
        fs.unlinkSync(snap.path);
      }
    }

    this.snapshots.delete(batchId);
  }

  clear(): void {
    this.snapshots.clear();
  }
}
