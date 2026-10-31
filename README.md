# livingblocks

Working web components as data. A carousel, an accordion, a notice, a form, a table or a chart is
described as a tree of layers with roles (the colours and text styles of
whatever design it lands in), its behaviour's settings, and the parts that
behaviour needs. A design tool draws the tree in the design's own style; a
page carries the settings as attributes, and a small runtime makes the
component work, with a keyboard and a screen reader, and with reduced motion
respected.

No dependencies. The runtime is about 15 KB gzipped; tables and charts are an add-on of about 8 KB.

LivingBlocks is the runtime of [uxdeck](https://uxdeck.app/blocks), the design
canvas of [uxspot.io](https://uxspot.io): the Blocks you place there work on the
sites it publishes. Every behaviour, its settings and the checker are on
[uxdeck.app/livingblocks](https://uxdeck.app/livingblocks).

## What is in it

- `blocks/*.json`: the Blocks, one file each.
- `schema/block.schema.json`: their shape, for editors.
- `livingblocks` (ES module): every Block (`BLOCKS`, `blockById`), the checker
  (`validateBlock`), the groups (`CATEGORIES`) and the types.
- `livingblocks/global` and `livingblocks/global.min`: the runtime as a plain script,
  `window.LivingBlocks.start(root)`.
- `livingblocks/dashboard` and `livingblocks/dashboard.min`: the table and the chart, an add-on loaded after the
  runtime (and before `start`) only by pages that hold one; it registers them with `LivingBlocks.register`.
- `parseData`, `formatValue`, `geometry` and their kin (ES module): a chart's data read as a spreadsheet copies it,
  and where its points, lines and bars stand, for a design tool drawing it.
- `sortOrder`, `cellValue` and `compareCells` (ES module): how a table's column sorts by its kind, so a design tool can
  draw the rows in the order a visitor first sees them.

## On a page

Each Block's own element carries its spec, and the elements its behaviour
needs carry their part:

```html
<section data-living='{"kind":"carousel","v":1,"settings":{"perView":1,"loop":true,"arrows":true,"dots":true,"swipe":true}}' aria-label="Carousel">
  <div>
    <div data-living-part="track">
      <div>Slide 1</div>
      <div>Slide 2</div>
      <div>Slide 3</div>
    </div>
    <button data-living-part="prev">←</button>
    <button data-living-part="next">→</button>
  </div>
  <div data-living-part="dots"><span></span></div>
</section>
<script src="livingblocks.min.js"></script>
<script>LivingBlocks.start(document.body)</script>
```

Settings that change at a breakpoint go in `data-living-at`, a list of
`{ "query": "(max-width: 809px)", "settings": { "perView": 1 } }`, applied in
order as the page's CSS cascades.

## Behaviours

| Kind | Parts it needs | Settings |
|---|---|---|
| carousel | track, prev, next, dots, pause (a picture may move in depth) | perView, loop, autoplay, interval, arrows, dots, swipe, start, parallax |
| ring | track (its children stand around a circle in depth); optional prev, next (turn a card), pause (stops its spin) | radius, depth, turn, tilt, light, lean, spin, drag |
| showcase (the Showreel) | track (its children are slides, one shown at a time; a slide's picture is the full-bleed backdrop); prev, next, pause, counter, progress if wanted | autoplay, interval, transition (fade, zoom, blur, wipe), speed, lines, blur, wheel, loop, start |
| mosaic (the Media grid) | a tile part on each picture or video; track optional (the Block itself is the grid; rows between step aside). Spans come from the narrowest tile | columns, gap, video (view, hover, always), reveal |
| cylinder | track (its children, lines of text, stand around a cylinder on its side) | span (radius, a share of the smaller side), arc, from, turn, hold (screens), depth, fit (share of the width the longest line takes) |
| accordion | item, header, panel (an icon may turn) | single, start (-1: none open) |
| notice | dismiss (any number: a close, a Got it) | position, delay, stay (0: until closed), remember |
| form | field (each with `data-living-field`: type text, email, tel, long, choice or checkbox, name, required, options), label, input, submit, status | after (message, redirect), redirect, to, show (helper, toast), sentText, failText, preview (sent, failed) |
| table (add-on) | head, column (each with `data-living-column`: kind text, number, money, percent, date, status, person or link, sort, min, phone), body, row, cell; optional icon (a column's sort arrow), search, first, prev, next, last, counter, empty | sort, dir, pageSize, pin, stripes, density, tones, count |
| chart (add-on) | plot (its series' layers carry `data-living-series`), tick, value, range; bar | type (line, area, bar), data, stacked, smooth, points, zero, format, prefix, suffix, decimals, grid, legend, draw, value, ticks |

A notice's place on the window is the page's own CSS (a design tool pins it
there); the runtime brings it in after `delay`, takes it away on a dismiss part,
on Escape or after `stay` (held while the pointer or the focus is on it),
reads its words out politely without taking the focus, and with `remember`
keeps it away for that visitor (localStorage, keyed by its words) until its
words change. `LivingBlocks.start(root, { remember: false })` shows it every
time, for a design tool's preview. It is not a cookie consent.

## Tables and charts

They are an add-on, so a page with a carousel never downloads them:

```html
<script src="livingblocks.min.js"></script>
<script src="livingblocks.dashboard.min.js"></script>
<script>LivingBlocks.start(document.body)</script>
```

A table is the design's own rows and cells; each header cell says what its column holds, which decides how it
sorts (money and numbers as numbers, dates as dates) and how a design tool draws its cells (a status as a badge, a
person with initials). The counter's words come from `count`: "Viewing {from} to {to} of {total}".

A chart's `data` is text, rows of a label and a value per series, the first row naming them, as a spreadsheet copies
them (tabs) or as CSV: `Month,Revenue,Costs\nJan,1200,400`. A design tool draws it from `geometry(parseData(data),
settings, width, height)`; the add-on reads the same data for its tooltip, its keyboard and the table screen readers
get.

## Forms

A form's `input` parts become real controls (an `input`, a `textarea` or a
`select`) that take the drawn placeholder's font and colour; answers are
checked as they are typed, and a field no person fills catches bots. The form
sends to its host, not to a mail service of its own:

- `GET <endpoint>` answers `{ "t": "<token>" }`, and `"ts": "<site key>"` when
  the host wants a [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
  pass: the runtime then loads Turnstile once, invisibly unless it needs the
  visitor, and sends its pass as `cf`.
- `POST <endpoint>` (JSON) sends `{ form, to, fields, labels, website, t, at, cf }`
  and expects `{ "ok": true }`; `{ "closed": true }` or a 429 says the form is
  not taking messages, anything else that it failed.

The endpoint is `options.formEndpoint`, else `/__uxdeck/form` on the page's own
address, where uxdeck's published sites relay the message to the owner's
confirmed address. A form never asks for passwords, card numbers or codes: the
checker refuses such a field.

```js
LivingBlocks.start(document.body, { formEndpoint: '/api/contact' }); // your own endpoint
LivingBlocks.start(preview, { formPreview: true, toastIn: preview }); // a design tool's preview: checked, acted out, never sent
LivingBlocks.start(page, { formOff: true });                          // an export with nowhere to send to: says so
```

`settings.to` names the address by an id the host knows (`account`, or 24 hex
characters), never the address itself, so a page never shows where its
messages go.

## Colours

A Block names roles, never colours, so it arrives in the design it lands in:
`accent`, `surface`, `ink`, `on-accent` and `on-picture`, plus `field` (a text
box: the surface a shade toward the ink) and `edge` (its outline: the surface
toward the ink until it reads at 3:1 on it). A layer's `fill` and `ink` take a
role, and so does its `stroke`, a 1px line inside its box.

The behaviours are a fixed, reviewed set: a Block is data and never brings
code of its own (docs/CONTRIBUTING.md).

## Develop

```
npm install
npm run build   # checks every Block; a Block that fails stops the build
npm test
npm run dev     # rebuilds as src/ changes
```

## License

MIT, (c) 2026 uxspot.io.
