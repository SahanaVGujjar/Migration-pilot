import { estimateTokens } from './budget';

export interface CodeChunk {
  index: number;
  content: string;
  tokens: number;
}

export function splitByTopLevelDeclarations(
  sourceCode: string,
  maxTokensPerChunk: number
): CodeChunk[] {
  if (estimateTokens(sourceCode) <= maxTokensPerChunk) {
    return [{ index: 0, content: sourceCode, tokens: estimateTokens(sourceCode) }];
  }

  const lines = sourceCode.split('\n');
  const chunks: CodeChunk[] = [];
  let current = '';
  let depth = 0;
  let chunkIndex = 0;

  const flush = (): void => {
    if (current.trim()) {
      chunks.push({
        index: chunkIndex++,
        content: current.trim(),
        tokens: estimateTokens(current),
      });
      current = '';
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      depth === 0 &&
      /^(export\s+)?(function|class|const|let|var|interface|type|enum)\s/.test(trimmed)
    ) {
      flush();
    }

    current += line + '\n';

    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;

    if (depth <= 0 && estimateTokens(current) >= maxTokensPerChunk * 0.8) {
      flush();
      depth = 0;
    }
  }

  flush();

  if (chunks.length === 0) {
    return [{ index: 0, content: sourceCode, tokens: estimateTokens(sourceCode) }];
  }

  return chunks;
}

export function mergeChunks(chunks: string[]): string {
  return chunks.filter(Boolean).join('\n\n');
}
