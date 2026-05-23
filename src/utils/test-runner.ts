import { execSync } from 'child_process';
import chalk from 'chalk';

export interface TestResult {
  passed: boolean;
  output: string;
  duration: number;
}

export class TestRunner {
  private cwd: string;
  private testCommand: string;

  constructor(cwd: string, testCommand: string) {
    this.cwd = cwd;
    this.testCommand = testCommand;
  }

  detectTestCommand(): string | null {
    const detectors: Array<{ file: string; command: string }> = [
      { file: 'jest.config.js', command: 'npx jest --passWithNoTests' },
      { file: 'jest.config.ts', command: 'npx jest --passWithNoTests' },
      { file: 'vitest.config.ts', command: 'npx vitest run' },
      { file: 'vitest.config.js', command: 'npx vitest run' },
      { file: '.mocharc.yml', command: 'npx mocha' },
      { file: 'pytest.ini', command: 'pytest' },
      { file: 'pyproject.toml', command: 'pytest' },
    ];

    const fs = require('fs');
    const path = require('path');

    for (const detector of detectors) {
      if (fs.existsSync(path.join(this.cwd, detector.file))) {
        return detector.command;
      }
    }

    // Check package.json for test script
    const pkgPath = path.join(this.cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
          return 'npm test';
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  async runTests(): Promise<TestResult> {
    const startTime = Date.now();
    try {
      const output = execSync(this.testCommand, {
        cwd: this.cwd,
        encoding: 'utf-8',
        timeout: 120000,
        stdio: 'pipe',
      });

      return {
        passed: true,
        output,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        passed: false,
        output: error.stdout || error.stderr || error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  formatResult(result: TestResult): string {
    const status = result.passed
      ? chalk.green('✓ Tests PASSED')
      : chalk.red('✗ Tests FAILED');
    const duration = chalk.gray(`(${(result.duration / 1000).toFixed(1)}s)`);
    return `${status} ${duration}`;
  }
}
