import { SymbolStub } from '../core/types';

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

const KIND_PRIORITY: Record<string, number> = {
  type: 0,
  interface: 1,
  enum: 2,
  class: 3,
  function: 4,
  const: 5,
  default: 6,
};

export interface AssembledContext {
  stubs: Array<{ modulePath: string; exports: SymbolStub[] }>;
  stubTokens: number;
  truncated: boolean;
}

export function assembleDependencyStubs(
  stubs: Array<{ modulePath: string; exports: SymbolStub[] }>,
  maxTokens: number
): AssembledContext {
  if (stubs.length === 0) {
    return { stubs: [], stubTokens: 0, truncated: false };
  }

  const flat: Array<{ modulePath: string; stub: SymbolStub }> = [];
  for (const mod of stubs) {
    for (const stub of mod.exports) {
      flat.push({ modulePath: mod.modulePath, stub });
    }
  }

  flat.sort((a, b) => {
    const pa = KIND_PRIORITY[a.stub.kind] ?? 99;
    const pb = KIND_PRIORITY[b.stub.kind] ?? 99;
    return pa - pb;
  });

  const result: Array<{ modulePath: string; exports: SymbolStub[] }> = [];
  const byModule = new Map<string, SymbolStub[]>();
  let used = 0;
  let truncated = false;

  for (const item of flat) {
    const stubText = JSON.stringify({ module: item.modulePath, ...item.stub });
    const tokens = estimateTokens(stubText);

    if (used + tokens > maxTokens) {
      truncated = true;
      break;
    }

    used += tokens;
    const list = byModule.get(item.modulePath) || [];
    list.push(item.stub);
    byModule.set(item.modulePath, list);
  }

  for (const [modulePath, exports] of byModule) {
    result.push({ modulePath, exports });
  }

  return { stubs: result, stubTokens: used, truncated };
}

export function estimateFileContextTokens(
  sourceCode: string,
  stubTokens: number,
  rulesTokens: number
): number {
  return estimateTokens(sourceCode) + stubTokens + rulesTokens;
}

export function fitsInBudget(totalTokens: number, maxContextTokens: number): boolean {
  return totalTokens <= maxContextTokens;
}

export function computeBatchTokenBudget(maxContextTokens: number, batchSize: number): number {
  return maxContextTokens * batchSize;
}
