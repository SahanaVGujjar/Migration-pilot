export interface TestResult {
    passed: boolean;
    output: string;
    duration: number;
}
export declare class TestRunner {
    private cwd;
    private testCommand;
    constructor(cwd: string, testCommand: string);
    detectTestCommand(): string | null;
    runTests(): Promise<TestResult>;
    formatResult(result: TestResult): string;
}
//# sourceMappingURL=test-runner.d.ts.map