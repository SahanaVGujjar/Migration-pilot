import * as path from 'path';
import { MigrationProfile, SymbolStub, TransformOutput } from '../core/types';
import { CodeParser } from '../graph/parser';

export class RuleEngine {
  apply(profile: MigrationProfile, sourcePath: string, content: string): TransformOutput {
    const ext = path.extname(sourcePath);
    const targetExt = profile.extensionMap[ext] || ext;
    const baseName = sourcePath.slice(0, -ext.length);
    const targetPath = baseName + targetExt;

    let code = content;
    const changes: string[] = [];

    if (profile.id === 'js-to-ts') {
      code = this.jsToTsRules(code, changes, targetExt);
    } else if (profile.id === 'ts-to-js') {
      code = this.tsToJsRules(code, changes, targetExt);
    } else if (profile.id === 'class-to-hooks') {
      code = this.classToHooksRules(code, changes);
    } else if (profile.id === 'python-to-java') {
      code = this.pythonToJavaRules(code, changes, sourcePath);
    } else if (profile.id === 'java-to-python') {
      code = this.javaToPythonRules(code, changes);
    } else if (profile.id === 'angular-to-react') {
      code = this.angularToReactRules(code, changes, sourcePath);
    } else if (profile.id === 'react-to-angular') {
      code = this.reactToAngularRules(code, changes, sourcePath);
    }

    const exports = this.extractExportsForProfile(profile, code, sourcePath, content);

    const needsLLM =
      profile.requiresLLM ||
      (profile.id === 'js-to-ts' && this.needsSemanticTyping(content)) ||
      (profile.id === 'class-to-hooks' && /class\s+\w+\s+extends\s+(React\.)?Component/.test(content)) ||
      profile.id === 'python-to-java' ||
      profile.id === 'java-to-python' ||
      profile.id === 'angular-to-react' ||
      profile.id === 'react-to-angular';

    return { code, targetPath, changes, exports, needsLLM };
  }

  private jsToTsRules(code: string, changes: string[], targetExt: string): string {
    let result = code;

    if (/require\s*\(/.test(result)) {
      result = result.replace(
        /const\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        "import $1 from '$2'"
      );
      result = result.replace(
        /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        'import { $1 } from \'$2\''
      );
      changes.push('Converted require() to import');
    }

    if (/module\.exports|exports\./.test(result)) {
      result = result.replace(/module\.exports\s*=\s*/g, 'export default ');
      result = result.replace(/exports\.(\w+)\s*=/g, 'export const $1 =');
      changes.push('Converted CommonJS exports to ES exports');
    }

    result = result.replace(/from\s+['"](\.[^'"]+)\.(js|jsx)['"]/g, "from '$1'");
    changes.push('Removed .js/.jsx from import paths');

    result = result.replace(
      /const\s+(\w+)\s*=\s*(\[\]|\{\}|''|""|``|\d+|true|false|null)/g,
      (match, name, val) => {
        const typeMap: Record<string, string> = {
          '[]': 'unknown[]',
          '{}': 'Record<string, unknown>',
          "''": 'string',
          '""': 'string',
          '``': 'string',
          true: 'boolean',
          false: 'boolean',
          null: 'null',
        };
        if (/^\d+$/.test(val)) return `const ${name}: number = ${val}`;
        const t = typeMap[val];
        return t ? `const ${name}: ${t} = ${val}` : match;
      }
    );

    if (targetExt === '.tsx' && /<\w+/.test(result) && !result.includes('import React')) {
      result = "import React from 'react';\n" + result;
      changes.push('Added React import for JSX');
    }

    return result;
  }

  private tsToJsRules(code: string, changes: string[], targetExt: string): string {
    let result = code;

    result = result.replace(/import\s+type\s+/g, 'import ');
    result = result.replace(/export\s+type\s+/g, 'export ');
    changes.push('Removed type-only import/export keywords');

    result = result.replace(/:\s*[A-Za-z_][\w<>,\[\]|&\s.?]*(?=\s*[,)=;{])/g, '');
    result = result.replace(/\)\s*:\s*[^{=>\n]+(?=\s*\{)/g, ')');
    result = result.replace(/<[^>]+>(?=\s*\()/g, '');
    changes.push('Stripped type annotations');

    result = result.replace(/^\s*(export\s+)?interface\s+\w+[\s\S]*?\}\s*$/gm, '');
    result = result.replace(/^\s*(export\s+)?type\s+\w+\s*=[\s\S]*?;\s*$/gm, '');
    changes.push('Removed interfaces and type aliases');

    result = result.replace(/\s+as\s+const/g, '');
    result = result.replace(/\s+as\s+[A-Za-z_][\w<>]*/g, '');
    result = result.replace(/\s+satisfies\s+[^{;]+/g, '');

    result = result.replace(/^\s*(public|private|protected|readonly)\s+/gm, '');
    changes.push('Removed access modifiers');

    if (targetExt === '.jsx' && /<\w+/.test(result) && !result.includes('import React')) {
      result = "import React from 'react';\n" + result;
    }

    return result;
  }

  private classToHooksRules(code: string, changes: string[]): string {
    if (!/class\s+\w+\s+extends\s+(React\.)?Component/.test(code)) {
      return code;
    }

    let result = code;

    if (!result.includes('useState') && result.includes('this.state')) {
      changes.push('Class component detected — LLM conversion recommended');
    }

    return result;
  }

  private pythonToJavaRules(code: string, changes: string[], sourcePath: string): string {
    let result = code;
    changes.push('Python→Java requires LLM for semantic conversion');

    const className = this.inferJavaClassName(sourcePath);
    if (!result.includes('class ') && /def |class /.test(result)) {
      changes.push(`Suggested Java class name: ${className}`);
    }

    return result;
  }

  private javaToPythonRules(code: string, changes: string[]): string {
    changes.push('Java→Python requires LLM for semantic conversion');
    return code;
  }

  private angularToReactRules(code: string, changes: string[], sourcePath: string): string {
    let result = code;

    if (/\.component\.html$/.test(sourcePath)) {
      changes.push('Angular template file — will be merged into .tsx by LLM');
      return result;
    }

    if (/\.component\.css$|\.component\.scss$/.test(sourcePath)) {
      changes.push('Angular style file — will be converted to CSS Module by LLM');
      return result;
    }

    if (/\.module\.ts$/.test(sourcePath)) {
      changes.push('Angular module file — will be decomposed into direct imports');
      return result;
    }

    if (/@Component\s*\(/.test(result)) {
      changes.push('Angular @Component detected — LLM will convert to React functional component');

      const inputMatches = result.match(/@Input\(\)\s+\w+/g);
      if (inputMatches) {
        changes.push(`Found ${inputMatches.length} @Input() prop(s) — will become React props`);
      }

      const outputMatches = result.match(/@Output\(\)\s+\w+/g);
      if (outputMatches) {
        changes.push(`Found ${outputMatches.length} @Output() event(s) — will become callback props`);
      }
    }

    if (/@Injectable\s*\(/.test(result)) {
      changes.push('Angular @Injectable service — LLM will convert to custom React hook or Context');
    }

    if (/@Pipe\s*\(/.test(result)) {
      changes.push('Angular @Pipe detected — LLM will convert to utility function');
    }

    if (/@Directive\s*\(/.test(result)) {
      changes.push('Angular @Directive detected — LLM will convert to React hook or HOC');
    }

    if (/Observable|Subject|BehaviorSubject|pipe\(/.test(result)) {
      changes.push('RxJS patterns detected — will be converted to React hooks (useState/useEffect)');
    }

    if (/FormGroup|FormControl|FormBuilder/.test(result)) {
      changes.push('Angular Reactive Forms detected — will be converted to React controlled components');
    }

    return result;
  }

  private reactToAngularRules(code: string, changes: string[], sourcePath: string): string {
    let result = code;

    if (/\.module\.css$/.test(sourcePath)) {
      changes.push('CSS Module file — will be converted to Angular component styles');
      return result;
    }

    const hasJSX = /<\w+[\s>\/]/.test(result) && /(?:return|=>)\s*(?:\(?\s*<)/.test(result);
    if (hasJSX) {
      changes.push('JSX detected — LLM will extract Angular template with proper directives');
    }

    const hookPatterns = [
      { regex: /useState\s*[<(]/, name: 'useState → class property' },
      { regex: /useEffect\s*\(/, name: 'useEffect → ngOnInit/ngOnDestroy' },
      { regex: /useContext\s*\(/, name: 'useContext → @Injectable service' },
      { regex: /useRef\s*[<(]/, name: 'useRef → @ViewChild or class property' },
      { regex: /useMemo\s*\(/, name: 'useMemo → getter or computed property' },
      { regex: /useCallback\s*\(/, name: 'useCallback → class method' },
      { regex: /useReducer\s*\(/, name: 'useReducer → service with state management' },
    ];

    for (const { regex, name } of hookPatterns) {
      if (regex.test(result)) {
        changes.push(`React ${name}`);
      }
    }

    if (/useNavigate|useParams|useLocation|<Link[\s>]|<Route[\s>]/.test(result)) {
      changes.push('React Router patterns detected — will be converted to Angular Router');
    }

    if (/createContext|\.Provider[\s>]/.test(result)) {
      changes.push('React Context detected — will be converted to Angular @Injectable service');
    }

    const componentName = this.inferReactComponentName(result);
    if (componentName) {
      changes.push(`Component "${componentName}" will become Angular @Component class`);
    }

    return result;
  }

  private inferReactComponentName(code: string): string | null {
    const exportDefault = code.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (exportDefault) return exportDefault[1];

    const exportNamed = code.match(/export\s+(?:const|function)\s+(\w+)/);
    if (exportNamed) return exportNamed[1];

    const arrowComponent = code.match(/const\s+(\w+)\s*(?::\s*React\.FC)?.*?=.*?=>/);
    if (arrowComponent) return arrowComponent[1];

    return null;
  }

  private inferJavaClassName(sourcePath: string): string {
    const base = path.basename(sourcePath, path.extname(sourcePath));
    return base
      .split(/[_-]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');
  }

  private extractExportsForProfile(
    profile: MigrationProfile,
    code: string,
    sourcePath: string,
    originalContent: string
  ): SymbolStub[] {
    if (
      profile.id === 'python-to-java' ||
      profile.id === 'java-to-python' ||
      profile.id === 'angular-to-react' ||
      profile.id === 'react-to-angular'
    ) {
      const parser = new CodeParser();
      const fromOriginal = parser.extractExports(originalContent, sourcePath);
      if (fromOriginal.length > 0) return fromOriginal;
    }
    return this.extractBasicExports(code, sourcePath);
  }

  private needsSemanticTyping(content: string): boolean {
    return (
      /function\s+\w+\s*\([^)]*\)\s*\{/.test(content) &&
      !/:\s*(string|number|boolean|void|any)/.test(content)
    );
  }

  private extractBasicExports(code: string, sourcePath: string): SymbolStub[] {
    const exports: SymbolStub[] = [];
    const fnRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let m;
    while ((m = fnRegex.exec(code)) !== null) {
      exports.push({ name: m[1], kind: 'function', signature: `${m[1]}()` });
    }

    const constRegex = /export\s+const\s+(\w+)/g;
    while ((m = constRegex.exec(code)) !== null) {
      exports.push({ name: m[1], kind: 'const', signature: `const ${m[1]}` });
    }

    if (/export\s+default/.test(code)) {
      exports.push({ name: 'default', kind: 'default', signature: 'default export' });
    }

    if (exports.length === 0) {
      const base = path.basename(sourcePath, path.extname(sourcePath));
      exports.push({ name: base, kind: 'const', signature: `module ${base}` });
    }

    return exports;
  }
}
