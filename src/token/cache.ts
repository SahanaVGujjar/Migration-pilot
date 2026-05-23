import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { LLMConversionResult } from '../core/types';

export class TokenCache {
  private cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  static computeKey(
    profileId: string,
    sourceCode: string,
    depStubHash: string
  ): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${profileId}:${sourceCode}:${depStubHash}`)
      .digest('hex');
    return hash;
  }

  get(key: string): LLMConversionResult | null {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as LLMConversionResult;
      return {
        ...data,
        tokenUsage: { ...data.tokenUsage, cached: true },
      };
    } catch {
      return null;
    }
  }

  set(key: string, result: LLMConversionResult): void {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  }

  clear(): void {
    if (fs.existsSync(this.cacheDir)) {
      for (const file of fs.readdirSync(this.cacheDir)) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    }
  }
}
