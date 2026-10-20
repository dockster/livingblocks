# livingblocks

Working web components as data. A carousel, an accordion or a notice is
described as a tree of layers with roles (the colours and text styles of
whatever design it lands in), its behaviour's settings, and the parts that
behaviour needs. A design tool draws the tree in the design's own style; a
page carries the settings as attributes, and a small runtime makes the
component work, with a keyboard and a screen reader, and with reduced motion
respected.

No dependencies. The runtime is about 11 KB gzipped.

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

A notice's place on the window is the page's own CSS (a design tool pins it
there); the runtime brings it in after `delay`, takes it away on a dismiss part,
on Escape or after `stay` (held while the pointer or the focus is on it),
reads its words out politely without taking the focus, and with `remember`
keeps it away for that visitor (localStorage, keyed by its words) until its
words change. `LivingBlocks.start(root, { remember: false })` shows it every
time, for a design tool's preview. It is not a cookie consent.

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
