// Configuration and hazard checks for the dsh-theme-demo stylesheet.
//
// Resolves client.js relative to this file, so it runs from a fresh clone
// without a server and without any machine-specific path.
//
// Run:  node verify/check-config.mjs
import { readFile } from 'node:fs/promises'

const src = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

// The bundle ships in the module-loader envelope, so it is executed with a stub
// loader to recover the plugin object.
let loaded = null
globalThis.window = { __ModuleLoader__: { load(s) { loaded = s } } }
new Function(src)()
const mod = loaded.factory(() => { throw new Error('unexpected require') })

// A stub DOM captures the stylesheet without a browser.
let css = null
globalThis.document = {
  createElement() { return { dataset: {}, textContent: '', remove() {} } },
  head: { appendChild(tag) { css = tag.textContent } },
}
let tokens = null
mod.apply({
  effect(fn) { return fn() },
  theme: { overrideTokens(source, t) { tokens = t; return () => {} } },
})

if (!css) {
  console.log('FAIL  no stylesheet produced')
  process.exit(1)
}

const rules = css.split('}').filter((r) => r.trim()).length
console.log('stylesheet bytes:', css.length, '| rules:', rules)
console.log('tokens supplied :', Object.keys(tokens).length)

let fails = 0
function check(label, ok) {
  if (!ok) fails++
  console.log((ok ? 'PASS  ' : 'FAIL  ') + label)
}

// An unbalanced sheet silently discards every rule after the break.
let depth = 0
let min = 0
for (const ch of css) {
  if (ch === '{') depth++
  else if (ch === '}') { depth--; if (depth < min) min = depth }
}
console.log()
check('braces balanced', depth === 0 && min === 0)

// Every token must carry both palette modes or the theme service rejects it.
const badTokens = Object.keys(tokens).filter((n) => {
  const v = tokens[n]
  return !v || typeof v.light !== 'string' || typeof v.dark !== 'string'
})
check('every token has {light,dark}'
  + (badTokens.length ? ': ' + badTokens.join(',') : ''), badTokens.length === 0)

const SCROLL = '\\[data-input-scroll="true"\\]'

// The input fill is the one setting whose selector target moves. The painted
// level and the cleared levels must never overlap: identical selectors with
// !important on both sides cancel the fill outright.
console.log('\n--- input fill wiring ---')
const clearRule = css.match(
  /[^}]*\{background-color:transparent !important;background-image:none !important;border:none !important;box-shadow:none !important;\}/,
)
const clearSel = clearRule ? clearRule[0].split('{')[0] : ''
const paintMatch = css.match(
  /(html body [^{]*)\{background-color:#[0-9a-f]{6} !important;background-image:none !important;border:1px solid/,
)
const paintSel = paintMatch ? paintMatch[1].trim() : ''
console.log('      painted : ' + (paintSel || '(not found)'))
check('a fill level is painted', paintSel !== '')
check('painted level NOT in the clear list', paintSel !== '' && !clearSel.split(',')
  .map((s) => s.trim()).includes(paintSel))
// When the fill sits outside the scroll container, that container becomes an
// inner layer and must be cleared, or it shows as a box inside a box.
const paintsOutward = paintSel.includes(':has(')
const clearsScroll = clearSel.split(',').map((s) => s.trim())
  .includes('html body [data-input-scroll="true"]')
check('outward fill also clears the scroll container',
  !paintsOutward || clearsScroll)

// Hazards that each cost a debugging round during development. Every one of
// these is a real fault that shipped and had to be traced from a screenshot.
console.log('\n--- regressions ---')
check('no !important on the global white-text rule (would flatten syntax colours)',
  !/body,\s*body button[^{]*\{[^}]*!important/.test(css))
check('highlighted code keeps color:revert', css.includes('color:revert'))
check('measuring mirror pinned transparent (ghost text)',
  /mirror[^{]*\{color:transparent/.test(css)
  || css.includes('-webkit-text-fill-color:transparent'))
check('clipPath rects excluded from svg fill', css.includes('svg:not(defs)'))
check('svg text painted with fill, not color', /svg text[^{]*\{fill:/.test(css))
check('placeholder vendor prefixes are separate rules',
  css.includes('::-webkit-input-placeholder{') && css.includes('::-moz-placeholder{'))
check('focus uses inset shadow, not outline', !/\{[^}]*outline:\s*\d/.test(css))
check('autofill override present', css.includes('0 0 0 1000px'))
check('svg reset present (no box around standalone icons)',
  /svg\{border:none/.test(css))
check('menus matched by role, not class substring', css.includes('[role="menuitem"]'))
check('menu structural wrappers cleared', css.includes('_viewport'))
check('bubble colour limited to direct text child',
  !/\[class\*="bubble"\]\s+\*\s*\{[^}]*!important/.test(css))

// The veil must be a gradient layer: opacity would composite the whole body
// subtree, text included.
if (css.includes('url(')) {
  console.log('\n--- background ---')
  check('veil is a gradient layer, not opacity', css.includes('linear-gradient(rgba('))
  check('asset referenced by plugin route', css.includes('/dsh-theme-demo/assets/'))
}

console.log('\n' + (fails === 0 ? 'ALL CHECKS PASSED' : fails + ' CHECK(S) FAILED'))
process.exit(fails === 0 ? 0 : 1)
