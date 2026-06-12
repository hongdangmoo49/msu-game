# MSU Survival

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Phaser](https://img.shields.io/badge/Phaser-3.90-7b3ff2)](https://phaser.io/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-runtime-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

MSU Survival is a lightweight browser survival game built with Phaser and TypeScript.
Pick an MSU character, survive waves of enemies, collect XP, and stack weapon or passive upgrades until the screen turns into controlled chaos.

The project is designed so the game can run even when the MSU network is unavailable. Live or cached MSU data is resolved through the local server, while the browser client falls back to safe embedded assets when needed.

## Highlights

- Character lobby powered by an MSU game manifest
- Vampire-survivor style auto-combat loop
- Keyboard movement with automatic nearest-enemy targeting
- Level-up choices for weapons and passives
- Object pools for projectiles, enemies, and XP orbs
- Offline-friendly fallback manifest and inline fallback assets
- Server-side MSU API proxy so API keys never ship to the browser
- Acceptance checks for security, fallback behavior, and performance budget

## Gameplay

| Area | Details |
| --- | --- |
| Lobby | Select a character card, then start a match. |
| Movement | `WASD` or arrow keys. |
| Combat | Weapons fire automatically toward nearby enemies. |
| Progression | Collect XP orbs, level up, and choose one of three upgrades. |
| Restart | After game over, click or press any key. |
| Debug | Add `?perf=1` to show the performance overlay. |

Current weapon patterns include single-shot bolts, spread shots, ring bursts, and spiral fire. Passive upgrades can improve speed, max HP, armor, and XP magnet range.

## Quick Start

```bash
npm install
npm run dev:server
```

In another terminal:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The Vite dev server proxies `/api/*` to the local Node server on port `3000`.

## Production Build

```bash
npm run build
npm start
```

Open:

```text
http://localhost:3000
```

## Environment

All MSU credentials stay server-side.

| Variable | Purpose |
| --- | --- |
| `MSU_API_KEY` | API key used by the Node proxy for MSU upstream calls. |
| `MSU_MANIFEST_PROXY_URL` | Optional remote manifest source. |
| `MSU_MANIFEST_PROXY_TIMEOUT_MS` | Optional timeout for the manifest proxy. Defaults to `2500`. |
| `MSU_MANIFEST_RAW_PATH` | Optional local raw manifest file path. |
| `MSU_MANIFEST_PATH` | Optional normalized/cache manifest file path. |
| `MSU_MANIFEST_CACHE_PATH` | Alternative cache manifest path. |
| `PORT` | Production server port. Defaults to `3000`. |

If no live or cached manifest is available, the game still boots with the bundled fallback manifest at `public/assets/manifest.fallback.json`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite client dev server. |
| `npm run dev:server` | Start the local Node API/static server in watch mode. |
| `npm run build` | Build client and server output into `dist/`. |
| `npm start` | Serve the production build. |
| `npm run typecheck` | Run TypeScript type checking. |
| `npm test` | Run security, fallback, and performance tests. |
| `npm run verify:acceptance` | Run typecheck, build, and the full test suite. |

## Project Structure

```text
.
|-- public/assets/              # Fallback manifest and static assets
|-- server/                     # Local HTTP server and MSU proxy routes
|-- src/game/                   # Phaser scenes, entities, systems, and UI
|-- src/msu/                    # MSU endpoint metadata, types, and normalization
|-- src/ui/                     # Shared Phaser UI helpers
|-- tests/                      # Acceptance-oriented test scripts
|-- docs/                       # API notes and validation checklist
`-- vite.config.ts              # Vite client build/dev config
```

## Safety Checks

The acceptance command validates the main release gates:

```bash
npm run verify:acceptance
```

It checks that:

- browser bundles do not contain MSU API key names or upstream auth headers
- game runtime code does not call the MSU API directly during play
- manifest loading works with network failures through fallback data
- projectile/enemy simulation stays under the 60 FPS frame budget

## Notes

- The client fetches only `/api/manifest`; direct MSU calls are handled by the server.
- Build output and dependencies are intentionally ignored by git.
- More implementation details live in `docs/acceptance-checklist.md` and `docs/msu-api-notes.md`.
