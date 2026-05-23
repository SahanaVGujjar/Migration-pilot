import * as path from 'path';
import {
  LLMConversionResult,
  LLMProvider,
  MigrationConfig,
  MigrationProfile,
  PromptContext,
  SymbolStub,
  TokenUsage,
} from '../core/types';
import { SymbolRegistry } from '../graph/symbol-registry';
import { assembleDependencyStubs, estimateTokens, fitsInBudget } from '../token/budget';
import { TokenCache } from '../token/cache';
import { mergeChunks, splitByTopLevelDeclarations } from '../token/chunker';
import { buildPrompt, getSystemPrompt, parseLLMResponse } from '../llm/prompt-builder';
import { RuleEngine } from './rule-engine';
import { CodeParser } from '../graph/parser';

export class LLMTransformer {
  private ruleEngine = new RuleEngine();
  private parser = new CodeParser();
  private cache: TokenCache;
  private totalTokensUsed: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cached: false,
  };

  constructor(
    private config: MigrationConfig,
    private profile: MigrationProfile,
    private llm: LLMProvider | null
  ) {
    this.cache = new TokenCache(config.cacheDir);
  }

  getTokenUsage(): TokenUsage {
    return { ...this.totalTokensUsed };
  }

  async transformFile(
    sourcePath: string,
    content: string,
    registry: SymbolRegistry
  ): Promise<{
    targetPath: string;
    code: string;
    exports: SymbolStub[];
    changes: string[];
    usedLLM: boolean;
    cacheHit: boolean;
    tokenUsage: TokenUsage;
  }> {
    const ruleResult = this.ruleEngine.apply(this.profile, sourcePath, content);
    const depStubs = registry.getStubsForImports(this.getImportPaths(sourcePath, content));
    const assembled = assembleDependencyStubs(
      depStubs,
      Math.floor(this.config.maxContextTokens * 0.3)
    );

    const rulesTokens = estimateTokens(this.profile.rules.join('\n'));
    const sourceTokens = estimateTokens(content);
    const contextTokens = sourceTokens + assembled.stubTokens + rulesTokens;

  if (!this.config.aiEnabled || !this.llm || !ruleResult.needsLLM) {
      const parserExports = this.parser.extractExports(ruleResult.code, ruleResult.targetPath);
      return {
        targetPath: ruleResult.targetPath,
        code: ruleResult.code,
        exports: parserExports.length > 0 ? parserExports : ruleResult.exports,
        changes: ruleResult.changes,
        usedLLM: false,
        cacheHit: false,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cached: false },
      };
    }

    if (this.totalTokensUsed.totalTokens >= this.config.maxTokens) {
      throw new Error(`Token limit exceeded (${this.config.maxTokens})`);
    }

    const depHash = registry.hash();
    const cacheKey = TokenCache.computeKey(this.profile.id, content, depHash);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      this.addTokenUsage(cached.tokenUsage);
      return {
        targetPath: this.resolveTargetPath(sourcePath, cached.targetExtension),
        code: cached.targetCode,
        exports: cached.exports,
        changes: [...ruleResult.changes, 'LLM conversion (cached)'],
        usedLLM: true,
        cacheHit: true,
        tokenUsage: cached.tokenUsage,
      };
    }

    let code: string;
    let exports: SymbolStub[];
    let tokenUsage: TokenUsage;
    const changes = [...ruleResult.changes];

    if (fitsInBudget(contextTokens, this.config.maxContextTokens)) {
      const result = await this.convertWithLLM(
        sourcePath,
        ruleResult.code,
        assembled.stubs,
        ruleResult.targetPath
      );
      code = result.targetCode;
      exports = result.exports;
      tokenUsage = result.tokenUsage;
      changes.push('LLM conversion');
      this.cache.set(cacheKey, result);
    } else {
      const chunks = splitByTopLevelDeclarations(
        ruleResult.code,
        Math.floor(this.config.maxContextTokens * 0.6)
      );
      const converted: string[] = [];

      for (const chunk of chunks) {
        const result = await this.convertWithLLM(
          sourcePath,
          chunk.content,
          assembled.stubs,
          ruleResult.targetPath
        );
        converted.push(result.targetCode);
        this.addTokenUsage(result.tokenUsage);
      }

      code = mergeChunks(converted);
      exports = this.parser.extractExports(code, ruleResult.targetPath);
      tokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cached: false,
      };
      changes.push(`LLM conversion (${chunks.length} chunks)`);
    }

    return {
      targetPath: this.resolveTargetPath(sourcePath, path.extname(ruleResult.targetPath)),
      code,
      exports,
      changes,
      usedLLM: true,
      cacheHit: false,
      tokenUsage,
    };
  }

  private async convertWithLLM(
    sourcePath: string,
    sourceCode: string,
    dependencyStubs: Array<{ modulePath: string; exports: SymbolStub[] }>,
    targetPath: string
  ): Promise<LLMConversionResult> {
    if (!this.llm) {
      throw new Error('LLM provider not available');
    }

    const context: PromptContext = {
      sourceLanguage: this.profile.source.name,
      targetLanguage: this.profile.target.name,
      migrationRules: this.profile.rules,
      dependencyStubs,
      sourceCode,
      sourcePath,
    };

    const prompt = buildPrompt(this.profile, context);

    if (this.config.verbose) {
      console.log(`\n  [verbose] Prompt tokens ~${estimateTokens(prompt)}`);
      console.log(`  [verbose] Dep stubs: ${dependencyStubs.length} modules (stubs only, no full files)`);
    }

    const response = await this.llm.complete(prompt, {
      systemPrompt: getSystemPrompt(),
      maxTokens: 4096,
      temperature: 0.1,
    });

    const parsed = parseLLMResponse(response.text);
    const tokenUsage: TokenUsage = {
      promptTokens: response.promptTokens,
      completionTokens: response.completionTokens,
      totalTokens: response.promptTokens + response.completionTokens,
      cached: false,
    };

    this.addTokenUsage(tokenUsage);

    return {
      targetCode: parsed.targetCode || sourceCode,
      targetExtension: parsed.targetExtension || path.extname(targetPath),
      exports: parsed.exports as SymbolStub[],
      confidence: parsed.confidence,
      warnings: parsed.warnings,
      tokenUsage,
    };
  }

  private getImportPaths(sourcePath: string, content: string): string[] {
    const allFiles = new Set([sourcePath]);
    return this.parser.extractImports(content, sourcePath, allFiles);
  }

  private resolveTargetPath(sourcePath: string, ext: string): string {
    const oldExt = path.extname(sourcePath);
    if (ext.startsWith('.')) {
      return sourcePath.slice(0, -oldExt.length) + ext;
    }
    const mapped = this.profile.extensionMap[oldExt];
    return sourcePath.slice(0, -oldExt.length) + (mapped || oldExt);
  }

  private addTokenUsage(usage: TokenUsage): void {
    this.totalTokensUsed.promptTokens += usage.promptTokens;
    this.totalTokensUsed.completionTokens += usage.completionTokens;
    this.totalTokensUsed.totalTokens += usage.totalTokens;
  }
}
