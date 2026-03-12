/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['tests/**', 'node_modules/**'],
    reporters: ['default', 'html'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('recharts')) {
            return 'vendor-recharts'
          }

          if (id.includes('pdf-lib')) {
            return 'vendor-pdf'
          }

          if (id.includes('@aws-sdk')) {
            return 'vendor-aws-sdk'
          }

          if (id.includes('aws-amplify') || id.includes('@aws-amplify')) {
            return 'vendor-amplify'
          }

          if (id.includes('framer-motion')) {
            return 'vendor-motion'
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons'
          }

          if (id.includes('sonner')) {
            return 'vendor-sonner'
          }

          if (id.includes('zustand')) {
            return 'vendor-zustand'
          }

          return 'vendor'
        },
      },
    },
  },
})
