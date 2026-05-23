import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { MigrationProfile } from '../core/types';

export class Validator {
  constructor(
    private targetDir: string,
    private profile: MigrationProfile
  ) {}

  async runValidators(): Promise<{ passed: boolean; output: string }> {
    if (this.profile.validators.length === 0) {
      return { passed: true, output: 'No validators configured' };
    }

    const outputs: string[] = [];
    let passed = true;

    for (const validator of this.profile.validators) {
      try {
        const output = execSync(validator, {
          cwd: this.targetDir,
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 120000,
        });
        outputs.push(`✓ ${validator}\n${output}`);
      } catch (error: unknown) {
        passed = false;
        const err = error as { stdout?: string; stderr?: string; message?: string };
        outputs.push(
          `✗ ${validator}\n${err.stdout || err.stderr || err.message || 'Validation failed'}`
        );
      }
    }

    return { passed, output: outputs.join('\n\n') };
  }

  ensureTsConfig(): void {
    const tsconfigPath = path.join(this.targetDir, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) return;

    const config = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'node',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        jsx: 'react',
        allowJs: true,
        noEmit: true,
      },
      include: ['**/*.ts', '**/*.tsx'],
    };

    fs.writeFileSync(tsconfigPath, JSON.stringify(config, null, 2));
  }
}

export function formatValidatorResult(passed: boolean, output: string): string {
  return passed
    ? chalk.green('✓ Validators passed')
    : chalk.red(`✗ Validators failed\n${chalk.gray(output.slice(0, 500))}`);
}
