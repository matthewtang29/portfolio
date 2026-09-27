(function(){
  const DIFFICULTIES = {
    beginner:     { rows: 9,  cols: 9,  mines: 10, cellSize: 38 },
    intermediate: { rows: 16, cols: 16, mines: 40, cellSize: 30 },
    expert:       { rows: 16, cols: 30, mines: 99, cellSize: 26 }
  };

  const gridEl = document.getElementById('grid');
  const mineCounterEl = document.getElementById('mineCounter');
  const timerEl = document.getElementById('timer');
  const statusLineEl = document.getElementById('statusLine');
  const ledEl = document.getElementById('led');
  const ledTextEl = document.getElementById('ledText');
  const resetBtn = document.getElementById('resetBtn');
  const diffButtons = document.querySelectorAll('.diff-btn');

  let currentDiff = 'beginner';
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

  function pad3(n){
    n = Math.max(0, Math.min(999, n));
    return String(n).padStart(3, '0');
  }

  function bestTimeKey(diff){ return 'minefield-best-' + diff; }

  function getBestTime(diff){
    try{
      const v = localStorage.getItem(bestTimeKey(diff));
      return v ? parseInt(v, 10) : null;
    }catch(e){ return null; }
  }

  function maybeSaveBestTime(diff, seconds){
    try{
      const current = getBestTime(diff);
      if(current === null || seconds < current){
        localStorage.setItem(bestTimeKey(diff), String(seconds));
        return true;
      }
    }catch(e){ /* storage unavailable, skip silently */ }
    return false;
  }

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

  function initGame(diff){
    currentDiff = diff;
    const cfg = DIFFICULTIES[diff];
    rows = cfg.rows; cols = cfg.cols; mineCount = cfg.mines;
    firstClickDone = false;
    gameOver = false;
    flagsPlaced = 0;
    revealedCount = 0;
    stopTimer();
    elapsedSeconds = 0;
    timerEl.textContent = pad3(0);
    mineCounterEl.textContent = pad3(mineCount);
    setLed('standby');
    setStatus('Ready. Click any cell to begin.');

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

    gridEl.style.setProperty('--cell-size', cfg.cellSize + 'px');
    gridEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    renderBoard(true);
  }

  function renderBoard(){
    gridEl.innerHTML = '';
    for(let r = 0; r < rows; r++){
      for(let c = 0; c < cols; c++){
        const cell = board[r][c];
        const btn = document.createElement('button');
        btn.className = 'cell';
        btn.type = 'button';
        btn.dataset.r = r;
        btn.dataset.c = c;
        updateCellEl(btn, cell, r, c);
        attachCellHandlers(btn, r, c);
        gridEl.appendChild(btn);
      }
    }
  }

  function updateCellEl(btn, cell, r, c){
    btn.dataset.revealed = cell.revealed ? 'true' : 'false';
    btn.dataset.flagged = cell.flagged ? 'true' : 'false';
    btn.disabled = gameOver && !cell.revealed && !(cell.mine && cell.flagged);
    btn.removeAttribute('data-num');
    btn.removeAttribute('data-mine-hit');
    btn.removeAttribute('data-wrong-flag');
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
      btn.setAttribute('aria-label', `Hidden cell, row ${r+1}, column ${c+1}`);
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

  function placeMines(excludeR, excludeC){
    const forbidden = new Set();
    for(let dr = -1; dr <= 1; dr++){
      for(let dc = -1; dc <= 1; dc++){
        const rr = excludeR + dr, cc = excludeC + dc;
        if(rr >= 0 && rr < rows && cc >= 0 && cc < cols) forbidden.add(rr + ',' + cc);
      }
    }
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
        let count = 0;
        for(let dr = -1; dr <= 1; dr++){
          for(let dc = -1; dc <= 1; dc++){
            if(dr === 0 && dc === 0) continue;
            const rr = r + dr, cc = c + dc;
            if(rr >= 0 && rr < rows && cc >= 0 && cc < cols && board[rr][cc].mine) count++;
          }
        }
        board[r][c].adjacent = count;
      }
    }
  }

  function handleReveal(r, c){
    if(gameOver) return;
    const cell = board[r][c];
    if(cell.revealed || cell.flagged) return;

    if(!firstClickDone){
      placeMines(r, c);
      firstClickDone = true;
      startTimer();
    }

    if(cell.mine){
      cell.revealed = true;
      cell.causedLoss = true;
      endGame(false);
      return;
    }

    floodReveal(r, c);
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
        for(let dr = -1; dr <= 1; dr++){
          for(let dc = -1; dc <= 1; dc++){
            if(dr === 0 && dc === 0) continue;
            const rr = r + dr, cc = c + dc;
            if(rr >= 0 && rr < rows && cc >= 0 && cc < cols && !board[rr][cc].revealed){
              stack.push([rr, cc]);
            }
          }
        }
      }
    }
  }

  function handleFlag(r, c){
    if(gameOver) return;
    const cell = board[r][c];
    if(cell.revealed) return;
    if(!firstClickDone){
      // allow flagging before first click without starting mines placement oddities
    }
    cell.flagged = !cell.flagged;
    flagsPlaced += cell.flagged ? 1 : -1;
    mineCounterEl.textContent = pad3(mineCount - flagsPlaced);
    refreshAllCells();
  }

  function checkWin(){
    const totalSafeCells = rows * cols - mineCount;
    if(revealedCount >= totalSafeCells){
      endGame(true);
    }
  }

  function endGame(won){
    gameOver = true;
    stopTimer();
    if(won){
      setLed('won');
      const isBest = maybeSaveBestTime(currentDiff, elapsedSeconds);
      const best = getBestTime(currentDiff);
      let msg = `Field cleared in ${elapsedSeconds}s.`;
      if(isBest) msg += ' New best time.';
      else if(best !== null) msg += ` Best: ${best}s.`;
      setStatus(msg, 'won');
      for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
          if(board[r][c].mine) board[r][c].flagged = true;
        }
      }
    } else {
      setLed('lost');
      setStatus('Detonated. The board below shows every mine.', 'lost');
      for(let r = 0; r < rows; r++){
        for(let c = 0; c < cols; c++){
          if(board[r][c].mine) board[r][c].revealed = true;
        }
      }
    }
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

  diffButtons.forEach(btn => {
    btn.addEventListener('click', () => initGame(btn.dataset.diff));
  });
  resetBtn.addEventListener('click', () => initGame(currentDiff));

  initGame('beginner');
})();
