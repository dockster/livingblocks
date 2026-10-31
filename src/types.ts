// The livingblocks format: a Block described as data. A Block is a tree of layers
// with roles (the colours and text styles of whatever design it lands in),
// the settings its behaviour starts with, and the parts that behaviour needs.
// A design tool reads the tree and draws it in the design's own style; a page
// carries the Block's settings as attributes and the runtime (runtime.ts)
// makes it work.
//
// A Block is data, never code: anyone can submit one (docs/CONTRIBUTING.md)
// and it is checked against the schema (schema/block.schema.json) and the
// rules in validate.ts without running anything. What a Block does comes from
// a fixed set of behaviours (`kind`), each versioned, reviewed and played by
// the runtime.
//
// Every Block is built with auto layout: each container lays out its
// children, and only a layer marked to float (an arrow over the slides, a
// close button in a corner) is placed by hand.

/** The format's version: a reader refuses a Block written in a version it does not know. */
export const FORMAT = 1;

/** The behaviours there are; each is played by the runtime. */
/** `table` and `chart` are played by the dashboard add-on (livingblocks/dashboard), not the main runtime. */
export type Kind = 'carousel' | 'accordion' | 'notice' | 'ring' | 'showcase' | 'mosaic' | 'cylinder' | 'form' | 'table' | 'chart';

/**
 * The parts a behaviour needs, marked on its layers. A carousel: its track of
 * slides, prev, next, dots, pause, a picture moving in depth. An accordion:
 * each item, its header (pressed to open and close) and its panel (what
 * opens), an icon that turns. A notice: what dismisses it.
 */
/**
 * A showcase: its counter (01 / 05) and its progress line. A mosaic: each tile.
 * A form: each field (its label and the box typed in, whose words are the
 * placeholder), the button that sends it, and where its messages show.
 */
/**
 * A table: its header row (head) and each header cell (column, with what its column holds), the rows' container
 * (body), each row and cell; a search box (search, a box typed in like a form's input); pages (first, prev, next, last,
 * and the counter whose words say where the reader is: "{from} to {to} of {total}"); what shows when no row matches
 * (empty); a header cell's sort arrow (icon). A chart: the plot it is drawn in, each bar, each label along its axis
 * (tick), and the words the design tool fills from its data: its value and its range.
 */
export type Part = 'track' | 'prev' | 'next' | 'dots' | 'pause' | 'dismiss' | 'picture' | 'item' | 'header' | 'panel' | 'icon' | 'tile' | 'counter' | 'progress' | 'field' | 'label' | 'input' | 'submit' | 'status' | 'head' | 'column' | 'body' | 'row' | 'cell' | 'search' | 'first' | 'last' | 'empty' | 'plot' | 'bar' | 'tick' | 'value' | 'range';

/**
 * Colours by role, read from the design the Block lands in: its accent (the
 * colour its buttons are), the surface its cards are, its ink; the words on
 * the accent; white words over a picture.
 */
/** `field`: a box on a surface (a form's text box), the surface a shade toward the ink */
export type Colour = 'accent' | 'surface' | 'field' | 'edge' | 'ink' | 'on-accent' | 'on-picture';

/** Text by role: the design's heading or body text style, else these sizes. */
export interface Typography {
  role: 'heading' | 'body';
  size: number;
  weight: number;
  align?: 'left' | 'center' | 'right';
}

/** Placed by hand over its parent, which lays out the rest: distances from its edges, or centred. */
export interface Float {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  /** centred across or down the parent */
  centreX?: boolean;
  centreY?: boolean;
  /** stretched to the parent's width and height (a picture behind a slide's words) */
  cover?: boolean;
}

export interface Layout {
  direction: 'row' | 'column';
  gap: number;
  /** top, right, bottom, left */
  pad: [number, number, number, number];
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between';
  /** a row whose children go onto the next line when they do not fit (a table's footer on a phone) */
  wrap?: boolean;
}

export type LayerType = 'frame' | 'stack' | 'text' | 'button' | 'image' | 'ellipse';

/**
 * A form's field, on the layer marked `field`: what is typed in it, the name its answer is sent under (from its
 * label when left out), whether it must be filled, the choices of a choice field. Only these kinds of answer: a
 * form never asks for a password, a card or a code (validate.ts FORBIDDEN).
 */
export interface Field {
  type: 'text' | 'email' | 'tel' | 'long' | 'choice' | 'checkbox';
  name?: string;
  required?: boolean;
  options?: string[];
}

/**
 * A table's column, on its header cell (part `column`): what it holds, which decides how it sorts (numbers as numbers,
 * dates as dates) and how it is drawn (a status as a badge, a person with a picture or initials); whether a press on
 * its header sorts by it; the narrowest it gets before the table scrolls sideways (px); shown on phones or not.
 */
export interface Column {
  kind: 'text' | 'number' | 'money' | 'percent' | 'date' | 'status' | 'person' | 'link';
  sort?: boolean;
  min?: number;
  phone?: boolean;
}

export interface Layer {
  type: LayerType;
  /** `{n}` is the number of the nearest repeated layer: Slide 2's title says Picture 2 */
  name: string;
  part?: Part;
  w: number;
  h: number;
  /** a container: lays its children out (required when it holds any) */
  layout?: Layout;
  /** in its parent's layout: fixed, hugging its content, or filling the parent */
  sizeW?: 'fixed' | 'fit' | 'fill';
  sizeH?: 'fixed' | 'fit' | 'fill';
  float?: Float;
  clip?: boolean;
  fill?: Colour;
  /** a 1px border inside the box (`edge`: a text box's outline, readable at 3:1 on its surface) */
  stroke?: Colour;
  /** a colour laid over a picture, so the words on it read (0 to 1) */
  shade?: number;
  ink?: Colour;
  /** the design's corner radius, or a number */
  radius?: number | 'design';
  /** lifted off what is under it by a soft shadow (a card that floats over a page) */
  raised?: boolean;
  /** a picture shown whole, never cropped (a logo); else it covers its box */
  contain?: boolean;
  text?: string;
  typography?: Typography;
  hidden?: boolean;
  /** the layer is made this many times (1 to 12) */
  repeat?: number;
  /** a form's field: on the layer marked `field` */
  field?: Field;
  /** a table's column: on the layer marked `column` */
  column?: Column;
  children?: Layer[];
}

/** A behaviour's settings; each kind reads its own (validate.ts SETTINGS says which, and their ranges). */
export type Settings = Record<string, string | number | boolean>;

export interface Block {
  /** the schema it follows, for editors that check as you type */
  $schema?: string;
  format: number;
  /** its name in files and on the page: lower case and dashes, the same as its file's name */
  id: string;
  kind: Kind;
  label: string;
  hint: string;
  category: string;
  isNew?: boolean;
  /** who made it, for a Block from the community */
  author?: string;
  settings: Settings;
  root: Layer;
}

/** A Block's settings at one breakpoint of a page: the media query, and what changes there. */
export interface Step {
  query: string;
  settings: Settings;
}
