/**
 * Render the real app chrome for the presentation as PNGs:
 *  - docs/app-chrome/topbar-<section>.png  (production TopBar, our sections as nav)
 *  - docs/app-chrome/topbar-none.png
 *  - docs/app-chrome/log-example.png       (faithful /log Request-log page with example entries)
 *
 * Uses the exact dark-mode tokens from frontend/src/index.css and the markup of
 * TopBar.tsx / RequestLogPage.tsx, screenshotted with Playwright at 2x.
 * The logo is embedded as a data URI (file:// srcs broke inside setContent).
 *
 * Run: node scripts/render-app-chrome.mjs
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'app-chrome')
const LOGO_URI = `data:image/png;base64,${readFileSync(join(ROOT, 'docs', 'studyos-logo-glyph.png')).toString('base64')}`

// Presentation sections, mirroring the grading rubric order
const SECTIONS = ['Problem', 'Students', 'Product', 'Build', 'Iterate', 'Demo', 'Future', 'Try it']

const FONTS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap" rel="stylesheet">
`

// dark-mode tokens (frontend/src/index.css .dark)
const T = {
  sidebar: 'rgb(20,28,34)',
  sidebarHover: 'rgb(38,50,58)',
  sidebarActive: 'rgb(12,18,22)',
  bg: '#23262D', // softened slide background so the page blends into the deck
  surface: '#27292F',
  border: '#3A3D44',
  fg: '#EDEDED',
  fgMuted: '#B1B2B7',
  primary: '#D14060',
}

// Real icons from frontend/src/features/layout/components/icons.tsx
const SUN_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/>
  <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
</svg>`
const GEAR_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

function iconButton(svg) {
  return `<div style="display:flex;height:40px;width:40px;align-items:center;justify-content:center;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:${T.sidebarHover};color:rgba(255,255,255,0.8);">${svg}</div>`
}

function topbarHtml(active) {
  const items = SECTIONS.map((name) => {
    const isActive = name === active
    const style = isActive
      ? `background:${T.sidebarActive};font-weight:600;color:#fff;`
      : `font-weight:500;color:rgba(255,255,255,0.65);`
    return `<a style="display:flex;align-items:center;border-radius:6px;padding:8px 14px;font-size:13.5px;${style}">${name}</a>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}
  <style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',-apple-system,sans-serif}</style></head>
  <body><header style="display:flex;align-items:center;justify-content:space-between;min-height:60px;background:${T.sidebar};padding-left:2rem;padding-right:1.5rem;">
    <div style="display:flex;align-items:center;gap:8px;min-width:0;">
      <div style="display:flex;height:30px;width:30px;align-items:center;justify-content:center;overflow:hidden;border-radius:6px;background:#fff;">
        <img src="${LOGO_URI}" style="height:100%;width:100%;object-fit:contain;padding:2px;">
      </div>
      <span style="font-family:'Source Serif 4',Georgia,serif;font-size:18px;font-weight:600;color:#fff;">StudyPlanner</span>
    </div>
    <nav style="margin:0 2rem;display:flex;flex:1;gap:4px;">${items}</nav>
    <div style="display:flex;align-items:center;gap:8px;">
      ${iconButton(SUN_ICON)}
      ${iconButton(GEAR_ICON)}
    </div>
  </header></body></html>`
}

function logCard({ status, method, url, ts, ms, message }) {
  return `<article style="border-radius:10px;border:1px solid ${T.border};background:${T.surface};padding:12px 16px;font-size:12px;color:${T.fg};margin-bottom:12px;">
    <div style="display:flex;flex-wrap:wrap;align-items:center;column-gap:12px;row-gap:4px;">
      <span style="font-weight:600;color:${T.primary};">${status}</span>
      <span style="font-weight:500;">${method}</span>
      <span style="min-width:0;word-break:break-all;color:${T.fgMuted};">${url}</span>
    </div>
    <div style="margin-top:4px;color:${T.fgMuted};">${ts}</div>
    <div style="margin-top:2px;color:${T.fgMuted};">${ms} ms</div>
    <div style="margin-top:4px;word-wrap:break-word;">${message}</div>
  </article>`
}

function logHtml() {
  const entries = [
    { status: 500, method: 'GET', url: '/api/catalog/courses?period=229', ts: '7/29/2026, 9:14:31 AM', ms: 842, message: 'Internal error while loading the catalog.' },
    { status: 'NETWORK', method: 'POST', url: '/api/me/semester-plans/SS-2026', ts: '7/28/2026, 6:02:12 PM', ms: 30012, message: 'Request failed before reaching the server.' },
    { status: 401, method: 'GET', url: '/api/me/progress', ts: '7/28/2026, 11:47:03 AM', ms: 121, message: 'Session expired.' },
  ].map(logCard).join('')
  const btn = `border-radius:6px;border:1px solid ${T.border};background:${T.surface};padding:6px 12px;font-size:12px;font-weight:500;color:${T.fg};`
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}
  <style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',-apple-system,sans-serif}</style></head>
  <body style="background:${T.bg};">
  <div id="log-root" style="width:720px;padding:20px 16px;">
    <div style="margin-bottom:14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;">
      <div>
        <h1 style="font-size:18px;font-weight:600;color:${T.fg};">Request log</h1>
        <p style="margin-top:4px;font-size:13px;color:${T.fgMuted};">API failures from this browser session and your server-side history.</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button style="${btn}">Refresh session</button>
        <button style="${btn}">Refresh server</button>
      </div>
    </div>
    <section>
      <h2 style="margin-bottom:12px;font-size:14px;font-weight:600;color:${T.fg};">Server (all users)</h2>
      ${entries}
    </section>
  </div></body></html>`
}

async function shoot(page, html, path, width, height) {
  await page.setViewportSize({ width, height })
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path })
  console.log('wrote', path)
}

async function shootLog(page) {
  // Render wider than the content column, then crop to the page content so the
  // screenshot has no empty side gutters when scaled up on the slide.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent(logHtml(), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const box = await page.locator('#log-root').boundingBox()
  const full = join(OUT, 'log-example.png')
  const cropped = join(OUT, 'log-example-cropped.png')
  await page.screenshot({ path: full })
  await page.screenshot({
    path: cropped,
    clip: {
      x: Math.max(0, box.x - 8),
      y: Math.max(0, box.y - 8),
      width: box.width + 16,
      height: box.height + 16,
    },
  })
  console.log('wrote', full)
  console.log('wrote', cropped)
}

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 3 })
mkdirSync(OUT, { recursive: true })

for (const section of [...SECTIONS, null]) {
  const name = section ? section.toLowerCase().replace(/\s+/g, '-') : 'none'
  await shoot(page, topbarHtml(section), join(OUT, `topbar-${name}.png`), 1440, 60)
}
await shootLog(page)

await browser.close()
