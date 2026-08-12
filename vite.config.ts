import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import {
  assertFirebaseBuildConfig,
  LOCAL_ONLY_BUILD_OPT_OUT,
} from './src/firebase-build-contract';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const allowLocalOnlyBuild = process.env[LOCAL_ONLY_BUILD_OPT_OUT] === '1';
    const firebaseBuild = assertFirebaseBuildConfig(
      loadEnv(mode, process.cwd(), 'VITE_'),
      allowLocalOnlyBuild,
    );
    if (firebaseBuild === 'local-only') {
      console.warn(`[gym] ${LOCAL_ONLY_BUILD_OPT_OUT}=1: building a local-only bundle that cannot sync.`);
    }
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
