import { MigrationType, TransformResult } from '../types';
import { AIAssistant } from '../utils/ai';
export interface Transformer {
    transform(filePath: string): Promise<TransformResult>;
}
export declare function createTransformer(type: MigrationType, ai?: AIAssistant): Transformer;
//# sourceMappingURL=index.d.ts.map