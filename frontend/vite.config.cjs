const react = require('@vitejs/plugin-react')
const { defineConfig } = require('vite')

module.exports = defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 3000,
    // Listen on all interfaces - ensures both 127.0.0.1 and localhost reach this server.
    // The Spotify callback goes directly to Flask (port 5000), not through Vite.
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
