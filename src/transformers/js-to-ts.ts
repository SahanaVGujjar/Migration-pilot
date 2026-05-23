import * as fs from 'fs';
import * as path from 'path';
import { TransformResult } from '../types';
import { AIAssistant } from '../utils/ai';

export class JsToTsTransformer {
  private ai: AIAssistant | null;

  constructor(ai?: AIAssistant) {
    this.ai = ai && ai.isAvailable() ? ai : null;
  }

  async transform(filePath: string): Promise<TransformResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const changes: string[] = [];
    let linesAdded = 0;
    let linesRemoved = 0;

    let newContent = content;

    // 1. Convert require() to import statements
    const requireResult = this.convertRequiresToImports(newContent);
    if (requireResult.changed) {
      newContent = requireResult.content;
      changes.push(...requireResult.changes);
      linesAdded += requireResult.linesAdded;
      linesRemoved += requireResult.linesRemoved;
    }

    // 2. Convert module.exports to export
    const exportResult = this.convertExports(newContent);
    if (exportResult.changed) {
      newContent = exportResult.content;
      changes.push(...exportResult.changes);
    }

    // 3. Add type annotations to function parameters
    const funcResult = await this.addFunctionTypes(newContent, filePath);
    if (funcResult.changed) {
      newContent = funcResult.content;
      changes.push(...funcResult.changes);
      linesAdded += funcResult.linesAdded;
    }

    // 4. Convert JSDoc to TypeScript types
    const jsdocResult = this.convertJSDocToTypes(newContent);
    if (jsdocResult.changed) {
      newContent = jsdocResult.content;
      changes.push(...jsdocResult.changes);
    }

    // 5. Add type annotations to variable declarations where possible
    const varResult = this.addVariableTypes(newContent);
    if (varResult.changed) {
      newContent = varResult.content;
      changes.push(...varResult.changes);
    }

    // 6. Fix import extensions (.js → no extension for TS)
    const importExtResult = this.fixImportExtensions(newContent);
    if (importExtResult.changed) {
      newContent = importExtResult.content;
      changes.push(...importExtResult.changes);
    }

    // 7. Handle prop-types for React files
    const ext = path.extname(filePath);
    if (ext === '.jsx' || this.isReactFile(content)) {
      const propsResult = this.convertPropTypes(newContent);
      if (propsResult.changed) {
        newContent = propsResult.content;
        changes.push(...propsResult.changes);
      }
    }

    // Determine new file path
    const newExt = this.isReactFile(newContent) ? '.tsx' : '.ts';
    const newFilePath = filePath.replace(/\.(js|jsx)$/, newExt);

    return {
      newContent,
      newFilePath,
      changes: changes.length > 0 ? changes : ['Renamed to TypeScript'],
      linesAdded,
      linesRemoved,
    };
  }

  private convertRequiresToImports(content: string): {
    content: string;
    changed: boolean;
    changes: string[];
    linesAdded: number;
    linesRemoved: number;
  } {
    const changes: string[] = [];
    let changed = false;
    let linesAdded = 0;
    let linesRemoved = 0;

    let result = content;

    // const X = require('module')
    result = result.replace(
      /const\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g,
      (_match, varName, modulePath) => {
        changed = true;
        changes.push(`Converted require('${modulePath}') to import`);
        return `import ${varName} from '${modulePath}';`;
      }
    );

    // const { a, b } = require('module')
    result = result.replace(
      /const\s+(\{[^}]+\})\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)\s*;?/g,
      (_match, destructured, modulePath) => {
        changed = true;
        changes.push(`Converted destructured require('${modulePath}') to import`);
        return `import ${destructured} from '${modulePath}';`;
      }
    );

    // const X = require('module').default
    result = result.replace(
      /const\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)\.(\w+)\s*;?/g,
      (_match, varName, modulePath, prop) => {
        changed = true;
        changes.push(`Converted require('${modulePath}').${prop} to import`);
        if (prop === 'default') {
          return `import ${varName} from '${modulePath}';`;
        }
        return `import { ${prop} as ${varName} } from '${modulePath}';`;
      }
    );

    return { content: result, changed, changes, linesAdded, linesRemoved };
  }

  private convertExports(content: string): {
    content: string;
    changed: boolean;
    changes: string[];
  } {
    const changes: string[] = [];
    let changed = false;
    let result = content;

    // module.exports = X → export default X
    result = result.replace(
      /module\.exports\s*=\s*(\w+)\s*;?/g,
      (_match, name) => {
        changed = true;
        changes.push(`Converted module.exports to export default`);
        return `export default ${name};`;
      }
    );

    // module.exports = { a, b } → export { a, b }
    result = result.replace(
      /module\.exports\s*=\s*(\{[^}]+\})\s*;?/g,
      (_match, obj) => {
        changed = true;
        changes.push(`Converted module.exports object to named exports`);
        // Parse the object to create named exports
        const props = obj
          .replace(/[{}]/g, '')
          .split(',')
          .map((p: string) => p.trim())
          .filter(Boolean);
        return props.map((p: string) => {
          if (p.includes(':')) {
            const [key, value] = p.split(':').map((s: string) => s.trim());
            return `export { ${value} as ${key} };`;
          }
          return `export { ${p} };`;
        }).join('\n');
      }
    );

    // exports.X = Y → export const X = Y
    result = result.replace(
      /exports\.(\w+)\s*=\s*([\s\S]*?)(?=\n(?:exports\.|module\.|const |let |var |function |class |\/\/)|\n*$)/g,
      (_match, name, value) => {
        changed = true;
        changes.push(`Converted exports.${name} to named export`);
        return `export const ${name} = ${value.trimEnd()}`;
      }
    );

    return { content: result, changed, changes };
  }

  private async addFunctionTypes(
    content: string,
    filePath: string
  ): Promise<{
    content: string;
    changed: boolean;
    changes: string[];
    linesAdded: number;
  }> {
    const changes: string[] = [];
    let changed = false;
    let linesAdded = 0;
    let result = content;

    // Add return type void to functions that don't return anything
    result = result.replace(
      /function\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
      (match, funcName, params) => {
        const hasReturn = this.functionHasReturn(content, match);
        if (!params.includes(':')) {
          changed = true;
          const typedParams = this.inferParamTypes(params, content);
          if (typedParams !== params) {
            changes.push(`Added parameter types to function ${funcName}`);
          }
          if (!hasReturn) {
            changes.push(`Added void return type to function ${funcName}`);
            return `function ${funcName}(${typedParams}): void {`;
          }
          return `function ${funcName}(${typedParams}) {`;
        }
        return match;
      }
    );

    // Arrow functions with parameters: const fn = (a, b) => { ... }
    result = result.replace(
      /(const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g,
      (match, keyword, funcName, params) => {
        if (!params.includes(':') && params.trim().length > 0) {
          changed = true;
          const typedParams = this.inferParamTypes(params, content);
          changes.push(`Added parameter types to arrow function ${funcName}`);
          return `${keyword} ${funcName} = (${typedParams}) =>`;
        }
        return match;
      }
    );

    // Try AI-powered type inference if available
    if (this.ai) {
      try {
        const aiTypes = await this.ai.inferTypes(content, path.basename(filePath));
        for (const typeInfo of aiTypes) {
          if (typeInfo.confidence > 0.7 && typeInfo.inferredType !== 'any') {
            const pattern = new RegExp(
              `(${typeInfo.variableName})(?!\\s*:)\\s*([,)=])`,
              'g'
            );
            const newResult = result.replace(
              pattern,
              `$1: ${typeInfo.inferredType}$2`
            );
            if (newResult !== result) {
              result = newResult;
              changed = true;
              linesAdded++;
              changes.push(
                `AI inferred ${typeInfo.variableName}: ${typeInfo.inferredType} (${Math.round(typeInfo.confidence * 100)}% confidence)`
              );
            }
          }
        }
      } catch {
        // AI inference is best-effort
      }
    }

    return { content: result, changed, changes, linesAdded };
  }

  private inferParamTypes(params: string, fullContent: string): string {
    if (!params.trim()) return params;

    return params
      .split(',')
      .map((param) => {
        const trimmed = param.trim();
        if (!trimmed || trimmed.includes(':')) return param;

        // Handle default values
        if (trimmed.includes('=')) {
          const [name, defaultVal] = trimmed.split('=').map((s) => s.trim());
          const type = this.inferTypeFromDefault(defaultVal);
          return ` ${name}: ${type} = ${defaultVal}`;
        }

        // Handle rest params
        if (trimmed.startsWith('...')) {
          const name = trimmed.slice(3);
          return ` ...${name}: any[]`;
        }

        // Try to infer from usage in function body
        const inferredType = this.inferTypeFromUsage(trimmed, fullContent);
        return ` ${trimmed}: ${inferredType}`;
      })
      .join(',');
  }

  private inferTypeFromDefault(defaultVal: string): string {
    const val = defaultVal.trim();
    if (val === 'true' || val === 'false') return 'boolean';
    if (val === 'null') return 'any';
    if (val === 'undefined') return 'any';
    if (/^['"`]/.test(val)) return 'string';
    if (/^\d+(\.\d+)?$/.test(val)) return 'number';
    if (val.startsWith('[')) return 'any[]';
    if (val.startsWith('{')) return 'Record<string, any>';
    return 'any';
  }

  private inferTypeFromUsage(paramName: string, content: string): string {
    // Check for common patterns in function body
    const lengthCheck = new RegExp(`${paramName}\\.length`, 'g');
    const mapCheck = new RegExp(`${paramName}\\.(map|filter|reduce|forEach|find)`, 'g');
    const stringMethods = new RegExp(`${paramName}\\.(toLowerCase|toUpperCase|trim|split|replace|includes|startsWith|endsWith|match|slice|substring)`, 'g');
    const numberOps = new RegExp(`${paramName}\\s*[+\\-*/]\\s*\\d|\\d\\s*[+\\-*/]\\s*${paramName}`, 'g');
    const booleanCheck = new RegExp(`${paramName}\\s*===?\\s*(true|false)|!${paramName}[^.]`, 'g');

    if (mapCheck.test(content)) return 'any[]';
    if (stringMethods.test(content)) return 'string';
    if (numberOps.test(content)) return 'number';
    if (booleanCheck.test(content)) return 'boolean';
    if (lengthCheck.test(content)) return 'string | any[]';
    return 'any';
  }

  private functionHasReturn(content: string, funcMatch: string): boolean {
    const startIdx = content.indexOf(funcMatch);
    if (startIdx === -1) return false;

    let braceCount = 0;
    let foundOpen = false;
    for (let i = startIdx; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        foundOpen = true;
      }
      if (content[i] === '}') braceCount--;

      if (foundOpen && braceCount === 0) {
        const funcBody = content.slice(startIdx, i + 1);
        return /\breturn\s+[^;]/.test(funcBody);
      }
    }
    return false;
  }

  private convertJSDocToTypes(content: string): {
    content: string;
    changed: boolean;
    changes: string[];
  } {
    const changes: string[] = [];
    let changed = false;
    let result = content;

    // Convert @param {type} name patterns in JSDoc to TS types
    const jsdocPattern = /\/\*\*[\s\S]*?\*\/\s*\n\s*((?:export\s+)?(?:function|const|let|var)\s+\w+)/g;

    let match;
    while ((match = jsdocPattern.exec(content)) !== null) {
      const jsdocBlock = match[0];
      const paramTypes = new Map<string, string>();

      const paramRegex = /@param\s+\{([^}]+)\}\s+(\w+)/g;
      let paramMatch;
      while ((paramMatch = paramRegex.exec(jsdocBlock)) !== null) {
        paramTypes.set(paramMatch[2], this.convertJSDocType(paramMatch[1]));
      }

      if (paramTypes.size > 0) {
        changed = true;
        changes.push(`Extracted types from JSDoc (${paramTypes.size} params)`);
      }
    }

    return { content: result, changed, changes };
  }

  private convertJSDocType(jsdocType: string): string {
    const typeMap: Record<string, string> = {
      'String': 'string',
      'Number': 'number',
      'Boolean': 'boolean',
      'Object': 'Record<string, any>',
      'Array': 'any[]',
      'Function': '(...args: any[]) => any',
      '*': 'any',
    };
    return typeMap[jsdocType] || jsdocType;
  }

  private addVariableTypes(content: string): {
    content: string;
    changed: boolean;
    changes: string[];
  } {
    const changes: string[] = [];
    let changed = false;
    let result = content;

    // Add types to obvious variable declarations:
    // const x = "hello" → const x: string = "hello"
    result = result.replace(
      /(const|let)\s+(\w+)\s*=\s*(true|false)\s*;/g,
      (_match, keyword, name, val) => {
        changed = true;
        return `${keyword} ${name}: boolean = ${val};`;
      }
    );

    result = result.replace(
      /(const|let)\s+(\w+)\s*=\s*(\d+(?:\.\d+)?)\s*;/g,
      (_match, keyword, name, val) => {
        changed = true;
        return `${keyword} ${name}: number = ${val};`;
      }
    );

    result = result.replace(
      /(const|let)\s+(\w+)\s*=\s*(['"`][^'"`]*['"`])\s*;/g,
      (_match, keyword, name, val) => {
        changed = true;
        return `${keyword} ${name}: string = ${val};`;
      }
    );

    result = result.replace(
      /(const|let)\s+(\w+)\s*=\s*new\s+(Map|Set|WeakMap|WeakSet|Array)\s*\(\s*\)\s*;/g,
      (_match, keyword, name, cls) => {
        changed = true;
        const typeMap: Record<string, string> = {
          'Map': 'Map<any, any>',
          'Set': 'Set<any>',
          'WeakMap': 'WeakMap<object, any>',
          'WeakSet': 'WeakSet<object>',
          'Array': 'any[]',
        };
        return `${keyword} ${name}: ${typeMap[cls]} = new ${cls}();`;
      }
    );

    if (changed) {
      changes.push('Added type annotations to variable declarations');
    }

    return { content: result, changed, changes };
  }

  private fixImportExtensions(content: string): {
    content: string;
    changed: boolean;
    changes: string[];
  } {
    const changes: string[] = [];
    let changed = false;

    // Remove .js/.jsx extensions from relative imports
    const result = content.replace(
      /(from\s+['"])([^'"]+)\.(js|jsx)(['"])/g,
      (_match, prefix, modPath, _ext, suffix) => {
        changed = true;
        return `${prefix}${modPath}${suffix}`;
      }
    );

    if (changed) {
      changes.push('Removed .js/.jsx extensions from imports');
    }

    return { content: result, changed, changes };
  }

  private convertPropTypes(content: string): {
    content: string;
    changed: boolean;
    changes: string[];
  } {
    const changes: string[] = [];
    let changed = false;
    let result = content;

    // Extract PropTypes definitions and convert to interfaces
    const propTypesPattern = /(\w+)\.propTypes\s*=\s*\{([^}]+)\}/g;
    const propTypesMatches = [...content.matchAll(propTypesPattern)];

    for (const match of propTypesMatches) {
      const componentName = match[1];
      const propsBody = match[2];
      const interfaceName = `${componentName}Props`;

      const props = this.parsePropTypes(propsBody);
      if (props.length > 0) {
        const interfaceStr = `interface ${interfaceName} {\n${props
          .map((p) => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`)
          .join('\n')}\n}`;

        result = interfaceStr + '\n\n' + result;
        result = result.replace(match[0], '');

        // Remove PropTypes import
        result = result.replace(
          /import\s+PropTypes\s+from\s+['"]prop-types['"];\s*\n?/,
          ''
        );

        changed = true;
        changes.push(
          `Converted PropTypes to TypeScript interface ${interfaceName}`
        );
      }
    }

    return { content: result, changed, changes };
  }

  private parsePropTypes(body: string): Array<{
    name: string;
    type: string;
    required: boolean;
  }> {
    const props: Array<{ name: string; type: string; required: boolean }> = [];

    const propRegex = /(\w+)\s*:\s*PropTypes\.(\w+)(\.\w+)*/g;
    let match;
    while ((match = propRegex.exec(body)) !== null) {
      const propTypeMap: Record<string, string> = {
        string: 'string',
        number: 'number',
        bool: 'boolean',
        func: '(...args: any[]) => any',
        array: 'any[]',
        object: 'Record<string, any>',
        node: 'React.ReactNode',
        element: 'React.ReactElement',
        any: 'any',
      };

      props.push({
        name: match[1],
        type: propTypeMap[match[2]] || 'any',
        required: match[0].includes('.isRequired'),
      });
    }

    return props;
  }

  private isReactFile(content: string): boolean {
    return (
      /import\s+.*React/.test(content) ||
      /from\s+['"]react['"]/.test(content) ||
      /<\w+[\s/>]/.test(content) ||
      /jsx|tsx/.test(content)
    );
  }
}
