// The dashboard add-on (livingblocks/dashboard): the table and the chart, in a file of their own so a page with a
// carousel never downloads them. Loaded after the main runtime (livingblocks/global), it registers both with it
// (LivingBlocks.register) and uses its helpers (LivingBlocks.kit). Plain browser code once built: the page holds no
// module loader.
//
// A table is the design's own layers: a header row of column cells, each saying what its column holds
// (data-living-column), and rows of cells. Here it becomes a table for assistive technology, sorts by a column's
// kind, lights the row under the pointer, filters by a search box, pages, and on a narrow screen scrolls sideways
// with its first column held in place.
//
// A chart is drawn by the design tool from its data (chartData.ts geometry: a path for a line, boxes for bars, labels
// along its axis). Here it gets a tooltip and a guide line at the point under the pointer or the keyboard's focus,
// draws in as it comes into view, drops the axis labels that would overlap, and carries its data as a table read by
// screen readers.

import { formatValue, geometry, parseData, type ChartData } from './chartData.js';
import { sortOrder } from './tableSort.js';

type Kit = {
  partOf: (el: Element, name: string) => HTMLElement | null;
  asButton: (el: Element | null, label: string | null, press: () => void) => () => void;
  announce: (doc: Document, words: string) => void;
  reduced: () => boolean;
  ease: string;
};
type Spec = { kind: string; v: number; settings: Record<string, unknown> };
type Runtime = { register: (kind: string, run: (el: HTMLElement, spec: Spec) => (() => void) | void) => void; kit: Kit };

(function () {
  const lb = (window as unknown as { LivingBlocks?: Runtime }).LivingBlocks;
  if (!lb || typeof lb.register !== 'function') return;
  const kit = lb.kit;
  const EASE = kit.ease;

  /** this Block's own parts of a name, in document order (not those of a Block inside it) */
  const partsOf = (el: Element, name: string): HTMLElement[] => {
    const out: HTMLElement[] = [];
    el.querySelectorAll<HTMLElement>(`[data-living-part="${name}"]`).forEach((p) => {
      if (p.closest('[data-living]') === el) out.push(p);
    });
    return out;
  };
  /** the parts of a name directly under a parent layer, skipping wrappers a design added */
  const childParts = (parent: Element, name: string): HTMLElement[] => {
    const out: HTMLElement[] = [];
    const walk = (n: Element) => {
      for (const c of Array.from(n.children)) {
        if (c.hasAttribute('data-living')) continue;
        if (c.getAttribute('data-living-part') === name) out.push(c as HTMLElement);
        else if (!c.hasAttribute('data-living-part')) walk(c);
      }
    };
    walk(parent);
    return out;
  };

  const CSS =
    '[data-living-part="row"][hidden], [data-living-part="empty"][hidden], [data-living-hide="true"] { display: none !important; }' +
    '[data-living-part="row"] { transition: background-color 0.2s ' + EASE + '; }' +
    '[data-living-rows] > [data-living-part="row"]:hover, [data-living-rows] > [data-living-part="row"]:focus-within { background-color: var(--living-row-hover); }' +
    '[data-living-part="column"][data-living-sort] { cursor: pointer; user-select: none; }' +
    '[data-living-part="column"][data-living-sort]:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }' +
    '[data-living-part="icon"] { transition: transform 0.3s ' + EASE + ', opacity 0.2s ' + EASE + '; }' +
    '[data-living-pinned] { position: sticky; left: var(--living-pin-left, 0); z-index: 1; }' +
    '.living-search { box-sizing: border-box; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; }' +
    '.living-search::placeholder { color: var(--living-placeholder, inherit); opacity: 1; }' +
    '.living-search:focus { outline: none; }' +
    '[data-living-part="search"]:focus-within { outline: 2px solid currentColor; outline-offset: 2px; }' +
    '.living-tip { position: absolute; z-index: 3; pointer-events: none; box-sizing: border-box; min-width: 120px; max-width: 260px; padding: 10px 12px; border-radius: 10px; background: var(--living-tip-bg, #1d1d1f); color: var(--living-tip-ink, #fff); font-size: 13px; line-height: 1.45; box-shadow: 0 8px 24px rgba(0,0,0,.18); opacity: 0; transform: translate(-50%, calc(-100% - 12px)); transition: opacity .15s ' + EASE + '; white-space: nowrap; }' +
    '.living-tip.is-on { opacity: 1; }' +
    '.living-tip b { display: block; font-weight: 600; margin-bottom: 2px; }' +
    '.living-tip span { display: flex; align-items: center; gap: 6px; }' +
    '.living-tip i { display: inline-block; flex: none; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 1px rgba(255,255,255,.7); }' +
    '.living-guide { position: absolute; top: 0; bottom: 0; width: 1px; z-index: 2; pointer-events: none; background: currentColor; opacity: 0; transition: opacity .15s ' + EASE + '; }' +
    '.living-guide.is-on { opacity: .35; }' +
    '.living-dot { position: absolute; z-index: 2; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%; border: 2px solid var(--living-dot-ring, #fff); box-sizing: border-box; pointer-events: none; opacity: 0; transition: opacity .15s ' + EASE + '; }' +
    '.living-dot.is-on { opacity: 1; }' +
    '[data-living-part="plot"]:focus-visible { outline: 2px solid currentColor; outline-offset: 4px; }' +
    '.living-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }' +
    '@media (prefers-reduced-motion: reduce) { [data-living-part="row"], [data-living-part="icon"], .living-tip, .living-guide, .living-dot { transition: none; } }';
  const addStyle = (doc: Document) => {
    if (doc.getElementById('livingblocks-dashboard-style')) return;
    const st = doc.createElement('style');
    st.id = 'livingblocks-dashboard-style';
    st.textContent = CSS;
    doc.head.appendChild(st);
  };
  /** a colour that is drawn, or null when it is transparent */
  const solid = (c: string | null | undefined) => (c && !/^(transparent|rgba\(\s*0,\s*0,\s*0,\s*0\s*\))$/.test(c) ? c : null);
  /** the first colour behind an element, up to the Block */
  const behind = (n: HTMLElement | null, stop: Element): string | null => {
    for (let p: HTMLElement | null = n; p; p = p.parentElement) {
      const c = solid(getComputedStyle(p).backgroundColor);
      if (c) return c;
      if (p === stop) break;
    }
    return null;
  };

  // ── Table ─────────────────────────────────────────────────────────────────
  type Column = { kind: string; sort?: boolean; min?: number; phone?: boolean };
  function table(el: HTMLElement, spec: Spec): () => void {
    const s = spec.settings;
    const doc = el.ownerDocument;
    addStyle(doc);
    const offs: Array<() => void> = [];
    const head = kit.partOf(el, 'head');
    const body = kit.partOf(el, 'body');
    if (!head || !body) return () => {};
    const columns = childParts(head, 'column');
    const config: Column[] = columns.map((c) => {
      try {
        return JSON.parse(c.getAttribute('data-living-column') || '{}') as Column;
      } catch {
        return { kind: 'text' };
      }
    });
    const all = childParts(body, 'row');
    const cellsOf = (row: HTMLElement) => childParts(row, 'cell');
    const drawnOrder = all.slice();

    // what assistive technology reads: a table of a header row and rows of cells
    const grid = head.parentElement === body.parentElement ? (head.parentElement as HTMLElement) : el;
    const roles: Array<[Element, string | null]> = [];
    const role = (n: Element, r: string) => {
      roles.push([n, n.getAttribute('role')]);
      n.setAttribute('role', r);
    };
    role(grid, 'table');
    if (grid !== el && !grid.hasAttribute('aria-label') && el.getAttribute('aria-label')) grid.setAttribute('aria-label', el.getAttribute('aria-label') || '');
    role(head, 'row');
    columns.forEach((c) => role(c, 'columnheader'));
    role(body, 'rowgroup');
    all.forEach((r) => {
      role(r, 'row');
      cellsOf(r).forEach((c) => role(c, 'cell'));
    });

    // the row under the pointer lights up in the header's own colour, or a shade of the words' when it has none
    const hover = solid(getComputedStyle(head).backgroundColor) || 'rgba(127,127,127,0.08)';
    body.style.setProperty('--living-row-hover', hover);
    body.setAttribute('data-living-rows', '');

    // sorting
    let sortBy = typeof s.sort === 'number' && s.sort >= 0 && s.sort < columns.length ? s.sort : -1;
    let dir: 'asc' | 'desc' = s.dir === 'asc' ? 'asc' : 'desc';
    // a column's sort arrow (its own, not one of a Block inside it), and its name without the arrow
    const icons = columns.map((c) => Array.from(c.querySelectorAll<HTMLElement>('[data-living-part="icon"]')).find((i) => i.closest('[data-living]') === el) ?? null);
    const nameOf = (i: number) => {
      const icon = icons[i];
      let words = '';
      const walk = (n: Node) => {
        if (n === icon) return;
        if (n.nodeType === 3) words += n.textContent;
        n.childNodes.forEach(walk);
      };
      walk(columns[i]);
      return words.replace(/\s+/g, ' ').trim();
    };
    const iconWas = icons.map((i) => (i ? { t: i.style.transform, o: i.style.opacity } : null));
    let rows = all.slice();
    const paint = () => {
      columns.forEach((c, i) => {
        if (!config[i]?.sort) return;
        c.setAttribute('aria-sort', i === sortBy ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
        const icon = icons[i];
        if (icon) {
          icon.style.opacity = i === sortBy ? '1' : '0';
          // drawn pointing down: descending; turned for ascending
          icon.style.transform = i === sortBy && dir === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      });
    };
    const order = () => {
      if (sortBy < 0) rows = drawnOrder.slice();
      else {
        const kind = config[sortBy]?.kind ?? 'text';
        rows = sortOrder(drawnOrder.map((r) => cellsOf(r)[sortBy]?.textContent ?? ''), kind, dir).map((i) => drawnOrder[i]);
      }
      for (const r of rows) body.appendChild(r);
    };
    columns.forEach((c, i) => {
      if (!config[i]?.sort) return;
      c.setAttribute('data-living-sort', '');
      if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '0');
      const press = () => {
        if (sortBy === i) dir = dir === 'asc' ? 'desc' : 'asc';
        else {
          sortBy = i;
          dir = config[i].kind === 'text' || config[i].kind === 'person' || config[i].kind === 'status' || config[i].kind === 'link' ? 'asc' : 'desc';
        }
        order();
        paint();
        page = 0;
        show();
        kit.announce(doc, `Sorted by ${nameOf(i)}, ${dir === 'asc' ? 'ascending' : 'descending'}`);
      };
      const click = (e: Event) => {
        e.preventDefault();
        press();
      };
      const key = (e: KeyboardEvent) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        press();
      };
      c.addEventListener('click', click);
      c.addEventListener('keydown', key);
      offs.push(() => {
        c.removeEventListener('click', click);
        c.removeEventListener('keydown', key);
        c.removeAttribute('data-living-sort');
        c.removeAttribute('aria-sort');
      });
    });

    // searching: the search part becomes a box typed in (its drawn words, the placeholder)
    let query = '';
    const searchPart = kit.partOf(el, 'search');
    let searchInput: HTMLInputElement | null = null;
    const hiddenDrawn: HTMLElement[] = [];
    if (searchPart) {
      const drawn = Array.from(searchPart.children).find((n) => (n.textContent || '').trim()) as HTMLElement | undefined;
      searchInput = doc.createElement('input');
      searchInput.type = 'search';
      searchInput.className = 'living-search';
      searchInput.placeholder = (drawn?.textContent || 'Search').trim();
      searchInput.setAttribute('aria-label', searchInput.placeholder);
      if (drawn) {
        const ds = getComputedStyle(drawn);
        searchInput.style.font = ds.font;
        searchInput.style.setProperty('--living-placeholder', ds.color);
        drawn.style.display = 'none';
        hiddenDrawn.push(drawn);
      }
      searchPart.appendChild(searchInput);
      const onInput = () => {
        query = (searchInput!.value || '').trim().toLowerCase();
        page = 0;
        show();
      };
      searchInput.addEventListener('input', onInput);
      offs.push(() => searchInput!.removeEventListener('input', onInput));
    }

    // pages: rows per page, the counter's own words with {from}, {to} and {total}, first, previous, next, last
    const size = typeof s.pageSize === 'number' && s.pageSize > 0 ? Math.round(s.pageSize) : 0;
    let page = 0;
    const counter = kit.partOf(el, 'counter');
    // its words: the setting's, with {from}, {to} and {total}; else the counter's own when they hold them
    const drawnCount = counter ? counter.textContent || '' : '';
    const counterWords = typeof s.count === 'string' && s.count ? s.count : drawnCount;
    const nav = { first: kit.partOf(el, 'first'), prev: kit.partOf(el, 'prev'), next: kit.partOf(el, 'next'), last: kit.partOf(el, 'last') };
    const empty = kit.partOf(el, 'empty');
    const emptyWas = empty ? empty.hidden : false;
    const show = () => {
      const match = query ? rows.filter((r) => (r.textContent || '').toLowerCase().includes(query)) : rows;
      const pages = size ? Math.max(1, Math.ceil(match.length / size)) : 1;
      page = Math.min(page, pages - 1);
      const from = size ? page * size : 0;
      const to = size ? Math.min(match.length, from + size) : match.length;
      const shown = new Set(match.slice(from, to));
      for (const r of rows) r.hidden = !shown.has(r);
      if (empty) empty.hidden = match.length > 0;
      if (counter && /\{(from|to|total)\}/.test(counterWords))
        counter.textContent = counterWords.replace(/\{from\}/g, String(match.length ? from + 1 : 0)).replace(/\{to\}/g, String(to)).replace(/\{total\}/g, String(match.length));
      const off = (n: HTMLElement | null, yes: boolean) => {
        if (!n) return;
        if (yes) {
          n.setAttribute('data-living-off', 'true');
          n.setAttribute('aria-disabled', 'true');
        } else {
          n.removeAttribute('data-living-off');
          n.removeAttribute('aria-disabled');
        }
      };
      off(nav.first, page === 0);
      off(nav.prev, page === 0);
      off(nav.next, page >= pages - 1);
      off(nav.last, page >= pages - 1);
    };
    const go = (to: () => number) => () => {
      const match = query ? rows.filter((r) => (r.textContent || '').toLowerCase().includes(query)) : rows;
      const pages = size ? Math.max(1, Math.ceil(match.length / size)) : 1;
      const next = Math.max(0, Math.min(pages - 1, to()));
      if (next === page) return;
      page = next;
      show();
      kit.announce(doc, `Page ${page + 1} of ${pages}`);
    };
    offs.push(kit.asButton(nav.first, 'First page', go(() => 0)));
    offs.push(kit.asButton(nav.prev, 'Previous page', go(() => page - 1)));
    offs.push(kit.asButton(nav.next, 'Next page', go(() => page + 1)));
    offs.push(kit.asButton(nav.last, 'Last page', go(() => 1e9)));

    // narrow screens: the columns keep their narrowest width and the table scrolls sideways, its first column held
    const phoneHidden = config.map((c) => c?.phone === false);
    const fit = () => {
      const phone = (doc.defaultView?.innerWidth ?? 1024) < 600;
      columns.forEach((c, i) => {
        const hide = phone && phoneHidden[i];
        c.toggleAttribute('data-living-hide', false);
        if (hide) c.setAttribute('data-living-hide', 'true');
        else c.removeAttribute('data-living-hide');
        for (const r of all) {
          const cell = cellsOf(r)[i];
          if (!cell) continue;
          if (hide) cell.setAttribute('data-living-hide', 'true');
          else cell.removeAttribute('data-living-hide');
        }
      });
      const need = config.reduce((sum, c, i) => sum + (phone && phoneHidden[i] ? 0 : c?.min ?? 120), 0);
      const tight = grid.clientWidth > 0 && grid.clientWidth < need;
      grid.style.overflowX = tight ? 'auto' : '';
      // the rows' container as wide as the rows, so what is drawn behind them (a table's dividers) runs their length
      for (const r of [head, body, ...all]) r.style.minWidth = tight ? `${need}px` : '';
      const pin = s.pin !== false && tight;
      const first = (r: HTMLElement) => (r === head ? columns[0] : cellsOf(r)[0]);
      for (const r of [head, ...all]) {
        const c = first(r);
        if (!c) continue;
        // inline: a page's own class rules (a cell placed relative) would win over a rule of ours
        if (pin) {
          // held where the row's padding puts it, the strip before it painted over, so its words keep their margin
          const bg = behind(r, el) || behind(el, el) || '#fff';
          const pad = parseFloat(getComputedStyle(r).paddingLeft) || 0;
          c.setAttribute('data-living-pinned', '');
          c.style.setProperty('--living-pin-left', `${pad}px`);
          c.style.position = 'sticky';
          c.style.left = `${pad}px`;
          c.style.zIndex = '1';
          c.style.backgroundColor = bg;
          c.style.boxShadow = pad ? `-${pad}px 0 0 0 ${bg}` : '';
        } else {
          c.removeAttribute('data-living-pinned');
          c.style.removeProperty('--living-pin-left');
          c.style.position = '';
          c.style.left = '';
          c.style.zIndex = '';
          c.style.backgroundColor = '';
          c.style.boxShadow = '';
        }
      }
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fit()) : null;
    ro?.observe(grid);

    if (sortBy >= 0) order();
    paint();
    show();
    fit();

    return () => {
      offs.forEach((f) => f());
      ro?.disconnect();
      for (const r of drawnOrder) body.appendChild(r);
      for (const r of all) r.hidden = false;
      if (empty) empty.hidden = emptyWas;
      if (counter) counter.textContent = drawnCount;
      icons.forEach((icon, i) => {
        if (icon && iconWas[i]) {
          icon.style.transform = iconWas[i]!.t;
          icon.style.opacity = iconWas[i]!.o;
        }
      });
      searchInput?.remove();
      hiddenDrawn.forEach((d) => (d.style.display = ''));
      roles.reverse().forEach(([n, r]) => (r === null ? n.removeAttribute('role') : n.setAttribute('role', r)));
      body.removeAttribute('data-living-rows');
      body.style.removeProperty('--living-row-hover');
      grid.style.overflowX = '';
      for (const r of [head, body, ...all]) r.style.minWidth = '';
      el.querySelectorAll('[data-living-pinned]').forEach((c) => {
        c.removeAttribute('data-living-pinned');
        const st = (c as HTMLElement).style;
        st.position = st.left = st.zIndex = st.backgroundColor = '';
      });
      el.querySelectorAll('[data-living-hide]').forEach((c) => c.removeAttribute('data-living-hide'));
    };
  }

  // ── Chart ─────────────────────────────────────────────────────────────────
  function chart(el: HTMLElement, spec: Spec): () => void {
    const s = spec.settings;
    const doc = el.ownerDocument;
    addStyle(doc);
    const plot = kit.partOf(el, 'plot');
    if (!plot) return () => {};
    const data: ChartData = parseData(typeof s.data === 'string' ? s.data : '');
    const fmt = { format: s.format as 'number' | 'compact' | 'percent', prefix: s.prefix as string, suffix: s.suffix as string, decimals: s.decimals as number };
    const offs: Array<() => void> = [];
    const added: Element[] = [];
    const positioned = getComputedStyle(plot).position === 'static';
    if (positioned) plot.style.position = 'relative';

    // the colours: each series as drawn (its line's stroke, its bars' fill), else the words' colour
    // each series' layers say their series (data-living-series): its line is the path drawn with no fill, its area
    // the filled one; the grid's dashed lines say nothing and are left alone
    const seriesOf = (n: Element) => Number(n.getAttribute('data-living-series'));
    const marked = Array.from(plot.querySelectorAll('[data-living-series]'));
    const pathsOf = (n: Element) => Array.from(n.querySelectorAll('svg path'));
    const unfilled = (p: Element) => getComputedStyle(p).fill === 'none' || getComputedStyle(p).fillOpacity === '0';
    const lines: Array<{ si: number; path: Element }> = [];
    const areas: Element[] = [];
    for (const n of marked) for (const p of pathsOf(n)) (unfilled(p) ? lines.push({ si: seriesOf(n), path: p }) : areas.push(p));
    const bars = partsOf(el, 'bar');
    const colourOf = (si: number) => {
      const line = lines.find((l) => l.si === si);
      if (line) return getComputedStyle(line.path).stroke;
      const bar = bars.find((b) => seriesOf(b) === si) ?? bars[si];
      if (bar) return solid(getComputedStyle(bar).backgroundColor) || getComputedStyle(el).color;
      return getComputedStyle(el).color;
    };

    // what a screen reader reads: the data as a table; the drawing itself is one picture with a name
    const sr = doc.createElement('table');
    sr.className = 'living-sr';
    const caption = (el.getAttribute('aria-label') || 'Chart').trim();
    const cap = doc.createElement('caption');
    cap.textContent = caption;
    sr.appendChild(cap);
    const tr = doc.createElement('tr');
    for (const h of [data.labelName || 'Label', ...data.series.map((x) => x.name)]) {
      const th = doc.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      tr.appendChild(th);
    }
    sr.appendChild(tr);
    data.labels.forEach((l, i) => {
      const row = doc.createElement('tr');
      const th = doc.createElement('th');
      th.scope = 'row';
      th.textContent = l;
      row.appendChild(th);
      for (const x of data.series) {
        const td = doc.createElement('td');
        td.textContent = formatValue(x.values[i], fmt);
        row.appendChild(td);
      }
      sr.appendChild(row);
    });
    plot.insertAdjacentElement('afterend', sr);
    added.push(sr);
    const plotWas = { role: plot.getAttribute('role'), label: plot.getAttribute('aria-label'), tab: plot.getAttribute('tabindex') };
    plot.setAttribute('role', 'img');
    plot.setAttribute('aria-label', `${caption}: ${data.series.map((x) => x.name).join(', ')}, ${data.labels.length} points. Arrow keys read each point; its values are in the table that follows.`);
    if (!plot.hasAttribute('tabindex')) plot.setAttribute('tabindex', '0');

    // the tooltip, the guide line and a dot on each series at the point
    const tip = doc.createElement('div');
    tip.className = 'living-tip';
    // in the chart's own type (its value's or a label's), never the browser's default serif
    const words = kit.partOf(el, 'value') || partsOf(el, 'tick')[0] || kit.partOf(el, 'range');
    if (words) tip.style.fontFamily = getComputedStyle(words).fontFamily;
    tip.setAttribute('aria-hidden', 'true');
    const guide = doc.createElement('div');
    guide.className = 'living-guide';
    guide.setAttribute('aria-hidden', 'true');
    plot.appendChild(guide);
    plot.appendChild(tip);
    added.push(tip, guide);
    const type = (s.type as 'line' | 'area' | 'bar') || 'line';
    const dots = type === 'bar' ? [] : data.series.map((_, si) => {
      const d = doc.createElement('div');
      d.className = 'living-dot';
      d.setAttribute('aria-hidden', 'true');
      d.style.background = colourOf(si);
      plot.appendChild(d);
      added.push(d);
      return d;
    });
    const ring = behind(plot, el) || behind(el, el);
    if (ring) plot.style.setProperty('--living-dot-ring', ring);
    let at = -1;
    const geo = () => geometry(data, { type, stacked: !!s.stacked, smooth: !!s.smooth, zero: s.zero !== false, ticks: s.ticks as number }, plot.clientWidth, plot.clientHeight);
    const point = (i: number) => {
      if (i < 0 || i >= data.labels.length) return hide();
      at = i;
      const g = geo();
      const x = g.xs[i];
      guide.style.left = `${x}px`;
      guide.classList.toggle('is-on', type !== 'bar');
      let top = plot.clientHeight;
      dots.forEach((d, si) => {
        const v = data.series[si].values[i];
        if (v === null) return d.classList.remove('is-on');
        const y = g.y(v);
        top = Math.min(top, y);
        d.style.left = `${x}px`;
        d.style.top = `${y}px`;
        d.classList.add('is-on');
      });
      if (type === 'bar') for (const b of g.bars) if (b.index === i) top = Math.min(top, b.y);
      tip.innerHTML = '';
      const b = doc.createElement('b');
      b.textContent = data.labels[i];
      tip.appendChild(b);
      data.series.forEach((x, si) => {
        const line = doc.createElement('span');
        const sw = doc.createElement('i');
        sw.style.background = colourOf(si);
        line.appendChild(sw);
        line.appendChild(doc.createTextNode(`${data.series.length > 1 ? `${x.name}: ` : ''}${formatValue(x.values[i], fmt) || '-'}`));
        tip.appendChild(line);
      });
      // kept inside the plot's width
      const half = tip.offsetWidth / 2;
      tip.style.left = `${Math.max(half, Math.min(plot.clientWidth - half, x))}px`;
      tip.style.top = `${Math.max(0, top)}px`;
      tip.classList.add('is-on');
    };
    const hide = () => {
      at = -1;
      tip.classList.remove('is-on');
      guide.classList.remove('is-on');
      dots.forEach((d) => d.classList.remove('is-on'));
    };
    const nearest = (clientX: number) => {
      const r = plot.getBoundingClientRect();
      const g = geo();
      const x = clientX - r.left;
      let best = -1;
      let dist = Infinity;
      g.xs.forEach((px, i) => {
        const d = Math.abs(px - x);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      return best;
    };
    const move = (e: PointerEvent) => point(nearest(e.clientX));
    const leave = () => hide();
    const key = (e: KeyboardEvent) => {
      const n = data.labels.length;
      if (!n) return;
      let next = at;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = at < 0 ? 0 : Math.min(n - 1, at + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = at < 0 ? 0 : Math.max(0, at - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = n - 1;
      else if (e.key === 'Escape') return hide();
      else return;
      e.preventDefault();
      point(next);
      kit.announce(doc, `${data.labels[next]}: ${data.series.map((x) => `${data.series.length > 1 ? `${x.name} ` : ''}${formatValue(x.values[next], fmt) || 'no value'}`).join(', ')}`);
    };
    const blur = () => hide();
    plot.addEventListener('pointermove', move);
    plot.addEventListener('pointerleave', leave);
    plot.addEventListener('keydown', key);
    plot.addEventListener('blur', blur);
    offs.push(() => {
      plot.removeEventListener('pointermove', move);
      plot.removeEventListener('pointerleave', leave);
      plot.removeEventListener('keydown', key);
      plot.removeEventListener('blur', blur);
    });

    // the axis labels that would overlap at this width step aside, every other one, until none do
    const ticks = partsOf(el, 'tick');
    const thin = () => {
      ticks.forEach((t) => (t.style.visibility = ''));
      for (let step = 1; step < ticks.length; step *= 2) {
        let overlap = false;
        let right = -Infinity;
        ticks.forEach((t, i) => {
          const show = i % step === 0;
          t.style.visibility = show ? '' : 'hidden';
          if (!show) return;
          // the words' own width, not their box's (a bar's label spans its whole band)
          const range = doc.createRange();
          range.selectNodeContents(t);
          const r = range.getBoundingClientRect();
          if (r.width && r.left < right + 8) overlap = true;
          right = r.right;
        });
        if (!overlap) break;
      }
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => thin()) : null;
    ro?.observe(el);
    thin();

    // drawing in: lines trace themselves, areas fade up, bars grow from their base; at rest under reduced motion
    const draw = s.draw === 'off' || kit.reduced() ? 'off' : s.draw === 'always' ? 'always' : 'once';
    let io: IntersectionObserver | null = null;
    const anims: Animation[] = [];
    if (draw !== 'off' && typeof IntersectionObserver !== 'undefined' && typeof Element.prototype.animate === 'function') {
      const opts = { duration: 1100, easing: EASE, fill: 'backwards' as FillMode };
      const play = () => {
        anims.splice(0).forEach((a) => a.cancel());
        lines.forEach(({ path: p }) => {
          const len = (p as SVGPathElement).getTotalLength?.() || 0;
          if (!len) return;
          anims.push(p.animate([{ strokeDasharray: `${len} ${len}`, strokeDashoffset: `${len}` }, { strokeDasharray: `${len} ${len}`, strokeDashoffset: '0' }], opts));
        });
        areas.forEach((p) => anims.push(p.animate([{ opacity: 0 }, { opacity: 1 }], { ...opts, delay: 250 })));
        bars.forEach((b, i) => anims.push(b.animate([{ transform: 'scaleY(0)', transformOrigin: '50% 100%' }, { transform: 'scaleY(1)', transformOrigin: '50% 100%' }], { ...opts, duration: 800, delay: Math.min(400, i * 18) })));
      };
      // before it is seen, it waits drawn out of sight (its first frame), so nothing shows and then vanishes
      const rest = () => anims.splice(0).forEach((a) => a.cancel());
      let seen = false;
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            if (!seen || draw === 'always') play();
            seen = true;
            if (draw === 'once') io?.disconnect();
          } else if (draw === 'always' && seen) rest();
        }
      }, { threshold: 0.3 });
      io.observe(plot);
      offs.push(rest);
    }

    return () => {
      offs.forEach((f) => f());
      io?.disconnect();
      ro?.disconnect();
      ticks.forEach((t) => (t.style.visibility = ''));
      added.forEach((n) => n.remove());
      if (positioned) plot.style.position = '';
      plot.style.removeProperty('--living-dot-ring');
      for (const [k, v] of [['role', plotWas.role], ['aria-label', plotWas.label], ['tabindex', plotWas.tab]] as const) {
        if (v === null) plot.removeAttribute(k);
        else plot.setAttribute(k, v);
      }
    };
  }

  lb.register('table', table);
  lb.register('chart', chart);
})();
