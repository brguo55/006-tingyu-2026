# 听雨 · Tingyu

A planner that runs in the browser: tasks, a pomodoro timer and habit tracking, in pixel art.

**Live:** https://brguo55.github.io/006-tingyu-2026/

## Features

- **Tasks** — lists, a Today view, search, notes and due dates. Type 明天 / 周五 / 下周一 at the start or end of a task to set its due date.
- **Pomodoro** — focus, short and long breaks, linked to a task, daily and weekly stats, and an immersive full-screen mode. It stays accurate in a background tab and resumes after a reload.
- **轻重 (Eisenhower matrix)** — tag tasks 马上做 / 排时间 / 顺手做 / 放一放 (important × urgent). Add tasks inside a quadrant and drag them between quadrants.
- **Habits** — daily check-ins, current and best streaks, and a 22-week grid.
- **倒数 (countdowns)** — days until an exam, trip or deadline. Yearly ones (birthdays, anniversaries) repeat and show which year it is; past dates count up.
- **House** — a pixel-art, Hollow Knight-style side-view map (1800 × 500 pixels, about 4 screens wide × 2 tall) with a camera that follows the pink-haired knight. The knight is the repo owner's own 26 × 52 pixel sprite. He starts sitting in his wooden armchair. A / D walk, Space jumps (hold for higher, with coyote time, jump buffering and a slight hang at the apex; press again in the air for a double jump with a burst of feathers), and S drops through furniture. E is reserved for interactions (none yet). Areas: entrance, a double-height library with shelves to climb, a tea corner, a study with a computer (it rains on the screen) and a real-time wall clock, plus a loft with a bed, reached by shelf steps. Animations: SIT, IDLE (breathing, blinking), MOVE (8-frame walk), JUMP, FALL and LAND, plus dust. Parallax: the rainy view outside the windows moves slower and foreground pillars, ivy and plants move faster. His bunny-eared bird flies along. Click him, finish a task, check a habit or end a pomodoro and he hops with a happy face and hearts. There's a mute button (key M), and the color swatches tint the wallpaper and rug.
- **Pixel UI** — the panel uses the [Fusion Pixel](https://github.com/TakWolf/fusion-pixel-font) font (SIL OFL 1.1, loaded from jsDelivr and cached for offline use), square 2px borders and hard shadows.
- **Offline & installable** — install it as an app from Chrome or Edge.

## Art

The scene is pixel art at 1 pixel = 2 world units, scaled up by whole numbers so pixels stay square. The house is drawn in code (`js/stage/house.js`). The knight's frames (`js/stage/sprites.js`) are all derived from one hand-drawn 26 × 52 sprite: breathing, blinking, an 8-frame walk (legs redrawn with simple two-bone IK), jumping, landing and sitting. Commissioned frame animations can replace them later. A pixel-art brief for commissioning artwork is in [`docs/art-brief/`](docs/art-brief/README.md). It has reference images at 1× pixels, an annotated layout guide, the current layers, pixel platform coordinates and the sprite spec.

## Your data

Everything is stored locally in the browser (IndexedDB). Nothing is sent to a server or to GitHub.

Backups (Settings → 备份):

1. **Auto-backup to a folder** (Chrome / Edge) — pick a folder synced by Google Drive, OneDrive or Dropbox. The app writes `tingyu-latest.json` after every change, plus one dated snapshot per day, and keeps the last 30 days.
2. **Export / import** a backup file in any browser. Use this to move to a new computer.
3. The backup status is always visible, and you get a reminder if you haven't backed up for 3 days.

Never put the backup folder inside this repository — it is public. `tingyu-*.json` is git-ignored as a safety net.

## Development

Plain HTML, CSS and JavaScript: no dependencies and no build step. Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

```
index.html, manifest.webmanifest, sw.js
css/          stage.css (canvas), app.css (panel)
js/stage/     map and controls (room.js), the pixel house (house.js), sprites (sprites.js),
              pixel helpers (pixel.js), palette, canvas controls, audio
js/app/       util, store (IndexedDB), backup, tasks, pomodoro, habits, settings, app shell
icons/        app icons
```
