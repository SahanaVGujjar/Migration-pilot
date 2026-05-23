import * as fs from 'fs';
import * as path from 'path';

export type ResolvedLLMProvider = 'ollama' | 'openai' | 'openrouter' | 'groq' | 'mock';

export interface ResolvedLLMSettings {
  provider: ResolvedLLMProvider;
  model: string;
  apiKey?: string;
  baseUrl: string;
  useMock: boolean;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string; apiKeyEnv: string }> = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    apiKeyEnv: 'GROQ_API_KEY',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
    model: 'codellama',
    apiKeyEnv: '',
  },
};

/** Load `.env` from cwd when variables are not already set (does not override shell env). */
export function loadDotEnv(cwd: string = process.cwd()): void {
  const envPath = path.join(cwd, '.env');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function resolveLLMFromEnv(cli?: {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}): ResolvedLLMSettings {
  const useMock =
    process.env.USE_MOCK_AI === 'true' ||
    process.env.USE_MOCK_AI === '1';

  const providerName = (cli?.provider || process.env.LLM_PROVIDER || 'ollama').toLowerCase();

  if (useMock) {
    return {
      provider: 'mock',
      model: cli?.model || 'mock',
      baseUrl: '',
      useMock: true,
    };
  }

  const defaults = PROVIDER_DEFAULTS[providerName] || PROVIDER_DEFAULTS.ollama;

  const apiKey =
    cli?.apiKey ||
    (defaults.apiKeyEnv ? process.env[defaults.apiKeyEnv] : undefined) ||
    process.env.OPENAI_API_KEY;

  const baseUrl = cli?.baseUrl || process.env.LLM_BASE_URL || defaults.baseUrl;
  const model = cli?.model || process.env.LLM_MODEL || defaults.model;

  return {
    provider: (providerName in PROVIDER_DEFAULTS ? providerName : 'ollama') as ResolvedLLMProvider,
    model,
    apiKey,
    baseUrl,
    useMock: false,
  };
}
