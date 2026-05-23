import { AITypeInference } from '../types';
export declare class AIAssistant {
    private model;
    private baseUrl;
    private available;
    constructor(model?: string, baseUrl?: string);
    checkAvailability(): Promise<boolean>;
    isAvailable(): boolean;
    inferTypes(code: string, functionName: string): Promise<AITypeInference[]>;
    inferInterfaceFromUsage(objectAccesses: string[], variableName: string): Promise<string | null>;
    suggestTypeForValue(value: string, context: string): Promise<string>;
    private generate;
    private httpGet;
}
//# sourceMappingURL=ai.d.ts.map