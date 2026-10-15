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
  // what a drag turns or swipes: the browser's own dragging of a picture in it does not start (a ghost of the picture)
  function noNativeDrag(el, offs) {
    var stop = function (e) { e.preventDefault(); };
    el.addEventListener('dragstart', stop);
    offs.push(function () { el.removeEventListener('dragstart', stop); });
  }

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
      noNativeDrag(track, offs);
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

  /**
   * A ring: the track's children stand around a circle in depth, after
   * Codrops' On-Scroll 3D Carousel (MIT, docs/THIRD-PARTY.md; rebuilt without
   * GSAP). The page's scroll turns it as it crosses the screen, tilting a
   * little and lighting the cards from bright to their own; the speed of the
   * scroll pushes the cards out and leans them, settling on a spring. It can
   * spin on its own, and be dragged (or turned with the arrow keys, a card at
   * a time). Under reduced motion it stands still, facing the front, and
   * turns only when asked.
   */
  function ring(el, spec) {
    var s = spec.settings || {};
    var track = partOf(el, 'track');
    if (!track) return null;
    var cards = Array.prototype.slice.call(track.children);
    var n = cards.length;
    if (n < 2) return null;
    var num = function (v, d, lo, hi) { v = typeof v === 'number' && isFinite(v) ? v : d; return Math.min(hi, Math.max(lo, v)); };
    var radius = num(s.radius, 500, 100, 1600);
    var depth = num(s.depth, 900, 200, 3000);
    var turn = num(s.turn, 180, 0, 720);
    var tilt = num(s.tilt, 3, 0, 15);
    var light = num(s.light, 0.5, 0, 1);
    var lean = num(s.lean, 0.5, 0, 1) * 2;
    var spinSpeed = num(s.spin, 0, 0, 60);
    var still = reduced();
    var step = 360 / n;
    // what is put back on stop: each element's own inline style
    var own = [el, track].concat(cards).map(function (x) { return [x, x.getAttribute('style')]; });
    var offs = [];

    // the cards' own size, before they are taken out of the row
    var sizes = cards.map(function (c) { return [c.offsetWidth, c.offsetHeight]; });
    var W = Math.max.apply(null, sizes.map(function (z) { return z[0]; })) || 200;
    var H = Math.max.apply(null, sizes.map(function (z) { return z[1]; })) || 260;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.perspective = depth + 'px';
    el.style.overflow = 'clip';
    el.style.touchAction = s.drag === false ? '' : 'pan-y';
    if (s.drag !== false) el.style.cursor = 'grab';
    track.style.position = 'absolute';
    track.style.left = '50%';
    track.style.top = '50%';
    track.style.width = W + 'px';
    track.style.height = H + 'px';
    track.style.margin = -H / 2 + 'px 0 0 ' + -W / 2 + 'px';
    track.style.transformStyle = 'preserve-3d';
    track.style.display = 'block';
    cards.forEach(function (c, i) {
      c.style.position = 'absolute';
      c.style.left = (W - sizes[i][0]) / 2 + 'px';
      c.style.top = (H - sizes[i][1]) / 2 + 'px';
      c.style.margin = '0';
      c.style.transformStyle = 'preserve-3d';
      c.setAttribute('role', 'group');
      c.setAttribute('aria-roledescription', 'slide');
      c.setAttribute('aria-label', i + 1 + ' of ' + n);
    });
    var tabbed = !el.hasAttribute('tabindex');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-roledescription', 'carousel');
    if (tabbed) el.setAttribute('tabindex', '0');

    // the box that scrolls it: the nearest one that scrolls, else the window
    var box = el.parentElement;
    while (box && box !== document.body) {
      var oy = getComputedStyle(box).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight) break;
      box = box.parentElement;
    }
    if (box === document.body) box = null;
    var view = function () {
      if (!box) return { top: 0, h: window.innerHeight };
      var r = box.getBoundingClientRect();
      return { top: r.top, h: box.clientHeight };
    };

    var spin = 0; // degrees turned by the drag, the keys and its own spin
    var spinTo = 0;
    var spread = { v: 0, vel: 0 };
    var tip = { v: 0, vel: 0 };
    var lastTop = null;
    var lastT = 0;
    var frame = 0;
    var seen = true;

    var paint = function (p) {
      var k = 1 - 2 * p;
      var rot = still ? 0 : -turn * p;
      track.style.transform = 'translateZ(' + -radius + 'px) rotateX(' + (still ? 0 : tilt * k) + 'deg) rotateY(' + (rot + spin) + 'deg) rotateZ(' + (still ? 0 : tilt * k) + 'deg)';
      // from bright to its own (and a shade under) on an ease out, as it crosses
      var e = 1 - Math.pow(1 - p, 3);
      var b = still || !light ? 1 : 1 + 1.5 * light + (-1.7 * light) * e;
      var z = still ? 0 : tilt * 3.3 * k;
      cards.forEach(function (c, i) {
        c.style.transform = 'rotateY(' + i * step + 'deg) translateZ(' + (radius + spread.v) + 'px) rotateY(' + tip.v + 'deg) rotateZ(' + z + 'deg)';
        c.style.filter = b === 1 ? '' : 'brightness(' + Math.round(b * 100) + '%)';
      });
    };
    var progress = function (r) {
      var v = view();
      return Math.min(1, Math.max(0, (v.top + v.h - r.top) / (v.h + r.height)));
    };
    // a spring towards `to`; true while it moves
    var spring = function (sp, to, dt) {
      sp.vel += (120 * (to - sp.v) - 14 * sp.vel) * dt;
      sp.v += sp.vel * dt;
      if (Math.abs(to - sp.v) < 0.01 && Math.abs(sp.vel) < 0.01) {
        sp.v = to;
        sp.vel = 0;
        return false;
      }
      return true;
    };
    var tick = function (now) {
      frame = 0;
      var dt = lastT ? Math.min(1 / 30, (now - lastT) / 1000) : 1 / 60;
      lastT = now;
      var r = el.getBoundingClientRect();
      // the speed it moves on screen, px a second (whatever scrolls it)
      var speed = lastTop === null ? 0 : (lastTop - r.top) / dt;
      lastTop = r.top;
      var busy = false;
      if (!still) {
        if (spinSpeed && seen && !dragging) spinTo -= spinSpeed * dt;
        busy = spring(spread, Math.min(Math.abs(speed) * 0.05 * lean, 180 * lean), dt) || busy;
        busy = spring(tip, Math.max(-20 * lean, Math.min(20 * lean, -speed * 0.006 * lean)), dt) || busy;
        var gap = spinTo - spin;
        spin += Math.abs(gap) < 0.01 ? gap : gap * (1 - Math.exp(-dt / 0.12));
        busy = busy || Math.abs(gap) > 0.01 || (spinSpeed > 0 && seen) || dragging;
      } else spin = spinTo;
      paint(progress(r));
      if (busy) frame = window.requestAnimationFrame(tick);
      else lastT = 0;
    };
    var wake = function () {
      if (!frame) frame = window.requestAnimationFrame(tick);
    };
    var onScroll = function () { wake(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    offs.push(function () {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    });
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (es) {
        seen = es[es.length - 1].isIntersecting;
        if (seen) wake();
      });
      io.observe(el);
      offs.push(function () { io.disconnect(); });
    }

    // dragged sideways it turns: the front card follows the pointer
    var dragging = false;
    var degPerPx = 180 / (Math.PI * radius);
    if (s.drag !== false) {
      var x0 = 0, y0 = 0, from = 0, id = -1, moved = false, trail = [];
      var down = function (e) {
        if (e.button !== 0 || id !== -1) return;
        id = e.pointerId;
        x0 = e.clientX;
        y0 = e.clientY;
        from = spinTo;
        moved = false;
        trail = [[e.timeStamp, e.clientX]];
      };
      var move = function (e) {
        if (e.pointerId !== id) return;
        var dx = e.clientX - x0;
        if (!moved) {
          if (Math.abs(e.clientY - y0) > Math.abs(dx) && Math.abs(e.clientY - y0) > 6) { id = -1; return; }
          if (Math.abs(dx) < 6) return;
          moved = true;
          dragging = true;
          el.style.cursor = 'grabbing';
          if (el.setPointerCapture) el.setPointerCapture(id);
        }
        spinTo = from + dx * degPerPx;
        trail.push([e.timeStamp, e.clientX]);
        while (trail.length > 2 && e.timeStamp - trail[0][0] > 100) trail.shift();
        wake();
      };
      var up = function (e) {
        if (e.pointerId !== id) return;
        id = -1;
        if (!moved) return;
        dragging = false;
        el.style.cursor = 'grab';
        // it keeps turning a little after it is let go
        var t = trail[0];
        var last = trail[trail.length - 1];
        // its speed over at least a frame and at most 3 px a millisecond, coasting half a turn at most: a drag
        // the browser delivers in two events a millisecond apart would otherwise fling it round many times
        if (!still && e.timeStamp - last[0] < 80) {
          var v = Math.max(-3, Math.min(3, (last[1] - t[1]) / Math.max(16, last[0] - t[0])));
          spinTo += Math.max(-180, Math.min(180, v * 350 * degPerPx));
        }
        wake();
        // the click a drag ends with is not one
        var swallow = function (c) { c.preventDefault(); c.stopPropagation(); };
        el.addEventListener('click', swallow, { capture: true, once: true });
        window.setTimeout(function () { el.removeEventListener('click', swallow, true); }, 0);
      };
      noNativeDrag(el, offs);
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      offs.push(function () {
        el.removeEventListener('pointerdown', down);
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      });
    }
    // the arrow keys turn it a card at a time
    var key = function (e) {
      if (e.target !== el) return;
      var d = e.key === 'ArrowRight' ? -1 : e.key === 'ArrowLeft' ? 1 : 0;
      if (!d) return;
      e.preventDefault();
      spinTo = Math.round(spinTo / step) * step + d * step;
      wake();
    };
    el.addEventListener('keydown', key);
    offs.push(function () { el.removeEventListener('keydown', key); });

    paint(progress(el.getBoundingClientRect()));
    wake();
    return function () {
      window.cancelAnimationFrame(frame);
      offs.forEach(function (f) { f(); });
      own.forEach(function (o) {
        if (o[1] === null) o[0].removeAttribute('style');
        else o[0].setAttribute('style', o[1]);
      });
      cards.forEach(function (c) { c.removeAttribute('role'); c.removeAttribute('aria-roledescription'); c.removeAttribute('aria-label'); });
      el.removeAttribute('role');
      el.removeAttribute('aria-roledescription');
      if (tabbed) el.removeAttribute('tabindex');
    };
  }

  /** put an element's inline style back as it was (null: none) */
  function keepStyles(list) {
    var own = list.map(function (x) { return [x, x.getAttribute('style')]; });
    return function () {
      own.forEach(function (o) {
        if (o[1] === null) o[0].removeAttribute('style');
        else o[0].setAttribute('style', o[1]);
      });
    };
  }
  /** the videos inside an element, set to play silently inline */
  function videosIn(el) {
    return Array.prototype.slice.call(el.querySelectorAll('video')).map(function (v) {
      v.muted = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      return v;
    });
  }
  function play(v, on) {
    if (on) {
      var p = v.play && v.play();
      if (p && p.catch) p.catch(function () {});
    } else if (v.pause) v.pause();
  }

  /**
   * Split an element's words into lines, each line a mask the words can move
   * through (a line reveal). Returns the lines' words, line by line, and a
   * function that gives the element its own words back.
   */
  function linesOf(el) {
    var doc = el.ownerDocument;
    var html = el.innerHTML;
    var words = [];
    var walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(function (t) {
      var frag = doc.createDocumentFragment();
      (t.textContent || '').split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) return frag.appendChild(doc.createTextNode(part));
        var w = doc.createElement('span');
        w.className = 'living-word';
        w.style.display = 'inline-block';
        w.textContent = part;
        frag.appendChild(w);
        words.push(w);
      });
      t.parentNode.replaceChild(frag, t);
    });
    // words on the same line share a mask
    var lines = [];
    var top = null;
    words.forEach(function (w) {
      var y = w.offsetTop;
      if (top === null || Math.abs(y - top) > 2) {
        lines.push([]);
        top = y;
      }
      lines[lines.length - 1].push(w);
    });
    lines.forEach(function (line) {
      var mask = doc.createElement('span');
      mask.className = 'living-line';
      mask.style.cssText = 'display:block;overflow:hidden;overflow:clip;padding-bottom:0.1em;margin-bottom:-0.1em';
      line[0].parentNode.insertBefore(mask, line[0]);
      line.forEach(function (w, i) {
        var next = w.nextSibling;
        mask.appendChild(w);
        if (i < line.length - 1 && next && next.nodeType === 3) mask.appendChild(next);
      });
    });
    return { lines: lines, restore: function () { el.innerHTML = html; } };
  }

  // ── Showcase ──────────────────────────────────────────────────────────────
  // A hero of stacked slides (the track's children), one shown at a time: a
  // full-bleed picture or video behind (the slide's `picture`, blurred if
  // asked), its own words revealed line by line, the change from one to the
  // next a fade, a zoom, a blur or a wipe (after giordanobetti.com's reel,
  // observed 2026-10-15). Previous and Next, a counter, a progress line, the
  // arrow keys, a swipe, playing on its own, and the wheel if asked. Videos
  // play while their slide shows. Under reduced motion it changes at once,
  // never plays on its own, and its videos wait.
  function showcase(el, spec) {
    var s = spec.settings || {};
    var track = partOf(el, 'track');
    if (!track) return null;
    var slides = Array.prototype.slice.call(track.children);
    var n = slides.length;
    if (!n) return null;
    var still = reduced();
    var speed = Math.max(0.2, Math.min(3, s.speed || 1.2)) * 1000;
    var loop = s.loop !== false;
    var at = Math.max(0, Math.min(n - 1, s.start || 0));
    var offs = [];
    var anims = [];
    var prev = partOf(el, 'prev');
    var next = partOf(el, 'next');
    var counter = partOf(el, 'counter');
    var bar = partOf(el, 'progress');
    var pauseBtn = partOf(el, 'pause');
    var restore = keepStyles([el, track, bar].concat(slides).filter(Boolean));
    var counterText = counter ? counter.textContent : '';

    el.setAttribute('role', 'region');
    el.setAttribute('aria-roledescription', 'carousel');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    // the slides on top of one another, the track as tall as the first
    track.style.display = 'grid';
    // one column as wide as the hero and one row: an auto column would shrink the slides to their words
    track.style.gridTemplateColumns = 'minmax(0, 1fr)';
    track.style.gridTemplateRows = 'minmax(0, 1fr)';
    track.style.width = '100%';
    track.style.flex = '1 1 auto';
    track.style.minWidth = '0';
    track.style.position = 'relative';
    var pics = [];
    var texts = [];
    slides.forEach(function (sl, i) {
      sl.style.gridArea = '1 / 1';
      sl.style.width = '100%';
      sl.style.minWidth = '0';
      sl.setAttribute('role', 'group');
      sl.setAttribute('aria-roledescription', 'slide');
      sl.setAttribute('aria-label', i + 1 + ' of ' + n);
      var pic = sl.querySelector('[data-living-part="picture"]');
      if (pic && s.blur) {
        pics.push([pic, pic.getAttribute('style')]);
        pic.style.filter = 'blur(' + Math.min(60, s.blur) + 'px)';
        pic.style.transform = 'scale(1.08)';
      }
    });
    // each slide's words, line by line, once they are laid out
    if (s.lines !== false && !still) {
      slides.forEach(function (sl) {
        var list = [];
        Array.prototype.slice.call(sl.querySelectorAll('*')).forEach(function (t) {
          if (t.children.length || !/\S/.test(t.textContent || '') || t.closest('[data-living-part="picture"], video, button, a')) return;
          list.push(linesOf(t));
        });
        texts.push(list);
      });
    }
    var vids = slides.map(videosIn);
    var words = function (i) {
      return (texts[i] || []).reduce(function (all, t) { return all.concat(t.lines); }, []);
    };
    var reveal = function (i, dir) {
      // in: up through each line's mask, one word after another; out: on up and away
      words(i).forEach(function (line, li) {
        line.forEach(function (w, wi) {
          var d = (li * 0.08 + wi * 0.03) * 1000;
          anims.push(w.animate(dir > 0 ? [{ transform: 'translateY(110%)' }, { transform: 'none' }] : [{ transform: 'none' }, { transform: 'translateY(-110%)' }], { duration: speed * 0.6, delay: dir > 0 ? speed * 0.35 + d : d * 0.5, easing: EASE, fill: 'both' }));
        });
      });
    };
    var KEY = {
      fade: [[{ opacity: 0 }, { opacity: 1 }], [{ opacity: 1 }, { opacity: 1 }]],
      zoom: [[{ opacity: 0, transform: 'scale(1.15)' }, { opacity: 1, transform: 'none' }], [{ transform: 'none' }, { transform: 'scale(0.95)' }]],
      blur: [[{ opacity: 0, filter: 'blur(24px)', transform: 'scale(1.08)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], [{ filter: 'blur(0)' }, { filter: 'blur(12px)' }]],
      wipe: [[{ clipPath: 'inset(0 0 0 100%)' }, { clipPath: 'inset(0 0 0 0)' }], [{ opacity: 1 }, { opacity: 1 }]],
    };
    var kind = KEY[s.transition] ? s.transition : 'blur';
    var paint = function (from, to, dir) {
      slides.forEach(function (sl, i) {
        var on = i === to;
        sl.style.zIndex = on ? '2' : i === from ? '1' : '0';
        sl.style.visibility = on || i === from ? '' : 'hidden';
        sl.setAttribute('aria-hidden', on ? 'false' : 'true');
        if (on) sl.removeAttribute('inert');
        else sl.setAttribute('inert', '');
        vids[i].forEach(function (v) { play(v, on && !still); });
      });
      if (counter) counter.textContent = String(to + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
      if (prev) prev.setAttribute('data-living-off', !loop && to === 0 ? 'true' : 'false');
      if (next) next.setAttribute('data-living-off', !loop && to === n - 1 ? 'true' : 'false');
      if (from === null || from === to || still) {
        if (from !== null && from !== to) slides[from].style.visibility = 'hidden';
        return;
      }
      var k = KEY[kind];
      var wipe = kind === 'wipe' && dir < 0 ? [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }] : k[0];
      anims.push(slides[to].animate(wipe, { duration: speed, easing: EASE }));
      var out = slides[from].animate(k[1], { duration: speed, easing: EASE });
      anims.push(out);
      out.onfinish = function () {
        if (at !== from) slides[from].style.visibility = 'hidden';
      };
      reveal(from, -1);
      reveal(to, 1);
    };
    var busy = 0;
    var go = function (to, dir) {
      if (to < 0 || to >= n) {
        if (!loop) return false;
        to = (to + n) % n;
      }
      if (to === at) return false;
      var from = at;
      at = to;
      busy = Date.now();
      paint(from, to, dir);
      restartTimer();
      return true;
    };
    var step = function (d) { return go(at + d, d); };

    // playing on its own, with a progress line that fills over each slide's time
    var playing = !!s.autoplay && !still;
    var held = false;
    var timer = 0;
    var interval = Math.max(2, Math.min(30, s.interval || 6)) * 1000;
    var fill = null;
    var restartTimer = function () {
      window.clearTimeout(timer);
      if (fill) fill.cancel();
      if (bar) {
        bar.style.transformOrigin = '0 50%';
        fill = playing && !held ? bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: interval, easing: 'linear', fill: 'both' }) : null;
        if (!fill) bar.style.transform = 'scaleX(' + (n > 1 ? at / (n - 1) : 1) + ')';
      }
      if (playing && !held) timer = window.setTimeout(function () { step(1); }, interval);
    };
    var hold = function (v) {
      held = v;
      restartTimer();
    };
    if (pauseBtn) {
      pauseBtn.style.display = s.autoplay ? '' : 'none';
      offs.push(asButton(pauseBtn, 'Pause', function () {
        playing = !playing;
        pauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        pauseBtn.setAttribute('data-living-on', playing ? 'false' : 'true');
        restartTimer();
      }));
    }
    ['pointerenter', 'focusin'].forEach(function (t) {
      var f = function () { hold(true); };
      el.addEventListener(t, f);
      offs.push(function () { el.removeEventListener(t, f); });
    });
    ['pointerleave', 'focusout'].forEach(function (t) {
      var f = function (e) {
        if (t === 'focusout' && el.contains(e.relatedTarget)) return;
        hold(false);
      };
      el.addEventListener(t, f);
      offs.push(function () { el.removeEventListener(t, f); });
    });
    if (prev) offs.push(asButton(prev, 'Previous slide', function () { step(-1); }));
    if (next) offs.push(asButton(next, 'Next slide', function () { step(1); }));
    var key = function (e) {
      if (e.target !== el) return;
      var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (d && step(d)) e.preventDefault();
    };
    el.addEventListener('keydown', key);
    offs.push(function () { el.removeEventListener('keydown', key); });
    // a swipe sideways
    var x0 = null;
    var down = function (e) { x0 = e.pointerType === 'mouse' && e.button !== 0 ? null : [e.clientX, e.clientY]; };
    var up = function (e) {
      if (!x0) return;
      var dx = e.clientX - x0[0];
      var dy = e.clientY - x0[1];
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    };
    noNativeDrag(el, offs);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.style.touchAction = 'pan-y';
    offs.push(function () {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerup', up);
    });
    // the wheel, if asked: a slide a turn, never past the ends (the page scrolls on there)
    if (s.wheel) {
      var acc = 0;
      var wheel = function (e) {
        if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
        if (Date.now() - busy < speed) {
          if ((e.deltaY > 0 && (loop || at < n - 1)) || (e.deltaY < 0 && (loop || at > 0))) e.preventDefault();
          return;
        }
        acc += e.deltaY;
        if (Math.abs(acc) < 40) return;
        var d = acc > 0 ? 1 : -1;
        acc = 0;
        if (step(d)) e.preventDefault();
      };
      el.addEventListener('wheel', wheel, { passive: false });
      offs.push(function () { el.removeEventListener('wheel', wheel); });
    }

    paint(null, at, 1);
    if (!still) reveal(at, 1);
    restartTimer();
    return function () {
      window.clearTimeout(timer);
      if (fill) fill.cancel();
      anims.forEach(function (a) { a.cancel(); });
      offs.forEach(function (f) { f(); });
      vids.forEach(function (l) { l.forEach(function (v) { play(v, false); }); });
      texts.forEach(function (l) { l.forEach(function (t) { t.restore(); }); });
      pics.forEach(function (p) {
        if (p[1] === null) p[0].removeAttribute('style');
        else p[0].setAttribute('style', p[1]);
      });
      slides.forEach(function (sl) {
        ['role', 'aria-roledescription', 'aria-label', 'aria-hidden', 'inert'].forEach(function (a) { sl.removeAttribute(a); });
      });
      if (counter) counter.textContent = counterText;
      restore();
    };
  }

  // ── Mosaic ────────────────────────────────────────────────────────────────
  // A dense grid of pictures and videos (the `tile` parts, or the track's
  // children), after au-rel.io's (observed 2026-10-15): each tile spans as
  // many columns, and half-rows of a square, as its size in the design;
  // `columns` across (fewer on a breakpoint), `gap` between; the grid packs
  // tiles into the holes. Videos play while on screen (or on hover, or all
  // the time); tiles can rise in as they arrive. Under reduced motion the
  // tiles are simply there and the videos wait.
  function mosaic(el, spec) {
    var s = spec.settings || {};
    var track = partOf(el, 'track') || el;
    var tiles = Array.prototype.slice.call(track.querySelectorAll('[data-living-part="tile"]')).filter(function (t) { return t.closest('[data-living]') === el; });
    if (!tiles.length) tiles = Array.prototype.slice.call(track.children);
    if (!tiles.length) return null;
    var still = reduced();
    var cols = Math.max(1, Math.min(8, Math.round(s.columns || 4)));
    var gap = Math.max(0, Math.min(48, s.gap === undefined ? 4 : s.gap));
    var offs = [];
    var anims = [];
    // what lies between the grid and its tiles (rows, as the canvas lays them out) steps aside
    var between = [];
    tiles.forEach(function (t) {
      for (var p = t.parentElement; p && p !== track; p = p.parentElement) if (between.indexOf(p) < 0) between.push(p);
    });
    var restore = keepStyles([track].concat(between, tiles));
    // each tile's span, from its size in the design: the narrowest tile is one column, half of it one row,
    // so the spans hold whatever width the grid is given (it fills its container)
    var sizes = tiles.map(function (t) { var r = t.getBoundingClientRect(); return [r.width, r.height]; });
    var unit = Math.max(1, Math.min.apply(null, sizes.map(function (z) { return z[0] || Infinity; })));
    if (!isFinite(unit)) unit = 1;
    var W = track.getBoundingClientRect().width || 1;
    var spans = sizes.map(function (z) {
      return [Math.max(1, Math.round((z[0] + gap) / (unit + gap))), Math.max(1, Math.round((z[1] + gap) / (unit / 2 + gap)))];
    });
    between.forEach(function (b) { b.style.display = 'contents'; });
    track.style.display = 'grid';
    track.style.gridAutoFlow = 'row dense';
    track.style.gap = gap + 'px';
    // an inner track fills the Block; the Block as its own track takes the width it is given
    if (track !== el) track.style.width = '100%';
    var layout = function () {
      var w = track.getBoundingClientRect().width || W;
      // a narrow window takes two columns at most, a phone's one or two
      var c = w < 480 ? Math.min(cols, 2) : cols;
      var u = (w - gap * (c - 1)) / c;
      track.style.gridTemplateColumns = 'repeat(' + c + ', minmax(0, 1fr))';
      track.style.gridAutoRows = Math.max(1, u / 2) + 'px';
      tiles.forEach(function (t, i) {
        t.style.gridColumn = 'span ' + Math.min(c, spans[i][0]);
        t.style.gridRow = 'span ' + spans[i][1];
        t.style.width = 'auto';
        t.style.height = 'auto';
        t.style.minWidth = '0';
        t.style.minHeight = '0';
      });
    };
    layout();
    var ro = window.ResizeObserver ? new ResizeObserver(function () { layout(); }) : null;
    if (ro) {
      ro.observe(track);
      offs.push(function () { ro.disconnect(); });
    }
    // the videos: while on screen, on hover, or always
    var mode = s.video === 'hover' || s.video === 'always' ? s.video : 'view';
    var vids = tiles.map(videosIn);
    var seen = [];
    if (!still) {
      if (mode === 'always') vids.forEach(function (l) { l.forEach(function (v) { play(v, true); }); });
      if (mode === 'hover')
        tiles.forEach(function (t, i) {
          var on = function () { vids[i].forEach(function (v) { play(v, true); }); };
          var off = function () { vids[i].forEach(function (v) { play(v, false); }); };
          t.addEventListener('pointerenter', on);
          t.addEventListener('pointerleave', off);
          offs.push(function () {
            t.removeEventListener('pointerenter', on);
            t.removeEventListener('pointerleave', off);
          });
        });
    }
    // tiles rise in as they arrive, a little after one another
    var rise = !!s.reveal && !still;
    if (rise) tiles.forEach(function (t) { t.style.opacity = '0'; });
    if (window.IntersectionObserver && (mode === 'view' || rise)) {
      var queue = 0;
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var i = tiles.indexOf(e.target);
          if (mode === 'view' && !still) vids[i].forEach(function (v) { play(v, e.isIntersecting); });
          if (rise && e.isIntersecting && !seen[i]) {
            seen[i] = true;
            var d = queue++ * 60;
            window.setTimeout(function () { queue = Math.max(0, queue - 1); }, d + 50);
            anims.push(e.target.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: d, easing: EASE, fill: 'forwards' }));
          }
        });
      }, { threshold: 0.2 });
      tiles.forEach(function (t) { io.observe(t); });
      offs.push(function () { io.disconnect(); });
    }
    return function () {
      offs.forEach(function (f) { f(); });
      anims.forEach(function (a) { a.cancel(); });
      vids.forEach(function (l) { l.forEach(function (v) { play(v, false); }); });
      restore();
    };
  }

  var KINDS = { carousel: carousel, accordion: accordion, notice: notice, ring: ring, showcase: showcase, mosaic: mosaic };

  // the few rules the behaviour needs, whatever page it is on: a dot not showing
  // its slide and an arrow at the end of a row that does not loop are dimmed
  var CSS =
    '[data-living-part="dots"] > * { transition: opacity 0.3s ' + EASE + '; cursor: pointer; }' +
    '[data-living-part="dots"] > [data-living-on="false"] { opacity: 0.35; }' +
    '[data-living-off="true"] { opacity: 0.35; cursor: default; }' +
    '[data-living-part="track"] { will-change: transform; }' +
    '[data-living-part="tile"] img, [data-living-part="tile"] video, img[data-living-part="tile"], video[data-living-part="tile"] { width: 100%; height: 100%; object-fit: cover; }' +
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
