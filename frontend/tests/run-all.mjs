import { spawn } from 'node:child_process'

const tests = [
  'tests/routeSanity.test.js',
  'tests/galaxyInteraction.test.js',
  'tests/identityCardExport.test.js',
  'tests/mobileReadiness.test.js',
  'tests/recommendationTracking.test.js',
]

function runTest(testFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [testFile], {
      stdio: 'inherit',
      shell: false,
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${testFile} terminated with signal ${signal}`))
        return
      }
      if (code !== 0) {
        reject(new Error(`${testFile} exited with code ${code}`))
        return
      }
      resolve()
    })
  })
}

async function main() {
  for (const testFile of tests) {
    // Keep output grouped and deterministic across CI shells.
    console.log(`\n[frontend:test] Running ${testFile}`)
    await runTest(testFile)
  }
  console.log('\n[frontend:test] All frontend sanity tests passed.')
}

main().catch((error) => {
  console.error('\n[frontend:test] Failed:', error.message)
  process.exit(1)
})
