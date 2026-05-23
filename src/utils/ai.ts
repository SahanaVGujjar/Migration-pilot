import { AITypeInference } from '../types';
import * as http from 'http';

export class AIAssistant {
  private model: string;
  private baseUrl: string;
  private available: boolean = false;

  constructor(model: string = 'codellama', baseUrl: string = 'http://localhost:11434') {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async checkAvailability(): Promise<boolean> {
    try {
      const response = await this.httpGet(`${this.baseUrl}/api/tags`);
      this.available = response.includes(this.model);
      return this.available;
    } catch {
      this.available = false;
      return false;
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async inferTypes(code: string, functionName: string): Promise<AITypeInference[]> {
    if (!this.available) return [];

    const prompt = `Analyze this JavaScript function and infer TypeScript types for all parameters and return values. 
Return ONLY a JSON array with objects containing: variableName, inferredType, confidence (0-1), reasoning.
Do not include any other text, just the JSON array.

Function:
\`\`\`javascript
${code}
\`\`\``;

    try {
      const response = await this.generate(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // AI inference failed, fall back to basic types
    }
    return [];
  }

  async inferInterfaceFromUsage(
    objectAccesses: string[],
    variableName: string
  ): Promise<string | null> {
    if (!this.available) return null;

    const prompt = `Given these property accesses on a variable named "${variableName}":
${objectAccesses.map((a) => `- ${a}`).join('\n')}

Generate a TypeScript interface for this variable. Return ONLY the interface definition, no explanation.`;

    try {
      const response = await this.generate(prompt);
      const interfaceMatch = response.match(/interface[\s\S]*?\}/);
      if (interfaceMatch) {
        return interfaceMatch[0];
      }
    } catch {
      // AI inference failed
    }
    return null;
  }

  async suggestTypeForValue(value: string, context: string): Promise<string> {
    if (!this.available) return 'any';

    const prompt = `What TypeScript type best describes this value: ${value}
Context: ${context}
Return ONLY the type (e.g., "string", "number", "string[]", etc.), nothing else.`;

    try {
      const response = await this.generate(prompt);
      const cleaned = response.trim().replace(/[`"']/g, '');
      if (cleaned.length < 100) return cleaned;
    } catch {
      // fallback
    }
    return 'any';
  }

  private async generate(prompt: string): Promise<string> {
    const payload = JSON.stringify({
      model: this.model,
      prompt,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 500,
      },
    });

    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}/api/generate`);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 30000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.response || '');
            } catch {
              reject(new Error('Failed to parse AI response'));
            }
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('AI request timed out'));
      });
      req.write(payload);
      req.end();
    });
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      http
        .get(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname,
            timeout: 5000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve(data));
          }
        )
        .on('error', reject);
    });
  }
}
