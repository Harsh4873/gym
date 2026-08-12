export const FIREBASE_BUILD_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export const LOCAL_ONLY_BUILD_OPT_OUT = 'GYM_ALLOW_LOCAL_ONLY_BUILD';

type FirebaseBuildEnvironment = Record<string, string | undefined>;

/**
 * Gym's Firebase configuration is baked in at build time. Refuse to produce a
 * bundle with missing values unless an entirely local-only build was requested
 * explicitly. A partial configuration is never safe, even with the opt-out.
 */
export function assertFirebaseBuildConfig(
  env: FirebaseBuildEnvironment,
  allowLocalOnlyBuild = false,
): 'configured' | 'local-only' {
  const missing = FIREBASE_BUILD_ENV_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length === 0) return 'configured';

  if (missing.length === FIREBASE_BUILD_ENV_KEYS.length && allowLocalOnlyBuild) return 'local-only';

  throw new Error(
    [
      `Gym build stopped: ${missing.length} Firebase build variable(s) are unset.`,
      `Missing: ${missing.join(', ')}`,
      'These are injected from the repository variables in the Pages workflow. A build',
      'without them ships an app that can never sync, with no error shown to the user.',
      `Set them, or pass ${LOCAL_ONLY_BUILD_OPT_OUT}=1 for a deliberate local-only build.`,
    ].join('\n'),
  );
}
