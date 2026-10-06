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
   Going to another page with the sidebar:
     //01 //02 //03  this page fades out; on the next page the title
                     drops in first, then everything else follows it down
     //04 Minefield  a board of cells drops in, then floods open on the game page
   Clicking the page you're already on just loads it normally.
   The head script on every page picks the transition up from sessionStorage. */
(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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


  /* ----- //01 //02 //03: title first, then the rest ----- */
  // lists of cards get split up so each card drops in on its own
  const SPLIT = ".article-list, .article, .featured, .project-grid";

  // the page broken into pieces in reading order, with the title pulled out
  function pieces() {
    const h1 = document.querySelector("main h1");
    const rest = [];
    (function walk(parent) {
      Array.from(parent.children).forEach(function (child) {
        if (child === h1) return;
        if ((h1 && child.contains(h1)) || child.matches(SPLIT)) walk(child);
        else rest.push(child);
      });
    })(document.querySelector("main"));
    const footer = document.querySelector("footer");
    if (footer) rest.push(footer);
    return { title: h1, rest: rest };
  }

  function dropIn() {
    const p = pieces();
    // fill "backwards" only: holds the start pose during the delay,
    // then lets go so hover effects still work afterwards
    if (p.title) {
      p.title.animate(
        [{ opacity: 0, transform: "translateY(-28px)" }, { opacity: 1, transform: "none" }],
        { duration: 560, delay: 120, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
    }
    p.rest.forEach(function (el, i) {
      el.animate(
        [{ opacity: 0, transform: "translateY(-16px)" }, { opacity: 1, transform: "none" }],
        { duration: 520, delay: 480 + Math.min(i, 8) * 80, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" });
    });
  }

  function fadeOut() {
    const els = Array.from(document.querySelectorAll("main, footer"));
    return finished(els.map(function (el) {
      return el.animate(
        [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(8px)" }],
        { duration: 200, easing: "ease-in", fill: "forwards" });
    }));
  }


  /* ----- //04: minefield cover ----- */
  const MINE = {
    COLORS: { 1: "#2F6FC4", 2: "#2E9E5B", 3: "#E23B3B" },
    SHUT: "inset 3px 3px 0 rgba(255,255,255,.13), inset -3px -3px 0 rgba(0,0,0,.35)",
    OPEN: "inset 0 0 0 1px #CDD5DE",

    build: function (origin, covered) {
      const o = { origin: origin };
      o.el = make("div", "pt pt-4", document.body);
      o.el.setAttribute("aria-hidden", "true");
      o.stage = make("div", "pt-stage", o.el);
      o.label = make("div", "pt-label", o.el);
      make("i", "fa-solid fa-bomb", o.label);
      make("span", "pt-num", o.label).textContent = "//04";
      make("span", "pt-name", o.label).textContent = "MINEFIELD";
      if (!covered) o.label.style.opacity = 0;

      // a grid of cells over the screen; each knows how far it is from the link
      const W = innerWidth, H = innerHeight;
      const S = Math.max(46, Math.ceil(Math.max(W, H) / 20));
      o.cells = [];
      for (let r = 0; r < Math.ceil(H / S); r++) {
        for (let c = 0; c < Math.ceil(W / S); c++) {
          const cell = make("div", "pt-cell", o.stage);
          cell.style.left = c * S + "px";
          cell.style.top = r * S + "px";
          cell.style.width = cell.style.height = S + 1 + "px";
          if (!covered) cell.style.opacity = 0;
          cell.dist = Math.hypot((c + 0.5) * S - origin.x, (r + 0.5) * S - origin.y) / S;
          cell.rand = Math.random();
          o.cells.push(cell);
        }
      }
      o.maxDist = Math.max.apply(null, o.cells.map(function (c) { return c.dist; })) || 1;
      return o;
    },

    // cells drop in at random, then the bomb wobbles
    cover: function (o) {
      const anims = o.cells.map(function (c) {
        return c.animate(
          [{ opacity: 0, transform: "scale(.2)" }, { opacity: 1, transform: "scale(1.1)", offset: .7 }, { opacity: 1, transform: "scale(1)" }],
          { duration: 220, delay: c.rand * 400, easing: "ease-out", fill: "both" });
      });
      anims.push(o.label.animate(
        [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1.06)", offset: .7 }, { opacity: 1, transform: "scale(1)" }],
        { duration: 340, delay: 460, easing: "cubic-bezier(.3,1.4,.5,1)", fill: "both" }));
      anims.push(o.label.firstChild.animate(
        [{ transform: "rotate(0)" }, { transform: "rotate(-18deg)" }, { transform: "rotate(14deg)" }, { transform: "rotate(-8deg)" }, { transform: "rotate(0)" }],
        { duration: 500, delay: 560, easing: "ease-in-out" }));
      return finished(anims);
    },

    // flood open from the link like clicking an empty cell; the odd one shows a number
    reveal: function (o) {
      const step = 520 / o.maxDist;
      const v = this;
      o.label.animate([{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(.9)" }],
        { duration: 200, easing: "ease-in", fill: "forwards" });
      return finished(o.cells.map(function (c) {
        const n = c.rand < 0.16 ? 1 : c.rand < 0.24 ? 2 : c.rand < 0.28 ? 3 : 0;
        if (n) c.textContent = n;
        const ink = n ? v.COLORS[n] : "transparent";
        return c.animate([
          { background: "#3A4152", boxShadow: v.SHUT, color: "transparent", opacity: 1, transform: "scale(1)" },
          { background: "#E8ECF1", boxShadow: v.OPEN, color: ink, opacity: 1, transform: "scale(1)", offset: .2 },
          { background: "#E8ECF1", boxShadow: v.OPEN, color: ink, opacity: 1, transform: "scale(.94)", offset: .65 },
          { background: "#E8ECF1", boxShadow: v.OPEN, color: ink, opacity: 0, transform: "scale(.7)" }
        ], { duration: 420, delay: 140 + c.dist * step + c.rand * 50, easing: "ease-out", fill: "forwards" });
      }));
    }
  };


  // arriving from another page
  const pending = parseInt(root.dataset.pt, 10);
  try { sessionStorage.removeItem("pt"); } catch (e) {}
  if (pending === 4) {
    busy = true;
    const o = MINE.build(centerOf(navLink(4)), true);
    delete root.dataset.pt;
    wait(140)
      .then(function () { return MINE.reveal(o); })
      .then(function () { o.el.remove(); busy = false; });
  } else {
    if (pending) dropIn();
    delete root.dataset.pt;
  }

  document.querySelectorAll(".side-nav a").forEach(function (link) {
    link.addEventListener("click", function (e) {
      const id = numOf(link);
      if (!id || reduceMotion || busy) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (new URL(link.href, location.href).pathname === location.pathname) return;
      e.preventDefault();
      busy = true;
      const out = id === 4 ? MINE.cover(MINE.build(centerOf(link), false)) : fadeOut();
      out.then(function () {
        try { sessionStorage.setItem("pt", id); } catch (err) {}
        location.href = link.href;
      });
    });
  });

  // coming back with the browser's back button: undo the exit animation
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    document.querySelectorAll(".pt").forEach(function (el) { el.remove(); });
    document.querySelectorAll("main, footer").forEach(function (el) {
      el.getAnimations().forEach(function (a) { a.cancel(); });
    });
    delete root.dataset.pt;
    busy = false;
  });
})();
