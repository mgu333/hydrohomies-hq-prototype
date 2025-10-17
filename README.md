# Hydrohomies HQ — Prototype

A small charity: water themed browser game prototype. Catch good drops, avoid bad and hazardous drops, and reach the goal before time runs out.
Features
 - Good drops +1, Bad drops -2, Hazard drops -4
 - 30s round, win at 25 points
 - Pause/Resume, Reset, Mute (persisted in localStorage)
 - High score persisted in localStorage
 - Accessibility: aria-live for score, focus styles, prefers-reduced-motion support
 - Responsive, mobile-first design

Run locally
1. Start a static server from the repo root:

```bash
python3 -m http.server 8000
```

2. Open http://127.0.0.1:8000/index.html/index.html in your browser or the Codespace simple browser.

Run tests (Playwright)

```bash
npm ci
npx playwright install
npx playwright test
```

Controls
 - Click or tap drops to collect/avoid
 - Pause: `P` key or Pause button
 - Reset: `R` key or Reset button
 - Mute toggles sound and persists choice

Notes about publishing
 - The site is ready for GitHub Pages. Files are kept at repo root and links are relative.

*** End README ***