# Changelog

## 0.3.0

- A new behaviour, `cylinder`, and its Block "Text cylinder": the track's
  children, lines of text, stand around a cylinder lying on its side, and
  the page's scroll turns it so the lines roll up over the top and away. It
  holds its place for `hold` screens of scrolling while it turns (0: it
  turns as it crosses the screen), and the lines grow so the longest takes
  `fit` of the width. Settings: span, arc, from, turn, hold, depth,
  fit. Under reduced motion it stays the list it was designed as. After
  Codrops' 3D Text Animation on Scroll, demo 1 (MIT, docs/THIRD-PARTY.md),
  rebuilt without GSAP.
- livingblocks.min.js 10.7 KB gzipped, budget 11 (was 10).

## 0.2.1

- Dragging a carousel, a 3D ring or a showcase no longer starts the browser's own drag of a
  picture in it (a ghost of the picture following the pointer).

## 0.2.0

- A new behaviour, `ring`, and its Block "3D ring": the track's children
  stand around a circle in depth. The page's scroll turns it as it crosses
  the screen, tilting a little and lighting the cards from bright to their
  own; the scroll's speed pushes the cards out and leans them, settling on a
  spring; it can spin on its own, and be dragged with a little inertia or
  turned a card at a time with the arrow keys. Settings: radius, depth, turn,
  tilt, light, lean, spin, drag. Under reduced motion it stands still facing
  the front and turns only when asked. After Codrops' On-Scroll 3D Carousel
  (MIT, docs/THIRD-PARTY.md), rebuilt without GSAP.
- A drag's throw is measured over at least a frame and coasts half a turn at
  most, so a drag delivered in two quick events cannot fling it round.
- A new behaviour, `showcase`, and its Block "Showreel hero" (after
  giordanobetti.com's reel, observed, no code taken): slides stacked one at a
  time, a full-bleed picture or video behind (blurred if asked) and the
  slide's words revealed line by line through masks; the change a fade, a
  zoom, a blur or a wipe; Previous, Next, a counter, a progress line, the
  arrow keys, a swipe, playing on its own (held on hover and focus, a Pause
  button), the wheel if asked (never past the ends). Videos play while their
  slide shows. Under reduced motion it changes at once and never plays.
- A new behaviour, `mosaic`, and its Block "Media grid" (after au-rel.io's
  grid, observed): a dense grid where each tile spans as many columns and
  half-rows as its size in the design, `columns` across (two at most on a
  narrow window), a `gap`; videos play while on screen, on hover or always;
  tiles can rise in as they arrive.
- Both Blocks fill their container (`sizeW: fill` on the root); the grid's
  spans come from its narrowest tile, so they hold at any width, and its own
  track part is optional.
- New parts: `tile`, `counter`, `progress`.
- livingblocks.min.js is 9.9 KB gzipped (budget 10, was 6 before the ring).

## 0.1.1 (2026-10-13)

- A Banner fills what it is in. The runtime capped every Notice at
  `calc(100% - 32px)`, meant for a card floating over a narrow window, so a
  Banner in the page's flow, or pinned across its container, stopped 32 px
  short of the right edge. Only a floating Notice narrower than its container
  is capped now.

## 0.1.0 (2026-10-11)

- The format (format 1): Blocks as layer trees with roles, settings and parts;
  the JSON Schema; the checker.
- Twelve Blocks. Carousels: Carousel, Logo strip, Picture carousel (pictures
  moving in depth), Products, Testimonials. Accordions: Accordion, Details,
  FAQ list, Steps. Notices: Notice, Banner, Promo notice.
- `contain` on a picture: shown whole, never cropped (a logo).
- `raised` on a layer: a card lifted off the page by a soft shadow.
- The checker keeps spacing on the 4 pt scale, and words on the Blocks' type
  scale (15, 17, 28), so several Blocks on a page keep to four sizes.
- The runtime's carousel: arrows, dots, swipe and drag, playing on its own
  (stops on hover and focus, Pause, never with reduced motion), several slides
  at once, settings per breakpoint, pictures in depth; keyboard and screen
  reader.
- The runtime's accordion: a header opens its item to its own height on the
  house curve, one at a time or several, the item open first or none;
  Enter, Space, Up, Down, Home and End; headers say expanded or collapsed and
  control their panel, an open panel is a region named by its header, a
  closed one is out of reach; reduced motion opens at once.
- The runtime's notice: comes in after its delay, sliding from its edge on the
  house curve; leaves on a dismiss part (a button's own link still goes),
  Escape, or after its time (held while pointed at or focused); never takes
  the focus; its words read out by a polite live region; remembered once
  closed on that visitor's browser until its words change; `start(root,
  { remember: false })` for previews; reduced motion comes in at once.
