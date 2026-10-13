// The livingblocks runtime: what Blocks do on a page (types.ts). A Block's layer
// carries its behaviour, version and settings (data-living), and its settings at
// each breakpoint (data-living-at); the layers its behaviour needs carry their
// part (data-living-part). Everything else is the design's own layers, drawn as
// designed. LivingBlocks.start(root) starts every Block under root, and those
// added later, and returns a function that stops them all.
//
// A plain script with no imports, so the same text runs in a design tool's
// preview, on a published page and in an exported project. It respects
// reduced motion, and each behaviour works with a keyboard and a screen
// reader.
(function () {
  var EASE = 'cubic-bezier(0.87, 0, 0.13, 1)';
  var reduced = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  /**
   * The Block's spec at this width: its own settings, then those of each
   * breakpoint whose query applies, in order, as the page's CSS cascades
   * (data-living-at, engine/blocks.ts blockAttributes).
   */
  function specOf(el) {
    try {
      var s = JSON.parse(el.getAttribute('data-living') || 'null');
      if (!s || s.v !== 1) return null;
      var steps = JSON.parse(el.getAttribute('data-living-at') || '[]');
      var settings = Object.assign({}, s.settings);
      steps.forEach(function (st) {
        if (window.matchMedia && window.matchMedia(st.query).matches) Object.assign(settings, st.settings);
      });
      return { kind: s.kind, v: s.v, settings: settings };
    } catch (e) {
      return null;
    }
  }
  /** what decides a Block's settings now: its spec and the breakpoints that apply */
  function keyOf(el) {
    var steps = [];
    try {
      steps = JSON.parse(el.getAttribute('data-living-at') || '[]');
    } catch (e) {
      steps = [];
    }
    return (el.getAttribute('data-living') || '') + steps.map(function (st) {
      return window.matchMedia && window.matchMedia(st.query).matches ? '1' : '0';
    }).join('');
  }
  /** a part of this Block, not of a Block inside it */
  function partOf(el, name) {
    var all = el.querySelectorAll('[data-living-part="' + name + '"]');
    for (var i = 0; i < all.length; i++) if (all[i].closest('[data-living]') === el) return all[i];
    return null;
  }
  /** a layer that is not a button by element becomes one: role, Tab stop, Enter and Space */
  function asButton(el, label, press) {
    if (!el) return function () {};
    var native = el.tagName === 'BUTTON';
    if (!native) {
      el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    }
    if (label) el.setAttribute('aria-label', label);
    var click = function (e) {
      e.preventDefault();
      e.stopPropagation();
      press();
    };
    var key = function (e) {
      if (native || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      press();
    };
    el.addEventListener('click', click);
    el.addEventListener('keydown', key);
    return function () {
      el.removeEventListener('click', click);
      el.removeEventListener('keydown', key);
    };
  }

  // ── Carousel ──────────────────────────────────────────────────────────────
  // A row of slides (the track) in a layer that clips; Previous and Next, dots,
  // a pause button. The track moves by the slide's own place in the row, so
  // slides of any width, and several at once, line up.
  function carousel(el, spec) {
    var s = spec.settings || {};
    var track = partOf(el, 'track');
    if (!track) return null;
    var slides = Array.prototype.slice.call(track.children);
    var n = slides.length;
    if (!n) return null;
    var perView = Math.max(1, Math.min(n, s.perView || 1));
    var last = n - perView;
    var at = Math.max(0, Math.min(last, s.start || 0));
    var offs = [];
    var prev = partOf(el, 'prev');
    var next = partOf(el, 'next');
    var dotsBox = partOf(el, 'dots');
    var pauseBtn = partOf(el, 'pause');
    var playing = !!s.autoplay && !reduced();
    var held = false;
    var timer = 0;

    el.setAttribute('role', 'region');
    el.setAttribute('aria-roledescription', 'carousel');
    track.setAttribute('aria-live', playing ? 'off' : 'polite');
    slides.forEach(function (sl, i) {
      sl.setAttribute('role', 'group');
      sl.setAttribute('aria-roledescription', 'slide');
      sl.setAttribute('aria-label', i + 1 + ' of ' + n);
    });
    // what the settings leave out, for this width (a breakpoint's settings can bring it back)
    [[prev, s.arrows], [next, s.arrows], [dotsBox, s.dots], [pauseBtn, s.autoplay]].forEach(function (p) {
      if (p[0]) p[0].style.display = p[1] ? '' : 'none';
    });

    // responsive: each slide takes its share of the view, whatever width the page is
    // (the canvas draws them at a fixed width; the page follows its own)
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.style.flexShrink = '0';
    track.style.width = '100%';
    track.style.minWidth = '0';
    slides.forEach(function (sl) {
      sl.style.flex = '0 0 calc((100% - ' + gap * (perView - 1) + 'px) / ' + perView + ')';
      sl.style.width = 'auto';
      sl.style.minWidth = '0';
      sl.style.maxWidth = 'none';
    });

    // pictures move in depth as their slide moves (parallax), by a share of the slide's width,
    // drawn larger by as much so they never show an edge; never with reduced motion
    var depth = Math.max(0, Math.min(0.3, s.parallax || 0));
    var view = track.parentElement || el;
    var pictures = slides.map(function (sl) {
      return Array.prototype.slice.call(sl.querySelectorAll('[data-living-part="picture"]')).filter(function (p) {
        return p.closest('[data-living]') === el;
      });
    });
    var deep = depth > 0 && pictures.some(function (list) { return list.length; });
    var deepFrame = 0;
    function placeDepth() {
      if (!deep || reduced()) return;
      var v = view.getBoundingClientRect();
      slides.forEach(function (sl, i) {
        if (!pictures[i].length) return;
        var r = sl.getBoundingClientRect();
        var off = r.left - v.left;
        var t = 'translateX(' + (-off * depth).toFixed(1) + 'px) scale(' + (1 + 2 * depth).toFixed(3) + ')';
        pictures[i].forEach(function (p) { p.style.transform = t; });
      });
    }
    // during a slide's move, every frame until it has landed
    function followDepth(ms) {
      if (!deep || reduced()) return;
      var until = Date.now() + ms;
      window.cancelAnimationFrame(deepFrame);
      var step = function () {
        placeDepth();
        if (Date.now() < until) deepFrame = window.requestAnimationFrame(step);
      };
      step();
    }

    // the dots: as many as the places the row can stop at, the designer's first dot copied for any missing
    var dots = [];
    if (dotsBox && s.dots) {
      var made = Array.prototype.slice.call(dotsBox.children);
      var stops = last + 1;
      for (var k = made.length; k < stops && made[0]; k++) {
        var copy = made[0].cloneNode(true);
        copy.setAttribute('data-living-made', '');
        dotsBox.appendChild(copy);
        made.push(copy);
      }
      made.forEach(function (d, i) {
        if (i >= stops) d.style.display = 'none';
        else dots.push(d);
      });
    }
    dots.forEach(function (d, i) {
      offs.push(asButton(d, 'Show slide ' + (i + 1), function () { go(i, true); }));
    });

    function measure() {
      return slides[at] ? slides[at].offsetLeft - slides[0].offsetLeft : 0;
    }
    function paint(animate) {
      track.style.transition = animate && !reduced() ? 'transform 0.6s ' + EASE : 'none';
      track.style.transform = 'translateX(' + -measure() + 'px)';
      slides.forEach(function (sl, i) {
        var shown = i >= at && i < at + perView;
        sl.setAttribute('aria-hidden', shown ? 'false' : 'true');
        // what is out of sight is out of the Tab order too
        if (shown) sl.removeAttribute('inert');
        else sl.setAttribute('inert', '');
      });
      dots.forEach(function (d, i) {
        d.setAttribute('data-living-on', i === at ? 'true' : 'false');
        if (i === at) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      followDepth(animate ? 700 : 0);
      if (!s.loop) {
        [[prev, at === 0], [next, at >= last]].forEach(function (p) {
          if (!p[0]) return;
          p[0].setAttribute('aria-disabled', p[1] ? 'true' : 'false');
          p[0].setAttribute('data-living-off', p[1] ? 'true' : 'false');
        });
      }
    }
    function go(i, byHand) {
      if (i < 0) i = s.loop ? last : 0;
      if (i > last) i = s.loop ? 0 : last;
      at = i;
      paint(true);
      if (byHand) restart();
    }
    offs.push(asButton(prev, 'Previous slide', function () { go(at - 1, true); }));
    offs.push(asButton(next, 'Next slide', function () { go(at + 1, true); }));

    // plays on its own: stops while the pointer or the focus is on it, and for good with Pause
    function tick() {
      if (playing && !held) go(at + 1, false);
    }
    function restart() {
      window.clearInterval(timer);
      if (playing) timer = window.setInterval(tick, Math.max(2, s.interval || 5) * 1000);
    }
    function labelPause() {
      if (!pauseBtn) return;
      pauseBtn.setAttribute('aria-label', playing ? 'Pause slides' : 'Play slides');
      pauseBtn.setAttribute('aria-pressed', playing ? 'false' : 'true');
      pauseBtn.setAttribute('data-living-on', playing ? 'true' : 'false');
    }
    if (s.autoplay) {
      offs.push(asButton(pauseBtn, null, function () {
        playing = !playing;
        track.setAttribute('aria-live', playing ? 'off' : 'polite');
        labelPause();
        restart();
      }));
      labelPause();
      var hold = function () { held = true; };
      var free = function (e) {
        if (e.type === 'focusout' && el.contains(e.relatedTarget)) return;
        held = false;
      };
      el.addEventListener('pointerenter', hold);
      el.addEventListener('pointerleave', free);
      el.addEventListener('focusin', hold);
      el.addEventListener('focusout', free);
      offs.push(function () {
        el.removeEventListener('pointerenter', hold);
        el.removeEventListener('pointerleave', free);
        el.removeEventListener('focusin', hold);
        el.removeEventListener('focusout', free);
      });
    }

    // Left and Right while the focus is in it
    var keys = function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.target && e.target.closest && e.target.closest('input, textarea, select, [role="tab"]')) return;
      e.preventDefault();
      go(at + (e.key === 'ArrowRight' ? 1 : -1), true);
    };
    el.addEventListener('keydown', keys);
    offs.push(function () { el.removeEventListener('keydown', keys); });

    // swipe on a touch screen, drag with a mouse: the row follows, and a short throw is enough
    if (s.swipe) {
      var from = null;
      var moved = false;
      var down = function (e) {
        if (e.button !== 0 || (e.target.closest && e.target.closest('[data-living-part="prev"], [data-living-part="next"], [data-living-part="dots"], [data-living-part="pause"]'))) return;
        from = { x: e.clientX, y: e.clientY, base: measure(), t: Date.now() };
        moved = false;
      };
      var move = function (e) {
        if (!from) return;
        var dx = e.clientX - from.x;
        if (!moved && Math.abs(dx) < 6) return;
        if (!moved && Math.abs(e.clientY - from.y) > Math.abs(dx)) {
          from = null;
          return;
        }
        moved = true;
        held = true;
        track.style.transition = 'none';
        track.style.transform = 'translateX(' + (-from.base + dx) + 'px)';
        placeDepth();
      };
      var up = function (e) {
        if (!from) return;
        var dx = e.clientX - from.x;
        var fast = Math.abs(dx) > 30 && Date.now() - from.t < 300;
        var width = slides[0].offsetWidth || 1;
        from = null;
        held = false;
        if (!moved) return;
        if (Math.abs(dx) > width / 4 || fast) go(at + (dx < 0 ? 1 : -1), true);
        else paint(true);
      };
      // a drag is not a click on what is under it
      var swallow = function (e) {
        if (!moved) return;
        e.preventDefault();
        e.stopPropagation();
        moved = false;
      };
      track.style.touchAction = 'pan-y';
      track.addEventListener('pointerdown', down);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
      track.addEventListener('click', swallow, true);
      offs.push(function () {
        track.removeEventListener('pointerdown', down);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        track.removeEventListener('click', swallow, true);
      });
    }

    // a resize moves the slides' places
    var resized = function () { paint(false); };
    window.addEventListener('resize', resized);
    offs.push(function () { window.removeEventListener('resize', resized); });

    paint(false);
    restart();
    return function () {
      window.clearInterval(timer);
      window.cancelAnimationFrame(deepFrame);
      offs.forEach(function (f) { f(); });
      // back as it was drawn, for the next start (a breakpoint's settings, a new setting in Preview)
      ['transform', 'transition', 'flexShrink', 'width', 'minWidth'].forEach(function (k) { track.style[k] = ''; });
      slides.forEach(function (sl) {
        ['flex', 'width', 'minWidth', 'maxWidth'].forEach(function (k) { sl.style[k] = ''; });
        sl.removeAttribute('inert');
      });
      pictures.forEach(function (list) { list.forEach(function (p) { p.style.transform = ''; }); });
      [prev, next, dotsBox, pauseBtn].forEach(function (p) { if (p) p.style.display = ''; });
      dotsBox && Array.prototype.slice.call(dotsBox.querySelectorAll('[data-living-made]')).forEach(function (d) { d.remove(); });
      dotsBox && Array.prototype.slice.call(dotsBox.children).forEach(function (d) { d.style.display = ''; });
    };
  }

  // ── Accordion ─────────────────────────────────────────────────────────────
  // Items (part item), each a header pressed to open and close it (part
  // header) and what opens (part panel), maybe an icon that turns (part icon).
  // The design shows every item open, so all of it can be written; the page
  // starts as the settings say (start: the item open first, -1 none). A panel
  // opens to its own height and closes to none, on the house curve; with
  // `single`, opening one closes the others.
  var uid = 0;
  /** the first layer with this part inside an item, belonging to this Block */
  function partIn(scope, el, name) {
    var all = scope.querySelectorAll('[data-living-part="' + name + '"]');
    for (var i = 0; i < all.length; i++) if (all[i].closest('[data-living]') === el) return all[i];
    return null;
  }
  /** once a height transition ends (or would have), whichever comes first */
  function afterMove(node, done) {
    var called = false;
    var finish = function (e) {
      if (called || (e && e.propertyName !== 'height')) return;
      called = true;
      node.removeEventListener('transitionend', finish);
      done();
    };
    node.addEventListener('transitionend', finish);
    window.setTimeout(finish, 600);
  }
  function accordion(el, spec) {
    var s = spec.settings || {};
    var rows = [];
    Array.prototype.slice.call(el.querySelectorAll('[data-living-part="item"]')).forEach(function (item) {
      if (item.closest('[data-living]') !== el) return;
      var header = partIn(item, el, 'header');
      var panel = partIn(item, el, 'panel');
      if (header && panel) rows.push({ header: header, panel: panel, icon: partIn(item, el, 'icon'), open: true });
    });
    if (!rows.length) return null;
    var offs = [];

    function set(r, open, animate) {
      r.open = open;
      var p = r.panel;
      r.header.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (r.icon) {
        r.icon.style.transition = animate && !reduced() ? 'transform 0.45s ' + EASE : 'none';
        r.icon.style.transform = open ? 'rotate(45deg)' : 'rotate(0deg)';
      }
      var smooth = animate && !reduced();
      if (open) {
        p.style.display = '';
        p.removeAttribute('inert');
        if (!smooth) {
          p.style.height = '';
          return;
        }
        var to = p.scrollHeight;
        p.style.transition = 'none';
        p.style.height = '0px';
        void p.offsetHeight;
        p.style.transition = 'height 0.45s ' + EASE;
        p.style.height = to + 'px';
        afterMove(p, function () {
          if (!r.open) return;
          p.style.transition = '';
          p.style.height = '';
        });
      } else {
        // what is closed is out of the Tab order and out of a screen reader's reach
        p.setAttribute('inert', '');
        if (!smooth) {
          p.style.height = '0px';
          p.style.display = 'none';
          return;
        }
        p.style.transition = 'none';
        p.style.height = p.scrollHeight + 'px';
        void p.offsetHeight;
        p.style.transition = 'height 0.45s ' + EASE;
        p.style.height = '0px';
        afterMove(p, function () {
          if (r.open) return;
          p.style.transition = '';
          p.style.display = 'none';
        });
      }
    }
    function toggle(i) {
      var r = rows[i];
      var open = !r.open;
      if (open && s.single) rows.forEach(function (o, k) { if (k !== i && o.open) set(o, false, true); });
      set(r, open, true);
    }

    rows.forEach(function (r, i) {
      uid += 1;
      if (!r.header.id) r.header.id = 'living-header-' + uid;
      if (!r.panel.id) r.panel.id = 'living-panel-' + uid;
      r.header.setAttribute('aria-controls', r.panel.id);
      r.panel.setAttribute('role', 'region');
      r.panel.setAttribute('aria-labelledby', r.header.id);
      r.panel.style.overflow = 'hidden';
      // the icon says it with its turn; a screen reader hears expanded or collapsed instead
      if (r.icon) r.icon.setAttribute('aria-hidden', 'true');
      offs.push(asButton(r.header, null, function () { toggle(i); }));
      set(r, i === (typeof s.start === 'number' ? s.start : 0), false);
    });

    // Up and Down between the headers, Home and End to the first and last
    var keys = function (e) {
      var at = -1;
      rows.forEach(function (r, k) { if (r.header === e.target) at = k; });
      if (at < 0) return;
      var to = e.key === 'ArrowDown' ? (at + 1) % rows.length : e.key === 'ArrowUp' ? (at - 1 + rows.length) % rows.length : e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : -1;
      if (to < 0) return;
      e.preventDefault();
      rows[to].header.focus();
    };
    el.addEventListener('keydown', keys);
    offs.push(function () { el.removeEventListener('keydown', keys); });

    return function () {
      offs.forEach(function (f) { f(); });
      rows.forEach(function (r) {
        ['height', 'display', 'overflow', 'transition'].forEach(function (k) { r.panel.style[k] = ''; });
        r.panel.removeAttribute('inert');
        r.panel.removeAttribute('role');
        r.panel.removeAttribute('aria-labelledby');
        r.header.removeAttribute('aria-expanded');
        r.header.removeAttribute('aria-controls');
        if (r.icon) {
          r.icon.style.transform = '';
          r.icon.style.transition = '';
        }
      });
    };
  }

  // ── Notice ────────────────────────────────────────────────────────────────
  // A message that comes in after a while (delay, seconds) and leaves when a
  // dismiss part is pressed, on Escape, or after `stay` seconds (0: until
  // dismissed; the count holds while the pointer or the focus is on it).
  // Where it sits on the window is the design's: a design tool pins it there
  // (uxdeck's Fixed layers). It never takes the focus (it does not interrupt);
  // what it says is read out politely as it comes in. With `remember`, once
  // dismissed it stays away for that visitor (their browser), until its words
  // change. Not consent: it holds nothing back.
  var announcer = null;
  /** one polite live region for the page: a notice's words, read out as it comes in */
  function announce(doc, words) {
    if (!announcer || !announcer.isConnected) {
      announcer = doc.createElement('div');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('data-living-announcer', '');
      announcer.className = 'living-announcer';
      doc.body.appendChild(announcer);
    }
    announcer.textContent = '';
    window.setTimeout(function () { announcer.textContent = words; }, 60);
  }
  /** a short, stable name for some words (a notice's memory key) */
  function hashOf(text) {
    var h = 5381;
    for (var i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  function notice(el, spec, options) {
    var s = spec.settings || {};
    var doc = el.ownerDocument || document;
    var all = el.querySelectorAll('[data-living-part="dismiss"]');
    var closers = [];
    for (var i = 0; i < all.length; i++) if (all[i].closest('[data-living]') === el) closers.push(all[i]);
    // its words, without its buttons': what is read out, and what it is remembered by
    var words = (function () {
      var out = [];
      var walk = function (n) {
        if (n.nodeType === 3) {
          var t = n.textContent.replace(/\s+/g, ' ').trim();
          if (t) out.push(t);
          return;
        }
        if (n.nodeType !== 1 || n.tagName === 'BUTTON' || n.tagName === 'A' || n.getAttribute('role') === 'button' || n.hasAttribute('data-living-part')) return;
        for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
      };
      walk(el);
      return out.join(' ');
    })();
    var memory = 'livingblocks:notice:' + hashOf(words);
    var remember = !!s.remember && options.remember !== false;
    var seen = false;
    if (remember) {
      try { seen = window.localStorage.getItem(memory) === '1'; } catch (e) { seen = false; }
    }
    var up = /^top/.test(s.position || 'bottom-center');
    var offs = [];
    var timers = [];
    var shown = false;
    var held = false;
    var left = 0;
    var stayTimer = 0;

    el.setAttribute('role', 'region');
    // a Notice floating over the window, a card narrower than it, keeps 16 clear of its edges on
    // a narrow one. A Banner takes the width its page gives it, in the page's flow or pinned
    // across its container: capped, it stopped 32 short of the right edge (uxdeck, 2026-10-13)
    var floats = /^(fixed|absolute|sticky)$/.test(window.getComputedStyle(el).position);
    var holder = el.offsetParent || el.parentElement;
    var spans = !!holder && Math.abs(el.getBoundingClientRect().width - holder.getBoundingClientRect().width) <= 2;
    if (floats && !spans) el.style.maxWidth = 'calc(100% - 32px)';
    el.style.display = 'none';
    el.setAttribute('data-living-on', 'false');

    function moveTo(on, animate) {
      var smooth = animate && !reduced();
      el.style.transition = smooth ? 'opacity 0.45s ' + EASE + ', transform 0.45s ' + EASE : 'none';
      el.style.opacity = on ? '1' : '0';
      el.style.transform = on ? 'translateY(0)' : 'translateY(' + (up ? -16 : 16) + 'px)';
    }
    function show() {
      if (shown) return;
      shown = true;
      el.style.display = '';
      moveTo(false, false);
      void el.offsetHeight;
      moveTo(true, true);
      el.setAttribute('data-living-on', 'true');
      if (words) announce(doc, words);
      countDown();
    }
    function hide(byVisitor) {
      if (!shown) return;
      shown = false;
      window.clearTimeout(stayTimer);
      // the focus was in it: it goes to the page, not nowhere
      if (el.contains(doc.activeElement) && doc.activeElement.blur) doc.activeElement.blur();
      el.setAttribute('data-living-on', 'false');
      moveTo(false, true);
      timers.push(window.setTimeout(function () { if (!shown) el.style.display = 'none'; }, reduced() ? 0 : 460));
      if (byVisitor && remember) {
        try { window.localStorage.setItem(memory, '1'); } catch (e) { /* storage refused: it shows again next time */ }
      }
    }
    // stays its time, held while the pointer or the focus is on it (WCAG 2.2.1)
    function countDown() {
      window.clearTimeout(stayTimer);
      if (!(s.stay > 0) || held || !shown) return;
      stayTimer = window.setTimeout(function () { hide(false); }, left || s.stay * 1000);
      left = 0;
    }
    if (s.stay > 0) {
      var hold = function () { held = true; window.clearTimeout(stayTimer); };
      var free = function (e) {
        if (e.type === 'focusout' && el.contains(e.relatedTarget)) return;
        held = false;
        countDown();
      };
      el.addEventListener('pointerenter', hold);
      el.addEventListener('pointerleave', free);
      el.addEventListener('focusin', hold);
      el.addEventListener('focusout', free);
      offs.push(function () {
        el.removeEventListener('pointerenter', hold);
        el.removeEventListener('pointerleave', free);
        el.removeEventListener('focusin', hold);
        el.removeEventListener('focusout', free);
      });
    }

    // what dismisses it: a close button, and buttons that also go somewhere (their link is kept)
    closers.forEach(function (c) {
      var native = c.tagName === 'BUTTON' || c.tagName === 'A';
      if (!native) {
        c.setAttribute('role', 'button');
        if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '0');
      }
      // a close drawn as a sign (×) says what it does
      if (!c.hasAttribute('aria-label') && !/[a-z0-9]/i.test(c.textContent || '')) c.setAttribute('aria-label', 'Close');
      var click = function () { hide(true); };
      var press = function (e) {
        if (native || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        hide(true);
      };
      c.addEventListener('click', click);
      c.addEventListener('keydown', press);
      offs.push(function () {
        c.removeEventListener('click', click);
        c.removeEventListener('keydown', press);
      });
    });
    // Escape, unless something else took it first (a dialog closing)
    var escape = function (e) {
      if (e.key !== 'Escape' || !shown || e.defaultPrevented) return;
      hide(true);
    };
    doc.addEventListener('keydown', escape);
    offs.push(function () { doc.removeEventListener('keydown', escape); });

    if (!seen) timers.push(window.setTimeout(show, Math.max(0, s.delay || 0) * 1000));

    return function () {
      timers.forEach(function (t) { window.clearTimeout(t); });
      window.clearTimeout(stayTimer);
      offs.forEach(function (f) { f(); });
      ['display', 'opacity', 'transform', 'transition', 'maxWidth'].forEach(function (k) { el.style[k] = ''; });
      el.removeAttribute('data-living-on');
    };
  }

  var KINDS = { carousel: carousel, accordion: accordion, notice: notice };

  // the few rules the behaviour needs, whatever page it is on: a dot not showing
  // its slide and an arrow at the end of a row that does not loop are dimmed
  var CSS =
    '[data-living-part="dots"] > * { transition: opacity 0.3s ' + EASE + '; cursor: pointer; }' +
    '[data-living-part="dots"] > [data-living-on="false"] { opacity: 0.35; }' +
    '[data-living-off="true"] { opacity: 0.35; cursor: default; }' +
    '[data-living-part="track"] { will-change: transform; }' +
    '.living-announcer { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }' +
    '@media (prefers-reduced-motion: reduce) { [data-living-part="dots"] > * { transition: none; } }';
  function addStyle(doc) {
    if (doc.getElementById('livingblocks-style')) return;
    var st = doc.createElement('style');
    st.id = 'livingblocks-style';
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  /**
   * options.remember: false keeps a notice from being remembered once
   * dismissed (a design tool's preview, where it should show every time).
   */
  function start(root, options) {
    options = options || {};
    addStyle(root.ownerDocument || document);
    // each Block running, with the settings it started with: new settings restart it
    var running = new Map();
    function start(el) {
      var raw = keyOf(el);
      var was = running.get(el);
      if (was && was.raw === raw) return;
      if (was) was.stop();
      running.delete(el);
      var spec = specOf(el);
      var run = spec && KINDS[spec.kind];
      if (!run) return;
      running.set(el, { raw: raw, stop: run(el, spec, options) || function () {} });
    }
    function scan() {
      // gone from the page: stopped
      running.forEach(function (r, el) {
        if (!el.isConnected) {
          r.stop();
          running.delete(el);
        }
      });
      if (root.matches && root.matches('[data-living]')) start(root);
      var all = root.querySelectorAll('[data-living]');
      for (var i = 0; i < all.length; i++) start(all[i]);
    }
    var queued = false;
    var watch = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      // after the frame's changes have all landed (Preview draws a new copy in one go)
      window.requestAnimationFrame(function () {
        queued = false;
        scan();
      });
    });
    scan();
    watch.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-living', 'data-living-at'] });
    // a width that crosses a breakpoint: the Blocks whose settings change there start again with them
    var widthFrame = 0;
    var onResize = function () {
      window.cancelAnimationFrame(widthFrame);
      widthFrame = window.requestAnimationFrame(scan);
    };
    window.addEventListener('resize', onResize);
    return function () {
      window.removeEventListener('resize', onResize);
      watch.disconnect();
      running.forEach(function (r) { r.stop(); });
      running.clear();
    };
  }

  window.LivingBlocks = { start: start, version: '__LIVINGBLOCKS_VERSION__' };
})();
