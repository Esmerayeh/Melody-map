const path = require('path')
const react = require('@vitejs/plugin-react')
const { build } = require('vite')

async function run() {
  try {
    await build({
      configFile: false,
      root: path.resolve(__dirname, '..'),
      plugins: [react()],
      resolve: {
        preserveSymlinks: true,
      },
      esbuild: false,
      build: {
        minify: 'terser',
      },
    })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
