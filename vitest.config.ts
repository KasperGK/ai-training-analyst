import { defineConfig } from 'vitest/config'
import path from 'path'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load .env.local for integration tests
  const env = loadEnv(mode, process.cwd(), '')

  return {
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
      env: {
        NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
      },
      coverage: {
        reporter: ['text', 'json', 'html'],
        include: ['src/app/api/chat/tools/**/*.ts', 'src/lib/**/*.ts'],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
