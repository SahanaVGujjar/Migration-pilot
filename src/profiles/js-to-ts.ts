import { MigrationProfile } from '../core/types';

export const jsToTsProfile: MigrationProfile = {
  id: 'js-to-ts',
  source: { name: 'JavaScript', extensions: ['.js', '.jsx'] },
  target: { name: 'TypeScript', extensions: ['.ts', '.tsx'] },
  fileGlobs: ['**/*.js', '**/*.jsx'],
  extensionMap: { '.js': '.ts', '.jsx': '.tsx' },
  validators: ['npx tsc --noEmit'],
  requiresLLM: false,
  rules: [
    'Convert require() to ES import statements',
    'Convert module.exports / exports.X to export / export const',
    'Add type annotations where inferrable from defaults and JSDoc',
    'Convert PropTypes to TypeScript interfaces for React components',
    'Remove .js/.jsx extensions from relative import paths',
    'Use .tsx for files containing JSX',
  ],
  promptTemplate: `Migrate the following {{sourceLanguage}} file to {{targetLanguage}}.

Migration rules:
- {{migrationRules}}

Already-migrated dependency symbol stubs (use these types, do NOT request full dependency files):
{{dependencyStubs}}

Source file: {{sourcePath}}
\`\`\`javascript
{{sourceCode}}
\`\`\`

Return JSON only:
{
  "targetCode": "...full converted file...",
  "targetExtension": ".ts or .tsx",
  "exports": [{ "name": "...", "kind": "function|class|type|const|default|interface", "signature": "..." }],
  "confidence": 0.0-1.0,
  "warnings": []
}`,
};
