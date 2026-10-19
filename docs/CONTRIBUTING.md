# Contributing a Block

A Block is a JSON file in `blocks/`, named after its `id`. It is data, never
code: what it does comes from one of the behaviours (`kind`) the runtime
plays, so nobody's script runs on anybody's page.

## The rules

The build checks every Block (src/validate.ts) and refuses one that fails,
saying why. A Block:

1. follows the schema (`schema/block.schema.json`; set `"$schema"` and your
   editor checks as you type), and has no field the format does not have: an
   unknown field (a `script`, an `onclick`) is refused, wherever it is;
2. is built with **auto layout throughout**: every layer that holds others has
   a `layout`; only a layer marked `float` (an arrow over slides, a close
   button in a corner) is placed by hand, over a parent that has a layout;
3. has the **parts its behaviour needs**: a carousel, track, prev, next, dots
   and pause; an accordion, item, header and panel; a notice, dismiss; a ring,
   a showcase and a cylinder, track; a mosaic, tile (the `NEEDS` list in
   src/validate.ts);
4. keeps its spacing on the **4 pt scale**: every gap and padding a multiple
   of 4;
5. uses only the **settings its behaviour reads**, within their ranges;
6. takes its colours and text by **role**, so it arrives in the style of the
   design it lands in: colours `accent`, `surface`, `ink`, `on-accent` and
   `on-picture`, text `heading` and `body`. Colours go in pairs: words on an
   `accent` fill are `on-accent`, words on a `surface` fill are `ink`, and
   `on-picture` is for words over a picture, not for a fill behind words;
7. sets its words in the **Blocks' type scale** (15, 17, 28): several Blocks
   on a page then keep to four sizes with the page's own heading;
8. stays within 300 layers, 10 levels and 4000 px;
9. reads well where it lands, in a light design and a dark one: words against
   what is behind them, controls against what they sit on (a card that floats
   over a page is `raised`).

## Steps

1. Copy a Block from `blocks/` with the same `kind`, give it a new `id` and
   file name, a `label`, a one-line `hint`, a `category` from
   src/categories.ts, and your name as `author`.
2. Change its layers and settings.
3. `npm install` once, then `npm run build && npm test`. The build lists
   every Block that fails, with each reason, and stops.
4. Open a pull request. A reviewer looks at it in a design tool and on a page
   before it is listed.

## A new behaviour

A new `kind` is code in the runtime and is not taken from contributions
directly: open an issue describing what it does, its parts, its settings and
how it works with a keyboard and a screen reader. A behaviour keeps its
version (`v` in a page's spec): a later runtime keeps playing every earlier
version, so a release never changes a page already published.
