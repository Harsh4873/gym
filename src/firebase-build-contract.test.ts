import { describe, expect, it } from 'vitest';
import {
  assertFirebaseBuildConfig,
  FIREBASE_BUILD_ENV_KEYS,
} from './firebase-build-contract';

const completeConfig = Object.fromEntries(
  FIREBASE_BUILD_ENV_KEYS.map((key) => [key, `configured-${key}`]),
);

describe('Gym Firebase build contract', () => {
  it('rejects a build when every Firebase variable is absent', () => {
    expect(() => assertFirebaseBuildConfig({})).toThrow(
      'Gym build stopped: 6 Firebase build variable(s) are unset.',
    );
  });

  it('accepts a complete Firebase configuration', () => {
    expect(assertFirebaseBuildConfig(completeConfig)).toBe('configured');
  });

  it('never accepts a partial configuration as local-only', () => {
    const partial = { ...completeConfig, VITE_FIREBASE_APP_ID: '   ' };
    expect(() => assertFirebaseBuildConfig(partial, true)).toThrow(
      'Missing: VITE_FIREBASE_APP_ID',
    );
  });

  it('allows an all-missing local-only build only through the explicit opt-out', () => {
    expect(assertFirebaseBuildConfig({}, true)).toBe('local-only');
  });
});
