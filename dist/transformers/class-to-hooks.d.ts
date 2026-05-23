import { TransformResult } from '../types';
export declare class ClassToHooksTransformer {
    transform(filePath: string): Promise<TransformResult>;
    private findMatchingBrace;
    private extractState;
    private extractClassMethods;
    private extractLifecycleMethods;
    private extractRenderBody;
    private transformMethodBody;
    private transformRenderBody;
    private buildFunctionalComponent;
    private updateImports;
    private inferTypeFromValue;
}
//# sourceMappingURL=class-to-hooks.d.ts.map