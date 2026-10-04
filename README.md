# 听雨 · Tingyu

A planner that runs in the browser: tasks, a pomodoro timer and habit tracking, drawn in pen and watercolor.

**Live:** https://brguo55.github.io/006-tingyu-2026/

## Features

- **Tasks** — lists, a Today view, search, notes and due dates. Type 明天 / 周五 / 下周一 at the start or end of a task to set its due date.
- **Pomodoro** — focus, short and long breaks, linked to a task, daily and weekly stats, and an immersive full-screen mode. It stays accurate in a background tab and resumes after a reload.
- **轻重 (Eisenhower matrix)** — tag tasks 马上做 / 排时间 / 顺手做 / 放一放 (important × urgent). Add tasks inside a quadrant and drag them between quadrants.
- **Habits** — daily check-ins, current and best streaks, and a 22-week watercolor grid.
- **倒数 (countdowns)** — days until an exam, trip or deadline. Yearly ones (birthdays, anniversaries) repeat and show which year it is; past dates count up.
- **Room** — a small top-down room where a pink-haired knight (redrawn in code from artwork commissioned by the repo owner) walks with WASD, followed by his bunny-eared bird. E is reserved for interactions (none yet). IDLE: breathing, blinking, sipping tea. MOVE: walk cycle. Furniture blocks the way and is depth-sorted. Click the knight, finish a task, check a habit or end a pomodoro and he raises his mug, with hearts. There's a mute button (key M), and the color swatches tint the rug and walls.
- **Offline & installable** — install it as an app from Chrome or Edge.

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
js/stage/     the room (room.js), the knight and bird (knight.js), palette, canvas controls, audio
js/app/       util, store (IndexedDB), backup, tasks, pomodoro, habits, settings, app shell
icons/        app icons
```
