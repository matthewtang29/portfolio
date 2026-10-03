/* ==========================================================
   RESUME LINK
   When your resume is ready, drop the PDF into this folder
   (e.g. "resume.pdf") and put its name between the quotes below.
   The Resume button on every page turns on automatically.
   ========================================================== */
const RESUME_FILE = "";


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
