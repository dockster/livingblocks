// What a Block must be to be accepted, checked without running anything in it
// (types.ts). The build refuses a Block that fails, and so would a review of
// a submitted one (docs/CONTRIBUTING.md). The JSON Schema
// (schema/block.schema.json) says the same shape for editors; these rules add
// what a schema says badly: auto layout throughout, spacing on the 4 pt scale,
// the parts each behaviour needs, the settings each one reads and their ranges,
// and sizes a design can hold.

import { FORMAT, type Block, type Kind, type Layer, type Part } from './types.js';

export const KINDS: readonly Kind[] = ['carousel', 'accordion', 'notice', 'ring', 'showcase', 'mosaic'];
export const PARTS: readonly Part[] = ['track', 'prev', 'next', 'dots', 'pause', 'dismiss', 'picture', 'item', 'header', 'panel', 'icon', 'tile', 'counter', 'progress'];
const LAYER_TYPES = ['frame', 'stack', 'text', 'button', 'image', 'ellipse'];
const COLOURS = ['accent', 'surface', 'ink', 'on-accent', 'on-picture'];
const SIZING = ['fixed', 'fit', 'fill'];

/** The parts each behaviour cannot work without. */
export const NEEDS: Record<Kind, Part[]> = {
  carousel: ['track', 'prev', 'next', 'dots', 'pause'],
  accordion: ['item', 'header', 'panel'],
  notice: ['dismiss'],
  ring: ['track'],
  showcase: ['track'],
  // the Block itself is the grid when no layer inside is marked track
  mosaic: ['tile'],
};

type Range = { type: 'number'; min: number; max: number } | { type: 'boolean' } | { type: 'enum'; values: string[] };
/** The settings each behaviour reads, and what each may be. */
export const SETTINGS: Record<Kind, Record<string, Range>> = {
  carousel: {
    perView: { type: 'number', min: 1, max: 4 },
    loop: { type: 'boolean' },
    autoplay: { type: 'boolean' },
    interval: { type: 'number', min: 2, max: 30 },
    arrows: { type: 'boolean' },
    dots: { type: 'boolean' },
    swipe: { type: 'boolean' },
    start: { type: 'number', min: 0, max: 99 },
    parallax: { type: 'number', min: 0, max: 0.3 },
  },
  accordion: {
    single: { type: 'boolean' },
    start: { type: 'number', min: -1, max: 99 },
  },
  notice: {
    position: { type: 'enum', values: ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] },
    delay: { type: 'number', min: 0, max: 60 },
    stay: { type: 'number', min: 0, max: 120 },
    remember: { type: 'boolean' },
  },
  // the track's children stand around a circle: its radius and the eye's distance (px), the degrees the page's
  // scroll turns it, its tilt (degrees), how much the cards light up and lean with the scroll's speed (0 to 1),
  // a spin of its own (degrees a second), and whether it can be dragged
  ring: {
    radius: { type: 'number', min: 100, max: 1600 },
    depth: { type: 'number', min: 200, max: 3000 },
    turn: { type: 'number', min: 0, max: 720 },
    tilt: { type: 'number', min: 0, max: 15 },
    light: { type: 'number', min: 0, max: 1 },
    lean: { type: 'number', min: 0, max: 1 },
    spin: { type: 'number', min: 0, max: 60 },
    drag: { type: 'boolean' },
  },
  // a hero of stacked slides: plays on its own every `interval` seconds, changes by a fade, zoom, blur or wipe
  // over `speed` seconds, reveals its words line by line, blurs its full-bleed picture by `blur` px, the wheel if asked
  showcase: {
    autoplay: { type: 'boolean' },
    interval: { type: 'number', min: 2, max: 30 },
    transition: { type: 'enum', values: ['fade', 'zoom', 'blur', 'wipe'] },
    speed: { type: 'number', min: 0.2, max: 3 },
    lines: { type: 'boolean' },
    blur: { type: 'number', min: 0, max: 60 },
    wheel: { type: 'boolean' },
    loop: { type: 'boolean' },
    start: { type: 'number', min: 0, max: 99 },
  },
  // a dense grid: columns across, the gap (px), when its videos play, whether tiles rise in as they arrive
  mosaic: {
    columns: { type: 'number', min: 1, max: 8 },
    gap: { type: 'number', min: 0, max: 48 },
    video: { type: 'enum', values: ['view', 'hover', 'always'] },
    reveal: { type: 'boolean' },
  },
};

/**
 * The type sizes every Block shares, so a page holding several stays within
 * four sizes, as design coaches check it (a screen's heading is the fourth):
 * body, a small heading or a glyph (an arrow, a close, a plus), a slide's heading.
 * A design's own text styles still win where it has them.
 */
export const TYPE_SCALE = [15, 17, 28];

const MAX_LAYERS = 300;
const MAX_DEPTH = 10;
const MAX_SIZE = 4000;

export interface Verdict {
  ok: boolean;
  errors: string[];
}

const isNum = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isText = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Whether a value read from anywhere (a file, a submission) is a Block, and if not, every reason why. */
export function validateBlock(value: unknown): Verdict {
  const errors: string[] = [];
  const say = (where: string, what: string) => errors.push(`${where}: ${what}`);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, errors: ['not an object'] };
  const b = value as Partial<Block>;

  if (b.format !== FORMAT) say('format', `must be ${FORMAT}`);
  if (typeof b.id !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/.test(b.id)) say('id', 'lower case letters, digits and dashes, 2 to 41 long, starting with a letter');
  if (!KINDS.includes(b.kind as Kind)) say('kind', `one of ${KINDS.join(', ')}`);
  if (!isText(b.label, 40)) say('label', 'a name, up to 40 characters');
  if (!isText(b.hint, 200)) say('hint', 'what it does in one line, up to 200 characters');
  if (typeof b.category !== 'string' || !/^[a-z][a-z0-9-]{1,30}$/.test(b.category)) say('category', 'lower case letters and dashes');
  if (b.isNew !== undefined && typeof b.isNew !== 'boolean') say('isNew', 'true or false');
  if (b.author !== undefined && !isText(b.author, 80)) say('author', 'a name, up to 80 characters');

  // settings: only those the behaviour reads, each within its range
  const known = SETTINGS[b.kind as Kind];
  if (!b.settings || typeof b.settings !== 'object' || Array.isArray(b.settings)) say('settings', 'an object');
  else if (known) {
    for (const [k, v] of Object.entries(b.settings)) {
      const r = known[k];
      if (!r) say(`settings.${k}`, `${b.kind} does not read it`);
      else if (r.type === 'number' && !isNum(v, r.min, r.max)) say(`settings.${k}`, `a number from ${r.min} to ${r.max}`);
      else if (r.type === 'boolean' && typeof v !== 'boolean') say(`settings.${k}`, 'true or false');
      else if (r.type === 'enum' && !r.values.includes(v as string)) say(`settings.${k}`, `one of ${r.values.join(', ')}`);
    }
  }

  // the layers
  let count = 0;
  const parts = new Set<Part>();
  const layer = (l: unknown, path: string, depth: number, parentLaysOut: boolean) => {
    if (!l || typeof l !== 'object') return say(path, 'a layer');
    const x = l as Partial<Layer>;
    const here = `${path}/${typeof x.name === 'string' ? x.name : '?'}`;
    count += Math.max(1, Number(x.repeat) || 1);
    if (depth > MAX_DEPTH) return say(here, `deeper than ${MAX_DEPTH} layers`);
    if (!LAYER_TYPES.includes(x.type as string)) say(here, `type one of ${LAYER_TYPES.join(', ')}`);
    if (!isText(x.name, 60)) say(here, 'a name, up to 60 characters');
    if (!isNum(x.w, 1, MAX_SIZE) || !isNum(x.h, 1, MAX_SIZE)) say(here, `w and h from 1 to ${MAX_SIZE}`);
    if (x.part !== undefined) {
      if (!PARTS.includes(x.part)) say(here, `part one of ${PARTS.join(', ')}`);
      else parts.add(x.part);
    }
    if (x.sizeW !== undefined && !SIZING.includes(x.sizeW)) say(here, 'sizeW fixed, fit or fill');
    if (x.sizeH !== undefined && !SIZING.includes(x.sizeH)) say(here, 'sizeH fixed, fit or fill');
    if (x.fill !== undefined && !COLOURS.includes(x.fill)) say(here, `fill one of ${COLOURS.join(', ')}`);
    if (x.ink !== undefined && !COLOURS.includes(x.ink)) say(here, `ink one of ${COLOURS.join(', ')}`);
    if (x.shade !== undefined && !isNum(x.shade, 0, 1)) say(here, 'shade from 0 to 1');
    if (x.radius !== undefined && x.radius !== 'design' && !isNum(x.radius, 0, 2000)) say(here, 'radius a number or "design"');
    if (x.raised !== undefined && typeof x.raised !== 'boolean') say(here, 'raised true or false');
    if (x.contain !== undefined && (typeof x.contain !== 'boolean' || x.type !== 'image')) say(here, 'contain: true or false, on a picture');
    if (x.text !== undefined && (typeof x.text !== 'string' || x.text.length > 500)) say(here, 'text up to 500 characters');
    if (x.repeat !== undefined && !isNum(x.repeat, 1, 12)) say(here, 'repeat from 1 to 12');
    if (x.typography !== undefined) {
      const t = x.typography;
      if (!t || !['heading', 'body'].includes(t.role) || !isNum(t.size, 8, 200) || !isNum(t.weight, 100, 900)) say(here, 'typography: a role (heading or body), a size from 8 to 200, a weight from 100 to 900');
      else if (!TYPE_SCALE.includes(t.size)) say(here, `typography: a size from the Blocks' scale (${TYPE_SCALE.join(', ')}), not ${t.size}, so several Blocks on a page keep to four sizes`);
    }
    if (x.layout !== undefined) {
      const lo = x.layout;
      if (!lo || !['row', 'column'].includes(lo.direction) || !isNum(lo.gap, 0, 1000) || !Array.isArray(lo.pad) || lo.pad.length !== 4 || !lo.pad.every((p) => isNum(p, 0, 1000))) say(here, 'layout: a direction (row or column), a gap, four paddings');
      // spacing on the 4 pt scale, as a design coach checks it: a Block should pass the coach of the tool it lands in
      else if ([lo.gap, ...lo.pad].some((v) => v % 4 !== 0)) say(here, `layout: gap and padding on the 4 pt scale (multiples of 4), not ${[lo.gap, ...lo.pad].filter((v) => v % 4 !== 0).join(', ')}`);
    }
    // auto layout throughout: a layer holding others lays them out; only one marked to float is placed by hand
    const kids = Array.isArray(x.children) ? x.children : [];
    if (x.children !== undefined && !Array.isArray(x.children)) say(here, 'children a list');
    if (kids.length && !x.layout) say(here, 'holds layers, so it needs a layout (auto layout throughout)');
    if (x.float !== undefined && !parentLaysOut) say(here, 'floats, but its parent has no layout to float over');
    if (depth === 0 && x.float !== undefined) say(here, 'the Block itself cannot float');
    kids.forEach((c) => layer(c, here, depth + 1, !!x.layout));
  };
  if (!b.root) say('root', 'the Block’s own layer');
  else {
    layer(b.root, '', 0, false);
    if (!(b.root as Layer).layout) say('root', 'the Block’s own layer lays out its parts (a layout)');
  }
  if (count > MAX_LAYERS) say('root', `${count} layers, more than ${MAX_LAYERS}`);
  for (const p of NEEDS[b.kind as Kind] ?? []) if (!parts.has(p)) say('parts', `a ${b.kind} needs a layer marked ${p}`);

  return { ok: errors.length === 0, errors };
}
