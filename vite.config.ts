import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

/** Set to 1 to build a deliberately local-only bundle with no Firebase sync. */
const LOCAL_ONLY_OPT_OUT = 'GYM_ALLOW_LOCAL_ONLY_BUILD';

/**
 * Gym's Firebase configuration is baked in at build time. If a value is absent
 * the bundle silently drops to permanent local-only mode: the user signs in,
 * sees nothing wrong, and gets no sync. Refuse to produce that bundle.
 *
 * A partial configuration is always a mistake and always fails. A completely
 * absent one is a legitimate local-only build, but only when asked for
 * explicitly.
 */
function assertFirebaseConfig(env: Record<string, string>): void {
  const missing = FIREBASE_ENV_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length === 0) return;

  if (missing.length === FIREBASE_ENV_KEYS.length && process.env[LOCAL_ONLY_OPT_OUT] === '1') {
    console.warn(`[gym] ${LOCAL_ONLY_OPT_OUT}=1: building a local-only bundle that cannot sync.`);
    return;
  }

  throw new Error(
    [
      `Gym build stopped: ${missing.length} Firebase build variable(s) are unset.`,
      `Missing: ${missing.join(', ')}`,
      'These are injected from the repository variables in the Pages workflow. A build',
      'without them ships an app that can never sync, with no error shown to the user.',
      `Set them, or pass ${LOCAL_ONLY_OPT_OUT}=1 for a deliberate local-only build.`,
    ].join('\n'),
  );
}

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    assertFirebaseConfig(loadEnv(mode, process.cwd(), 'VITE_'));
  }

  return {
    base: '/gym/',
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
