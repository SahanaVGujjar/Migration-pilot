import * as http from 'http';
import * as https from 'https';
import { LLMCompleteOptions, LLMCompleteResult } from '../core/types';
import { BaseLLMProvider } from './base-provider';

export class OllamaProvider extends BaseLLMProvider {
  readonly name = 'ollama';

  constructor(
    private model: string,
    private baseUrl: string = 'http://localhost:11434'
  ) {
    super();
  }

  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.httpGet(`${this.baseUrl}/api/tags`);
      return response.includes(this.model);
    } catch {
      return false;
    }
  }

  async complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMCompleteResult> {
    const systemPrompt = options?.systemPrompt || '';
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

    const payload = JSON.stringify({
      model: this.model,
      prompt: fullPrompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.1,
        num_predict: options?.maxTokens ?? 4096,
      },
    });

    const response = await this.httpPost(`${this.baseUrl}/api/generate`, payload);
    const parsed = JSON.parse(response);
    const text = parsed.response || '';

    return {
      text,
      promptTokens: this.estimateTokens(fullPrompt),
      completionTokens: this.estimateTokens(text),
    };
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      lib
        .get({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, timeout: 5000 }, (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve(data));
        })
        .on('error', reject);
    });
  }

  private httpPost(url: string, body: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 120000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve(data));
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama request timed out'));
      });
      req.write(body);
      req.end();
    });
  }
}
