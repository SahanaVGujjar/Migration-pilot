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
    }

    const exports = this.extractExportsForProfile(profile, code, sourcePath, content);

    const needsLLM =
      profile.requiresLLM ||
      (profile.id === 'js-to-ts' && this.needsSemanticTyping(content)) ||
      (profile.id === 'class-to-hooks' && /class\s+\w+\s+extends\s+(React\.)?Component/.test(content)) ||
      profile.id === 'python-to-java' ||
      profile.id === 'java-to-python';

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
    if (profile.id === 'python-to-java' || profile.id === 'java-to-python') {
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
