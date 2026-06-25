import { build } from 'vite'
import react from '@vitejs/plugin-react'

// Carve only the STABLE, already-eager vendors into their own chunks so they stay
// cached across app deploys (the main `index` chunk previously bundled them, so
// every deploy busted their cache). Deliberately minimal: we do NOT manually chunk
// three / @react-three / html2canvas / charts — vite already lazy-splits those off
// the first-paint path, and forcing them into named chunks pulled three into the
// entry preload (a regression). Returning undefined leaves them to vite's default.
function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('framer-motion')) return 'vendor-motion'
  if (id.includes('react-router') || id.includes('@remix-run')) return 'vendor-router'
  if (id.includes('@tanstack')) return 'vendor-query'
  if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react'
  return undefined
}

async function runBuild() {
  await build({
    plugins: [react()],
    build: {
      rollupOptions: {
        output: { manualChunks },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
        '/auth': {
          target: 'http://127.0.0.1:5000',
          changeOrigin: true,
        },
      },
    },
  })
}

runBuild().catch((error) => {
  console.error(error)
  process.exit(1)
})
