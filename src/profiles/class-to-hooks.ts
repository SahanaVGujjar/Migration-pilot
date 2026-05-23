import { MigrationProfile } from '../core/types';

export const classToHooksProfile: MigrationProfile = {
  id: 'class-to-hooks',
  source: { name: 'React Class Components', extensions: ['.jsx', '.tsx', '.js', '.ts'] },
  target: { name: 'React Hooks', extensions: ['.jsx', '.tsx', '.js', '.ts'] },
  fileGlobs: ['**/*.jsx', '**/*.tsx', '**/*.js', '**/*.ts'],
  extensionMap: { '.js': '.jsx', '.ts': '.tsx', '.jsx': '.jsx', '.tsx': '.tsx' },
  validators: [],
  requiresLLM: true,
  rules: [
    'Convert React class components to functional components',
    'Replace this.state with useState hooks',
    'Replace lifecycle methods with useEffect',
    'Replace this.props with destructured props parameter',
    'Convert class methods to useCallback where needed',
    'Preserve component export names and behavior',
  ],
  promptTemplate: `Convert React class components to functional components with hooks.

Migration rules:
- {{migrationRules}}

Dependency symbol stubs:
{{dependencyStubs}}

Source file: {{sourcePath}}
\`\`\`
{{sourceCode}}
\`\`\`

Return JSON only:
{
  "targetCode": "...full converted file...",
  "targetExtension": ".tsx or .jsx",
  "exports": [{ "name": "...", "kind": "function|const|default", "signature": "..." }],
  "confidence": 0.0-1.0,
  "warnings": []
}`,
};
