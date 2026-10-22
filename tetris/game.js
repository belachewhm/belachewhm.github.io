'use strict';

const COLS = 10, ROWS = 20, BLOCK = 30;
const BOARD_W = COLS * BLOCK, BOARD_H = ROWS * BLOCK;
const PREVIEW_W = 120, PREVIEW_H = 80, PREVIEW_BLOCK = 20;
const COLORS = [
    null,
    '#00cfcf', // I — cyan
    '#f0d000', // O — yellow
    '#a000f0', // T — purple
    '#00c000', // S — green
    '#e00000', // Z — red
    '#0000e0', // J — blue
    '#F05F40', // L — orange (site accent)
];

// Spawn orientations follow the Super Rotation System (SRS)
const PIECES = [
    null,
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
    [[2,2],[2,2]],                               // O
    [[0,3,0],[3,3,3],[0,0,0]],                   // T
    [[0,4,4],[4,4,0],[0,0,0]],                   // S
    [[5,5,0],[0,5,5],[0,0,0]],                   // Z
    [[6,0,0],[6,6,6],[0,0,0]],                   // J
    [[0,0,7],[7,7,7],[0,0,0]],                   // L
];

// SRS wall kicks, keyed by "<from><to>" rotation state (0, R=1, 2, L=3).
// Offsets are (x, y-up) as in the SRS spec; y is flipped when applied.
const KICKS_JLSTZ = {
    '01': [[0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
    '10': [[0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
    '12': [[0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
    '21': [[0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
    '23': [[0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
    '32': [[0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
    '30': [[0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
    '03': [[0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
};
const KICKS_I = {
    '01': [[0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2]],
    '10': [[0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2]],
    '12': [[0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1]],
    '21': [[0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1]],
    '23': [[0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2]],
    '32': [[0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2]],
    '30': [[0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1]],
    '03': [[0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1]],
};

const POINTS = [0, 100, 300, 500, 800];
const DAS = 133, ARR = 33;                 // ms: delay before auto-shift, then ms per cell
const SOFT_DROP_FACTOR = 20, SOFT_DROP_MAX_MS = 33;
const LOCK_DELAY = 500, MAX_LOCK_RESETS = 15;
const HOLD_TURNS = 5;
const CLEAR_FLASH_MS = 150, TETRIS_FLASH_MS = 220;
const TRAIL_MS = 120, HOLD_FADE_MS = 300;

function setupHiDPI(cv, w, h) {
    const dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
}

const canvas = document.getElementById('tetris-canvas');
const ctx = setupHiDPI(canvas, BOARD_W, BOARD_H);
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = setupHiDPI(nextCanvas, PREVIEW_W, PREVIEW_H);
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = setupHiDPI(holdCanvas, PREVIEW_W, PREVIEW_H);
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub = document.getElementById('overlay-sub');
const overlayBtn = document.getElementById('overlay-btn');

// The grid never changes, so draw it once and copy it each frame
const gridLayer = document.createElement('canvas');
(() => {
    const g = setupHiDPI(gridLayer, BOARD_W, BOARD_H);
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 0.5;
    g.beginPath();
    for (let r = 0; r <= ROWS; r++) { g.moveTo(0, r * BLOCK); g.lineTo(BOARD_W, r * BLOCK); }
    for (let c = 0; c <= COLS; c++) { g.moveTo(c * BLOCK, 0); g.lineTo(c * BLOCK, BOARD_H); }
    g.stroke();
})();

let board = emptyBoard(), piece = null, nextId = 0, bag = [];
let score = 0, level = 1, lines = 0, gameRunning = false, paused = false, animId = null, lastTime = null;
let gravityAcc = 0, lockTimer = 0, lockResets = 0, lowestY = 0;
let hold = null, holdUsed = false, holdFade = null; // hold = { id, turns }
let clearing = null, trail = null, dirty = true;
let difficultyOffset = 0, musicChoice = 'korobeiniki';

// Input state
const held = new Set();
let moveDir = 0, dasTimer = 0, arrTimer = 0, softDropping = false;

// --- Preferences -------------------------------------------------------------
function loadPref(key, fallback) {
    try { return localStorage.getItem('tetris.' + key) ?? fallback; } catch (e) { return fallback; }
}

function savePref(key, value) {
    try { localStorage.setItem('tetris.' + key, value); } catch (e) { /* private mode */ }
}

function updateMusicUI() {
    const btn = document.getElementById('music-btn');
    const track = Music.tracks().find(t => t.id === musicChoice);
    document.getElementById('track-name').textContent = track ? track.name : 'Off';
    btn.classList.toggle('btn-game-muted', !track);
}

function cycleMusic() {
    const options = [...Music.tracks().map(t => t.id), 'off'];
    musicChoice = options[(options.indexOf(musicChoice) + 1) % options.length];
    savePref('music', musicChoice);
    updateMusicUI();
    if (musicChoice === 'off') Music.stop();
    else if (gameRunning) Music.play(musicChoice);
}

// Volume runs 0 (mute) to 10
function changeVolume(delta) {
    const v = Music.setVolume(Music.getVolume() + delta);
    savePref('volume', v);
    document.getElementById('volume-display').textContent = v ? v : 'Mute';
}

function setDifficulty(offset) {
    difficultyOffset = offset;
    savePref('difficulty', offset);
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('diff-' + offset).classList.add('active');
}

// --- Pieces ------------------------------------------------------------------
function emptyBoard() {
    return Array.from({length: ROWS}, () => new Array(COLS).fill(0));
}

// 7-bag: every run of seven pieces contains each piece exactly once
function takeFromBag() {
    if (!bag.length) {
        bag = [1, 2, 3, 4, 5, 6, 7];
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
    }
    return bag.pop();
}

function spawn(id) {
    const matrix = PIECES[id].map(r => [...r]);
    // The I piece's top row is empty, so start it one higher to appear on row 0
    return { id, matrix, rot: 0, x: Math.floor((COLS - matrix[0].length) / 2), y: id === 1 ? -1 : 0 };
}

function setPiece(p) {
    piece = p;
    gravityAcc = 0; lockTimer = 0; lockResets = 0; lowestY = p.y;
    dirty = true;
    if (collides(p.matrix, p.x, p.y)) gameOver();
}

function spawnNext() {
    setPiece(spawn(nextId));
    nextId = takeFromBag();
    drawNext();
}

function startGame() {
    Music.unlock();
    board = emptyBoard();
    score = 0; level = 1; lines = 0;
    bag = [];
    hold = null; holdUsed = false; holdFade = null;
    clearing = null; trail = null;
    gameRunning = true; paused = false;
    clearInput();
    nextId = takeFromBag();
    spawnNext();
    drawHold();
    updateHUD();
    overlayBtn.onclick = startGame;
    overlay.style.display = 'none';
    if (animId) cancelAnimationFrame(animId);
    lastTime = null;
    animId = requestAnimationFrame(loop);
    Music.setLevel(level);
    if (musicChoice !== 'off') Music.play(musicChoice);
    else Music.stop();
}

// --- Loop --------------------------------------------------------------------
function loop(ts) {
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 100);
    lastTime = ts;
    if (!paused) update(dt);
    if (dirty) draw();
    if (gameRunning || trail || holdFade) animId = requestAnimationFrame(loop);
}

function update(dt) {
    tickEffects(dt);
    if (!gameRunning) return;
    if (clearing) {
        clearing.t += dt;
        dirty = true;
        if (clearing.t >= clearing.dur) finishClear();
        return;
    }
    handleShift(dt);
    applyGravity(dt);
    if (piece && isGrounded()) {
        lockTimer += dt;
        if (lockTimer >= LOCK_DELAY) lockPiece();
    }
}

function tickEffects(dt) {
    if (trail && (trail.t += dt) >= TRAIL_MS) trail = null;
    if (trail) dirty = true;
    if (holdFade) {
        holdFade.t += dt;
        if (holdFade.t >= HOLD_FADE_MS) holdFade = null;
        drawHold();
    }
}

function gravityInterval() {
    // Tetris guideline gravity curve, in ms per row
    const L = level + difficultyOffset;
    return Math.pow(0.8 - (L - 1) * 0.007, L - 1) * 1000;
}

function applyGravity(dt) {
    const normal = gravityInterval();
    const interval = softDropping ? Math.min(normal / SOFT_DROP_FACTOR, SOFT_DROP_MAX_MS) : normal;
    gravityAcc += dt;
    for (let n = 0; gravityAcc >= interval && n < ROWS; n++) {
        gravityAcc -= interval;
        if (!stepDown(softDropping)) { gravityAcc = 0; break; }
    }
}

function handleShift(dt) {
    if (!moveDir || !piece) return;
    const before = dasTimer;
    dasTimer += dt;
    if (dasTimer < DAS) return;
    if (before < DAS) {
        shift(moveDir);
        arrTimer = dasTimer - DAS;
    } else {
        arrTimer += dt;
    }
    for (let n = 0; arrTimer >= ARR && n < COLS; n++) {
        arrTimer -= ARR;
        if (!shift(moveDir)) { arrTimer = 0; break; }
    }
}

// --- Movement ----------------------------------------------------------------
function collides(m, px, py) {
    for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
            if (!m[r][c]) continue;
            const nx = px + c, ny = py + r;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
            if (ny >= 0 && board[ny][nx]) return true;
        }
    }
    return false;
}

const isGrounded = () => collides(piece.matrix, piece.x, piece.y + 1);
const canAct = () => gameRunning && !paused && piece && !clearing;

// Moving or rotating restarts the lock delay, a limited number of times per piece
function onPieceMoved() {
    dirty = true;
    if (lockResets < MAX_LOCK_RESETS) {
        if (lockTimer > 0 || isGrounded()) lockResets++;
        lockTimer = 0;
    }
}

function shift(dir) {
    if (collides(piece.matrix, piece.x + dir, piece.y)) return false;
    piece.x += dir;
    onPieceMoved();
    return true;
}

function stepDown(scored) {
    if (isGrounded()) return false;
    piece.y++;
    dirty = true;
    if (piece.y > lowestY) { lowestY = piece.y; lockResets = 0; lockTimer = 0; }
    if (scored) { score += 1; updateHUD(); }
    return true;
}

function rotateCW(m) {
    const n = m.length;
    return m[0].map((_, c) => m.map((_, r) => m[n - 1 - r][c]));
}

function rotateCCW(m) {
    const n = m.length;
    return m.map((row, r) => row.map((_, c) => m[c][n - 1 - r]));
}

function tryRotate(dir) {
    if (piece.id === 2) return; // O doesn't rotate
    const rotated = dir === 1 ? rotateCW(piece.matrix) : rotateCCW(piece.matrix);
    const to = (piece.rot + dir + 4) % 4;
    const kicks = (piece.id === 1 ? KICKS_I : KICKS_JLSTZ)['' + piece.rot + to];
    for (const [kx, ky] of kicks) {
        if (!collides(rotated, piece.x + kx, piece.y - ky)) {
            piece.matrix = rotated;
            piece.x += kx;
            piece.y -= ky;
            piece.rot = to;
            onPieceMoved();
            return;
        }
    }
}

function hardDrop() {
    const fromY = piece.y;
    while (!isGrounded()) piece.y++;
    score += (piece.y - fromY) * 2;
    updateHUD();
    if (piece.y > fromY) trail = { id: piece.id, matrix: piece.matrix, x: piece.x, fromY, toY: piece.y, t: 0 };
    lockPiece();
}

// Hold keeps a piece for HOLD_TURNS turns. Swapping it in puts the current piece
// on hold with a fresh countdown; if the countdown runs out the held piece is lost.
function doHold() {
    if (holdUsed) return;
    const current = piece.id;
    if (hold) {
        setPiece(spawn(hold.id));
    } else {
        spawnNext();
    }
    hold = { id: current, turns: HOLD_TURNS };
    holdUsed = true;
    holdFade = null;
    drawHold();
}

function lockPiece() {
    let lockedOut = false;
    piece.matrix.forEach((row, r) => row.forEach((val, c) => {
        if (!val) return;
        if (piece.y + r < 0) lockedOut = true;
        else board[piece.y + r][piece.x + c] = val;
    }));
    piece = null;
    dirty = true;
    if (lockedOut) { gameOver(); return; }

    holdUsed = false;
    if (hold && --hold.turns <= 0) {
        holdFade = { id: hold.id, t: 0 };
        hold = null;
    }
    drawHold();

    const full = [];
    board.forEach((row, r) => { if (row.every(v => v !== 0)) full.push(r); });
    if (full.length) {
        clearing = { rows: full, t: 0, dur: full.length === 4 ? TETRIS_FLASH_MS : CLEAR_FLASH_MS };
    } else {
        spawnNext();
    }
}

function finishClear() {
    const cleared = clearing.rows.length;
    board = board.filter((_, r) => !clearing.rows.includes(r));
    while (board.length < ROWS) board.unshift(new Array(COLS).fill(0));
    clearing = null;
    lines += cleared;
    score += POINTS[cleared] * level;
    const newLevel = Math.floor(lines / 10) + 1;
    if (newLevel !== level) { level = newLevel; Music.setLevel(level); }
    updateHUD();
    spawnNext();
}

function gameOver() {
    gameRunning = false;
    clearInput();
    Music.stop();
    overlayTitle.textContent = 'Game Over';
    overlaySub.textContent = 'Score: ' + score.toLocaleString();
    overlayBtn.textContent = 'Play Again';
    overlayBtn.onclick = startGame;
    overlay.style.display = 'flex';
}

function togglePause() {
    if (!gameRunning) return;
    paused = !paused;
    clearInput();
    if (paused) {
        Music.pause();
        overlayTitle.textContent = 'Paused';
        overlaySub.textContent = '';
        overlayBtn.textContent = 'Resume';
        overlayBtn.onclick = togglePause;
        overlay.style.display = 'flex';
    } else {
        Music.resume();
        overlayBtn.onclick = startGame;
        overlay.style.display = 'none';
        lastTime = null;
    }
}

function updateHUD() {
    document.getElementById('score-display').textContent = score.toLocaleString();
    document.getElementById('level-display').textContent = level;
    document.getElementById('lines-display').textContent = lines;
}

// --- Drawing -----------------------------------------------------------------
function drawBlock(context, x, y, colorId, size, alpha = 1) {
    context.globalAlpha = alpha;
    context.fillStyle = COLORS[colorId];
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    // subtle highlight
    context.fillStyle = 'rgba(255,255,255,0.15)';
    context.fillRect(x * size + 1, y * size + 1, size - 2, Math.max(3, size / 7));
    context.globalAlpha = 1;
}

function draw() {
    dirty = false;
    ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    ctx.drawImage(gridLayer, 0, 0, BOARD_W, BOARD_H);
    board.forEach((row, r) => row.forEach((val, c) => { if (val) drawBlock(ctx, c, r, val, BLOCK); }));

    if (clearing) {
        const k = 1 - clearing.t / clearing.dur;
        const tetris = clearing.rows.length === 4;
        ctx.fillStyle = tetris ? `rgba(255,215,80,${0.95 * k})` : `rgba(255,255,255,${0.8 * k})`;
        for (const r of clearing.rows) ctx.fillRect(0, r * BLOCK, BOARD_W, BLOCK);
        if (tetris) {
            ctx.fillStyle = `rgba(240,95,64,${0.25 * k})`;
            ctx.fillRect(0, 0, BOARD_W, BOARD_H);
        }
    }

    // Hard-drop trail: a fading streak from where the piece started to where it landed
    if (trail) {
        const k = 1 - trail.t / TRAIL_MS;
        ctx.fillStyle = COLORS[trail.id];
        ctx.globalAlpha = 0.35 * k;
        for (let c = 0; c < trail.matrix[0].length; c++) {
            const top = trail.matrix.findIndex(row => row[c]);
            if (top < 0) continue;
            const x = (trail.x + c) * BLOCK + 4;
            ctx.fillRect(x, (trail.fromY + top) * BLOCK, BLOCK - 8, (trail.toY - trail.fromY) * BLOCK);
        }
        ctx.globalAlpha = 1;
    }

    if (!piece) return;
    let ghostY = piece.y;
    while (!collides(piece.matrix, piece.x, ghostY + 1)) ghostY++;
    if (ghostY !== piece.y) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        piece.matrix.forEach((row, r) => row.forEach((val, c) => {
            if (val) ctx.fillRect((piece.x + c) * BLOCK + 1, (ghostY + r) * BLOCK + 1, BLOCK - 2, BLOCK - 2);
        }));
    }
    piece.matrix.forEach((row, r) => row.forEach((val, c) => {
        if (val) drawBlock(ctx, piece.x + c, piece.y + r, val, BLOCK);
    }));
}

// Draws a piece centred on its filled cells rather than its matrix
function drawPreview(context, id, alpha = 1) {
    const m = PIECES[id];
    const rows = m.map((row, r) => row.some(v => v) ? r : -1).filter(r => r >= 0);
    const cols = m[0].map((_, c) => m.some(row => row[c]) ? c : -1).filter(c => c >= 0);
    const w = cols.length * PREVIEW_BLOCK, h = rows.length * PREVIEW_BLOCK;
    context.save();
    context.translate((PREVIEW_W - w) / 2 - cols[0] * PREVIEW_BLOCK, (PREVIEW_H - h) / 2 - rows[0] * PREVIEW_BLOCK);
    m.forEach((row, r) => row.forEach((val, c) => { if (val) drawBlock(context, c, r, val, PREVIEW_BLOCK, alpha); }));
    context.restore();
}

function drawNext() {
    nextCtx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    if (nextId) drawPreview(nextCtx, nextId);
}

function drawHold() {
    holdCtx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    if (holdFade) {
        const k = 1 - holdFade.t / HOLD_FADE_MS;
        holdCtx.save();
        holdCtx.translate(PREVIEW_W / 2, PREVIEW_H / 2);
        holdCtx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
        holdCtx.translate(-PREVIEW_W / 2, -PREVIEW_H / 2);
        drawPreview(holdCtx, holdFade.id, k);
        holdCtx.restore();
        return;
    }
    if (!hold) return;
    drawPreview(holdCtx, hold.id, holdUsed ? 0.35 : 1);
    holdCtx.font = '700 18px "Open Sans", sans-serif';
    holdCtx.textAlign = 'right';
    holdCtx.textBaseline = 'top';
    holdCtx.fillStyle = hold.turns === 1 ? '#ff3b3b' : '#F05F40';
    holdCtx.fillText(hold.turns, PREVIEW_W - 6, 4);
}

// --- Keyboard ----------------------------------------------------------------
function clearInput() {
    held.clear();
    moveDir = 0; dasTimer = 0; arrTimer = 0; softDropping = false;
}

function pressDirection(dir) {
    moveDir = dir; dasTimer = 0; arrTimer = 0;
    if (canAct()) shift(dir);
}

document.addEventListener('keydown', e => {
    if (e.code === 'KeyM') { if (!e.repeat) cycleMusic(); return; }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') { changeVolume(-1); return; }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') { changeVolume(1); return; }
    if (!gameRunning) { if (e.code === 'Enter') startGame(); return; }
    if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) togglePause(); return; }
    if (paused || e.repeat) return; // auto-repeat is handled by DAS/ARR, not the OS
    held.add(e.code);
    switch (e.code) {
        case 'ArrowLeft':  pressDirection(-1); break;
        case 'ArrowRight': pressDirection(1); break;
        case 'ArrowDown':
            softDropping = true;
            if (canAct() && stepDown(true)) gravityAcc = 0;
            break;
        case 'ArrowUp':
        case 'KeyX': if (canAct()) tryRotate(1); break;
        case 'KeyZ': if (canAct()) tryRotate(-1); break;
        case 'Space': if (canAct()) hardDrop(); break;
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight': if (canAct()) doHold(); break;
    }
});

document.addEventListener('keyup', e => {
    held.delete(e.code);
    if (e.code === 'ArrowLeft' && moveDir === -1) {
        if (held.has('ArrowRight')) pressDirection(1); else moveDir = 0;
    } else if (e.code === 'ArrowRight' && moveDir === 1) {
        if (held.has('ArrowLeft')) pressDirection(-1); else moveDir = 0;
    } else if (e.code === 'ArrowDown') {
        softDropping = false;
    }
});

// Prevent arrow/space page scroll and button activation while the game is active
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
for (const type of ['keydown', 'keyup']) {
    window.addEventListener(type, e => {
        if (gameRunning && GAME_KEYS.includes(e.code)) e.preventDefault();
    }, { passive: false });
}

window.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameRunning && !paused) togglePause();
});

// Game buttons must never keep focus, or Space would "click" them instead of dropping
document.querySelectorAll('.game-wrapper button').forEach(b => {
    b.tabIndex = -1;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => b.blur());
});

// --- Touch -------------------------------------------------------------------
// Tap: rotate · drag sideways: move · drag down: soft drop · flick down: hard drop
// Swipe up: rotate · two-finger tap: hold
const DRAG_CELL = 30, AXIS_LOCK = 10, SWIPE_MIN = 25, FLICK_SPEED = 0.5; // px, px, px, px/ms
let touch = null;

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length >= 2) {
        if (canAct() && !touch?.multi) doHold();
        touch = { multi: true };
        return;
    }
    const t = e.touches[0];
    touch = { x0: t.clientX, y0: t.clientY, ax: t.clientX, ay: t.clientY, time: performance.now(), axis: null, multi: false };
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault(); // block page scroll while over the canvas
    if (!touch || touch.multi || !canAct()) return;
    const t = e.touches[0];
    const dx = t.clientX - touch.x0, dy = t.clientY - touch.y0;
    if (!touch.axis && (Math.abs(dx) > AXIS_LOCK || Math.abs(dy) > AXIS_LOCK)) {
        touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (touch.axis === 'x') {
        while (t.clientX - touch.ax >= DRAG_CELL) { shift(1); touch.ax += DRAG_CELL; }
        while (touch.ax - t.clientX >= DRAG_CELL) { shift(-1); touch.ax -= DRAG_CELL; }
    } else if (touch.axis === 'y') {
        while (t.clientY - touch.ay >= DRAG_CELL && piece) { stepDown(true); touch.ay += DRAG_CELL; }
    }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const gesture = touch;
    if (e.touches.length === 0) touch = null;
    if (!gesture || gesture.multi) return;
    if (!gameRunning) { startGame(); return; }
    if (paused) { togglePause(); return; }
    if (!canAct()) return;

    const t = e.changedTouches[0];
    const dy = t.clientY - gesture.y0;
    const speed = dy / Math.max(1, performance.now() - gesture.time);
    if (!gesture.axis) tryRotate(1);
    else if (gesture.axis === 'y' && dy > 0 && speed > FLICK_SPEED) hardDrop();
    else if (gesture.axis === 'y' && -dy > SWIPE_MIN) tryRotate(1);
}, { passive: false });

// --- Init --------------------------------------------------------------------
const savedDifficulty = parseInt(loadPref('difficulty', '0'), 10);
setDifficulty([0, 2, 4, 6].includes(savedDifficulty) ? savedDifficulty : 0);
musicChoice = loadPref('music', 'korobeiniki');
const savedVolume = parseInt(loadPref('volume', '7'), 10);
Music.setVolume(Number.isNaN(savedVolume) ? 7 : savedVolume);
changeVolume(0);
updateMusicUI();
Music.probeOptional().then(() => {
    if (musicChoice !== 'off' && !Music.tracks().some(t => t.id === musicChoice)) musicChoice = 'korobeiniki';
    updateMusicUI();
});
draw();
