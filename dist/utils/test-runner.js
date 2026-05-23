"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunner = void 0;
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
class TestRunner {
    constructor(cwd, testCommand) {
        this.cwd = cwd;
        this.testCommand = testCommand;
    }
    detectTestCommand() {
        const detectors = [
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
            }
            catch {
                // ignore
            }
        }
        return null;
    }
    async runTests() {
        const startTime = Date.now();
        try {
            const output = (0, child_process_1.execSync)(this.testCommand, {
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
        }
        catch (error) {
            return {
                passed: false,
                output: error.stdout || error.stderr || error.message,
                duration: Date.now() - startTime,
            };
        }
    }
    formatResult(result) {
        const status = result.passed
            ? chalk_1.default.green('✓ Tests PASSED')
            : chalk_1.default.red('✗ Tests FAILED');
        const duration = chalk_1.default.gray(`(${(result.duration / 1000).toFixed(1)}s)`);
        return `${status} ${duration}`;
    }
}
exports.TestRunner = TestRunner;
//# sourceMappingURL=test-runner.js.map