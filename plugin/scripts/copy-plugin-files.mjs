import { copyFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pluginRoot = fileURLToPath(new URL('..', import.meta.url))
const distDir = fileURLToPath(new URL('../dist/', import.meta.url))

mkdirSync(distDir, { recursive: true })

for (const file of ['plugin.json', 'preload.js', 'icon.png', 'LICENSE']) {
  copyFileSync(`${pluginRoot}${file}`, `${distDir}${file}`)
}
