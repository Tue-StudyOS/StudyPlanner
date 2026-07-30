/**
 * Render AI-tool logos for the presentation:
 *  - claude.png, cursor.png  (Simple Icons)
 *  - pi.png                  (official pi.dev mark, white for dark slides)
 *  - codex.png               (framed app-icon style: rounded square + ">_")
 *
 * Run: node scripts/render-tool-logos.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'tool-logos')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 2 })

async function shootIcon(url, path) {
  await page.setViewportSize({ width: 480, height: 480 })
  await page.setContent(
    `<body style="margin:0;background:transparent"><img id="i" src="${url}" style="width:480px;height:480px"></body>`,
    { waitUntil: 'networkidle' },
  )
  await page.locator('#i').screenshot({ path, omitBackground: true })
  console.log('wrote', path)
}

await shootIcon('https://cdn.simpleicons.org/claude', join(OUT, 'claude.png'))
await shootIcon('https://cdn.simpleicons.org/cursor/FFFFFF', join(OUT, 'cursor.png'))

// Official pi.dev mark (coding CLI harness), forced white
const piSvg = readFileSync(join(OUT, 'pi-logo.svg'), 'utf8')
  .replace(/fill:\s*#000/g, 'fill:#fff')
  .replace(/@media[\s\S]*?}/g, '')
const piUri = `data:image/svg+xml;base64,${Buffer.from(piSvg).toString('base64')}`
await page.setViewportSize({ width: 480, height: 480 })
await page.setContent(
  `<body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;">
     <img id="p" src="${piUri}" style="width:420px;height:420px">
   </body>`,
  { waitUntil: 'networkidle' },
)
await page.locator('#p').screenshot({ path: join(OUT, 'pi.png'), omitBackground: true })
console.log('wrote', join(OUT, 'pi.png'))

// Codex: keep the real app icon the user dropped into docs/tool-logos/codex.png.
// Do not overwrite it here.

await browser.close()
