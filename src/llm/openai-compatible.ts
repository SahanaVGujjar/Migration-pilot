import * as https from 'https';
import * as http from 'http';
import { LLMCompleteOptions, LLMCompleteResult } from '../core/types';
import { BaseLLMProvider } from './base-provider';

export interface OpenAIProviderOptions {
  extraHeaders?: Record<string, string>;
}

export class OpenAICompatibleProvider extends BaseLLMProvider {
  readonly name = 'openai-compatible';

  constructor(
    private model: string,
    private baseUrl: string = 'https://api.openai.com/v1',
    private apiKey?: string,
    private options: OpenAIProviderOptions = {}
  ) {
    super();
  }

  async checkAvailability(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.httpPost(
        `${this.baseUrl}/chat/completions`,
        JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMCompleteResult> {
    if (!this.apiKey) {
      throw new Error('API key required for OpenAI-compatible provider');
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = JSON.stringify({
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 4096,
    });

    const response = await this.httpPost(`${this.baseUrl}/chat/completions`, payload);
    const parsed = JSON.parse(response);

    const text = parsed.choices?.[0]?.message?.content || '';
    const usage = parsed.usage || {};

    return {
      text,
      promptTokens: usage.prompt_tokens ?? this.estimateTokens(prompt),
      completionTokens: usage.completion_tokens ?? this.estimateTokens(text),
    };
  }

  private httpPost(url: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;

      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Length': Buffer.byteLength(body),
            ...this.options.extraHeaders,
          },
          timeout: 120000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`OpenAI API error ${res.statusCode}: ${data}`));
              return;
            }
            resolve(data);
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OpenAI request timed out'));
      });
      req.write(body);
      req.end();
    });
  }
}
