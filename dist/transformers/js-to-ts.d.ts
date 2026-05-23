import { TransformResult } from '../types';
import { AIAssistant } from '../utils/ai';
export declare class JsToTsTransformer {
    private ai;
    constructor(ai?: AIAssistant);
    transform(filePath: string): Promise<TransformResult>;
    private convertRequiresToImports;
    private convertExports;
    private addFunctionTypes;
    private inferParamTypes;
    private inferTypeFromDefault;
    private inferTypeFromUsage;
    private functionHasReturn;
    private convertJSDocToTypes;
    private convertJSDocType;
    private addVariableTypes;
    private fixImportExtensions;
    private convertPropTypes;
    private parsePropTypes;
    private isReactFile;
}
//# sourceMappingURL=js-to-ts.d.ts.map