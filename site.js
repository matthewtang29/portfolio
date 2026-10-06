/* ==========================================================
   RESUME LINK
   When your resume is ready, drop the PDF into this folder
   (e.g. "resume.pdf") and put its name between the quotes below.
   The Resume button on every page turns on automatically.
   ========================================================== */
const RESUME_FILE = "resume.pdf";


/* ---------- Resume button ---------- */
document.querySelectorAll(".link-btn.resume").forEach(function (btn) {
  if (RESUME_FILE) {
    btn.href = RESUME_FILE;
    btn.target = "_blank";
    btn.rel = "noopener";
  } else {
    btn.classList.add("is-disabled");
    btn.setAttribute("aria-disabled", "true");
    btn.querySelector(".tip").textContent = "Resume (coming soon)";
    btn.addEventListener("click", function (e) { e.preventDefault(); });
  }
});


/* ---------- Email button: copy address to clipboard ---------- */
document.querySelectorAll(".link-btn.email").forEach(function (btn) {
  const tip = btn.querySelector(".tip");
  const email = btn.dataset.email;
  let timer = null;

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }

  function show(text) {
    tip.textContent = text;
    btn.classList.add("copied");
    clearTimeout(timer);
    timer = setTimeout(function () {
      btn.classList.remove("copied");
      tip.textContent = email;
    }, 1800);
  }

  btn.addEventListener("click", function () {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(email)
        .then(function () { show("Copied to clipboard!"); })
        .catch(function () { show(fallbackCopy(email) ? "Copied to clipboard!" : email); });
    } else {
      show(fallbackCopy(email) ? "Copied to clipboard!" : email);
    }
  });
});


/* ---------- Hobby photos ----------
   Each sticker starts as a drawing. If a real photo with the same
   name exists in images/hobbies/ (.png, .jpg, .jpeg or .webp),
   it's swapped in automatically. e.g. images/hobbies/climbing.png */
document.querySelectorAll(".hobby img[data-photo]").forEach(function (img) {
  const base = img.dataset.photo;
  const exts = ["png", "jpg", "jpeg", "webp"];
  (function tryNext(i) {
    if (i >= exts.length) return;
    const probe = new Image();
    probe.onload = function () {
      document.querySelectorAll('.hobby img[data-photo="' + base + '"]').forEach(function (el) {
        el.src = probe.src;
        el.classList.add("is-photo");
      });
    };
    probe.onerror = function () { tryNext(i + 1); };
    probe.src = base + "." + exts[i];
  })(0);
});


/* ---------- Hobby slider ("drag me") ----------
   Slides on its own, stops while you hover a sticker,
   and can be dragged left/right with mouse or finger. */
(function () {
  const viewport = document.querySelector(".hobbies");
  if (!viewport) return;
  const track = viewport.querySelector(".hobby-track");

  // duplicate the stickers so the loop is seamless
  const originals = Array.from(track.children);
  originals.forEach(function (item) {
    const copy = item.cloneNode(true);
    copy.setAttribute("aria-hidden", "true");
    copy.removeAttribute("tabindex");
    track.appendChild(copy);
  });

  const SPEED = 40; // pixels per second
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let offset = 0;
  let loopWidth = 0;
  let hovering = false;
  let dragging = false;
  let dragStartX = 0;
  let dragStartOffset = 0;
  let last = performance.now();

  function measure() {
    // distance from first original to first copy = one full loop
    loopWidth = track.children[originals.length].offsetLeft - track.children[0].offsetLeft;
  }

  function wrap() {
    if (!loopWidth) return;
    while (offset <= -loopWidth) offset += loopWidth;
    while (offset > 0) offset -= loopWidth;
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!hovering && !dragging && !reduceMotion) offset -= SPEED * dt;
    wrap();
    track.style.transform = "translateX(" + offset + "px)";
    requestAnimationFrame(frame);
  }

  // pause while hovering (or keyboard-focusing) a sticker
  track.querySelectorAll(".hobby").forEach(function (item) {
    item.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") hovering = true; });
    item.addEventListener("pointerleave", function () { hovering = false; });
    item.addEventListener("focus", function () { hovering = true; });
    item.addEventListener("blur", function () { hovering = false; });
  });

  // dragging
  viewport.addEventListener("pointerdown", function (e) {
    dragging = true;
    dragStartX = e.clientX;
    dragStartOffset = offset;
    viewport.classList.add("dragging");
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    offset = dragStartOffset + (e.clientX - dragStartX);
  });
  function endDrag() {
    dragging = false;
    viewport.classList.remove("dragging");
  }
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);

  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  measure();
  requestAnimationFrame(frame);
})();


/* ---------- Light / dark mode toggle ---------- */
(function () {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function current() {
    return root.dataset.theme || (media.matches ? "dark" : "light");
  }
  function label() {
    document.querySelectorAll(".theme-toggle .tip").forEach(function (tip) {
      tip.textContent = current() === "dark" ? "Light mode" : "Dark mode";
    });
  }
  // make sure the icon matches the device setting on first visit
  root.dataset.theme = current();
  label();

  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const next = current() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
      label();
    });
  });
})();


/* ---------- Page transitions ----------
   Each //0X link in the sidebar plays its own animation:
     //01 Home       chevron shutters sweep across
     //02 Articles   an iris opens out of the link, then the name types itself
     //03 Projects   dots ripple out from the link and grow into tiles
     //04 Minefield  a board of cells drops in, then floods open
   The cover plays on this page; the next page plays the uncover
   (the head script on every page picks it up from sessionStorage). */
(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NAMES = { 1: "Home", 2: "Articles", 3: "Projects", 4: "Minefield" };
  let busy = false;

  function make(tag, cls, parent) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (parent) parent.appendChild(node);
    return node;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function finished(anims) { return Promise.all(anims.map(function (a) { return a.finished; })); }
  function numOf(link) {
    const num = link.querySelector(".num");
    return num ? parseInt(num.textContent.replace(/\D/g, ""), 10) : 0;
  }
  function navLink(id) {
    return Array.from(document.querySelectorAll(".side-nav a")).find(function (a) { return numOf(a) === id; });
  }
  function centerOf(el) {
    if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  // radius that reaches the furthest corner from a point
  function reach(o) {
    return Math.hypot(Math.max(o.x, innerWidth - o.x), Math.max(o.y, innerHeight - o.y)) + 2;
  }
  // lay a grid of squares over the screen; each knows how far it is from the origin
  function grid(o, cls, minSize, across) {
    const W = innerWidth, H = innerHeight;
    const S = Math.max(minSize, Math.ceil(Math.max(W, H) / across));
    const cols = Math.ceil(W / S), rows = Math.ceil(H / S);
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = make("div", cls, o.stage);
        cell.style.left = c * S + "px";
        cell.style.top = r * S + "px";
        cell.style.width = cell.style.height = S + 1 + "px";
        cell.dist = Math.hypot((c + 0.5) * S - o.origin.x, (r + 0.5) * S - o.origin.y) / S;
        cells.push(cell);
      }
    }
    cells.maxDist = Math.max.apply(null, cells.map(function (c) { return c.dist; })) || 1;
    return cells;
  }
  // generic label pop in / fade out
  function labelIn(o, delay) {
    return o.label.animate(
      [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1.06)", offset: .7 }, { opacity: 1, transform: "scale(1)" }],
      { duration: 340, delay: delay, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "both" });
  }
  function labelOut(o) {
    return o.label.animate(
      [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.9)" }],
      { duration: 200, easing: "ease-in", fill: "forwards" });
  }


  const VARIANTS = {

    /* //01 — chevron shutters: the middle row leads, so the bars form an arrow */
    1: {
      build: function (o, covered) {
        const ROWS = 7;
        const edges = ["#F5C842", "#2BB3A6", "#F28C28"];
        o.rows = [];
        for (let i = 0; i < ROWS; i++) {
          const row = make("div", "pt-row", o.stage);
          row.style.top = (i * 100 / ROWS) + "%";
          row.style.height = "calc(" + (100 / ROWS) + "% + 1px)";
          row.style.setProperty("--edge-in", edges[i % 3]);
          row.style.setProperty("--edge-out", edges[(i + 1) % 3]);
          row.style.transform = covered ? "none" : "translateX(" + -(innerWidth + 90) + "px)";
          o.rows.push(row);
        }
        const bot = make("img", "pt-bot", null);
        bot.src = "bots/bolt.svg";
        bot.alt = "";
        o.label.insertBefore(bot, o.label.firstChild);
        o.bot = bot;
        if (!covered) o.label.style.opacity = 0;
      },
      cover: function (o) {
        const mid = (o.rows.length - 1) / 2;
        const anims = o.rows.map(function (row, i) {
          return row.animate(
            [{ transform: "translateX(" + -(innerWidth + 90) + "px)" }, { transform: "translateX(0)" }],
            { duration: 480, delay: Math.abs(i - mid) * 55, easing: "cubic-bezier(.75,0,.25,1)", fill: "forwards" });
        });
        anims.push(labelIn(o, 420));
        anims.push(o.bot.animate(
          [{ transform: "translateY(30px) rotate(-20deg)" }, { transform: "translateY(-10px) rotate(8deg)", offset: .6 }, { transform: "none" }],
          { duration: 460, delay: 420, easing: "ease-out", fill: "both" }));
        return finished(anims);
      },
      reveal: function (o) {
        const mid = (o.rows.length - 1) / 2;
        labelOut(o);
        return finished(o.rows.map(function (row, i) {
          return row.animate(
            [{ transform: "translateX(0)" }, { transform: "translateX(" + (innerWidth + 90) + "px)" }],
            { duration: 500, delay: 120 + Math.abs(i - mid) * 55, easing: "cubic-bezier(.75,0,.25,1)", fill: "forwards" });
        }));
      }
    },

    /* //02 — iris: yellow ring then teal fill open from the link; the name types itself */
    2: {
      build: function (o, covered) {
        const R = covered ? reach(o.origin) : 0;
        o.discs = ["#F5C842", "#2BB3A6"].map(function (color) {
          const disc = make("div", "pt-disc", o.stage);
          disc.style.background = color;
          disc.style.clipPath = "circle(" + R + "px at " + o.origin.x + "px " + o.origin.y + "px)";
          return disc;
        });
        make("span", "pt-cursor", o.name);
        if (!covered) {
          o.label.style.opacity = 0;
          o.chars.forEach(function (ch) { ch.style.opacity = 0; });
        }
      },
      cover: function (o) {
        const at = o.origin.x + "px " + o.origin.y + "px";
        const R = reach(o.origin);
        const anims = o.discs.map(function (disc, i) {
          return disc.animate(
            [{ clipPath: "circle(0px at " + at + ")" }, { clipPath: "circle(" + R + "px at " + at + ")" }],
            { duration: 560, delay: i * 110, easing: "cubic-bezier(.6,0,.2,1)", fill: "forwards" });
        });
        anims.push(o.label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: 480, fill: "both" }));
        o.chars.forEach(function (ch, i) {
          anims.push(ch.animate([{ opacity: 0 }, { opacity: 1 }],
            { duration: 1, delay: 560 + i * 55, fill: "both" }));
        });
        return finished(anims);
      },
      reveal: function (o) {
        const at = o.origin.x + "px " + o.origin.y + "px";
        const R = reach(o.origin);
        const n = o.chars.length;
        // backspace the name, then close the iris back into the link
        o.chars.forEach(function (ch, i) {
          ch.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: (n - 1 - i) * 28, fill: "forwards" });
        });
        const typed = n * 28 + 60;
        o.label.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: typed, fill: "forwards" });
        return finished(o.discs.slice().reverse().map(function (disc, i) {
          return disc.animate(
            [{ clipPath: "circle(" + R + "px at " + at + ")" }, { clipPath: "circle(0px at " + at + ")" }],
            { duration: 520, delay: typed + i * 110, easing: "cubic-bezier(.7,0,.3,1)", fill: "forwards" });
        }));
      }
    },

    /* //03 — dots (like the page background) ripple out and swell into tiles */
    3: {
      DOT:  { transform: "scale(0) rotate(45deg)", borderRadius: "50%", background: "#F5C842" },
      MID:  { transform: "scale(.55) rotate(20deg)", borderRadius: "50%", background: "#F5C842", offset: .45 },
      TILE: { transform: "scale(1) rotate(0deg)", borderRadius: "0%", background: "#F28C28" },
      build: function (o, covered) {
        const v = this;
        o.tiles = grid(o, "pt-tile", 56, 16);
        o.tiles.forEach(function (t) {
          const s = covered ? v.TILE : v.DOT;
          t.style.transform = s.transform;
          t.style.borderRadius = s.borderRadius;
          t.style.background = s.background;
        });
        const gear = make("img", "pt-bot", null);
        gear.src = "bots/gear.svg";
        gear.alt = "";
        o.label.insertBefore(gear, o.label.firstChild);
        o.gear = gear;
        gear.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
          { duration: 1400, iterations: Infinity, easing: "linear" });
        if (!covered) o.label.style.opacity = 0;
      },
      cover: function (o) {
        const v = this;
        const step = 460 / o.tiles.maxDist;
        const anims = o.tiles.map(function (t) {
          return t.animate([v.DOT, v.MID, v.TILE],
            { duration: 380, delay: t.dist * step, easing: "ease-out", fill: "both" });
        });
        anims.push(labelIn(o, 560));
        return finished(anims);
      },
      reveal: function (o) {
        const v = this;
        const step = 460 / o.tiles.maxDist;
        labelOut(o);
        return finished(o.tiles.map(function (t) {
          return t.animate([v.TILE, v.MID, v.DOT],
            { duration: 380, delay: 140 + t.dist * step, easing: "ease-in", fill: "forwards" });
        }));
      }
    },

    /* //04 — minefield: cells drop in at random, then flood open from the link like a zero-cell */
    4: {
      COLORS: { 1: "#2F6FC4", 2: "#2E9E5B", 3: "#E23B3B" },
      build: function (o, covered) {
        o.cells = grid(o, "pt-cell", 46, 20);
        o.cells.forEach(function (c) {
          if (!covered) c.style.opacity = 0;
          c.rand = Math.random();
        });
        const bomb = make("i", "fa-solid fa-bomb", null);
        o.label.insertBefore(bomb, o.label.firstChild);
        o.bomb = bomb;
        if (!covered) o.label.style.opacity = 0;
      },
      cover: function (o) {
        const anims = o.cells.map(function (c) {
          return c.animate(
            [{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "scale(1.1)", offset: .7 }, { opacity: 1, transform: "scale(1)" }],
            { duration: 220, delay: c.rand * 400, easing: "ease-out", fill: "both" });
        });
        anims.push(labelIn(o, 460));
        anims.push(o.bomb.animate(
          [{ transform: "rotate(0)" }, { transform: "rotate(-18deg)" }, { transform: "rotate(14deg)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(0)" }],
          { duration: 500, delay: 560, easing: "ease-in-out" }));
        return finished(anims);
      },
      reveal: function (o) {
        const v = this;
        const step = 520 / o.cells.maxDist;
        labelOut(o);
        return finished(o.cells.map(function (c) {
          // the odd cell shows a number as it opens, like the real game
          const n = c.rand < 0.16 ? 1 : c.rand < 0.24 ? 2 : c.rand < 0.28 ? 3 : 0;
          if (n) c.textContent = n;
          const ink = n ? v.COLORS[n] : "transparent";
          const shut = "inset 3px 3px 0 rgba(255,255,255,.13), inset -3px -3px 0 rgba(0,0,0,.35)";
          const open = "inset 0 0 0 1px #CDD5DE";
          return c.animate([
            { background: "#3A4152", boxShadow: shut, color: "transparent", opacity: 1, transform: "scale(1)" },
            { background: "#E8ECF1", boxShadow: open, color: ink, opacity: 1, transform: "scale(1)", offset: .2 },
            { background: "#E8ECF1", boxShadow: open, color: ink, opacity: 1, transform: "scale(.94)", offset: .65 },
            { background: "#E8ECF1", boxShadow: open, color: ink, opacity: 0, transform: "scale(.7)" }
          ], { duration: 420, delay: 140 + c.dist * step + c.rand * 50, easing: "ease-out", fill: "forwards" });
        }));
      }
    }
  };


  function overlay(id, origin, covered) {
    const o = { id: id, origin: origin };
    o.el = make("div", "pt pt-" + id, document.body);
    o.el.setAttribute("aria-hidden", "true");
    o.stage = make("div", "pt-stage", o.el);
    o.label = make("div", "pt-label", o.el);
    make("span", "pt-num", o.label).textContent = "//0" + id;
    o.name = make("span", "pt-name", o.label);
    o.chars = NAMES[id].toUpperCase().split("").map(function (ch) {
      const span = make("span", "pt-ch", o.name);
      span.textContent = ch;
      return span;
    });
    VARIANTS[id].build(o, covered);
    return o;
  }

  // uncover the page (runs on the page we just arrived at, or after a same-page click)
  function uncover(o) {
    return wait(140)
      .then(function () { return VARIANTS[o.id].reveal(o); })
      .then(function () { o.el.remove(); busy = false; });
  }

  // arriving from another page mid-transition
  const pending = parseInt(root.dataset.pt, 10);
  try { sessionStorage.removeItem("pt"); } catch (e) {}
  if (VARIANTS[pending]) {
    busy = true;
    const o = overlay(pending, centerOf(navLink(pending)), true);
    delete root.dataset.pt;
    uncover(o);
  } else {
    delete root.dataset.pt;
  }

  document.querySelectorAll(".side-nav a").forEach(function (link) {
    link.addEventListener("click", function (e) {
      const id = numOf(link);
      if (!VARIANTS[id] || reduceMotion || busy) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      busy = true;
      const o = overlay(id, centerOf(link), false);
      const samePage = new URL(link.href, location.href).pathname === location.pathname;
      VARIANTS[id].cover(o).then(function () {
        if (samePage) return uncover(o);
        try { sessionStorage.setItem("pt", id); } catch (err) {}
        location.href = link.href;
      });
    });
  });

  // coming back with the browser's back button: drop any leftover cover
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    document.querySelectorAll(".pt").forEach(function (el) { el.remove(); });
    delete root.dataset.pt;
    busy = false;
  });
})();
