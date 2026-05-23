import { MigrationProfile } from '../core/types';

export const javaToPythonProfile: MigrationProfile = {
  id: 'java-to-python',
  source: { name: 'Java', extensions: ['.java'] },
  target: { name: 'Python', extensions: ['.py'] },
  fileGlobs: ['**/*.java'],
  extensionMap: { '.java': '.py' },
  validators: ['python -m compileall -q .'],
  requiresLLM: true,
  rules: [
    'Convert Java classes to Python classes; use __init__ instead of constructors',
    'Map public static methods to module-level functions or @staticmethod',
    'Remove access modifiers (public, private, protected)',
    'Convert Java types to Python: String->str, int/long->int, double->float, boolean->bool',
    'Use List, Dict from typing or builtins instead of ArrayList, HashMap',
    'Replace System.out.println with print()',
    'Convert Java import to Python import/from',
    'Replace null with None, true/false with True/False',
    'Convert camelCase methods to snake_case (PEP 8) unless overriding Java API',
    'Remove semicolons, braces; use indentation for blocks',
    'Convert interfaces to ABC or Protocol where appropriate',
  ],
  promptTemplate: `Migrate the following {{sourceLanguage}} file to {{targetLanguage}}.

Migration rules:
- {{migrationRules}}

Already-migrated dependency symbol stubs:
{{dependencyStubs}}

Source file: {{sourcePath}}
\`\`\`java
{{sourceCode}}
\`\`\`

Return JSON only:
{
  "targetCode": "...full Python source file...",
  "targetExtension": ".py",
  "exports": [{ "name": "...", "kind": "function|class|const", "signature": "..." }],
  "confidence": 0.0-1.0,
  "warnings": []
}`,
};
