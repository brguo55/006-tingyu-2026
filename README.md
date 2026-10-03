# 听雨 · Tingyu

A rainy-day planner that runs in the browser: tasks, a pomodoro timer and habit tracking, drawn in pen and watercolor over a small 3D waterscape where it rains, snows or drops cherry blossoms.

**Live:** https://brguo55.github.io/006-tingyu-2026/

## Features

- **Tasks** — lists, a Today view, search, notes and due dates. Type 明天 / 周五 / 下周一 at the start or end of a task to set its due date.
- **Pomodoro** — focus, short and long breaks, linked to a task, daily and weekly stats, and an immersive full-screen mode. It stays accurate in a background tab and resumes after a reload.
- **Habits** — daily check-ins, current and best streaks, and a 22-week watercolor grid.
- **Scene** — rain, snow or sakura (keys 1 / 2 / 3) with matching ambient sound, a mute button (key M), and seven water colors that also tint the panel. Drag to rotate, scroll to zoom, and click the water to make ripples.
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
css/          scene.css (canvas), app.css (panel)
js/scene/     the waterscape: engine, palette, effects (rain / snow / sakura), audio
js/app/       util, store (IndexedDB), backup, tasks, pomodoro, habits, settings, app shell
assets/       recorded rain loop (base64 WAV)
icons/        app icons
```
