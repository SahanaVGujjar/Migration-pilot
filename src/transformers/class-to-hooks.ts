import * as fs from 'fs';
import { TransformResult } from '../types';

interface StateField {
  name: string;
  defaultValue: string;
  type: string;
}

interface LifecycleMethod {
  name: string;
  body: string;
}

interface ExtractedMethod {
  name: string;
  params: string;
  body: string;
}

const JS_KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
  'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new',
  'delete', 'typeof', 'void', 'in', 'of', 'with', 'yield', 'await',
  'class', 'extends', 'super', 'import', 'export', 'default', 'from',
]);

const LIFECYCLE_NAMES = new Set([
  'constructor', 'render', 'componentDidMount', 'componentWillUnmount',
  'componentDidUpdate', 'shouldComponentUpdate', 'componentWillMount',
  'componentWillReceiveProps', 'getDerivedStateFromProps',
  'getSnapshotBeforeUpdate', 'componentDidCatch',
]);

export class ClassToHooksTransformer {
  async transform(filePath: string): Promise<TransformResult> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const changes: string[] = [];
    let linesAdded = 0;
    let linesRemoved = 0;

    let newContent = content;

    const classPattern =
      /class\s+(\w+)\s+extends\s+(?:React\.)?(?:Component|PureComponent)\s*(?:<[^>]*>)?\s*\{/g;
    let match;

    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const classStartIdx = match.index;
      const classOpenBrace = classStartIdx + match[0].length - 1;

      const classBodyEnd = this.findMatchingBrace(content, classOpenBrace);
      if (classBodyEnd === -1) continue;

      const fullClassCode = content.slice(classStartIdx, classBodyEnd + 1);
      const classBody = content.slice(classOpenBrace + 1, classBodyEnd);

      const stateFields = this.extractState(classBody);
      const methods = this.extractClassMethods(classBody);
      const lifecycles = this.extractLifecycleMethods(classBody);
      const renderBody = this.extractRenderBody(classBody);
      const usesProps = /this\.props/.test(classBody);

      if (!renderBody) continue;

      const isTS = filePath.endsWith('.tsx') || filePath.endsWith('.ts');
      const hookComponent = this.buildFunctionalComponent(
        className, stateFields, methods, lifecycles, renderBody, usesProps, isTS
      );

      newContent = newContent.replace(fullClassCode, hookComponent);
      changes.push(`Converted class ${className} to functional component with hooks`);

      if (stateFields.length > 0) {
        changes.push(`Extracted ${stateFields.length} state fields to useState hooks`);
      }
      if (lifecycles.length > 0) {
        changes.push(`Converted ${lifecycles.length} lifecycle methods to useEffect`);
      }
      if (methods.length > 0) {
        changes.push(`Converted ${methods.length} methods to functions`);
      }

      linesRemoved += fullClassCode.split('\n').length;
      linesAdded += hookComponent.split('\n').length;
    }

    if (changes.length > 0) {
      newContent = this.updateImports(newContent);
    }

    return {
      newContent,
      newFilePath: filePath,
      changes: changes.length > 0 ? changes : ['No class components found'],
      linesAdded,
      linesRemoved,
    };
  }

  private findMatchingBrace(content: string, openIdx: number): number {
    let depth = 0;
    for (let i = openIdx; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      if (depth === 0) return i;
    }
    return -1;
  }

  private extractState(classBody: string): StateField[] {
    const fields: StateField[] = [];

    // Match state = { ... } or this.state = { ... }
    const stateRegex = /(?:this\.)?state\s*=\s*\{/g;
    const match = stateRegex.exec(classBody);
    if (!match) return fields;

    const braceStart = match.index + match[0].length - 1;
    const braceEnd = this.findMatchingBrace(classBody, braceStart);
    if (braceEnd === -1) return fields;

    const stateBody = classBody.slice(braceStart + 1, braceEnd);
    const fieldRegex = /(\w+)\s*:\s*([^,\n}]+)/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(stateBody)) !== null) {
      const name = fieldMatch[1].trim();
      const defaultValue = fieldMatch[2].trim();
      fields.push({
        name,
        defaultValue,
        type: this.inferTypeFromValue(defaultValue),
      });
    }

    return fields;
  }

  private extractClassMethods(classBody: string): ExtractedMethod[] {
    const methods: ExtractedMethod[] = [];

    // Arrow methods: name = (params) => { body }
    const arrowRegex = /^\s*(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{/gm;
    let match;

    while ((match = arrowRegex.exec(classBody)) !== null) {
      const name = match[1];
      if (LIFECYCLE_NAMES.has(name) || JS_KEYWORDS.has(name)) continue;

      const braceIdx = classBody.indexOf('{', match.index + match[0].length - 1);
      const braceEnd = this.findMatchingBrace(classBody, braceIdx);
      if (braceEnd === -1) continue;

      const rawBody = classBody.slice(braceIdx + 1, braceEnd);
      methods.push({
        name,
        params: match[2],
        body: this.transformMethodBody(rawBody),
      });
    }

    // Regular methods: name(params) { body }
    const methodRegex = /^\s*(\w+)\s*\(([^)]*)\)\s*\{/gm;
    while ((match = methodRegex.exec(classBody)) !== null) {
      const name = match[1];
      if (LIFECYCLE_NAMES.has(name) || JS_KEYWORDS.has(name)) continue;
      if (methods.some((m) => m.name === name)) continue;

      const braceIdx = match.index + match[0].length - 1;
      const braceEnd = this.findMatchingBrace(classBody, braceIdx);
      if (braceEnd === -1) continue;

      const rawBody = classBody.slice(braceIdx + 1, braceEnd);
      methods.push({
        name,
        params: match[2],
        body: this.transformMethodBody(rawBody),
      });
    }

    return methods;
  }

  private extractLifecycleMethods(classBody: string): LifecycleMethod[] {
    const lifecycles: LifecycleMethod[] = [];
    const names = ['componentDidMount', 'componentWillUnmount', 'componentDidUpdate'];

    for (const name of names) {
      const regex = new RegExp(`\\b${name}\\s*\\([^)]*\\)\\s*\\{`);
      const match = regex.exec(classBody);
      if (!match) continue;

      const braceIdx = match.index + match[0].length - 1;
      const braceEnd = this.findMatchingBrace(classBody, braceIdx);
      if (braceEnd === -1) continue;

      const rawBody = classBody.slice(braceIdx + 1, braceEnd);
      lifecycles.push({
        name,
        body: this.transformMethodBody(rawBody),
      });
    }

    return lifecycles;
  }

  private extractRenderBody(classBody: string): string | null {
    const renderRegex = /\brender\s*\(\s*\)\s*\{/;
    const match = renderRegex.exec(classBody);
    if (!match) return null;

    const braceIdx = match.index + match[0].length - 1;
    const braceEnd = this.findMatchingBrace(classBody, braceIdx);
    if (braceEnd === -1) return null;

    const rawBody = classBody.slice(braceIdx + 1, braceEnd);
    return this.transformRenderBody(rawBody);
  }

  private transformMethodBody(body: string): string {
    let result = body;
    result = result.replace(/this\.state\.(\w+)/g, '$1');
    result = result.replace(
      /this\.setState\(\s*\{\s*(\w+)\s*:\s*([^}]+)\}\s*\)/g,
      (_m, key, value) => {
        const setter = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        return `${setter}(${value.trim()})`;
      }
    );
    result = result.replace(/this\.props/g, 'props');
    result = result.replace(/this\.(\w+)/g, '$1');
    return result;
  }

  private transformRenderBody(body: string): string {
    let result = body;
    // const { x, y } = this.state → remove (we use individual useState vars)
    result = result.replace(/const\s*\{[^}]*\}\s*=\s*this\.state\s*;?\s*\n?/g, '');
    // const { x, y } = this.props → const { x, y } = props
    result = result.replace(/this\.props/g, 'props');
    // this.state.X → X
    result = result.replace(/this\.state\.(\w+)/g, '$1');
    // this.X → X (method calls)
    result = result.replace(/this\.(\w+)/g, '$1');
    return result;
  }

  private buildFunctionalComponent(
    name: string,
    stateFields: StateField[],
    methods: ExtractedMethod[],
    lifecycles: LifecycleMethod[],
    renderBody: string,
    usesProps: boolean,
    isTypeScript: boolean
  ): string {
    const lines: string[] = [];
    const propsParam = usesProps ? (isTypeScript ? 'props: any' : 'props') : '';

    lines.push(`const ${name} = (${propsParam}) => {`);

    for (const field of stateFields) {
      const setter = `set${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`;
      if (isTypeScript) {
        lines.push(`  const [${field.name}, ${setter}] = useState<${field.type}>(${field.defaultValue});`);
      } else {
        lines.push(`  const [${field.name}, ${setter}] = useState(${field.defaultValue});`);
      }
    }
    if (stateFields.length > 0) lines.push('');

    for (const method of methods) {
      const bodyLines = method.body.trim().split('\n').map((l) => '    ' + l.trim()).join('\n');
      lines.push(`  const ${method.name} = (${method.params}) => {`);
      lines.push(bodyLines);
      lines.push('  };');
      lines.push('');
    }

    const didMount = lifecycles.find((l) => l.name === 'componentDidMount');
    const willUnmount = lifecycles.find((l) => l.name === 'componentWillUnmount');
    const didUpdate = lifecycles.find((l) => l.name === 'componentDidUpdate');

    if (didMount || willUnmount) {
      lines.push('  useEffect(() => {');
      if (didMount) {
        for (const line of didMount.body.trim().split('\n')) {
          lines.push('    ' + line.trim());
        }
      }
      if (willUnmount) {
        lines.push('    return () => {');
        for (const line of willUnmount.body.trim().split('\n')) {
          lines.push('      ' + line.trim());
        }
        lines.push('    };');
      }
      lines.push('  }, []);');
      lines.push('');
    }

    if (didUpdate) {
      lines.push('  useEffect(() => {');
      for (const line of didUpdate.body.trim().split('\n')) {
        lines.push('    ' + line.trim());
      }
      lines.push('  });');
      lines.push('');
    }

    for (const line of renderBody.trim().split('\n')) {
      lines.push('  ' + line.trimEnd());
    }

    lines.push('};');
    return lines.join('\n');
  }

  private updateImports(content: string): string {
    const needsUseState = /\buseState\b/.test(content);
    const needsUseEffect = /\buseEffect\b/.test(content);
    const needsUseCallback = /\buseCallback\b/.test(content);

    const hooks: string[] = [];
    if (needsUseState) hooks.push('useState');
    if (needsUseEffect) hooks.push('useEffect');
    if (needsUseCallback) hooks.push('useCallback');
    if (hooks.length === 0) return content;

    const reactImportRegex = /import\s+(?:React\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s+['"]react['"]/;
    const match = reactImportRegex.exec(content);

    if (match) {
      const existing = match[1]
        ? match[1].split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const all = [...new Set([...existing, ...hooks])];
      return content.replace(reactImportRegex, `import React, { ${all.join(', ')} } from 'react'`);
    }

    return `import React, { ${hooks.join(', ')} } from 'react';\n${content}`;
  }

  private inferTypeFromValue(value: string): string {
    const v = value.trim();
    if (v === 'true' || v === 'false') return 'boolean';
    if (v === 'null' || v === 'undefined') return 'any';
    if (/^['"`]/.test(v)) return 'string';
    if (/^\d+(\.\d+)?$/.test(v)) return 'number';
    if (v.startsWith('[')) return 'any[]';
    if (v.startsWith('{')) return 'Record<string, any>';
    return 'any';
  }
}
