# AGENTS.md

Compact instructions for agents working in this repo. Only what's non-obvious and hard to re-derive.

## Quick start

```bash
npm install                 # root tooling (concurrently, playwright)
npm install --prefix client # three.js, cannon 0.6.2, vite, socket.io-client
npm install --prefix server # socket.io, express, cannon
npm run dev                 # server :3001 (socket.io) + client :5173 (vite proxy)
npm run build               # client production bundle (vite) — green-check without launching
node --test                 # unit tests (tests/combat.test.mjs)
docker build -t kdf .       # production image (serves client/dist on :3001)
```

Node ≥ 18. `node --test tests/` fails on Node 24 (positional args are globs) — use
`node --test` or the full file path.

## Branches (repo is a GitHub fork of victorgalvez56/redline)

| Branch | Role |
|---|---|
| `main` | Integration — finished work lands here. Pushed to `Salar-prog/knife-deagle-fight` (`origin`). |
| `knife-deagle-fight-dev` | Active development — feature branches come off it; merge to `main` when green. |
| `upstream/*` | Mirrors of upstream's branches: `upstream/main`, `upstream/vr-meta-quest`. |

- `upstream` remote = `https://github.com/victorgalvez56/redline.git`. Refresh mirrors with
  `git fetch upstream && git branch -f upstream/<name> upstream/<name>` — never `pull` upstream
  into `main`/dev, and never use GitHub's "Sync fork" button (it syncs into your default branch).
- Active work goes on `knife-deagle-fight-dev`; merge to `main` when done. Push both remotes.

## World mechanics you must know

- **z-up everywhere** (gravity `(0,0,-13)`; yaw around Z; forward = local +X). Never assume y-up.
- Cannon 0.6.2: `Cylinder` default axis is **Z**; there is **no `angularFactor`** — use
  `fixedRotation = true`. Capsule = cylinder (axis Z) + two spheres at ±cylinderHeight/2.
  `aabbNeedsUpdate = true` must be set after teleporting a `mass: 0` body (broadphase AABB
  freezes otherwise — remote bumper bug).
- Movement is **direct velocity** — `Player.update()` sets `body.velocity.x/y` every tick;
  gravity/jump own `z`. Speed tuning lives in `shared/constants.js` (`FOOT.runSpeed`,
  `sprintMultiplier`, `jumpVelocity`) — change numbers there only. Right vector for forward
  `(cos yaw, sin yaw)` is `(sin yaw, −cos yaw)`; the old `(−sin, cos)` strafed backwards.
- Camera (`client/src/javascript/Camera.js`): OTS pointer-lock rig; `camera.yaw` is the
  **view** forward `(cos yaw, sin yaw)` (offset points behind). `setAim` holds yaw/pitch;
  canvas click requests lock; ESC exits (browser default). Pointer lock is **required for firing**
  — no keyboard-aim fallback, by design. `setPan`/`orbitControls` are dead; keep them disabled.
- Networking: client-trusted damage **by design** (server relays verbatim). Server never
  validates HP/damage. Snapshot emit is `{pos, quat, vel, angVel}` — no `wheels`. Events:
  `combat:playerDown` (victim broadcasting death), `player:combatDamage`
  (`{targetId, amount}`, server relays to target only). Server never owned HP.
- Spawn: server assigns a deterministic arena-slot index at join (`pickSpawnSlotIndex`,
  `shared/combat.js`) and emits `spawnPos {x,y,z,index}` in `room:joined`. Client honors it —
  do NOT remap through `ARENA_SPAWN_GRID[slot]` (that was the old client-side bug; client grid
  removed in favor of server assignment + `shared/constants.js` grid).
- All RMB/LMB/wheel fire and swap input goes through pointer-lock gating in `World/Controls.js`;
  the unified `swap` event payload is `0`=toggle, `±1`=step, `'deagle'|'knife'`=select.
- View forward is `(cos yaw, sin yaw)` — matches both movement (`Player.js`) and knife arc
  (`Deagle`/`Knife` ray direction). Do not "fix" the yaw sign toward a third-person offset.
- R (manual respawn) was intentionally deleted — death auto-respawns after the 3 s countdown via
  `HealthSystem`. Don't re-add it.

## Gameplay tuning

Canonical numbers (in `shared/constants.js`): HP 100 · respawn 3 s · first to 5 kills ·
Deagle 50 HP / 600 ms / 10 start / 20 max (no reload) · Knife 35 HP / 250 ms / 2.1 m / 120°.
Adjustments go in `shared/constants.js` only — client and server both import from there.

## Deployment (infrastructure)

- **Docker**: single image at repo root. `server/src/index.js` serves `client/dist` via
  express when the build exists — one process, one port (3001); no separate static server
  needed. The image publishes to `ghcr.io/salar-prog/knife-deagle-fight` via
  `.github/workflows/docker.yml` on push to main/dev and `v*` tags.
- **systemd / nginx**: examples in `deploy/` — unit file + nginx proxy with WebSocket
  upgrade headers.
- **GitHub Pages**: static site lives in `docs/` (source: `main:/docs`), live at
  `https://salar-prog.github.io/knife-deagle-fight`. Anything in `docs/assets/` is
  served as-is (videos, GIFs).
- **Showcase video**: built with `/brag` (HyperFrames skill, installed globally). Outputs
  land in `brag-output-*/` (plan, brief, `brag.mp4/gif/jpg`, share copy) plus the editable
  Hyperframes project under that dir's `knife-deagle-fight/` subfolder. `docs/assets/`
  holds the copies embedded in README and Pages. HyperFrames check/render needs Chrome
  headless and ffmpeg/ffprobe on PATH.

## Testing

- Unit: `node --test` → `tests/combat.test.mjs` (pure helpers: spawn picker, knife arc).
- Build: `npm run build`.
- Docker build: `docker build -t kdf .` then
  `docker run -d -p 3002:3001 kdf` and `curl :3002/` (index) +
  `curl :3002/socket.io/?EIO=4&transport=polling` (Socket.IO handshake).
- Server smoke (socket.io-client script): two joins → distinct spawn slots; disconnect frees slot.
- Browser feel is NOT verifiable headlessly (no WebGL/pointer-lock) — do a two-profile
  playtest (`npm run dev`) before calling something shipped.
