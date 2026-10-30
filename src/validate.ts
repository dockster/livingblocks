// What a Block must be to be accepted, checked without running anything in it
// (types.ts). The build refuses a Block that fails, and so would a review of
// a submitted one (docs/CONTRIBUTING.md). The JSON Schema
// (schema/block.schema.json) says the same shape for editors; these rules add
// what a schema says badly: auto layout throughout, spacing on the 4 pt scale,
// the parts each behaviour needs, the settings each one reads and their ranges,
// and sizes a design can hold.

import { FORMAT, type Block, type Field, type Kind, type Layer, type Part } from './types.js';

export const KINDS: readonly Kind[] = ['carousel', 'accordion', 'notice', 'ring', 'showcase', 'mosaic', 'cylinder', 'form'];
export const PARTS: readonly Part[] = ['track', 'prev', 'next', 'dots', 'pause', 'dismiss', 'picture', 'item', 'header', 'panel', 'icon', 'tile', 'counter', 'progress', 'field', 'label', 'input', 'submit', 'status'];
const LAYER_TYPES = ['frame', 'stack', 'text', 'button', 'image', 'ellipse'];
const COLOURS = ['accent', 'surface', 'field', 'edge', 'ink', 'on-accent', 'on-picture'];
const SIZING = ['fixed', 'fit', 'fill'];
// the fields each object may have, as schema/block.schema.json says (additionalProperties: false): a field the format
// does not have is refused, never carried. Nothing in a Block runs, but a checker that let unknown fields through
// would pass a Block whose `script` or `onclick` a reviewer then has to notice by eye
const BLOCK_FIELDS = ['$schema', 'format', 'id', 'kind', 'label', 'hint', 'category', 'isNew', 'author', 'settings', 'root'];
const LAYER_FIELDS = ['type', 'name', 'part', 'w', 'h', 'layout', 'sizeW', 'sizeH', 'float', 'clip', 'fill', 'stroke', 'ink', 'shade', 'radius', 'text', 'typography', 'hidden', 'repeat', 'children', 'raised', 'contain', 'field'];
const FIELD_FIELDS = ['type', 'name', 'required', 'options'];
/** what a form may ask for: nothing else, so a Block cannot be a page that collects passwords or cards */
export const FIELD_TYPES: readonly Field['type'][] = ['text', 'email', 'tel', 'long', 'choice', 'checkbox'];
/**
 * Names and labels a form's field may not carry: a form on a published page is a phishing page's first tool, and
 * these are what one asks for (a password, a card, a security or one-time code, an account or social security number).
 */
export const FORBIDDEN = /\bpass(word|wd|code|phrase)?\b|\bpwd\b|\bpin\b|\bcards?\b|card ?(no|num|number)|credit ?card|\bcvv\b|\bcvc\b|\bcc\b|\bexpir(y|ation|es)\b|\biban\b|\bswift\b|\brouting\b|account ?(no|num|number)|\bssn\b|social ?security|one ?time|\botp\b|\b2fa\b|security ?code|verification ?code|mot ?de ?passe|\bcarte\b/i;
/** whether a field's name, label or words ask for one of these: dashes and underscores read as spaces (card_number) */
export const asksForSecret = (words: string) => FORBIDDEN.test(words.replace(/[_\-.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'));
/** a field's name: what its answer is sent under */
export const FIELD_NAME = /^[a-z][a-z0-9_-]{0,39}$/;
const LAYOUT_FIELDS = ['direction', 'gap', 'pad', 'align', 'justify'];
const FLOAT_FIELDS = ['left', 'right', 'top', 'bottom', 'centreX', 'centreY', 'cover'];
const TYPE_FIELDS = ['role', 'size', 'weight', 'align'];

/** The parts each behaviour cannot work without. */
export const NEEDS: Record<Kind, Part[]> = {
  carousel: ['track', 'prev', 'next', 'dots', 'pause'],
  accordion: ['item', 'header', 'panel'],
  notice: ['dismiss'],
  ring: ['track'],
  showcase: ['track'],
  // the Block itself is the grid when no layer inside is marked track
  mosaic: ['tile'],
  cylinder: ['track'],
  form: ['field', 'input', 'submit', 'status'],
};

type Range = { type: 'number'; min: number; max: number } | { type: 'boolean' } | { type: 'enum'; values: string[] } | { type: 'text'; max: number; pattern?: RegExp };
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
  // lines of text around a cylinder on its side: its radius as a share of the box's smaller side (span), the degrees
  // the lines spread over, where it starts and how far the scroll turns it (degrees), the screens of scrolling it holds
  // its place for (0: it turns as it crosses), the eye's distance (px), the share of the width the longest line takes
  // (fit). Named apart from the ring's radius and the carousel's start, which mean other things
  cylinder: {
    span: { type: 'number', min: 0.1, max: 1 },
    arc: { type: 'number', min: 30, max: 360 },
    from: { type: 'number', min: -180, max: 180 },
    turn: { type: 'number', min: 0, max: 720 },
    hold: { type: 'number', min: 0, max: 10 },
    depth: { type: 'number', min: 200, max: 3000 },
    fit: { type: 'number', min: 0, max: 1 },
  },
  // a form: after it sends, its status layer shows its words (as drawn) or the page goes to an address (on this site, or https); `to` names
  // the verified address its messages go to (the account's own: "account"), never the address itself
  form: {
    after: { type: 'enum', values: ['message', 'redirect'] },
    redirect: { type: 'text', max: 300, pattern: /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/ },
    to: { type: 'text', max: 40, pattern: /^(account|[a-f0-9]{24})$/ },
    // where its messages show: the status part (a helper under the form) or a toast; the words of each, when set
    show: { type: 'enum', values: ['helper', 'toast'] },
    sentText: { type: 'text', max: 160 },
    failText: { type: 'text', max: 160 },
    // what a design tool's Preview acts out after the answers pass: a message sent, or one that failed
    preview: { type: 'enum', values: ['sent', 'failed'] },
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
  /** every field of `o` the format does not have, said once each */
  const only = (o: unknown, allowed: string[], where: string) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return;
    for (const k of Object.keys(o)) if (!allowed.includes(k)) say(where ? `${where}.${k}` : k, 'not a field a Block has');
  };
  only(b, BLOCK_FIELDS, '');

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
      else if (r.type === 'text' && (typeof v !== 'string' || v.length > r.max || (r.pattern && !r.pattern.test(v)))) say(`settings.${k}`, `words up to ${r.max} characters${r.pattern ? ' in the form it takes' : ''}`);
    }
  }

  // the layers
  let count = 0;
  const parts = new Set<Part>();
  const fieldNames = new Set<string>();
  const layer = (l: unknown, path: string, depth: number, parentLaysOut: boolean) => {
    if (!l || typeof l !== 'object') return say(path, 'a layer');
    const x = l as Partial<Layer>;
    const here = `${path}/${typeof x.name === 'string' ? x.name : '?'}`;
    only(x, LAYER_FIELDS, here);
    only(x.layout, LAYOUT_FIELDS, `${here} layout`);
    only(x.float, FLOAT_FIELDS, `${here} float`);
    only(x.typography, TYPE_FIELDS, `${here} typography`);
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
    if (x.stroke !== undefined && !COLOURS.includes(x.stroke)) say(here, `stroke one of ${COLOURS.join(', ')}`);
    if (x.ink !== undefined && !COLOURS.includes(x.ink)) say(here, `ink one of ${COLOURS.join(', ')}`);
    if (x.shade !== undefined && !isNum(x.shade, 0, 1)) say(here, 'shade from 0 to 1');
    if (x.radius !== undefined && x.radius !== 'design' && !isNum(x.radius, 0, 2000)) say(here, 'radius a number or "design"');
    if (x.raised !== undefined && typeof x.raised !== 'boolean') say(here, 'raised true or false');
    if (x.contain !== undefined && (typeof x.contain !== 'boolean' || x.type !== 'image')) say(here, 'contain: true or false, on a picture');
    if (x.text !== undefined && (typeof x.text !== 'string' || x.text.length > 500)) say(here, 'text up to 500 characters');
    if (x.repeat !== undefined && !isNum(x.repeat, 1, 12)) say(here, 'repeat from 1 to 12');
    // a form's field: only on the layer marked field, of a kind a form may ask for, under a name it may carry
    if (x.part === 'field' && x.field === undefined) say(here, 'a field says what it asks for (field)');
    if (x.field !== undefined) {
      const f = x.field as Partial<Field>;
      only(f, FIELD_FIELDS, `${here} field`);
      if (x.part !== 'field') say(here, 'field: only on a layer marked field');
      if (!FIELD_TYPES.includes(f.type as Field['type'])) say(here, `field: type one of ${FIELD_TYPES.join(', ')}`);
      if (f.name !== undefined && (typeof f.name !== 'string' || !FIELD_NAME.test(f.name))) say(here, 'field: a name in lower case letters, digits, dashes and underscores');
      if (f.required !== undefined && typeof f.required !== 'boolean') say(here, 'field: required true or false');
      if (f.type === 'choice' && (!Array.isArray(f.options) || f.options.length < 1 || f.options.length > 12 || !f.options.every((o) => isText(o, 60)))) say(here, 'field: a choice has 1 to 12 options of up to 60 characters');
      if (f.type !== 'choice' && f.options !== undefined) say(here, 'field: options only on a choice');
      const named = typeof f.name === 'string' ? f.name : x.name ?? '';
      if (asksForSecret(named) || asksForSecret(x.name ?? '')) say(here, 'field: a form does not ask for passwords, cards or codes');
      if (typeof f.name === 'string') {
        if (fieldNames.has(f.name)) say(here, `field: the name ${f.name} is used twice`);
        fieldNames.add(f.name);
      }
    }
    if ((x.part === 'label' || x.part === 'input') && typeof x.text === 'string' && asksForSecret(x.text)) say(here, 'a form does not ask for passwords, cards or codes');
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
