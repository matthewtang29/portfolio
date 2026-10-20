/* ==========================================================
   Minefield
   - classic square grid or hex grid (6 neighbours per cell)
   - optional robot helper: 3 safe-cell hints per game
   ========================================================== */
(function(){
  const DIFFICULTIES = {
    beginner:     { rows: 9,  cols: 9,  mines: 10, cellSize: 38, hexSize: 38 },
    intermediate: { rows: 16, cols: 16, mines: 40, cellSize: 30, hexSize: 32 },
    expert:       { rows: 16, cols: 30, mines: 99, cellSize: 26, hexSize: 27 }
  };
  const HINTS_PER_GAME = 3;

  const gridEl = document.getElementById('grid');
  const boardScroll = document.getElementById('boardScroll');
  const mineCounterEl = document.getElementById('mineCounter');
  const timerEl = document.getElementById('timer');
  const statusLineEl = document.getElementById('statusLine');
  const ledEl = document.getElementById('led');
  const ledTextEl = document.getElementById('ledText');
  const resetBtn = document.getElementById('resetBtn');
  const diffButtons = document.querySelectorAll('.diff-btn');
  const hexToggle = document.getElementById('hexToggle');
  const robotToggle = document.getElementById('robotToggle');
  const helperEl = document.getElementById('helper');
  const helperBot = document.getElementById('helperBot');
  const helperBubble = document.getElementById('helperBubble');
  const hintBtn = document.getElementById('hintBtn');
  const hintCountEl = document.getElementById('hintCount');

  let currentDiff = 'beginner';
  let hexMode = loadOption('minefield-hex');
  let robotOn = loadOption('minefield-robot');
  let rows, cols, mineCount;
  let board = [];
  let firstClickDone = false;
  let gameOver = false;
  let flagsPlaced = 0;
  let revealedCount = 0;
  let timerInterval = null;
  let elapsedSeconds = 0;
  let longPressTimer = null;
  let justLongPressed = false;
  let hintsLeft = HINTS_PER_GAME;
  let hinted = null; // [r, c] of the cell the robot is pointing at

  /* ---------- small helpers ---------- */
  function loadOption(key){
    try { return localStorage.getItem(key) === '1'; } catch(e){ return false; }
  }
  function saveOption(key, on){
    try { localStorage.setItem(key, on ? '1' : '0'); } catch(e){}
  }
  function pad3(n){
    n = Math.max(0, Math.min(999, n));
    return String(n).padStart(3, '0');
  }
  function modeKey(){ return currentDiff + (hexMode ? '-hex' : ''); }
  function bestTimeKey(){ return 'minefield-best-' + modeKey(); }
  function getBestTime(){
    try{
      const v = localStorage.getItem(bestTimeKey());
      return v ? parseInt(v, 10) : null;
    }catch(e){ return null; }
  }
  function maybeSaveBestTime(seconds){
    try{
      const current = getBestTime();
      if(current === null || seconds < current){
        localStorage.setItem(bestTimeKey(), String(seconds));
        return true;
      }
    }catch(e){}
    return false;
  }

  /* ---------- neighbours: square = 8, hex = 6 ----------
     Hex uses "odd rows shifted right" layout. */
  function neighbours(r, c){
    let deltas;
    if(!hexMode){
      deltas = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    } else if(r % 2 === 0){
      deltas = [[-1,-1],[-1,0],[0,-1],[0,1],[1,-1],[1,0]];
    } else {
      deltas = [[-1,0],[-1,1],[0,-1],[0,1],[1,0],[1,1]];
    }
    const out = [];
    for(const [dr, dc] of deltas){
      const rr = r + dr, cc = c + dc;
      if(rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push([rr, cc]);
    }
    return out;
  }

  /* ---------- status ---------- */
  function setLed(state){
    ledEl.classList.remove('won', 'lost');
    if(state === 'won'){ ledEl.classList.add('won'); ledTextEl.textContent = 'Field cleared'; }
    else if(state === 'lost'){ ledEl.classList.add('lost'); ledTextEl.textContent = 'Detonated'; }
    else { ledTextEl.textContent = 'Standby'; }
  }
  function setStatus(text, kind){
    statusLineEl.textContent = text;
    statusLineEl.classList.remove('won', 'lost');
    if(kind) statusLineEl.classList.add(kind);
  }

  /* ---------- robot helper ---------- */
  function say(text, mood){
    helperBubble.textContent = text;
    helperBot.classList.remove('happy', 'zapped', 'think');
    if(mood){
      void helperBot.offsetWidth; // restart the animation
      helperBot.classList.add(mood);
    }
  }
  function updateHelper(){
    helperEl.hidden = !robotOn;
    hintCountEl.textContent = hintsLeft;
    hintBtn.disabled = gameOver || hintsLeft <= 0;
  }

  // Works out cells that are provably safe from the numbers on screen
  // (same reasoning a careful player would use).
  function provablySafeCells(){
    const known = new Map(); // "r,c" -> 'mine' | 'safe'
    const key = (r, c) => r + ',' + c;
    let changed = true;
    let guard = 0;
    while(changed && guard++ < 50){
      changed = false;
      for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
          const cell = board[r][c];
          if(!cell.revealed || cell.mine) continue;
          const unknown = [];
          let mines = 0;
          for(const [rr, cc] of neighbours(r, c)){
            if(board[rr][cc].revealed) continue;
            const k = known.get(key(rr, cc));
            if(k === 'mine') mines++;
            else if(k !== 'safe') unknown.push([rr, cc]);
          }
          if(unknown.length === 0) continue;
          const left = cell.adjacent - mines;
          if(left === 0){
            unknown.forEach(([rr, cc]) => known.set(key(rr, cc), 'safe'));
            changed = true;
          } else if(left === unknown.length){
            unknown.forEach(([rr, cc]) => known.set(key(rr, cc), 'mine'));
            changed = true;
          }
        }
      }
    }
    const safe = [];
    known.forEach((v, k) => {
      if(v === 'safe'){
        const [r, c] = k.split(',').map(Number);
        if(!board[r][c].revealed) safe.push([r, c]);
      }
    });
    return safe;
  }

  function giveHint(){
    if(gameOver || hintsLeft <= 0) return;
    if(!firstClickDone){
      say('Click anywhere to start — your first click is always safe!', 'happy');
      return;
    }
    clearHint();

    let pick = null, logical = false;
    const safe = provablySafeCells().filter(([r, c]) => !board[r][c].flagged);
    if(safe.length){
      pick = safe[Math.floor(Math.random() * safe.length)];
      logical = true;
    } else {
      // nothing provable: robot "scans" for a safe cell next to the cleared area
      const frontier = [], anywhere = [];
      for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
          const cell = board[r][c];
          if(cell.revealed || cell.mine || cell.flagged) continue;
          anywhere.push([r, c]);
          if(neighbours(r, c).some(([rr, cc]) => board[rr][cc].revealed)) frontier.push([r, c]);
        }
      }
      const pool = frontier.length ? frontier : anywhere;
      if(pool.length) pick = pool[Math.floor(Math.random() * pool.length)];
    }
    if(!pick){ say('Nothing left for me to check!'); return; }

    hintsLeft--;
    hinted = pick;
    if(logical){
      say('Logic says this one is safe — can you see why?', 'think');
    } else {
      say("No safe move by logic here, so I scanned it for you. Trust me on this one.", 'happy');
    }
    updateHelper();
    refreshAllCells();
    const btn = cellButton(pick[0], pick[1]);
    if(btn){
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      btn.focus({ preventScroll: true });
    }
  }
  function clearHint(){ hinted = null; }

  /* ---------- game setup ---------- */
  function initGame(diff){
    currentDiff = diff;
    const cfg = DIFFICULTIES[diff];
    rows = cfg.rows; cols = cfg.cols; mineCount = cfg.mines;
    firstClickDone = false;
    gameOver = false;
    flagsPlaced = 0;
    revealedCount = 0;
    hintsLeft = HINTS_PER_GAME;
    hinted = null;
    stopTimer();
    elapsedSeconds = 0;
    timerEl.textContent = pad3(0);
    mineCounterEl.textContent = pad3(mineCount);
    setLed('standby');
    setStatus('Ready. Click any cell to begin.');
    boardScroll.classList.remove('shake');
    say(hexMode
      ? 'Hex mode! Each number counts its 6 neighbours. I have 3 hints for you.'
      : 'Hi! I can point out 3 safe cells each game.');
    updateHelper();

    diffButtons.forEach(btn => {
      btn.setAttribute('aria-pressed', btn.dataset.diff === diff ? 'true' : 'false');
    });

    board = [];
    for(let r = 0; r < rows; r++){
      const row = [];
      for(let c = 0; c < cols; c++){
        row.push({ mine:false, revealed:false, flagged:false, adjacent:0 });
      }
      board.push(row);
    }
    renderBoard();
  }

  function renderBoard(){
    gridEl.innerHTML = '';
    gridEl.classList.toggle('hex', hexMode);
    for(let r = 0; r < rows; r++){
      for(let c = 0; c < cols; c++){
        gridEl.appendChild(makeCell(r, c));
      }
    }
    layoutBoard();
  }

  /* Size cells so the whole board fits the available width (no sideways
     scrolling). Cells never grow past the difficulty's size, and never
     shrink below MIN_CELL — on very narrow phones the board scrolls instead. */
  const MIN_CELL = 16;
  function fitCell(maxSize, gridWidthFor){
    const cs = getComputedStyle(boardScroll);
    const avail = boardScroll.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let size = maxSize;
    while(size > MIN_CELL && gridWidthFor(size) > avail) size--;
    return size;
  }

  function layoutBoard(){
    const cfg = DIFFICULTIES[currentDiff];
    if(hexMode){
      // pointy-top hexagons; odd rows shift half a cell right
      const w = fitCell(cfg.hexSize, s => cols * s + s / 2);
      const h = Math.round(w * 1.1547);       // 2/sqrt(3)
      const rowStep = Math.round(h * 0.75);
      gridEl.style.gridTemplateColumns = '';
      gridEl.style.setProperty('--cell-size', w + 'px');
      gridEl.style.setProperty('--hex-h', h + 'px');
      gridEl.style.width = (cols * w + w / 2) + 'px';
      gridEl.style.height = ((rows - 1) * rowStep + h) + 'px';
      for(const btn of gridEl.children){
        const r = +btn.dataset.r, c = +btn.dataset.c;
        btn.style.left = (c * w + (r % 2 ? w / 2 : 0)) + 'px';
        btn.style.top = (r * rowStep) + 'px';
      }
    } else {
      // cells + 2px gaps + 2px border on each side
      const size = fitCell(cfg.cellSize, s => cols * s + (cols - 1) * 2 + 4);
      gridEl.style.width = '';
      gridEl.style.height = '';
      gridEl.style.setProperty('--cell-size', size + 'px');
      gridEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
      for(const btn of gridEl.children){ btn.style.left = ''; btn.style.top = ''; }
    }
  }
  window.addEventListener('resize', layoutBoard);

  function makeCell(r, c){
    const btn = document.createElement('button');
    btn.className = 'cell';
    btn.type = 'button';
    btn.dataset.r = r;
    btn.dataset.c = c;
    updateCellEl(btn, board[r][c], r, c);
    attachCellHandlers(btn, r, c);
    return btn;
  }

  function cellButton(r, c){
    return gridEl.children[r * cols + c] || null;
  }

  function updateCellEl(btn, cell, r, c){
    btn.dataset.revealed = cell.revealed ? 'true' : 'false';
    btn.dataset.flagged = cell.flagged ? 'true' : 'false';
    btn.disabled = gameOver && !cell.revealed && !(cell.mine && cell.flagged);
    btn.removeAttribute('data-num');
    btn.removeAttribute('data-mine-hit');
    btn.removeAttribute('data-wrong-flag');
    btn.removeAttribute('data-hint');
    btn.textContent = '';

    if(cell.revealed){
      if(cell.mine){
        btn.textContent = '✹';
        btn.setAttribute('aria-label', `Mine, row ${r+1}, column ${c+1}`);
      } else if(cell.adjacent > 0){
        btn.textContent = String(cell.adjacent);
        btn.dataset.num = cell.adjacent;
        btn.setAttribute('aria-label', `${cell.adjacent} adjacent mines, row ${r+1}, column ${c+1}`);
      } else {
        btn.setAttribute('aria-label', `Clear, row ${r+1}, column ${c+1}`);
      }
    } else if(cell.flagged){
      btn.textContent = '⚑';
      btn.setAttribute('aria-label', `Flagged, row ${r+1}, column ${c+1}`);
    } else {
      const isHint = hinted && hinted[0] === r && hinted[1] === c;
      if(isHint) btn.dataset.hint = 'true';
      btn.setAttribute('aria-label', (isHint ? 'Robot hint: safe cell, ' : 'Hidden cell, ') + `row ${r+1}, column ${c+1}`);
    }

    if(gameOver && cell.mine && cell.revealed && cell.causedLoss){
      btn.dataset.mineHit = 'true';
    }
    if(gameOver && cell.flagged && !cell.mine){
      btn.dataset.wrongFlag = 'true';
      btn.textContent = '✕';
    }
  }

  function attachCellHandlers(btn, r, c){
    btn.addEventListener('click', () => {
      if(justLongPressed){ justLongPressed = false; return; }
      handleReveal(r, c);
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      handleFlag(r, c);
    });
    btn.addEventListener('pointerdown', (e) => {
      if(e.pointerType !== 'touch') return;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        justLongPressed = true;
        handleFlag(r, c);
      }, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
      btn.addEventListener(evt, () => clearTimeout(longPressTimer));
    });
  }

  document.addEventListener('keydown', (e) => {
    if(e.key.toLowerCase() !== 'f') return;
    const active = document.activeElement;
    if(active && active.classList.contains('cell')){
      e.preventDefault();
      handleFlag(parseInt(active.dataset.r, 10), parseInt(active.dataset.c, 10));
    }
  });

  /* ---------- mines ---------- */
  function placeMines(excludeR, excludeC){
    const forbidden = new Set([excludeR + ',' + excludeC]);
    neighbours(excludeR, excludeC).forEach(([r, c]) => forbidden.add(r + ',' + c));
    let placed = 0;
    while(placed < mineCount){
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      const key = r + ',' + c;
      if(forbidden.has(key) || board[r][c].mine) continue;
      board[r][c].mine = true;
      placed++;
    }
    for(let r = 0; r < rows; r++){
      for(let c = 0; c < cols; c++){
        if(board[r][c].mine) continue;
        board[r][c].adjacent = neighbours(r, c).filter(([rr, cc]) => board[rr][cc].mine).length;
      }
    }
  }

  /* ---------- moves ---------- */
  function handleReveal(r, c){
    if(gameOver) return;
    const cell = board[r][c];
    if(cell.revealed || cell.flagged) return;

    if(!firstClickDone){
      placeMines(r, c);
      firstClickDone = true;
      startTimer();
      setStatus('Game on. Good luck!');
    }

    if(hinted && hinted[0] === r && hinted[1] === c){
      clearHint();
      if(robotOn) say('Nice, back to you!', 'happy');
    }

    if(cell.mine){
      cell.revealed = true;
      cell.causedLoss = true;
      endGame(false);
      return;
    }

    floodReveal(r, c);
    if(hinted && board[hinted[0]][hinted[1]].revealed) clearHint();
    checkWin();
    refreshAllCells();
  }

  function floodReveal(startR, startC){
    const stack = [[startR, startC]];
    while(stack.length){
      const [r, c] = stack.pop();
      const cell = board[r][c];
      if(cell.revealed || cell.flagged) continue;
      cell.revealed = true;
      revealedCount++;
      if(cell.adjacent === 0){
        neighbours(r, c).forEach(([rr, cc]) => {
          if(!board[rr][cc].revealed) stack.push([rr, cc]);
        });
      }
    }
  }

  function handleFlag(r, c){
    if(gameOver) return;
    const cell = board[r][c];
    if(cell.revealed) return;
    cell.flagged = !cell.flagged;
    flagsPlaced += cell.flagged ? 1 : -1;
    mineCounterEl.textContent = pad3(mineCount - flagsPlaced);
    refreshAllCells();
  }

  function checkWin(){
    if(revealedCount >= rows * cols - mineCount) endGame(true);
  }

  function endGame(won){
    gameOver = true;
    stopTimer();
    clearHint();
    if(won){
      setLed('won');
      const isBest = maybeSaveBestTime(elapsedSeconds);
      const best = getBestTime();
      let msg = `Field cleared in ${elapsedSeconds}s.`;
      if(isBest) msg += ' New best time.';
      else if(best !== null) msg += ` Best: ${best}s.`;
      setStatus(msg, 'won');
      const used = HINTS_PER_GAME - hintsLeft;
      say(used === 0 ? 'Cleared it without my help. Show-off.' : 'We did it! High five! ✋', 'happy');
      for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
          if(board[r][c].mine) board[r][c].flagged = true;
        }
      }
    } else {
      setLed('lost');
      setStatus('Detonated. The board below shows every mine.', 'lost');
      say('Bzzzt! Short circuit. Hit New game to try again.', 'zapped');
      boardScroll.classList.remove('shake');
      void boardScroll.offsetWidth;
      boardScroll.classList.add('shake');
      for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
          if(board[r][c].mine) board[r][c].revealed = true;
        }
      }
    }
    updateHelper();
    refreshAllCells();
  }

  function refreshAllCells(){
    const buttons = gridEl.children;
    for(let i = 0; i < buttons.length; i++){
      const btn = buttons[i];
      const r = parseInt(btn.dataset.r, 10);
      const c = parseInt(btn.dataset.c, 10);
      updateCellEl(btn, board[r][c], r, c);
    }
  }

  /* ---------- timer ---------- */
  function startTimer(){
    stopTimer();
    timerInterval = setInterval(() => {
      elapsedSeconds++;
      timerEl.textContent = pad3(elapsedSeconds);
    }, 1000);
  }
  function stopTimer(){
    if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
  }

  /* ---------- controls ---------- */
  function syncToggles(){
    hexToggle.setAttribute('aria-pressed', hexMode ? 'true' : 'false');
    robotToggle.setAttribute('aria-pressed', robotOn ? 'true' : 'false');
  }

  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => initGame(btn.dataset.diff));
  });
  resetBtn.addEventListener('click', () => initGame(currentDiff));
  hintBtn.addEventListener('click', giveHint);

  hexToggle.addEventListener('click', () => {
    hexMode = !hexMode;
    saveOption('minefield-hex', hexMode);
    syncToggles();
    initGame(currentDiff); // switching grids starts a fresh game
  });
  robotToggle.addEventListener('click', () => {
    robotOn = !robotOn;
    saveOption('minefield-robot', robotOn);
    syncToggles();
    if(!robotOn){ clearHint(); refreshAllCells(); }
    updateHelper(); // turning the robot on/off doesn't restart your game
  });

  syncToggles();
  initGame('beginner');
})();
