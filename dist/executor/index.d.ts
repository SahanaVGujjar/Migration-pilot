import { MigrationConfig, MigrationPlan, MigrationReport } from '../types';
export declare class MigrationExecutor {
    private config;
    private transformer;
    private git;
    private testRunner;
    private dashboard;
    private ai;
    constructor(config: MigrationConfig);
    execute(plan: MigrationPlan): Promise<MigrationReport>;
    private executeBatch;
    private rollbackBatch;
    private updateImportReferences;
    private getRelativePath;
}
//# sourceMappingURL=index.d.ts.map