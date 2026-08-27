// dsh-theme-demo, browser half.
//
// Ships in the runtime's module-loader envelope, the same shape the bundler
// emits for the plugins that come with the harness, so no build step is needed
// to install this package.
//
// What this plugin does, and why it is split in two:
//
//   1. Thirteen --dsw-alias-* tokens are overridden. This is the supported
//      theming route and covers every surface that reads the token layer.
//   2. A stylesheet repairs the components the token layer cannot reach. These
//      exist because the app hardcodes light fills in places, and forced white
//      text on a light fill is invisible. Each repair pairs a foreground with a
//      background so no combination can produce unreadable content.
//
// The background image cannot ride a token: theme tokens are declared as CSS
// colors and reject url(...). It is therefore applied through the stylesheet,
// and served by this package's node half over its own HTTP route.

window.__ModuleLoader__.load({
  id: '@dsh-external/dsh-theme-demo',
  factory: () => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    // ---------------------------------------------------------------------
    // Theme configuration.
    //
    // Every value the interactive prototype exposed as a toggle is frozen here.
    // Edit this block to retune the theme; nothing below it needs to change.
    // ---------------------------------------------------------------------
    const SKIN = {
      // Forced white body text plus the component repairs that make it legible.
      // These two belong together: the repairs exist only because white text
      // would otherwise land on light fills. Turning `white` off while leaving
      // `patch` on is a diagnostic state, not a supported look.
      white: true,
      patch: true,

      // Background image served by this package's node half. Set `image` to
      // null for a plain dark background. The prefix must match ROUTE in
      // lib/index.js; a mismatch silently yields no background.
      image: '/dsh-theme-demo/assets/background.png',
      // How much of the image shows through the darkening veil. The veil is what
      // keeps body text readable over artwork.
      strength: 0.45,

      // Selectors, sidebar navigation, and open dropdown menus.
      select: {
        bg: '#4a7bd4', border: '#6f9ae4', fg: '#ffffff', hover: '#5c8ce0',
        selBg: '#1d4ed8', selBorder: '#8fb4f5',
        menuBg: '#16295c', menuItem: '#1d3470', menuHover: '#2d4a8a',
      },
      // Composer toolbar buttons. `followBlock` takes the surface from the code
      // block palette instead of a colour of its own, so the toolbar recedes
      // into the composer rather than forming a bright band across it.
      toolbar: { followBlock: true, fg: '#e8f0ff' },
      // Floating and header action buttons. `followBlock: false` uses the
      // neutral panel tokens, which keeps these controls part of the app chrome
      // instead of reading as code-coloured chips.
      icon: { followBlock: false, fg: '#e8f0ff' },
      // Code blocks and inline code. `banner` is a lighter step of `bg` so the
      // header strip reads as its own band.
      block: { bg: '#0f1f45', border: '#24407a', banner: '#152a5c' },
      // Message bubbles.
      bubble: { bg: '#1c2c4a', text: '#ffffff', border: '#2d4368' },
      // The composer input surface.
      input: { text: '#000000', bg: '#eef2f8', border: '#94a8c4' },
      // Which element carries the input fill. See INPUT_LEVELS below: the
      // composer nests several layers, and painting the wrong one produces a
      // visible box inside a box.
      inputLevel: 'l1',
      placeholder: '#6b7a90',
      // Filled svg badges and the text drawn on top of them. The plate and its
      // label are one setting because the plate exists to back the label.
      rect: { fill: '#16295c', text: '#ffffff' },
      // Run-time metadata, which the app fades out by default.
      time: '#ffffff',
      // Whether icon buttons carry a visible border. With borders off, the
      // selected-state accent bar below carries more of the signalling weight.
      btnBorder: false,
    }

    // The thirteen overridable alias tokens. Every value must supply both
    // palette modes; the same value is repeated because this skin is dark in
    // either preference rather than following the light/dark switch.
    const DARK = {
      base: '#0b1220', layer1: '#111a2b', layer2: '#18233a', overlay: '#1b2740',
      border1: '#243352', border2: '#33456b', brand: '#22d3ee', sidebar: '#080e19',
      label1: '#ffffff', label2: '#c2cfe2',
      // The state colours stay deliberately warm. Making everything cool would
      // cost the semantic distinction between error, warning, and success.
      error: '#f87189', success: '#34d399', warn: '#fbbf24',
    }

    function both(v) { return { light: v, dark: v } }

    function buildTokens() {
      const tokens = {
        '--dsw-alias-bg-base': both(DARK.base),
        '--dsw-alias-bg-layer-1': both(DARK.layer1),
        '--dsw-alias-bg-layer-2': both(DARK.layer2),
        '--dsw-alias-bg-overlay': both(DARK.overlay),
        '--dsw-alias-border-l1': both(DARK.border1),
        '--dsw-alias-border-l2': both(DARK.border2),
        '--dsw-alias-brand-primary': both(DARK.brand),
        '--dsw-alias-label-primary': both(DARK.label1),
        '--dsw-alias-label-secondary': both(DARK.label2),
        '--dsw-alias-state-error-primary': both(DARK.error),
        '--dsw-alias-state-success-primary': both(DARK.success),
        '--dsw-alias-state-warn-primary': both(DARK.warn),
        '--dsw-specific-sidebar-fill': both(DARK.sidebar),
      }
      // The base layer must be transparent for the image to show through; the
      // image itself is painted on body by the stylesheet.
      if (SKIN.image) tokens['--dsw-alias-bg-base'] = both('transparent')
      return tokens
    }

    // ---------------------------------------------------------------------
    // Selectors.
    //
    // CSS Modules class names carry a build hash that changes on every rebuild
    // while the local name does not. Two emit shapes appear in this app:
    //   <hash>_<localName>   e.g. VOzbGW_navCell
    //   _<localName>_<hash>  e.g. _copyButton_178r4_59
    // Matching the local-name substring survives rebuilds either way. Where the
    // component exposes an ARIA role or a data attribute, that is used instead:
    // it is semantic, unique, and cannot collide with a sibling whose local name
    // merely shares a prefix.
    // ---------------------------------------------------------------------
    const SCROLL = '[data-input-scroll="true"]'
    const BACKDROP = '[data-input-backdrop="true"]'
    const MIRROR = '[data-input-mirror="true"]'
    // The html prefix raises specificity above the app's own class rules.
    const H = 'html body '

    // Floating and header actions; these sit on app chrome.
    const ACTION_BTN = [
      H + 'button[class*="toBottom"]',
      H + 'button[aria-label="\u56de\u5230\u5e95\u90e8"]',
      H + 'button[class*="sessionLogButton"]',
      H + 'button[class*="newSession"]',
      H + 'button[aria-label="\u65b0\u5efa\u4f1a\u8bdd"]',
    ].join(',')

    // Composer toolbar buttons.
    //   [class$="_add"] is anchored to the end because a bare "_add" substring
    //   would also match _address, _added and _addButton.
    //   [class*="_trigger"] is restricted to `button` so triggerIcon,
    //   triggerLabel and chevron spans do not each get their own surface.
    const TOOLBAR_BTN = [
      H + 'button[class$="_add"]',
      H + 'button[aria-label="\u547d\u4ee4"]',
      H + 'button[class*="_trigger"]',
    ].join(',')

    // Dropdown triggers and toggle cubes, restricted to `button` so wrapper
    // elements sharing the local name are not painted.
    const SELECT_BTN = [
      H + 'button[class*="_selector"]',
      H + 'button[class*="themeCube"]',
    ].join(',')

    const NAV_BTN = H + 'button[class*="navCell"]'

    // Open menus. Roles are used rather than class names: [class*="_item"]
    // would also match _itemWrap, _itemIcon and _itemLabel, painting three
    // nested surfaces for one row.
    const MENU = H + '[role="menu"], ' + H + '[role="listbox"]'
    const MENU_ITEM = H + '[role="menuitem"], ' + H + '[role="option"]'

    // A component may mark the chosen entry through ARIA, a class, or both.
    const SEL_MARKS = ['[aria-pressed="true"]', '[aria-current]',
      '[class*="_selected"]', '[class*="_active"]']
    const ITEM_MARKS = SEL_MARKS.concat(['[aria-selected="true"]',
      '[aria-checked="true"]'])

    const BANNERW = H + '[class*="_bannerWrap"]'
    const BANNER = H + '[class*="_banner"]'
    const INFOSTR = H + '[class*="_infostring"]'
    const ACTION = H + '[class*="_action"]'
    const COPYBTN = H + '[class*="_copyButton"]'
    const BUBBLE = H + '[class*="bubble"]'
    // The direct text container only, deliberately not a descendant wildcard.
    const BUBBLE_T = H + '[class*="bubble"] > [class*="_text"]'

    // Filled svg shapes that follow `color`. clipPath rects are excluded
    // because their fill is never painted, so recolouring them does nothing
    // visible while risking a clip region being treated as artwork.
    const SVG_RECT = H + 'svg:not(defs) > rect[fill="currentColor"], '
      + H + 'svg g > rect[fill="currentColor"]'
    // SVG text is painted with `fill`; `color` has no effect on it at all.
    const SVG_TEXT = H + 'svg text, ' + H + 'svg tspan'

    const TIME_SEL = [H + '[class*="timeStart"]', H + '[class*="timeEnd"]'].join(',')
    const TIME_KIDS = [H + '[class*="timeStart"] *', H + '[class*="timeEnd"] *'].join(',')
    const TIME_DOT = H + '[class*="runTimeDot"]'
    // opacity composites the whole subtree and cannot be undone from a child,
    // so a faded ancestor has to be cleared as well.
    const TIME_WRAP = [
      H + ':has(> [class*="timeStart"])',
      H + ':has(> [class*="timeEnd"])',
    ].join(',')

    const PLAIN = H + 'input:not([type=checkbox]):not([type=radio])'
      + ':not([type=submit]):not([type=button]):not([type=reset])'
      + ':not([type=file]):not([type=range]):not([type=color]):not([type=image])'
      + ', ' + H + 'select'

    // Which element carries the input fill.
    //
    // The composer nests several layers: an outer frame, the scroll container
    // marked with data-input-scroll, and inside it a grow wrapper, the textarea,
    // a highlight backdrop, and a measuring mirror. Painting one layer while a
    // sibling or ancestor keeps its own fill is what produces a visible box
    // inside a box, so the painted level and the cleared levels must be chosen
    // together — never overlapping.
    const INPUT_LEVELS = {
      // The scroll container itself: the tightest fill, hugging the text.
      l0: H + SCROLL,
      // One level out: includes the composer's own padding, so the fill reads as
      // a field rather than as a highlight behind the text.
      l1: H + ':has(> ' + SCROLL + ')',
      // Two levels out: the whole composer frame including the toolbar row.
      l2: H + ':has(> * > ' + SCROLL + ')',
    }

    // ---------------------------------------------------------------------
    // Stylesheet fragments.
    // ---------------------------------------------------------------------

    function whiteCss() {
      // No !important here on purpose. Syntax highlighting emits inline
      // per-token colours, and an author !important would beat those inline
      // styles and flatten every highlighted block to one colour.
      return 'body, body button, body h1, body h2, body h3, body h4, body h5,'
        + 'body h6, body p, body span, body div, body a, body li, body td,'
        + 'body th, body label, body strong, body em, body small'
        + '{color:var(--dsw-alias-label-primary);}'
        + 'body pre *, body code *, body .shiki, body .shiki *{color:revert;}'
        // The composer backdrop paints highlight chips and owns its palette.
        + 'body ' + BACKDROP + ', body ' + BACKDROP + ' *{color:revert !important;}'
        // The mirror duplicates typed text to measure height and hides itself
        // with a transparent colour. Any visible colour turns it into ghost
        // text sitting exactly on top of the real input.
        + 'body ' + MIRROR + ', body ' + MIRROR + ' *'
        + '{color:transparent !important;}'
    }

    // An svg is a glyph, not a surface. Without this reset the button rules
    // below draw a box around every standalone icon and logo.
    function svgResetCss() {
      return H + 'svg{border:none !important;'
        + 'background-color:transparent !important;'
        + 'background-image:none !important;'
        + 'box-shadow:none !important;'
        + 'outline:none !important;}'
    }

    // Shared emitter for a button group. The icons use fill="currentColor", so
    // `color` is what recolours them. Child spans and svgs are set explicitly
    // rather than relying on inheritance, because the app colours some of them
    // directly.
    function buttonSurface(sel, bg, bd, fg, hover) {
      const parts = sel.split(',')
      const bdr = SKIN.btnBorder
        ? 'border:1px solid ' + bd + ' !important;'
        : 'border:none !important;'
      let css = sel + '{background-color:' + bg + ' !important;'
        + 'background-image:none !important;' + bdr
        + 'color:' + fg + ' !important;}'
      css += parts.map((s) => s + ' span,' + s + ' svg').join(',')
        + '{color:' + fg + ' !important;'
        + '-webkit-text-fill-color:' + fg + ' !important;'
        + 'background-color:transparent !important;}'
      css += parts.map((s) => s + ' svg path[fill="currentColor"]').join(',')
        + '{fill:currentColor !important;}'
      // Outline-style icons follow stroke rather than fill.
      css += parts.map((s) => s + ' svg [stroke="currentColor"]').join(',')
        + '{stroke:currentColor !important;}'
      if (hover) {
        css += parts.map((s) => s + ':hover').join(',')
          + '{background-color:' + hover + ' !important;}'
      }
      return css
    }

    // The selected variant. A brighter fill alone can read as ambiguous on an
    // already-coloured row, so an inset bar is available as a second cue that
    // does not depend on colour discrimination.
    function selectedSurface(sel, selBg, selBorder, accent, marks) {
      const full = []
      sel.split(',').forEach((p) => {
        marks.forEach((m) => { full.push(p.trim() + m) })
      })
      const joined = full.join(',')
      let css = joined + '{background-color:' + selBg + ' !important;'
        + 'background-image:none !important;'
      if (selBorder && SKIN.btnBorder) {
        css += 'border-color:' + selBorder + ' !important;'
      }
      css += 'color:#ffffff !important;}'
      css += full.map((s) => s + ' span,' + s + ' svg').join(',')
        + '{color:#ffffff !important;'
        + '-webkit-text-fill-color:#ffffff !important;}'
      if (accent) {
        css += joined + '{box-shadow:inset 3px 0 0 ' + accent + ' !important;}'
      }
      return css
    }

    // Floating and header actions. Following the neutral panel tokens keeps
    // these as app chrome; following the block palette ties them to code
    // colouring instead.
    function actionBtnCss() {
      const i = SKIN.icon
      const bg = i.followBlock ? SKIN.block.bg : 'var(--dsw-alias-bg-layer-2)'
      const bd = i.followBlock ? SKIN.block.border : 'var(--dsw-alias-border-l1)'
      return buttonSurface(ACTION_BTN, bg, bd, i.fg, bd)
    }

    // Composer toolbar buttons. These sit on the light input fill, so they need
    // a surface of their own regardless of which palette supplies it.
    function toolbarBtnCss() {
      const t = SKIN.toolbar
      const bg = t.followBlock ? SKIN.block.bg : t.bg
      const bd = t.followBlock ? SKIN.block.border : t.border
      // Following the block palette means there is no separate hover colour to
      // use, so the border colour doubles as the hover fill: one clear step
      // lighter than the surface without introducing a fourth blue.
      const hover = t.followBlock ? SKIN.block.border : t.hover
      return buttonSurface(TOOLBAR_BTN, bg, bd, t.fg, hover)
    }

    function selectBtnCss() {
      const s = SKIN.select
      let css = buttonSurface(SELECT_BTN, s.bg, s.border, s.fg, s.hover)
      css += buttonSurface(NAV_BTN, s.bg, s.border, s.fg, s.hover)
      // Emitted after the base rules so they win on source order at equal
      // specificity.
      //
      // With borders switched off, selBorder has nothing to colour, so the
      // brighter fill would be the only signal left. The inset accent bar is
      // added in that case to keep a second, non-colour cue — it costs nothing
      // when borders are on, but it is the difference between obvious and
      // guessable when they are off.
      const accent = 'var(--dsw-alias-brand-primary)'
      css += selectedSurface(SELECT_BTN, s.selBg, s.selBorder,
        SKIN.btnBorder ? null : accent, SEL_MARKS)
      css += selectedSurface(NAV_BTN, s.selBg, s.selBorder, accent, SEL_MARKS)
      return css
    }

    // The open menu. The container carries the surface and the shadow; rows get
    // a slightly lighter fill so they stay separable without borders.
    function menuCss() {
      const s = SKIN.select
      let css = MENU + '{background-color:' + s.menuBg + ' !important;'
        + 'background-image:none !important;'
        + 'border:1px solid ' + s.border + ' !important;'
        + 'box-shadow:0 8px 24px rgba(0,0,0,0.45) !important;'
        + 'color:#ffffff !important;}'
      // Structural wrappers must stay transparent, or viewport and itemWrap
      // each paint another shade over the menu surface.
      css += MENU + ' [class*="_viewport"], ' + MENU + ' [class*="_itemWrap"]'
        + '{background-color:transparent !important;'
        + 'background-image:none !important;}'
      css += MENU_ITEM + '{background-color:' + s.menuItem + ' !important;'
        + 'background-image:none !important;'
        + 'border:none !important;color:#ffffff !important;}'
      const items = MENU_ITEM.split(',')
      css += items.map((x) => x.trim() + ' span,' + x.trim() + ' svg').join(',')
        + '{color:#ffffff !important;'
        + '-webkit-text-fill-color:#ffffff !important;'
        + 'background-color:transparent !important;}'
      // Both drawing styles are pinned: some of these icons are stroked
      // outlines, others are filled shapes.
      css += items.map((x) => x.trim() + ' svg [stroke="currentColor"]').join(',')
        + '{stroke:currentColor !important;}'
      css += items.map((x) => x.trim() + ' svg [fill="currentColor"]').join(',')
        + '{fill:currentColor !important;}'
      css += items.map((x) => x.trim() + ':hover').join(',')
        + '{background-color:' + s.menuHover + ' !important;}'
      // The app marks the current row with a pale grey fill, which disappears
      // under forced white text.
      css += selectedSurface(MENU_ITEM, s.selBg, null, null, ITEM_MARKS)
      // The check glyph is the clearest selection signal, so it is brighter
      // than the row that carries it.
      const checks = []
      items.forEach((x) => {
        ITEM_MARKS.forEach((m) => { checks.push(x.trim() + m + ' [class*="_check"]') })
      })
      css += checks.join(',') + '{color:#7dd3fc !important;}'
      return css
    }

    // The rect is a backplate and the svg text sits on top of it, so the plate
    // and its label are set together.
    function rectCss() {
      return SVG_RECT + '{fill:' + SKIN.rect.fill + ' !important;}'
        + SVG_TEXT + '{fill:' + SKIN.rect.text + ' !important;}'
    }

    // The code block's header strip. Without this the block turns blue while
    // the bar above it stays light and its copy button vanishes.
    function bannerCss() {
      const b = SKIN.block
      let css = BANNERW + ',' + BANNER + ',' + ACTION
        + '{background-color:' + b.banner + ' !important;'
        + 'background-image:none !important;color:#dce6f7 !important;}'
      css += BANNER + '{border-color:' + b.border + ' !important;}'
      css += INFOSTR + '{background-color:transparent !important;'
        + 'color:#b7c7e0 !important;}'
      // A control inside a coloured strip should share that strip's surface.
      // Given its own fill it reads as a floating chip; hover is what makes it
      // discoverable instead.
      css += COPYBTN + '{background-color:transparent !important;'
        + 'background-image:none !important;border:none !important;'
        + 'box-shadow:none !important;color:#cfe0f8 !important;}'
      css += COPYBTN + ':hover{background-color:' + b.border + ' !important;'
        + 'color:#ffffff !important;}'
      return css
    }

    function blockCss() {
      const b = SKIN.block
      const sel = 'body pre, body .shiki, body pre.shiki, body div.shiki'
      return sel + '{background-color:' + b.bg + ' !important;'
        + 'background-image:none !important;'
        + 'border:1px solid ' + b.border + ' !important;}'
        + 'body :not(pre) > code{background-color:' + b.bg + ' !important;'
        + 'border:1px solid ' + b.border + ' !important;}'
        + 'body .shiki .line-number, body .shiki .line.highlighted'
        + '{background-color:transparent !important;}'
    }

    // Applied to the bubble and its direct text child only. A descendant
    // wildcard with !important here would override the inline colours emitted
    // by syntax highlighting for code inside a message.
    function bubbleCss() {
      const b = SKIN.bubble
      return BUBBLE + '{background-color:' + b.bg + ' !important;'
        + 'background-image:none !important;'
        + 'border:1px solid ' + b.border + ' !important;'
        + 'color:' + b.text + ' !important;}'
        + BUBBLE_T + '{color:' + b.text + ' !important;}'
    }

    function placeholderCss() {
      const ph = SKIN.placeholder
      // Each vendor prefix gets its own rule. Inside one comma list, a prefix
      // the browser does not recognise invalidates the entire selector and the
      // rule is dropped.
      return 'body ::placeholder{color:' + ph + ' !important;opacity:1 !important;}'
        + 'body ::-webkit-input-placeholder{color:' + ph + ' !important;opacity:1 !important;}'
        + 'body ::-moz-placeholder{color:' + ph + ' !important;opacity:1 !important;}'
    }

    function inputCss() {
      const f = SKIN.input
      const painted = INPUT_LEVELS[SKIN.inputLevel] || INPUT_LEVELS.l0
      // The colour is forced along the whole chain because the textarea uses
      // `color: inherit`; styling only the textarea would leave it inheriting
      // the forced white from its parent. -webkit-text-fill-color is set too,
      // since when present it overrides `color` for text rendering.
      const chain = H + SCROLL + ',' + H + SCROLL + ' > *,' + H + SCROLL + ' textarea'
      let css = chain + '{color:' + f.text + ' !important;'
        + '-webkit-text-fill-color:' + f.text + ' !important;'
        + 'caret-color:' + f.text + ' !important;}'
        + H + MIRROR + ', ' + H + MIRROR + ' *'
        + '{color:transparent !important;'
        + '-webkit-text-fill-color:transparent !important;}'

      // Inner layers are cleared so only the painted level shows a fill.
      //
      // The painted element must never appear in this list. An identical
      // selector carrying !important on both the clear rule and the paint rule
      // cancels the fill outright, which is how the border once disappeared
      // during prototyping. When the fill moves outward to l1 or l2, the scroll
      // container becomes an inner layer and has to be cleared as well.
      const cleared = [
        H + SCROLL + ' > *', H + BACKDROP, H + MIRROR, H + SCROLL + ' textarea',
      ]
      if (SKIN.inputLevel !== 'l0') cleared.push(H + SCROLL)
      css += cleared.join(',')
        + '{background-color:transparent !important;'
        + 'background-image:none !important;'
        + 'border:none !important;box-shadow:none !important;}'

      css += painted + '{background-color:' + f.bg + ' !important;'
        + 'background-image:none !important;'
        + 'border:1px solid ' + f.border + ' !important;}'
      // Focus lands on the inner textarea, so the surface needs :focus-within.
      css += painted + ':focus-within'
        + '{box-shadow:inset 0 0 0 2px #2563eb !important;}'

      css += PLAIN + '{color:' + f.text + ' !important;'
        + '-webkit-text-fill-color:' + f.text + ' !important;'
        + 'caret-color:' + f.text + ' !important;'
        + 'background-color:' + f.bg + ' !important;'
        + 'background-image:none !important;'
        + 'border:1px solid ' + f.border + ' !important;}'
      // An inset shadow is used rather than outline, which paints outside the
      // border and reads as a second box around the field.
      css += PLAIN.split(',').map((s) => s + ':focus').join(',')
        + '{outline:none !important;box-shadow:inset 0 0 0 2px #2563eb !important;}'
      // Chromium repaints autofilled fields with its own colour and ignores
      // background-color; a large inset shadow is the only reliable override.
      css += PLAIN.split(',').map((s) => s + ':-webkit-autofill').join(',')
        + '{-webkit-text-fill-color:' + f.text + ' !important;'
        + '-webkit-box-shadow:0 0 0 1000px ' + f.bg + ' inset !important;}'

      css += H + SCROLL + ' textarea::selection,'
        + PLAIN.split(',').map((s) => s + '::selection').join(',')
        + '{background:#2563eb !important;color:#ffffff !important;'
        + '-webkit-text-fill-color:#ffffff !important;}'

      return css + placeholderCss()
    }

    // Reveal the run-time metadata the app fades out. Several hiding mechanisms
    // are countered at once because the markup does not say which one is used.
    function timeCss() {
      const c = SKIN.time
      const reveal = 'opacity:1 !important;visibility:visible !important;'
      let css = TIME_WRAP + '{' + reveal + '}'
      css += TIME_SEL + '{' + reveal + 'color:' + c + ' !important;'
        + '-webkit-text-fill-color:' + c + ' !important;}'
      css += TIME_KIDS + '{' + reveal + 'color:' + c + ' !important;'
        + '-webkit-text-fill-color:' + c + ' !important;}'
      // The separator dots are decorative, so they stay dimmer than the text.
      css += TIME_DOT + '{' + reveal + 'color:' + c + ' !important;'
        + '-webkit-text-fill-color:' + c + ' !important;opacity:0.55 !important;}'
      return css
    }

    // The image and a flat veil share one background shorthand. The veil is a
    // gradient layer rather than an opacity value, because opacity would
    // composite the entire body subtree including all of its text.
    function backgroundCss() {
      const a = 1 - SKIN.strength
      const veil = 'rgba(11,18,32,' + a + ')'
      return 'body{background-color:var(--dsw-alias-bg-base);'
        + 'background-image:linear-gradient(' + veil + ',' + veil + '),'
        + 'url("' + SKIN.image + '");'
        + 'background-size:auto,cover;'
        + 'background-position:center,center;'
        + 'background-repeat:repeat,no-repeat;'
        + 'background-attachment:fixed,fixed;}'
    }

    function buildCss() {
      let css = ''
      if (SKIN.white) css += whiteCss()
      if (SKIN.patch) {
        css += svgResetCss()
        css += inputCss()
        css += blockCss()
        css += bannerCss()
        css += actionBtnCss()
        css += toolbarBtnCss()
        css += selectBtnCss()
        css += menuCss()
        css += bubbleCss()
        css += timeCss()
        css += rectCss()
      }
      if (SKIN.image) css += backgroundCss()
      return css
    }

    /** Required service: the browser theme registry. */
    const inject = ['theme']

    /**
     * Apply the skin for exactly this plugin's lifetime.
     * @param ctx - client cordis context.
     */
    function apply(ctx) {
      // One override layer keyed by this package. Registering again with the
      // same source replaces the whole layer, so the full token set is always
      // supplied rather than patched.
      ctx.effect(() => ctx.theme.overrideTokens(
        '@dsh-external/dsh-theme-demo',
        buildTokens(),
      ), 'theme-demo: alias token layer')

      // Guarded so the module stays importable in a DOM-free test runtime.
      if (typeof document === 'undefined') return

      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = '@dsh-external/dsh-theme-demo'
        tag.textContent = buildCss()
        document.head.appendChild(tag)
        return () => { tag.remove() }
      }, 'theme-demo: component stylesheet')
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
