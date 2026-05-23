export type ProfileId =
  | 'js-to-ts'
  | 'ts-to-js'
  | 'class-to-hooks'
  | 'python-to-java'
  | 'java-to-python'
  | 'angular-to-react'
  | 'react-to-angular';

export type LLMProviderType = 'ollama' | 'openai' | 'openrouter' | 'groq' | 'mock';

export type FileStatus =
  | 'pending'
  | 'in_progress'
  | 'migrated'
  | 'failed'
  | 'skipped'
  | 'rolled_back';

export type ExportKind = 'function' | 'class' | 'type' | 'const' | 'default' | 'interface' | 'enum';

export interface LanguageSpec {
  name: string;
  extensions: string[];
}

export interface SymbolStub {
  name: string;
  kind: ExportKind;
  signature: string;
  docHint?: string;
}

export interface ModuleSymbols {
  modulePath: string;
  targetPath: string;
  exports: SymbolStub[];
}

export interface FileNode {
  filePath: string;
  relativePath: string;
  imports: string[];
  importedBy: string[];
  depth: number;
  status: FileStatus;
  estimatedTokens: number;
  error?: string;
}

export interface DependencyGraph {
  nodes: Map<string, FileNode>;
  roots: string[];
  migrationOrder: string[];
}

export interface MigrationBatch {
  id: number;
  files: string[];
  estimatedTokens: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
}

export interface MigrationPlan {
  profileId: ProfileId;
  totalFiles: number;
  totalEstimatedTokens: number;
  batches: MigrationBatch[];
  graph: DependencyGraph;
  estimatedTime: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cached: boolean;
}

export interface LLMConversionResult {
  targetCode: string;
  targetExtension: string;
  exports: SymbolStub[];
  confidence: number;
  warnings: string[];
  tokenUsage: TokenUsage;
}

export interface MigrationResult {
  file: string;
  targetFile: string;
  success: boolean;
  changes: string[];
  error?: string;
  tokenUsage?: TokenUsage;
  usedLLM: boolean;
  cacheHit: boolean;
}

export interface BatchResult {
  batchId: number;
  results: MigrationResult[];
  testsPass: boolean;
  validatorsPass: boolean;
  rolledBack: boolean;
  tokenUsage: TokenUsage;
}

export interface MigrationReport {
  profileId: ProfileId;
  startTime: Date;
  endTime: Date;
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  rolledBackFiles: number;
  batches: BatchResult[];
  needsManualReview: string[];
  tokenUsage: TokenUsage;
  stoppedByTokenLimit: boolean;
}

export interface MigrationConfig {
  profileId: ProfileId;
  /** @deprecated Use outputDir — kept for compatibility */
  targetDir: string;
  sourceDir: string;
  outputDir: string;
  copyStaticFiles: boolean;
  useGit: boolean;
  batchSize: number;
  maxContextTokens: number;
  maxTokens: number;
  runTests: boolean;
  testCommand: string;
  dryRun: boolean;
  aiEnabled: boolean;
  provider: LLMProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  cacheDir: string;
  verbose: boolean;
  expandContext: boolean;
}

export interface MigrationProfile {
  id: ProfileId;
  source: LanguageSpec;
  target: LanguageSpec;
  fileGlobs: string[];
  extensionMap: Record<string, string>;
  validators: string[];
  rules: string[];
  promptTemplate: string;
  requiresLLM: boolean;
}

export interface PromptContext {
  sourceLanguage: string;
  targetLanguage: string;
  migrationRules: string[];
  dependencyStubs: Array<{ modulePath: string; exports: SymbolStub[] }>;
  sourceCode: string;
  sourcePath: string;
}

export interface LLMCompleteOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCompleteResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
}

export interface LLMProvider {
  readonly name: string;
  checkAvailability(): Promise<boolean>;
  complete(prompt: string, options?: LLMCompleteOptions): Promise<LLMCompleteResult>;
}

export interface TransformOutput {
  code: string;
  targetPath: string;
  changes: string[];
  exports: SymbolStub[];
  needsLLM: boolean;
}
