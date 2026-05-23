import { LLMCompleteOptions, LLMCompleteResult, LLMProvider } from '../core/types';

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: string;

  abstract checkAvailability(): Promise<boolean>;

  abstract complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMCompleteResult>;

  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
