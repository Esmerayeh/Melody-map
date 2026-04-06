import { build } from 'vite'
import react from '@vitejs/plugin-react'

async function runBuild() {
  await build({
    plugins: [react()],
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
