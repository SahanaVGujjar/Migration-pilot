import { LLMProvider } from '../core/types';
import { OllamaProvider } from './ollama';
import { OpenAICompatibleProvider } from './openai-compatible';
import { MockLLMProvider } from './mock-provider';
import { ResolvedLLMSettings } from './env-config';

export function createLLMProviderFromSettings(settings: ResolvedLLMSettings): LLMProvider {
  if (settings.useMock || settings.provider === 'mock') {
    return new MockLLMProvider();
  }

  if (settings.provider === 'ollama') {
    return new OllamaProvider(settings.model, settings.baseUrl);
  }

  const extraHeaders: Record<string, string> = {};
  if (settings.provider === 'openrouter') {
    extraHeaders['HTTP-Referer'] = process.env.OPENROUTER_REFERER || 'https://github.com/migration-pilot';
    extraHeaders['X-Title'] = process.env.OPENROUTER_TITLE || 'migration-pilot';
  }

  return new OpenAICompatibleProvider(
    settings.model,
    settings.baseUrl,
    settings.apiKey,
    { extraHeaders }
  );
}

/** @deprecated Use createLLMProviderFromSettings */
export function createLLMProvider(
  provider: 'ollama' | 'openai',
  model: string,
  baseUrl: string,
  apiKey?: string
): LLMProvider {
  return createLLMProviderFromSettings({
    provider: provider === 'openai' ? 'openai' : 'ollama',
    model,
    baseUrl,
    apiKey,
    useMock: false,
  });
}

export { BaseLLMProvider } from './base-provider';
