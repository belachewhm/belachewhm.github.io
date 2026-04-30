## Purpose
Concise, task-focused guidance for AI coding agents working on this repo — a personal portfolio and demo site for Belachew "Billy" Haile-Mariam.

## Big Picture
- Static site with no build step. Three HTML pages: [index.html](index.html) (portfolio), [login.html](login.html) (demo login), [tetris.html](tetris.html) (Tetris game).
- Styling: `css/creative.css` (base theme) + `custom.css` (project-specific overrides). Edit `custom.css` for most changes; avoid editing `creative.css` unless changing base theme defaults.
- Scripts: `js/creative.js` — vanilla JS only (no jQuery). Handles smooth scroll and navbar scroll-spy.
- All dependencies (Bootstrap 5, Font Awesome 6, Google Fonts) are loaded via CDN in each HTML file's `<head>`.

## Quick dev workflow
No build step required. Serve the root directory with any static file server:
```
python3 -m http.server 8080
```
Then open `http://localhost:8080` in a browser.

## Where to make changes
- **Navbar / layout**: [index.html](index.html) — Bootstrap 5 markup. Nav links use `class="nav-link page-scroll"` for smooth-scroll behavior.
- **Styles**: `custom.css` for overrides (navbar colors, carousel sizing, modal layout, etc.). Base theme variables are in `css/creative.css`.
- **Scroll behavior / nav**: [js/creative.js](js/creative.js) — `updateNav()` toggles `.scrolled` class on `#mainNav` based on scroll position. `.scrolled` = white navbar; no class = transparent navbar.
- **Images**: `img/carousel/` for hero images, `img/portfolio/` for experience/education tiles.
- **Resume**: `docs/Billy_Haile-Mariam_Resume.pdf`
- **Login page**: [login.html](login.html) — always rejects auth (demo only). No backend. On failed attempt: shows `error_gif.gif` and plays `magicword.mp3`. Blank username or password silently blocks submission.
- **Tetris page**: [tetris.html](tetris.html) — self-contained canvas Tetris game. All game logic and Web Audio API music synthesis are inline in the file's `<script>` block. No external game assets. Music uses oscillator nodes scheduled ahead-of-time; `stopMusic()` explicitly stops all tracked oscillators. Difficulty shifts the drop-speed index in `DROP_INTERVALS`. Both `login.html` and `tetris.html` hardcode `.scrolled` on `#mainNav` (always white — no hero carousel).

## Navbar color system
Two states driven by the `.scrolled` class on `#mainNav`:
- `.scrolled` (at top, scrollY ≤ 100): white background, dark/orange text — defined in `#mainNav.scrolled` in `custom.css`
- no class (scrolled down): transparent, white text — defined in `#mainNav:not(.scrolled)` in `custom.css`

Brand color: `#F05F40` (orange). Hover: `#eb3812`.

## Patterns & conventions
- Each HTML page is self-contained: includes all CDN links and scripts inline.
- Modals follow Bootstrap 5 markup (`data-bs-toggle`, `data-bs-target`). Each experience tile has a paired `<div class="modal fade">`.
- `login.html` navbar always has `.scrolled` class hardcoded (no hero carousel, so always white).

## Debugging notes
- No tests or CI. Validate by opening in a browser with cache disabled (Cmd+Shift+R).
- If navbar colors look wrong, check scroll position and whether `.scrolled` class is present on `#mainNav`.
- Font Awesome icon classes use v4 shim (`fa fa-*`) via the CDN shim file — both v4 and v6 class names work.

## Common edits
- Add a nav link: add `<li class="nav-item"><a class="nav-link page-scroll" href="#section-id">Label</a></li>` in both `index.html` and `login.html` (pointing to `index.html#section-id` in login.html).
- Add a portfolio tile: copy an existing `.col-12.col-md-6` block in the experience section, update the modal ID, image, and text.
- Change hero images: replace files in `img/carousel/` (small/medium/large variants) and update `srcset` in `index.html`.
