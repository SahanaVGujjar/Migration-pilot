import { MigrationType, TransformResult } from '../types';
import { JsToTsTransformer } from './js-to-ts';
import { ClassToHooksTransformer } from './class-to-hooks';
import { AIAssistant } from '../utils/ai';

export interface Transformer {
  transform(filePath: string): Promise<TransformResult>;
}

export function createTransformer(
  type: MigrationType,
  ai?: AIAssistant
): Transformer {
  switch (type) {
    case 'js-to-ts':
      return new JsToTsTransformer(ai);
    case 'class-to-hooks':
      return new ClassToHooksTransformer();
    default:
      throw new Error(`Unknown migration type: ${type}`);
  }
}
