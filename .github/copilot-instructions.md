## Purpose
This file gives concise, task-focused guidance for AI coding agents working on this repo (a Start Bootstrap "Creative" one-page theme). Use it to quickly find where to change styles, scripts, assets, and how to run the build.

## Big Picture
- Single-page Bootstrap-based static site. The root HTML is [index.html](index.html). Styling lives under `css/` (built outputs) and `less/` (source). Scripts live in `js/` (see `js/creative.js`). Static assets: `img/` and `fonts/`.
- Build is Grunt-based: `Gruntfile.js` compiles LESS, minifies JS, and injects a banner. See [Gruntfile.js](Gruntfile.js).

## Quick dev workflows
- Install dev dependencies: `npm install` (uses `package.json`).
- Build once: `grunt` (runs `uglify`, `less`, `usebanner`).
- Live dev: `grunt watch` to recompile `less` and `js` on changes.

## Where to make changes
- CSS source: `less/<name>.less` (the package name is `creative` from `package.json`). Change variables in `less/variables.less` or `less/creative.less` and run `grunt`.
- Built CSS: `css/creative.css` and `css/creative.min.css` — do not edit generated files directly.
- Main JS: [js/creative.js](js/creative.js) — it contains page scrolling, nav, and animation initialization.
- Images and media: `img/` — used directly by `index.html` (examples: `img/carousel/*`, `img/portfolio/*`).

## Patterns & conventions
- Source vs build: source lives in `less/` and `js/*.js`; built assets are in `css/*.css` and `js/*.min.js`.
- Naming: `package.json` `name` is used by the Gruntfile templates (`<%= pkg.name %>`). Keep it consistent if you rename files.
- Banner: `grunt-banner` injects the license header into built files. See `Gruntfile.js` `banner` section.

## Integration & external deps
- External fonts are loaded from Google Fonts in `index.html`.
- Font Awesome is stored under `font-awesome/` (local css and fonts).
- jQuery, Bootstrap and plugins are local in `js/` (e.g., `jquery.js`, `bootstrap.js`, `wow.min.js`) and referenced in `index.html`.

## Debugging notes
- No unit tests or CI configured in repository. Validate visual changes by opening `index.html` in a browser or using a simple static server: `npx http-server -c-1 .`.
- If scripts or styles don't update, confirm `grunt` ran successfully and that the browser cache is cleared (files under `css/` and `js/` are frequently cached).

## Examples (common edits)
- Update hero/branding text: edit the navbar brand in [index.html](index.html) (search `navbar-brand`).
- Change animation timing: modify `new WOW().init();` or the CSS in `css/creative.css` / `less/creative.less`.
- Add a new portfolio tile: follow the markup used in `index.html` portfolio tiles and add images to `img/portfolio/`.

## Files to inspect first
- [index.html](index.html)
- [Gruntfile.js](Gruntfile.js)
- [package.json](package.json)
- [less/creative.less](less/creative.less)
- [js/creative.js](js/creative.js)

If any part of this file is unclear or you want more project-specific examples (e.g., how to extend the JS for a new UI widget), tell me which area to expand and I will iterate.
