import { MigrationProfile } from '../core/types';

export const angularToReactProfile: MigrationProfile = {
  id: 'angular-to-react',
  source: { name: 'Angular', extensions: ['.ts', '.html', '.css', '.scss'] },
  target: { name: 'React', extensions: ['.tsx', '.css'] },
  fileGlobs: ['**/*.component.ts', '**/*.service.ts', '**/*.pipe.ts', '**/*.guard.ts', '**/*.directive.ts', '**/*.module.ts', '**/*.component.html', '**/*.component.css', '**/*.component.scss'],
  extensionMap: {
    '.ts': '.tsx',
    '.html': '.tsx',
    '.css': '.module.css',
    '.scss': '.module.css',
  },
  validators: [],
  requiresLLM: true,
  rules: [
    'Convert @Component classes to React functional components with hooks',
    'Merge Angular template (.html) and component (.ts) into a single .tsx file',
    'Convert Angular template syntax (*ngIf, *ngFor, [ngClass], [(ngModel)]) to JSX equivalents',
    'Replace @Input() properties with React component props via a TypeScript interface',
    'Replace @Output() EventEmitter with callback props (e.g. onChange, onSubmit)',
    'Convert Angular services (@Injectable) to custom React hooks or React Context providers',
    'Replace RxJS Observable patterns (subscribe, pipe, map) with useState/useEffect hooks',
    'Convert Angular lifecycle hooks (ngOnInit, ngOnDestroy) to useEffect',
    'Convert Angular pipes to utility functions and call them inline in JSX',
    'Convert Angular Reactive Forms (FormGroup, FormControl) to React controlled components or react-hook-form',
    'Replace Angular Router (routerLink, ActivatedRoute) with React Router (Link, useNavigate, useParams)',
    'Convert Angular module imports/declarations into standard ES imports',
    'Convert component-scoped CSS/SCSS to CSS Modules (.module.css) with camelCase class references',
    'Remove Angular-specific decorators (@NgModule, @Component, @Injectable, @Pipe, @Directive)',
    'Preserve all business logic, validation, and data transformations',
  ],
  promptTemplate: `Migrate the following {{sourceLanguage}} file to a {{targetLanguage}} functional component with hooks.

Migration rules:
- {{migrationRules}}

Already-migrated dependency symbol stubs (use for types/signatures only — NOT full files):
{{dependencyStubs}}

Source file: {{sourcePath}}
\`\`\`typescript
{{sourceCode}}
\`\`\`

Return JSON only:
{
  "targetCode": "...full React .tsx file with imports, interface for props, and functional component...",
  "targetExtension": ".tsx",
  "exports": [{ "name": "ComponentName", "kind": "function|const|default|interface", "signature": "..." }],
  "confidence": 0.0-1.0,
  "warnings": []
}`,
};
