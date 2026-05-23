import { MigrationProfile } from '../core/types';

export const reactToAngularProfile: MigrationProfile = {
  id: 'react-to-angular',
  source: { name: 'React', extensions: ['.jsx', '.tsx', '.js', '.ts'] },
  target: { name: 'Angular', extensions: ['.ts', '.html', '.css'] },
  fileGlobs: ['**/*.jsx', '**/*.tsx', '**/*.js', '**/*.ts'],
  extensionMap: {
    '.jsx': '.ts',
    '.tsx': '.ts',
    '.js': '.ts',
    '.ts': '.ts',
  },
  validators: [],
  requiresLLM: true,
  rules: [
    'Convert React functional components to Angular @Component classes',
    'Extract JSX into a separate Angular template (.component.html) with Angular template syntax',
    'Convert JSX conditionals ({cond && <X/>}, ternaries) to *ngIf directives',
    'Convert JSX .map() iterations to *ngFor directives',
    'Convert JSX className to Angular [ngClass] or class bindings',
    'Convert JSX event handlers (onClick, onChange) to Angular event bindings ((click), (change))',
    'Convert React props interface to Angular @Input() decorated properties',
    'Convert callback props to Angular @Output() with EventEmitter',
    'Convert useState hooks to component class properties',
    'Convert useEffect hooks to Angular lifecycle hooks (ngOnInit, ngOnDestroy) with proper cleanup',
    'Convert useContext/React Context to Angular @Injectable services with dependency injection',
    'Convert custom React hooks to Angular services',
    'Convert React Router (useNavigate, useParams, Link) to Angular Router (Router, ActivatedRoute, routerLink)',
    'Convert CSS Modules or styled-components to Angular component-scoped styles (.component.css)',
    'Generate proper @NgModule or standalone component declarations',
    'Add appropriate Angular imports (CommonModule, FormsModule, RouterModule, etc.)',
    'Preserve all business logic, validation, and data transformations',
  ],
  promptTemplate: `Migrate the following {{sourceLanguage}} component to {{targetLanguage}}.

The output should follow Angular component conventions:
- A TypeScript class with @Component decorator
- Inline or separate template with Angular template syntax
- Proper use of Angular decorators (@Input, @Output, @Injectable)

Migration rules:
- {{migrationRules}}

Already-migrated dependency symbol stubs (use for types/signatures only — NOT full files):
{{dependencyStubs}}

Source file: {{sourcePath}}
\`\`\`
{{sourceCode}}
\`\`\`

Return JSON only:
{
  "targetCode": "...full Angular component .ts file with @Component decorator, template, and styles...",
  "targetExtension": ".ts",
  "exports": [{ "name": "ComponentName", "kind": "class|function|interface", "signature": "..." }],
  "confidence": 0.0-1.0,
  "warnings": []
}`,
};
