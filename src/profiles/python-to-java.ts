import { MigrationProfile } from '../core/types';

export const pythonToJavaProfile: MigrationProfile = {
  id: 'python-to-java',
  source: { name: 'Python', extensions: ['.py'] },
  target: { name: 'Java', extensions: ['.java'] },
  fileGlobs: ['**/*.py'],
  extensionMap: { '.py': '.java' },
  validators: [],
  requiresLLM: true,
  rules: [
    'Convert Python modules to Java classes with appropriate package declarations',
    'Map def functions to public/static methods or instance methods as appropriate',
    'Convert Python class to Java class with constructors instead of __init__',
    'Replace list/dict comprehensions with Java streams or loops',
    'Use Java types: String, int, long, double, boolean, List<T>, Map<K,V>',
    'Convert snake_case names to camelCase for methods/variables; PascalCase for classes',
    'Replace None with null, True/False with true/false',
    'Convert import/from to Java import statements matching package structure',
    'Replace print() with System.out.println() or a logger',
    'Handle if __name__ == "__main__" with a public static void main or remove',
  ],
  promptTemplate: `Migrate the following {{sourceLanguage}} file to {{targetLanguage}}.

Migration rules:
- {{migrationRules}}

Already-migrated dependency symbol stubs (use for types/signatures only — NOT full files):
{{dependencyStubs}}

Source file: {{sourcePath}}
\`\`\`python
{{sourceCode}}
\`\`\`

Return JSON only:
{
  "targetCode": "...full Java source file...",
  "targetExtension": ".java",
  "exports": [{ "name": "ClassName", "kind": "class|function|interface", "signature": "..." }],
  "confidence": 0.0-1.0,
  "warnings": []
}`,
};
