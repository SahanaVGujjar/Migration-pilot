export declare class GitManager {
    private cwd;
    constructor(cwd: string);
    isGitRepo(): boolean;
    initRepo(): void;
    createBackupBranch(name: string): string;
    createMigrationBranch(): string;
    commitBatch(batchId: number, files: string[]): void;
    rollbackLastCommit(): void;
    stageFile(filePath: string): void;
    removeFile(filePath: string): void;
    getTrackedFiles(): string[];
    hasUncommittedChanges(): boolean;
    saveSnapshot(label: string): string;
    restoreSnapshot(label: string): void;
}
//# sourceMappingURL=git.d.ts.map