# Tetris improvements plan — ✅ DONE

**Status:** ✅ **DONE** (2026-10-21). Implemented in `tetris/index.html`, `tetris/game.js`, `tetris/music.js` and `tetris/music/`.
**File in scope:** `tetris/index.html` (one self-contained page: CSS, markup and about 450 lines of JS)

## Goals

1. **Smoother and faster play.** Controls should respond immediately and movement should feel fluid, like modern Tetris.
2. **Hard drop that works reliably.** You should be able to slam pieces down every time.
3. **Music selection.** Let the player switch between the current Korobeiniki theme and an epic, Game of Thrones–feeling track, plus a third option.

---

## 1. Why hard drop fails today

Hard drop is mapped to Space (`hardDrop()`, line 500), but three things get in the way:

| # | Cause | Where | Effect |
|---|-------|-------|--------|
| a | **Focused buttons react to Space.** After you click *New Game*, *Music* or a difficulty button, that button keeps keyboard focus. When you press Space, the browser "clicks" the focused button on key-up, which restarts the game or toggles the music. | buttons at lines 186–215 | The drop is cancelled, the game restarts, or the music toggles. To you it looks like slamming doesn't work. |
| b | **Holding Space repeats.** The keydown handler ignores `e.repeat`, so holding Space hard-drops several pieces in a row. | line 614 | Accidental double slams. |
| c | **No lock delay.** Each gravity tick locks a piece as soon as it touches down (`moveDown` → `lock`, line 475), and the handler resets `dropTimer = 0` instead of carrying over the remainder. | lines 418–420 | Landings feel abrupt and you can't slide a piece into place. |

**Fixes**
- Call `blur()` on every game button after it is clicked, and give the buttons `tabindex="-1"` so they never hold focus during play.
- Ignore Space key-ups on buttons while a game is running.
- Skip `keydown` events where `e.repeat` is true for hard drop and rotation.
- Make hard drop lock the piece instantly, with no lock delay, and add a short visual "slam" cue: a trail from the piece's starting position to where it lands that fades over about 120 ms. This is drawing only and doesn't affect gameplay.
- Award hard-drop points (2 per cell) and soft-drop points (1 per cell), as in the standard rules.

## 2. Smoother, faster controls

Today, holding left or right relies on the operating system's key repeat: a pause of about 500 ms, then a variable rate. That is the main reason the game feels sluggish.

### 2.1 Input handling rewrite
- Track which keys are held (a `keys` set updated on `keydown` and `keyup`) and apply movement inside the `requestAnimationFrame` loop instead of in the event handler.
- **DAS/ARR** (fixed values, no settings control): DAS is how long a direction is held before auto-repeat starts; ARR is how fast it repeats after that.
  - First move happens instantly on keydown.
  - DAS = **133 ms**, then ARR = **33 ms** per cell (sliding across the board takes about 0.3 s).
  - If you press the opposite direction, that direction wins and the DAS timer restarts.
- **Soft drop while held:** moves down at 20× the current gravity (at least one cell every 33 ms) for as long as ↓ is held, instead of one cell per key repeat.
- Reset held keys when the window loses focus or the game pauses, so pieces don't keep sliding after you tab away.

### 2.2 Modern rotation and lock rules
- **SRS rotation** (the Super Rotation System used by modern Tetris), with the standard wall-kick tables. The I piece has its own table. This replaces the simple ±1/±2 nudge at line 491.
- **Counter-clockwise rotation** on `Z`, with clockwise on `↑` and `X`.
- **Lock delay:** 500 ms after the piece lands. Moving or rotating resets the timer, up to 15 times per piece, so it can't stall forever.
- **7-bag randomizer:** each run of seven pieces contains every piece exactly once, so no long droughts of I pieces. This replaces `Math.random()` at line 390.
- **Hold piece** on `C` or `Shift`, shown in a new "Hold" box in the side panel (on mobile, two-finger tap).
  - **Hold lasts 5 turns:** pressing hold when the slot is empty stores the current piece, brings in the next one, and starts a **5-turn countdown** shown on the Hold box.
  - **Using it:** at any point during those 5 turns, press hold again to bring the held piece into play as the current piece. The current piece then goes into the slot and the countdown restarts at 5.
  - **Expiry:** each locked piece counts as one turn. When the countdown reaches 0, the held piece **disappears** with a short fade, and the slot is empty and ready again.
  - **Anti-stall rule** (standard Tetris): you can hold only once per falling piece.
  - The Hold box shows the piece and a large countdown number. The number turns red on the last turn.

### 2.3 Game loop and rendering
- Use a fixed-step accumulator: `dropTimer -= interval` instead of `= 0`, and cap `dt` at about 100 ms, so gravity stays even and returning from another tab doesn't cause a jump.
- Draw the background grid once to an offscreen canvas and copy it each frame, instead of drawing 32 lines every frame.
- Compute the ghost piece's landing row only when the piece moves or rotates, not every frame.
- **Sharp rendering on HiDPI/Retina screens:** size the canvas backing store by `devicePixelRatio` and scale the context. Today the board looks slightly blurry on Mac screens.
- Only redraw when something changed (a "dirty" flag), which saves battery when nothing is happening.

### 2.4 Faster speed curve
- Replace `DROP_INTERVALS` (line 258, which bottoms out at 100 ms) with the standard guideline gravity formula:
  `interval = (0.8 − (L−1)·0.007)^(L−1)` seconds, where L is the level.
  Level 1 is about 1000 ms, level 10 about 64 ms and level 15 about 7 ms. The speed keeps increasing, and lock delay keeps high levels playable.
- Keep the Easy / Normal / Hard / Insane buttons as starting-level offsets (+0 / +2 / +4 / +6), as they work now.
- **Line-clear flash:** cleared rows flash white for about 150 ms, then collapse. Gravity and input pause during the flash, and a 4-line clear (a "Tetris") gets a stronger flash.

### 2.5 Touch (mobile)
- Keep the current gestures. Make the hard-drop swipe more reliable: a downward swipe faster than 0.5 px/ms triggers a hard drop, instead of the current "under 250 ms" rule.
- Horizontal drag moves the piece live, one cell per 30 px dragged, instead of only when you lift your finger.

## 3. Music selection

### 3.1 What's legally usable
I looked into free MIDI files on the web:
- **Game of Thrones:** the theme (Ramin Djawadi, 2011) is still under copyright, published by Universal. Claude won't transcribe the melody note by note. The engine still plays any `.mid` file, so if Billy finds a GoT MIDI later, it can be added at `tetris/music/got.mid` with no code changes.
- **Epic track instead:** **Holst, *Mars, the Bringer of War*** (from *The Planets*, published 1921, public domain in the US). It has a pounding 5/4 rhythm in the strings, low brass and timpani, and it's the piece most epic-fantasy and war soundtracks trace their sound back to. Claude will transcribe the main ostinato and theme into code.
- **Public-domain classical pieces:** these are safe to use. The [Mutopia Project](https://www.mutopiaproject.org) publishes free sheet music and MIDI files, and each piece lists its license. Their [*In the Hall of the Mountain King*](https://sca.uwaterloo.ca/Mutopia/cgibin/piece-info.cgi?id=1888) (Grieg, Op. 46 No. 4) is marked **Public Domain / CC "No rights reserved"**.

### 3.2 The tracks
| Track | Source | Notes |
|---|---|---|
| **Korobeiniki** (current) | Traditional folk tune, public domain | Kept as is, ported to the new engine. |
| **Mars, the Bringer of War** (epic / GoT feel) | Holst, public domain; transcribed into code | Col legno-style percussive strings for the 5/4 ostinato, low brass melody, timpani. |
| **The Long Winter** (GoT style) | **Original composition** by Claude, written into the code | D minor, 6/8 time, about 160 BPM: a cello-like repeating figure, a low drone, a horn/violin melody and timpani. It has the GoT mood without copying the theme. |
| *(optional)* **Game of Thrones** | A `.mid` you add later at `tetris/music/got.mid` | Left out of the menu unless the file exists. |
| **In the Hall of the Mountain King** (new 3rd option) | Mutopia MIDI, Grieg, PD / CC0 | It famously starts slow and gets faster and louder, which fits Tetris speeding up through the levels. |

*Other public-domain candidates, if you'd rather have one of these:* Bach's Minuet from French Suite No. 3 (it's the "Tetris B" music from the Game Boy version), Rimsky-Korsakov's *Flight of the Bumblebee*, or Offenbach's *Can-Can*.

### 3.3 Audio engine refactor (`tetris/music.js`)
The current engine (lines 260–351) plays one square-wave voice and re-schedules the whole melody with `setTimeout`. I'll replace it with:
- **One note-event format** used by every track: `{ time, duration, pitch, velocity, voice }`. Each voice is a separate instrument part.
- **A small MIDI file reader** (about 120 lines, no library). It reads standard `.mid` files, format 0 and 1, including note on/off and tempo changes, and converts them into note events. This is how the Mountain King file (and any later file) gets loaded. Files live in `tetris/music/`. Each track can name a MIDI channel to treat as the melody, and drum notes on channel 10 go to the timpani/noise voice. `LICENSE.txt` credits Mutopia for the Mountain King file.
- **Korobeiniki, Mars and The Long Winter** are written as note data in the code, so they don't need MIDI files.
- **Adding more tracks later:** add an entry to the `TRACKS` list in `music.js` with a name and a `.mid` path, then put the file in `tetris/music/`.
- **A lookahead scheduler:** checks every 25 ms and queues notes about 150 ms ahead. This is the standard Web Audio pattern. It loops seamlessly, switching tracks takes effect immediately, and nothing gets stuck after pausing.
- **Synthesized instruments:** everything is generated in the browser with no soundfonts.
  - square wave for the chiptune Korobeiniki
  - sawtooth through a low-pass filter for strings
  - triangle for the drone
  - a pitch-dropping sine burst for timpani
  - plucked-style notes for the Mountain King piano part
- **Music speeds up with level:** tempo is multiplied by `1 + 0.03 × (level − 1)`, up to a maximum of 1.5×. The change is smooth, with no restart.

### 3.4 UI
- Replace the single "Music: On/Off" button with a music button that cycles **Korobeiniki → Mars → The Long Winter → Mountain King → Off** (plus GoT if the file is ever added), with a small label showing the current track.
- Remember the music choice and difficulty in `localStorage` (wrapped in try/catch so it fails quietly in private mode).
- Add a keyboard shortcut: `M` cycles the music.

## 4. Files and structure (split approved)
- `tetris/index.html`: markup and styles
- `tetris/game.js`: game logic, input and rendering
- `tetris/music.js`: audio engine, MIDI reader and track data
- `tetris/music/mountain-king.mid` and `tetris/music/LICENSE.txt`

These are plain `<script>` tags, so there's no build step and deployment stays the same.

## 5. Testing

The repo has no test harness, so testing is manual plus a quick headless check:
- Serve locally (`python3 -m http.server` from the repo root) and open `/tetris/`.
- **Checklist:**
  - Space hard-drops correctly after clicking each button.
  - Holding Space does not drop several pieces.
  - The DAS slide feels right.
  - A piece can slide under an overhang during lock delay.
  - The T-spin and I-piece wall kicks work.
  - The 7-bag rule holds: in 70 pieces, each type appears exactly 10 times.
  - Pausing and resuming keeps the music in sync.
  - Switching tracks mid-game works.
  - The Mountain King MIDI loads and loops.
  - Music tempo rises with level.
  - Hold: the piece is stored and the countdown starts at 5.
  - Swapping the held piece in works during the countdown and restarts it.
  - The held piece disappears when the countdown reaches 0.
  - Hold works only once per falling piece.
  - The line-clear flash plays.
  - Mobile swipes work.
  - The board is sharp on Retina.
- Load the page in headless Chrome to confirm there are no console errors.

## 6. Order of work

1. Fix button focus and Space repeat (fixes hard drop on its own and is a quick win).
2. Rewrite the input handling (DAS/ARR, held soft drop).
3. Add SRS, lock delay and 7-bag, plus hold with the 5-turn expiry and countdown.
4. Improve the loop and rendering (accumulator, HiDPI, cached grid), switch to the new gravity curve, and add the line-clear flash.
5. Refactor the audio engine (scheduler, MIDI reader, tempo scaling) and port Korobeiniki to the new format.
6. Transcribe Mars, compose The Long Winter, add the Mountain King MIDI and the optional `got.mid` slot, and add the music picker UI.
7. Update the controls hint, test, and commit. Each step can be a separate commit if you prefer.

## Decisions
- Hold piece: **yes**. It lasts 5 turns with a countdown, can be swapped in during those turns, and disappears at 0.
- Split into separate files: **yes**
- Line-clear flash and music that speeds up with level: **yes**
- Third track: **In the Hall of the Mountain King**
- "The Long Winter": **back in**, as a fourth track
- Epic track: **Holst's *Mars*** (confirmed). The ostinato is Holst's; the brass line is an arrangement written for the game.

## Added after the plan
- **Layout:** Next, Hold, the music controls and the key map moved to the left of the board. On narrow screens the board sits on top with both panels below it.
- **Volume:** every track is normalised to the same loudness. Korobeiniki was about 3× louder than the others. Volume runs 0–10 (default 7, 3 dB per step), with buttons and the `-` / `=` keys, and is remembered between visits.
- **Opening from disk:** the page loads its scripts by relative path when opened via `file://` and root-relative when served. The Mountain King MIDI still needs a server.
