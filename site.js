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
   Dragged left/right with mouse or finger. Set AUTO_SCROLL to true
   to have it slide on its own again (it stops while you hover a sticker). */
const AUTO_SCROLL = false;
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

  // keep the loop running no matter how the page was opened
  let running = false;
  function start() {
    measure();
    last = performance.now();
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function wrap() {
    if (!loopWidth) return;
    while (offset <= -loopWidth) offset += loopWidth;
    while (offset > 0) offset -= loopWidth;
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (AUTO_SCROLL && !hovering && !dragging && !reduceMotion) offset -= SPEED * dt;
    wrap();
    track.style.transform = "translateX(" + offset + "px)";
    requestAnimationFrame(frame);
  }

  // pause while hovering (or keyboard-focusing) a sticker
  // only counts once the visitor has actually moved their mouse, so a
  // sticker sliding under a resting cursor on page load can't freeze it
  let mouseMoved = false;
  window.addEventListener("mousemove", function () { mouseMoved = true; }, { once: true });
  track.querySelectorAll(".hobby").forEach(function (item) {
    item.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse" && mouseMoved) hovering = true; });
    item.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") hovering = true; });
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
  window.addEventListener("load", start);
  // back/forward navigation restoring the page from memory
  window.addEventListener("pageshow", start);
  // tab coming back into view
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) start();
  });
  // re-measure whenever the stickers change size (e.g. photos finish loading)
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(track);
  track.querySelectorAll("img").forEach(function (img) { img.addEventListener("load", measure); });

  // Chrome can pre-load the page while you're still typing the address;
  // in that case wait until the page is actually shown before starting
  if (document.prerendering) {
    document.addEventListener("prerenderingchange", start, { once: true });
  } else {
    start();
  }
})();


/* ---------- Light / dark mode toggle ----------
   Until the visitor clicks it, the site follows the device setting
   (pure CSS, so it also updates live). A click saves their choice;
   the small script in each page's <head> re-applies it before paint. */
(function () {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function current() {
    return root.dataset.theme || (media.matches ? "dark" : "light");
  }
  function label() {
    const next = current() === "dark" ? "light" : "dark";
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.setAttribute("aria-label", "Switch to " + next + " mode");
      const tip = btn.querySelector(".tip");
      if (tip) tip.textContent = next === "light" ? "Light mode" : "Dark mode";
    });
  }
  label();
  if (media.addEventListener) media.addEventListener("change", label);

  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const next = current() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) {}
      label();
    });
  });
})();
