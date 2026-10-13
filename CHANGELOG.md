# Changelog

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
