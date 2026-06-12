# Acceptance Checklist

WP-008 validation target: API key protection, limited network calls, cache/fallback play, 60 FPS budget.

## Commands

- `npm run verify:acceptance`
- `npm run test:security`
- `npm run test:network`
- `npm run test:perf`

## API Key Protection

- Server reads `MSU_API_KEY`; browser code does not read API key env vars.
- `tests/security-static.test.mjs` scans `dist/client` after build for `MSU_API_KEY`, `VITE_MSU_API_KEY`, `NXOPEN_API_KEY`, `x-nxopen-api-key`, `msu-authorization`, `openapi.msu.io`.
- Same test can scan real sentinel value via `MSU_API_KEY=<value> npm run test:security`.
- Sentinel run passed: `MSU_API_KEY=wp008-client-secret-sentinel npm run test:security`.

Acceptance status: pass via `npm run verify:acceptance` on 2026-06-12.

## In-Game MSU Calls

- Game runtime files scanned: `GameScene`, `entities`, `systems`, `ui`.
- Forbidden in runtime: `fetch(`, `XMLHttpRequest`, `navigator.sendBeacon`, `/api/msu`, direct MSU upstream URL, MSU auth headers.
- `/api/manifest` is allowed only in boot asset loader, before match start.

Acceptance status: pass via `npm run verify:acceptance` on 2026-06-12.

## Network Blocked Play

- `tests/network-fallback.test.mjs` bundles `assets.ts`, stubs `globalThis.fetch` to throw `network_blocked`, and calls `loadManifestWithFallback()`.
- Expected result: client fallback manifest, inline character image, inline skill image, fallback icons.
- Server fallback fixture also checked: `public/assets/manifest.fallback.json`.
- Manual browser check: enable network offline, load client, confirm lobby and match start use fallback assets.

Acceptance status: pass via `npm run verify:acceptance` on 2026-06-12.

## Performance

- `src/game/debug/PerfOverlay.ts` can be enabled with `?perf=1`, `?msuPerf=1`, or `localStorage["msu.perfOverlay"]="1"`.
- Overlay reports FPS, average frame time, p95 frame time, active projectile count, active enemy count.
- Automated budget: `tests/perf-budget.test.mjs` simulates 300 projectiles and 100 enemies for 600 measured frames.
- Pass threshold: p95 frame cost <= 16.67 ms.

Recorded result from `npm run verify:acceptance` on 2026-06-12:

```json
{
  "scenario": {
    "projectiles": 300,
    "enemies": 100,
    "frames": 600
  },
  "meanFrameMs": 0.033,
  "p95FrameMs": 0.038,
  "maxFrameMs": 0.207,
  "estimatedFpsFromMean": 30336.206,
  "targetFrameMs": 16.667
}
```
