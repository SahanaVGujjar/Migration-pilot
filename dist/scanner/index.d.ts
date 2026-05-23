import { DependencyGraph, MigrationType } from '../types';
export declare class CodebaseScanner {
    private targetDir;
    private migrationType;
    constructor(targetDir: string, migrationType: MigrationType);
    scan(): Promise<DependencyGraph>;
    private buildDependencyGraph;
    private extractImports;
    private resolveImportPath;
    private calculateDepths;
    private topologicalSort;
}
//# sourceMappingURL=index.d.ts.map