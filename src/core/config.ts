import * as path from 'path';
import { MigrationConfig, ProfileId } from './types';
import { resolveDirs } from './paths';
import { loadDotEnv, resolveLLMFromEnv } from '../llm/env-config';

export interface CLIOptions {
  from?: string;
  to?: string;
  copyStatic?: boolean;
  noCopyStatic?: boolean;
  clean?: boolean;
  git?: boolean;
  batchSize?: number;
  maxContextTokens?: number;
  maxTokens?: number;
  testCommand?: string;
  noTests?: boolean;
  tests?: boolean;
  dryRun?: boolean;
  ai?: boolean;
  noAi?: boolean;
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  cacheDir?: string;
  verbose?: boolean;
  expandContext?: boolean;
}

const DEFAULTS = {
  batchSize: 5,
  maxContextTokens: 4000,
  maxTokens: 50000,
};

export function buildConfig(profileId: ProfileId, options: CLIOptions): MigrationConfig {
  loadDotEnv();

  const { sourceDir, outputDir } = resolveDirs({
    from: options.from,
    to: options.to,
  });

  const aiEnabled = options.noAi ? false : options.ai !== false;
  const llm = resolveLLMFromEnv({
    provider: options.provider,
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
  });

  return {
    profileId,
    targetDir: outputDir,
    sourceDir,
    outputDir,
    copyStaticFiles: options.noCopyStatic !== true,
    useGit: options.git === true,
    batchSize: options.batchSize ?? DEFAULTS.batchSize,
    maxContextTokens: options.maxContextTokens ?? DEFAULTS.maxContextTokens,
    maxTokens: options.maxTokens ?? DEFAULTS.maxTokens,
    runTests: options.tests !== false && !options.noTests,
    testCommand: options.testCommand || '',
    dryRun: options.dryRun ?? false,
    aiEnabled,
    provider: llm.provider,
    model: llm.model,
    apiKey: llm.apiKey,
    baseUrl: llm.baseUrl,
    cacheDir: options.cacheDir || path.join(outputDir, '.migration-pilot', 'cache'),
    verbose: options.verbose ?? false,
    expandContext: options.expandContext ?? false,
  };
}
