import { MigrationPlan, MigrationReport } from '../types';
export declare class Dashboard {
    private plan;
    private startTime;
    init(plan: MigrationPlan): void;
    updateProgress(report: MigrationReport): void;
    formatReport(report: MigrationReport): string;
    private formatDuration;
}
//# sourceMappingURL=index.d.ts.map