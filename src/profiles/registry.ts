import { MigrationProfile } from '../core/types';
import { jsToTsProfile } from './js-to-ts';
import { tsToJsProfile } from './ts-to-js';
import { classToHooksProfile } from './class-to-hooks';
import { pythonToJavaProfile } from './python-to-java';
import { javaToPythonProfile } from './java-to-python';
import { angularToReactProfile } from './angular-to-react';
import { reactToAngularProfile } from './react-to-angular';

const profiles: Record<string, MigrationProfile> = {
  'js-to-ts': jsToTsProfile,
  'ts-to-js': tsToJsProfile,
  'class-to-hooks': classToHooksProfile,
  'python-to-java': pythonToJavaProfile,
  'java-to-python': javaToPythonProfile,
  'angular-to-react': angularToReactProfile,
  'react-to-angular': reactToAngularProfile,
};

export function getProfile(id: string): MigrationProfile {
  const profile = profiles[id];
  if (!profile) {
    throw new Error(
      `Unknown profile "${id}". Supported: ${Object.keys(profiles).join(', ')}`
    );
  }
  return profile;
}

export function listProfiles(): MigrationProfile[] {
  return Object.values(profiles);
}

export function listProfileIds(): string[] {
  return Object.keys(profiles);
}
