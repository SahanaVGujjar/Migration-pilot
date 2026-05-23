import { MigrationProfile } from '../core/types';

export const tsToJsProfile: MigrationProfile = {
  id: 'ts-to-js',
  source: { name: 'TypeScript', extensions: ['.ts', '.tsx'] },
  target: { name: 'JavaScript', extensions: ['.js', '.jsx'] },
  fileGlobs: ['**/*.ts', '**/*.tsx'],
  extensionMap: { '.ts': '.js', '.tsx': '.jsx' },
  validators: [],
  requiresLLM: false,
  rules: [
    'Remove all type annotations, interfaces, and type aliases',
    'Remove import type and export type syntax',
    'Keep ES module import/export syntax',
    'Use .jsx for files containing JSX',
    'Remove access modifiers (public, private, protected)',
    'Remove satisfies and as const type assertions where possible',
  ],
  promptTemplate: `Migrate the following {{sourceLanguage}} file to {{targetLanguage}}.

Migration rules:
- {{migrationRules}}

Already-migrated dependency symbol stubs:
{{dependencyStubs}}

Source file: {{sourcePath}}
\`\`\`typescript
{{sourceCode}}
\`\`\`

Return JSON only:
{
  "targetCode": "...full converted file...",
  "targetExtension": ".js or .jsx",
  "exports": [{ "name": "...", "kind": "function|class|const|default", "signature": "..." }],
  "confidence": 0.0-1.0,
  "warnings": []
}`,
};
