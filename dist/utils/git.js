"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitManager = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class GitManager {
    constructor(cwd) {
        this.cwd = cwd;
    }
    isGitRepo() {
        try {
            (0, child_process_1.execSync)('git rev-parse --is-inside-work-tree', {
                cwd: this.cwd,
                stdio: 'pipe',
            });
            return true;
        }
        catch {
            return false;
        }
    }
    initRepo() {
        (0, child_process_1.execSync)('git init', { cwd: this.cwd, stdio: 'pipe' });
    }
    createBackupBranch(name) {
        const branchName = `migration-pilot/backup/${name}-${Date.now()}`;
        try {
            (0, child_process_1.execSync)(`git checkout -b ${branchName}`, {
                cwd: this.cwd,
                stdio: 'pipe',
            });
            (0, child_process_1.execSync)('git checkout -', { cwd: this.cwd, stdio: 'pipe' });
        }
        catch {
            // If working tree is not clean, stash first
            (0, child_process_1.execSync)('git stash', { cwd: this.cwd, stdio: 'pipe' });
            (0, child_process_1.execSync)(`git checkout -b ${branchName}`, {
                cwd: this.cwd,
                stdio: 'pipe',
            });
            (0, child_process_1.execSync)('git checkout -', { cwd: this.cwd, stdio: 'pipe' });
            (0, child_process_1.execSync)('git stash pop', { cwd: this.cwd, stdio: 'pipe' });
        }
        return branchName;
    }
    createMigrationBranch() {
        const branchName = `migration-pilot/migrate-${Date.now()}`;
        (0, child_process_1.execSync)(`git checkout -b ${branchName}`, {
            cwd: this.cwd,
            stdio: 'pipe',
        });
        return branchName;
    }
    commitBatch(batchId, files) {
        for (const file of files) {
            try {
                (0, child_process_1.execSync)(`git add "${file}"`, { cwd: this.cwd, stdio: 'pipe' });
            }
            catch {
                // file may not exist if it was renamed
            }
        }
        (0, child_process_1.execSync)(`git commit -m "migration-pilot: batch ${batchId} - migrated ${files.length} files"`, { cwd: this.cwd, stdio: 'pipe' });
    }
    rollbackLastCommit() {
        (0, child_process_1.execSync)('git reset --hard HEAD~1', { cwd: this.cwd, stdio: 'pipe' });
    }
    stageFile(filePath) {
        (0, child_process_1.execSync)(`git add "${filePath}"`, { cwd: this.cwd, stdio: 'pipe' });
    }
    removeFile(filePath) {
        (0, child_process_1.execSync)(`git rm "${filePath}"`, { cwd: this.cwd, stdio: 'pipe' });
    }
    getTrackedFiles() {
        const output = (0, child_process_1.execSync)('git ls-files', {
            cwd: this.cwd,
            encoding: 'utf-8',
        });
        return output.trim().split('\n').filter(Boolean);
    }
    hasUncommittedChanges() {
        const output = (0, child_process_1.execSync)('git status --porcelain', {
            cwd: this.cwd,
            encoding: 'utf-8',
        });
        return output.trim().length > 0;
    }
    saveSnapshot(label) {
        const snapshotDir = path.join(this.cwd, '.migration-pilot', 'snapshots');
        fs.mkdirSync(snapshotDir, { recursive: true });
        const hash = (0, child_process_1.execSync)('git rev-parse HEAD', {
            cwd: this.cwd,
            encoding: 'utf-8',
        }).trim();
        const snapshotFile = path.join(snapshotDir, `${label}.json`);
        fs.writeFileSync(snapshotFile, JSON.stringify({ label, hash, timestamp: new Date().toISOString() }));
        return hash;
    }
    restoreSnapshot(label) {
        const snapshotFile = path.join(this.cwd, '.migration-pilot', 'snapshots', `${label}.json`);
        const data = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8'));
        (0, child_process_1.execSync)(`git reset --hard ${data.hash}`, {
            cwd: this.cwd,
            stdio: 'pipe',
        });
    }
}
exports.GitManager = GitManager;
//# sourceMappingURL=git.js.map