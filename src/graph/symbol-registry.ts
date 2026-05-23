import * as crypto from 'crypto';
import { ModuleSymbols, SymbolStub } from '../core/types';

export class SymbolRegistry {
  private modules = new Map<string, ModuleSymbols>();

  register(modulePath: string, targetPath: string, exports: SymbolStub[]): void {
    this.modules.set(modulePath, { modulePath, targetPath, exports });
  }

  has(modulePath: string): boolean {
    return this.modules.has(modulePath);
  }

  get(modulePath: string): ModuleSymbols | undefined {
    return this.modules.get(modulePath);
  }

  getStubsForImports(importPaths: string[]): Array<{ modulePath: string; exports: SymbolStub[] }> {
    const stubs: Array<{ modulePath: string; exports: SymbolStub[] }> = [];

    for (const importPath of importPaths) {
      const mod = this.modules.get(importPath);
      if (mod) {
        stubs.push({ modulePath: mod.targetPath, exports: mod.exports });
      }
    }

    return stubs;
  }

  getAll(): ModuleSymbols[] {
    return Array.from(this.modules.values());
  }

  clear(): void {
    this.modules.clear();
  }

  hash(): string {
    const payload = JSON.stringify(
      this.getAll().map((m) => ({
        path: m.modulePath,
        exports: m.exports.map((e) => `${e.kind}:${e.name}:${e.signature}`),
      }))
    );
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }
}
