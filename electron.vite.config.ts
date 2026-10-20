import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: process.env.FORGEDESK_QUICK_OUTPUT_DIR ? resolve(process.env.FORGEDESK_QUICK_OUTPUT_DIR, 'main') : undefined,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          cli: resolve(__dirname, 'src/main/cli.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: process.env.FORGEDESK_QUICK_OUTPUT_DIR ? resolve(process.env.FORGEDESK_QUICK_OUTPUT_DIR, 'preload') : undefined,
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: { outDir: process.env.FORGEDESK_QUICK_OUTPUT_DIR ? resolve(process.env.FORGEDESK_QUICK_OUTPUT_DIR, 'renderer') : undefined },
    plugins: [react()]
  }
})
