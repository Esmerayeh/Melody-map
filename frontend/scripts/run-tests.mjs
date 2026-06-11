import { spawnSync } from 'node:child_process'

const files = [
  'tests/shellEntry.test.js',
  'tests/routeSanity.test.js',
  'tests/galaxyInteraction.test.js',
  'tests/identityCardExport.test.js',
  'tests/shareUtils.test.js',
  'tests/mobileReadiness.test.js',
  'tests/recommendationTracking.test.js',
  'tests/semanticLayout.test.js',
  'tests/presenceTraversal.test.js',
]

const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: false,
})

process.exit(result.status ?? 1)
