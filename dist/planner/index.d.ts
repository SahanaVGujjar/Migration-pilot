import { DependencyGraph, MigrationConfig, MigrationPlan } from '../types';
export declare class MigrationPlanner {
    private config;
    constructor(config: MigrationConfig);
    createPlan(graph: DependencyGraph): MigrationPlan;
    private createBatches;
    private estimateTime;
    formatPlan(plan: MigrationPlan): string;
}
//# sourceMappingURL=index.d.ts.map