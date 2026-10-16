import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

function prototypeEntry(request: IncomingMessage, response: ServerResponse, next: () => void): void {
  if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(302, { Location: '/architecture.html' })
    response.end()
    return
  }
  next()
}

// Deliberately separate from electron-vite: no preload, main process or real workspace.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react(), {
    name: 'isolated-prototype-entry',
    configureServer(server) { server.middlewares.use(prototypeEntry) },
    configurePreviewServer(server) { server.middlewares.use(prototypeEntry) }
  }],
  server: { host: '127.0.0.1', port: 5180, strictPort: true },
  preview: { host: '127.0.0.1', port: 5180, strictPort: true },
  build: {
    outDir: resolve(__dirname, 'out/architecture-prototype'),
    emptyOutDir: true,
    rollupOptions: { input: resolve(__dirname, 'src/renderer/architecture.html') }
  }
})
