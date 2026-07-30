/**
 * Final pack: dark-mode catalog timeline only (HTML mocks first).
 * 1440x900, English where possible, courses visible, no favorites needed.
 */
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'presentation-iteration-shots', 'dark-uniform')
const SHOTS_ROOT = join(ROOT, 'docs', 'presentation-iteration-shots')
const WORKTREE = join(ROOT, '.capture-worktree-clear')
const PORT = 5173
const BASE = `http://localhost:${PORT}`
const API = 'https://studyplanner-api.ben-tischberger.workers.dev'
const ORIGIN = 'https://studyplaner.pages.dev'
const W = 1440
const H = 900
const VIEWPORT = { width: W, height: H }

const SHOTS = [
  { id: '01-html-dashboard', kind: 'html', page: 'dashboard' },
  { id: '02-html-catalog', kind: 'html', page: 'catalog' },
  { id: '03-early-react-catalog', kind: 'app', commit: 'ba8e6a1', path: '/catalog', auth: false },
  { id: '04-early-catalog-cards', kind: 'app', commit: '34c9db6', path: '/catalog', auth: false },
  { id: '05-api-catalog', kind: 'app', commit: 'bd91025', path: '/catalog', auth: true },
  { id: '06-studyplanner-catalog', kind: 'app', commit: 'e9f534f', path: '/catalog', auth: true },
  { id: '07-filters-catalog', kind: 'app', commit: 'daf2d7b', path: '/catalog', auth: true },
  { id: '08-test-landing', kind: 'app', commit: 'f6b5144', path: '/test', auth: true, noCourses: true },
  { id: '09-test-catalog', kind: 'app', commit: 'f6b5144', path: '/test/catalog', auth: true },
  { id: '10-season-catalog', kind: 'app', commit: '1033d12', path: '/catalog', auth: true },
  { id: '11-currentish-catalog', kind: 'app', commit: '1807ecc', path: '/catalog', auth: true },
  { id: '12-prod-catalog', kind: 'live', path: '/catalog' },
  { id: '13-prod-beta', kind: 'live', path: '/beta', noCourses: true },
]

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf8',
    stdio: opts.stdio ?? ['ignore', 'pipe', 'pipe'],
    shell: true,
  })
}

function resolveCommit(ref) {
  return sh('git', ['rev-parse', ref]).trim()
}

function ensureWorktree(commit) {
  if (!existsSync(WORKTREE)) sh('git', ['worktree', 'add', '--detach', WORKTREE, commit])
  else {
    sh('git', ['checkout', '--detach', commit], { cwd: WORKTREE })
    sh('git', ['reset', '--hard', commit], { cwd: WORKTREE })
  }
}

function lockHash(frontendDir) {
  const lock = join(frontendDir, 'package-lock.json')
  const pkg = join(frontendDir, 'package.json')
  return createHash('sha1')
    .update(existsSync(lock) ? readFileSync(lock) : readFileSync(pkg))
    .digest('hex')
    .slice(0, 12)
}

async function killPort() {
  for (let i = 0; i < 3; i++) {
    try {
      sh('powershell', [
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${PORT} -State Listen -EA SilentlyContinue | ForEach-Object { $procId = $_.OwningProcess; Stop-Process -Id $procId -Force -EA SilentlyContinue }`,
      ])
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
}

async function waitUp() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(BASE, { signal: AbortSignal.timeout(1500) })
      if (r.ok || r.status === 404) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}

function ensureNpm(frontendDir, cacheKey) {
  const marker = join(frontendDir, 'node_modules', '.capture-lock')
  const prev = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : ''
  if (prev === cacheKey && existsSync(join(frontendDir, 'node_modules', 'vite'))) return
  sh('npm', ['install', '--no-audit', '--no-fund'], { cwd: frontendDir, stdio: 'inherit' })
  writeFileSync(marker, cacheKey)
}

function startVite(frontendDir) {
  return spawn(
    'npx',
    ['vite', '--host', 'localhost', '--port', String(PORT), '--strictPort', '--force'],
    {
      cwd: frontendDir,
      env: { ...process.env, VITE_API_BASE_URL: API, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    },
  )
}

async function loginEnglish() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'test', password: 'test' }),
  })
  if (!res.ok) throw new Error(`login ${res.status}`)
  const body = await res.json()
  const token = ((res.headers.getSetCookie?.() ?? [])[0] ?? '')
    .split(';')[0]
    .split('=')
    .slice(1)
    .join('=')
  await fetch(`${API}/api/me/profile`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': body.csrfToken,
      'Content-Type': 'application/json',
      Cookie: `studyplanner_session=${token}`,
    },
    body: JSON.stringify({
      appLanguage: 'en',
      studyProgramId: body.user.profile.studyProgramId,
      currentSemesterLabel: body.user.profile.currentSemesterLabel,
    }),
  })
  return token
}

async function dismiss(page) {
  for (const sel of [
    'button:has-text("Skip")',
    'button:has-text("Überspringen")',
    'button:has-text("Close")',
    'button:has-text("Schließen")',
    'button:has-text("Not now")',
    'button:has-text("Finish")',
    'button:has-text("Fertig")',
    '[aria-label="Close"]',
  ]) {
    const btn = page.locator(sel).first()
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {})
      await page.waitForTimeout(150)
    }
  }
}

async function forceAppDark(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem('theme', 'dark')
    } catch {}
    document.documentElement?.classList.add('dark')
  })
}

async function waitCourses(page, timeoutMs = 70000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const text = await page.locator('body').innerText().catch(() => '')
    const loading =
      /Kurse werden aus der Datenbank geladen|Loading courses from the database|Could not reach the server/i.test(
        text,
      )
    const has = /\d+\s*ECTS/i.test(text) || /Showing\s+\d+\s+courses/i.test(text) || /Machine Learning/i.test(text)
    if (!loading && has) return true
    await page.waitForTimeout(600)
  }
  return false
}

async function saveShot(page, id) {
  await page.screenshot({
    path: join(OUT, `${id}.png`),
    fullPage: false,
    clip: { x: 0, y: 0, width: W, height: H },
  })
  console.log('  OK', id)
}

async function enableHtmlDark(page) {
  // TweaksPanel is closed by default — use compact moon DarkToggle in TopMenu.
  const clicked = await page.evaluate(() => {
    const attr = document.body.getAttribute('data-dark')
    if (attr === '1') return 'already'
    const buttons = [...document.querySelectorAll('header button, aside button')]
    const moonBtn = buttons.find((b) => (b.innerHTML || '').includes('M21 12.79'))
    if (!moonBtn) return 'missing'
    moonBtn.click()
    return 'clicked'
  })
  await page.waitForTimeout(450)
  const darkAttr = await page.evaluate(() => document.body.getAttribute('data-dark'))
  console.log(`  html dark toggle=${clicked} data-dark=${darkAttr}`)
  if (darkAttr !== '1') throw new Error(`HTML mock still light (data-dark=${darkAttr})`)
}

async function captureHtml(browser, shot) {
  const htmlPath = existsSync(join(ROOT, 'StudyOS.html'))
    ? join(ROOT, 'StudyOS.html')
    : (() => {
        const p = join(OUT, '_StudyOS.html')
        writeFileSync(p, sh('git', ['show', '6c943ca:frontend/StudyOS.html']))
        return p
      })()

  const page = await browser.newPage({ viewport: VIEWPORT, colorScheme: 'dark', locale: 'en-US' })
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)

  if (shot.page === 'catalog') {
    await page.getByText('Kurskatalog', { exact: true }).first().click()
  } else {
    await page.getByText('Dashboard', { exact: true }).first().click()
  }
  await page.waitForTimeout(400)
  await enableHtmlDark(page)

  await saveShot(page, shot.id)
  await page.close()
  return true
}

async function newCtx(browser, token, auth) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: 'dark',
    locale: 'en-US',
  })
  await context.addInitScript(
    ({ t, needAuth }) => {
      try {
        localStorage.setItem('theme', 'dark')
        if (needAuth && t) {
          localStorage.setItem('studyplaner.auth.token', t)
          localStorage.setItem('studyplanner.auth.token', t)
        }
      } catch {}
      document.documentElement?.classList.add('dark')
    },
    { t: token, needAuth: auth },
  )
  if (auth) {
    await context.addCookies([
      {
        name: 'studyplanner_session',
        value: token,
        domain: 'studyplanner-api.ben-tischberger.workers.dev',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      },
    ])
  }
  return context
}

async function captureApp(browser, token, shot) {
  ensureWorktree(resolveCommit(shot.commit))
  const frontendDir = join(WORKTREE, 'frontend')
  ensureNpm(frontendDir, lockHash(frontendDir))
  await killPort()
  const child = startVite(frontendDir)
  if (!(await waitUp())) {
    child.kill()
    throw new Error('vite failed')
  }
  const context = await newCtx(browser, token, Boolean(shot.auth))
  const page = await context.newPage()
  await page.goto(`${BASE}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await forceAppDark(page)
  await dismiss(page)
  if (!shot.noCourses) {
    const ok = await waitCourses(page)
    if (!ok) {
      console.log('  SKIP no courses', shot.id)
      await context.close()
      child.kill()
      await killPort()
      return false
    }
  } else {
    await page.waitForTimeout(1200)
  }
  await forceAppDark(page)
  await saveShot(page, shot.id)
  await context.close()
  child.kill()
  await killPort()
  return true
}

async function captureLive(browser, token, shot) {
  const context = await newCtx(browser, token, true)
  const page = await context.newPage()
  await page.goto(`${ORIGIN}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await forceAppDark(page)
  await dismiss(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await forceAppDark(page)
  await dismiss(page)
  if (!shot.noCourses) {
    const ok = await waitCourses(page)
    if (!ok) {
      console.log('  SKIP live no courses', shot.id)
      await context.close()
      return false
    }
  } else {
    for (let i = 0; i < 40; i++) {
      const t = await page.locator('body').innerText()
      if (/Loading…|Loading\.\.\./i.test(t) && t.trim().length < 40) {
        await page.waitForTimeout(500)
        continue
      }
      if (/ECTS|Study plan|BETA|Semester|WS|SS/i.test(t)) break
      await page.waitForTimeout(400)
    }
  }
  await forceAppDark(page)
  await saveShot(page, shot.id)
  await context.close()
  return true
}

function cleanupOtherShots() {
  // Keep only dark-uniform folder contents; delete filled/ authed/ and root pngs
  for (const name of ['filled', 'authed']) {
    const p = join(SHOTS_ROOT, name)
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true })
      console.log('removed', name)
    }
  }
  for (const f of readdirSync(SHOTS_ROOT)) {
    if (f.endsWith('.png') || f.endsWith('.json') || f === 'CLEAR-PASS.md' || f === 'INDEX.md') {
      unlinkSync(join(SHOTS_ROOT, f))
      console.log('removed root', f)
    }
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  for (const f of readdirSync(OUT)) {
    if (f.endsWith('.png') || f.endsWith('.html')) unlinkSync(join(OUT, f))
  }
  cleanupOtherShots()

  await killPort()
  const token = await loginEnglish()
  console.log('logged in, English profile')

  const browser = await chromium.launch({ headless: true })
  const kept = []

  for (const shot of SHOTS) {
    console.log(`\n=== ${shot.id} ===`)
    try {
      let ok = false
      if (shot.kind === 'html') ok = await captureHtml(browser, shot)
      else if (shot.kind === 'live') ok = await captureLive(browser, token, shot)
      else ok = await captureApp(browser, token, shot)
      if (ok) kept.push(shot.id)
    } catch (e) {
      console.error('  FAIL', e.message ?? e)
      await killPort()
    }
  }

  await browser.close()
  await killPort()

  writeFileSync(
    join(OUT, 'README.md'),
    [
      '# Dark catalog timeline (presentation)',
      '',
      `All **${W}×${H}px**, dark mode. HTML mocks first, then catalog evolution + test + beta.`,
      'English UI where the build supports it. No favorites required.',
      '',
      ...kept.map((id, i) => `${i + 1}. \`${id}.png\``),
      '',
    ].join('\n'),
  )
  writeFileSync(
    join(SHOTS_ROOT, 'README.md'),
    [
      '# Presentation screenshots',
      '',
      'Only folder needed: **[dark-uniform/](dark-uniform/)**',
      '',
      'Catalog (+ HTML mocks, /test, /beta), dark mode, same size.',
      '',
    ].join('\n'),
  )
  console.log(`\nDone ${kept.length}/${SHOTS.length} → ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
