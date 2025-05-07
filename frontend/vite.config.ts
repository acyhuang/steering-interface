/// <reference types="vitest" />
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"
import resolve from "vite-plugin-resolve"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const tsconfigPathValue = env.VITE_TSCONFIG_PATH || 'tsconfig.json'

  return {
    plugins: [
      tsconfigPaths({ 
        projects: [tsconfigPathValue]
      }),
      resolve({
        // Explicitly map @/ paths to their actual location
        "@": path.resolve(__dirname, "src"),
      }),
      react()
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./test/setup/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'test/setup/',
          'test/helpers/',
          'test/fixtures/',
          '**/*.d.ts',
        ],
      },
    },
  }
})
