import { MigrationProfile, PromptContext } from '../core/types';

const SYSTEM_PROMPT =
  'You are a code migration engine. Return ONLY valid JSON, no markdown fences or explanation.';

export function buildPrompt(profile: MigrationProfile, context: PromptContext): string {
  const template = profile.promptTemplate;

  const rules = context.migrationRules.join('\n- ');
  const stubsJson = JSON.stringify(context.dependencyStubs, null, 2);

  return template
    .replace(/\{\{sourceLanguage\}\}/g, context.sourceLanguage)
    .replace(/\{\{targetLanguage\}\}/g, context.targetLanguage)
    .replace(/\{\{migrationRules\}\}/g, rules)
    .replace(/\{\{dependencyStubs\}\}/g, stubsJson)
    .replace(/\{\{sourceCode\}\}/g, context.sourceCode)
    .replace(/\{\{sourcePath\}\}/g, context.sourcePath);
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function parseLLMResponse(text: string): {
  targetCode: string;
  targetExtension: string;
  exports: Array<{ name: string; kind: string; signature: string }>;
  confidence: number;
  warnings: string[];
} {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('LLM response did not contain valid JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    targetCode: parsed.targetCode || '',
    targetExtension: parsed.targetExtension || '',
    exports: parsed.exports || [],
    confidence: parsed.confidence ?? 0.5,
    warnings: parsed.warnings || [],
  };
}
