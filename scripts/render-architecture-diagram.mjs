/**
 * Dark architecture diagram — original connected layout (D1 hub) + MCP branch.
 * Explicit SVG arrows with real vertical runs (no stub tips on corners).
 *
 * Output: docs/StudyOS-architecture-diagram.png
 * Run: node scripts/render-architecture-diagram.mjs
 */
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs', 'StudyOS-architecture-diagram.png')
mkdirSync(join(ROOT, 'docs'), { recursive: true })

const BG = '#23262D'
const FG = '#ECECEC'
const MUTED = '#A8ABB2'
const WHITE = '#2E323A'
const RED_BG = '#3A2228'
const RED = '#D14060'
const TEAL_BG = '#1F3333'
const TEAL = '#4AA8A6'
const GOLD_BG = '#332C1E'
const GOLD = '#C9A24A'
const PURPLE_BG = '#2A2640'
const PURPLE = '#9B8CFF'
const DB_BG = '#1A2228'
const BORDER = '#5A606C'

// Box geometry (must match SVG anchors below)
// AI:     gpt(40,50,240,88)  mcp(360,50,260,88)
// App:    student(40,200,240,108) frontend(360,190,260,128) api(720,190,260,128)
// D1:     (720,390,260,145)
// Data:   uni(40,540,260,108) scraper(380,530,280,128)

const html = `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1100px; height: 720px;
    background: ${BG};
    font-family: Inter, -apple-system, sans-serif;
    color: ${FG};
    position: relative;
  }
  .lbl { position: absolute; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; }
  .box {
    position: absolute; border-radius: 10px; border: 2px solid;
    padding: 12px 14px; display: flex; flex-direction: column; justify-content: center;
  }
  .box h3 { font-size: 17px; font-weight: 700; line-height: 1.15; text-transform: uppercase; color: ${FG}; }
  .box p { margin-top: 5px; font-size: 12.5px; font-weight: 400; color: ${MUTED}; line-height: 1.3; }
  .white { background: ${WHITE}; border-color: ${BORDER}; }
  .red { background: ${RED_BG}; border-color: ${RED}; }
  .teal { background: ${TEAL_BG}; border-color: ${TEAL}; }
  .gold { background: ${GOLD_BG}; border-color: ${GOLD}; }
  .purple { background: ${PURPLE_BG}; border-color: ${PURPLE}; }
  .db { background: ${DB_BG}; border-color: ${TEAL}; border-width: 2.5px; }
  .edge-label {
    position: absolute; font-size: 12.5px; font-weight: 500;
    background: ${BG}; padding: 0 4px; white-space: nowrap; z-index: 2;
  }
  svg.edges { position: absolute; inset: 0; width: 1100px; height: 720px; pointer-events: none; z-index: 1; }
</style></head>
<body>
  <div class="lbl" style="left:40px;top:24px;color:${PURPLE};">AI</div>
  <div class="lbl" style="left:40px;top:168px;color:${TEAL};">APP</div>
  <div class="lbl" style="left:360px;top:168px;color:${RED};">CLOUDFLARE</div>
  <div class="lbl" style="left:40px;top:508px;color:${TEAL};">COURSE DATA</div>

  <div class="box purple" style="left:40px;top:50px;width:240px;height:88px;">
    <h3>StudyOS Bot / GPT</h3>
    <p>ChatGPT or any MCP client</p>
  </div>
  <div class="box purple" style="left:360px;top:50px;width:260px;height:88px;">
    <h3>MCP endpoint</h3>
    <p>studyplaner.pages.dev/mcp<br>search · resolve · detail</p>
  </div>

  <div class="box white" style="left:40px;top:200px;width:240px;height:108px;">
    <h3>Student</h3>
    <p>phone or laptop</p>
  </div>
  <div class="box red" style="left:360px;top:190px;width:260px;height:128px;">
    <h3>React frontend</h3>
    <p>course search<br>planner and progress</p>
  </div>
  <div class="box teal" style="left:720px;top:190px;width:260px;height:128px;">
    <h3>API Worker</h3>
    <p>authentication<br>catalog · plans · progress</p>
  </div>
  <div class="box db" style="left:720px;top:390px;width:260px;height:145px;">
    <h3>Cloudflare D1</h3>
    <p>courses + schedules<br>degree progress<br>single source of truth</p>
  </div>

  <div class="box gold" style="left:40px;top:540px;width:260px;height:108px;">
    <h3>University sources</h3>
    <p>ALMA · Moodle · ILIAS</p>
  </div>
  <div class="box white" style="left:380px;top:530px;width:280px;height:128px;">
    <h3>Scraper + matcher</h3>
    <p>collects and combines data</p>
  </div>

  <svg class="edges" viewBox="0 0 1100 720">
    <defs>
      <marker id="a-p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="${PURPLE}"/>
      </marker>
      <marker id="a-d" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="${BORDER}"/>
      </marker>
      <marker id="a-r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="${RED}"/>
      </marker>
      <marker id="a-t" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="${TEAL}"/>
      </marker>
    </defs>

    <!-- Bot → MCP -->
    <line x1="280" y1="94" x2="360" y2="94" stroke="${PURPLE}" stroke-width="2.5" marker-end="url(#a-p)"/>

    <!-- MCP → API: one clean L into the top of the API Worker -->
    <path d="M620 94 H850 V190" fill="none" stroke="${PURPLE}" stroke-width="2.5" marker-end="url(#a-p)"/>

    <!-- Student → Frontend -->
    <line x1="280" y1="254" x2="360" y2="254" stroke="${BORDER}" stroke-width="2.5" marker-end="url(#a-d)"/>

    <!-- Frontend → API -->
    <line x1="620" y1="254" x2="720" y2="254" stroke="${RED}" stroke-width="2.5" marker-end="url(#a-r)"/>

    <!-- API → D1 -->
    <line x1="850" y1="318" x2="850" y2="390" stroke="${TEAL}" stroke-width="2.5" marker-end="url(#a-t)"/>

    <!-- Uni → Scraper -->
    <line x1="300" y1="594" x2="380" y2="594" stroke="${BORDER}" stroke-width="2.5" marker-end="url(#a-d)"/>

    <!-- Scraper → D1: right to D1 center-x, then UP into D1 bottom (long vertical) -->
    <path d="M660 594 H850 V535" fill="none" stroke="${TEAL}" stroke-width="2.5" marker-end="url(#a-t)"/>
  </svg>

  <div class="edge-label" style="left:300px;top:76px;color:${PURPLE};">MCP</div>
  <div class="edge-label" style="left:860px;top:130px;color:${PURPLE};">reads</div>
  <div class="edge-label" style="left:300px;top:234px;color:${MUTED};">uses</div>
  <div class="edge-label" style="left:640px;top:234px;color:${RED};">requests</div>
  <div class="edge-label" style="left:860px;top:340px;color:${TEAL};">reads + writes</div>
  <div class="edge-label" style="left:315px;top:574px;color:${MUTED};">courses</div>
  <div class="edge-label" style="left:740px;top:560px;color:${TEAL};">publish</div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1100, height: 720 } })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: OUT })
console.log('wrote', OUT)
await browser.close()
