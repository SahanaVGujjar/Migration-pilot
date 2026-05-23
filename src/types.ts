export type MigrationType = 'js-to-ts' | 'class-to-hooks';

export interface MigrationConfig {
  type: MigrationType;
  targetDir: string;
  batchSize: number;
  runTests: boolean;
  testCommand: string;
  dryRun: boolean;
  aiAssisted: boolean;
  ollamaModel: string;
  ollamaUrl: string;
}

export type FileStatus = 'pending' | 'in_progress' | 'migrated' | 'failed' | 'skipped' | 'rolled_back';

export interface FileNode {
  filePath: string;
  relativePath: string;
  imports: string[];
  importedBy: string[];
  depth: number;
  status: FileStatus;
  error?: string;
}

export interface DependencyGraph {
  nodes: Map<string, FileNode>;
  roots: string[];
  migrationOrder: string[];
}

export interface MigrationPlan {
  totalFiles: number;
  batches: MigrationBatch[];
  graph: DependencyGraph;
  estimatedTime: string;
}

export interface MigrationBatch {
  id: number;
  files: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
}

export interface MigrationResult {
  file: string;
  success: boolean;
  changes: string[];
  error?: string;
  linesAdded: number;
  linesRemoved: number;
}

export interface BatchResult {
  batchId: number;
  results: MigrationResult[];
  testsPass: boolean;
  rolledBack: boolean;
}

export interface MigrationReport {
  type: MigrationType;
  startTime: Date;
  endTime: Date;
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  skippedFiles: number;
  rolledBackFiles: number;
  batches: BatchResult[];
  needsManualReview: string[];
}

export interface TransformResult {
  newContent: string;
  newFilePath: string;
  changes: string[];
  linesAdded: number;
  linesRemoved: number;
}

export interface AITypeInference {
  variableName: string;
  inferredType: string;
  confidence: number;
  reasoning: string;
}
