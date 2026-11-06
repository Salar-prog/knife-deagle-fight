# KNIFE DEAGLE FIGHT

> Two-hit Deagle. Swing first.

A browser-based multiplayer on-foot knife + Deagle arena duel, forked from
[REDLINE](https://github.com/victorgalvez56/redline) by **Victor Galvez**
(foundation: Bruno Simon's folio-2019). MIT license — see LICENSE.

Everything except the vehicle layer and race mode is REDLINE's: arena,
matcap rendering, Cannon physics, Socket.IO relay, pickups, respawn flow.

---

## Overview

KNIFE DEAGLE FIGHT is a browser-based, real-time multiplayer on-foot arena duel: knife and Deagle, free-for-all in a dedicated 100×100 m skatepark-style arena — first to five kills wins. Ammo and health pickups, jump pads, a healing zone, and a server-driven meteor shower.

The client renders matcap-shaded low-poly environments in Three.js. The server is authoritative for matchmaking, snapshot relay, hit attribution, and environmental hazards. Both ends share a Cannon.js physics world for predictable movement and collisions.

## Tech stack

| Layer | Tech |
| --- | --- |
| Rendering | [Three.js](https://threejs.org/) |
| Physics | [Cannon.js](https://github.com/schteppe/cannon.js) |
| Networking | [Socket.IO](https://socket.io/) (client + server) |
| Build | [Vite](https://vitejs.dev/) with [vite-plugin-glsl](https://github.com/UstymUkhman/vite-plugin-glsl) |
| Animation | [GSAP](https://gsap.com/) |
| Audio | [Howler.js](https://howlerjs.com/) |
| Trailer pipeline | [Remotion](https://www.remotion.dev/) |
| Reverse proxy | [Caddy](https://caddyserver.com/) (production) |

## Quick start

Requires **Node.js ≥ 18** and **npm ≥ 9**.

```bash
# Install all workspaces
npm install
npm install --prefix client
npm install --prefix server

# Run client + server together
npm run dev
```

That spins up:

- **Server** — Socket.IO at `http://localhost:3001`
- **Client** — Vite dev server at `http://localhost:5173`, proxying `/socket.io/` to the server

You can also run them individually:

```bash
npm run client   # Vite client only
npm run server   # Socket.IO server only
```

To build the production client:

```bash
npm run build    # → client/dist/
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser  client/                                                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐  │
│  │  Three.js    │   │  Cannon.js   │   │  Socket.IO client        │  │
│  │  rendering   │   │  local sim   │   │  inputs ↑ / snapshots ↓  │  │
│  └──────────────┘   └──────────────┘   └────────────┬─────────────┘  │
│                                                     │                │
└─────────────────────────────────────────────────────┼────────────────┘
                                                     │  WebSocket
┌─────────────────────────────────────────────────────┼────────────────┐
│  Node     server/                                   │                │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────┴─────────────┐  │
│  │  GameRoom    │ ← │  Cannon.js   │ ← │  Socket.IO server        │  │
│  │  20Hz tick   │   │  60Hz physics│   │  routes inputs, broadcasts│ │
│  └──────────────┘   └──────────────┘   └──────────────────────────┘  │
│                     ↑                                                │
│                     │  meteor scheduler, kill attribution            │
│                     │  ping ↔ clock-sync                             │
└──────────────────────────────────────────────────────────────────────┘
```

The server steps physics at 60 Hz and broadcasts world snapshots at 20 Hz. Each snapshot is the **client-reported state** (position, quaternion, velocity) cached server-side and re-emitted to all peers. Remote players on each client interpolate over a 80 ms render delay and fall back to velocity-based extrapolation when the buffer is empty.

Round-trip pings double as a clock-sync mechanism: the server returns its own `Date.now()` in the ping callback; the client computes `(serverTime + RTT/2) - clientTime` and EMA-smooths the result so renders use a shared temporal reference, not the local clock.

## Project structure

```
.
├── client/                 # Vite + Three.js front-end
│   └── src/
│       ├── index.html
│       ├── index.js
│       ├── javascript/     # World, Camera, HUD, Network, EntryFlow…
│       │   └── World/      # Track, Arena, Weapons, Meteors, HazardZones…
│       ├── shaders/        # GLSL
│       └── styles/redline.css
│
├── server/                 # Socket.IO authoritative server
│   └── src/
│       ├── index.js        # HTTP server boot
│       ├── GameRoom.js     # tick loop + event handlers + meteor shower
│       └── PhysicsWorld.js # shared with client via shared/constants.js
│
├── shared/
│   └── constants.js        # physics tuning, network rates, spawn grid
│
├── remotion/               # Trailer pipeline (intro + gameplay + outro)
│   └── src/Trailer.tsx     # composition with chromatic aberration,
│                           # synthwave grid, ken burns, scanning bar…
│
├── docs/                   # README assets
│   └── preview.gif
│
├── design/                 # Brand brief, palette, layout notes
└── ecosystem.config.cjs    # PM2 config (legacy)
```

## Game mode

| Element | Detail |
| --- | --- |
| **Objective** | First to 5 kills |
| **Arena** | 100×100 m skatepark: central plateau with 4 ramps, NE skate bowl, NW stairs deck, SE big kicker, SW spine, mixed low-poly trees, L-cover walls |
| **Tools** | Deagle (two-hit kill) and knife melee, ammo + health pickups, healing zone (south), server-driven meteor shower (~140/min) |
| **Kills** | Heuristic: a destruction event from a player you damaged within the last 1500 ms counts as your kill |

## Controls

| Action | Keys |
| --- | --- |
| Move | `WASD` |
| Sprint | `Shift` |
| Jump | `Space` |
| Aim (pointer lock) | `Mouse` |
| Fire / attack | `LMB` / `F` |
| Swap weapon (Deagle / knife) | `1` / `2` / `Q` |
| Chat | `Enter` |
| Mute | `M` |

A keyboard is currently required — touch controls are stubbed out but not wired up. Death auto-respawns after a 3 s countdown; there is no manual respawn.

## Upstream

This repo is a fork of [REDLINE](https://github.com/victorgalvez56/redline). The `upstream` remote points at the original:

```bash
git fetch upstream
```

## Contributing

PRs welcome. The repo is small enough to read top-to-bottom in an afternoon.

1. **Fork → clone → branch** (`git checkout -b feat/your-thing`)
2. Run locally with `npm run dev` (see [Quick start](#quick-start))
3. Keep changes scoped — one feature/fix per PR
4. Match the existing style: 4-space indent, semicolons-off where the file already drops them, single quotes
5. **No formatting-only commits** mixed with logic changes
6. Open a PR with a short description of *why* the change matters, not just *what* it does

### Good first issues

If you want to chip in but aren't sure where to start, the codebase has plenty of low-hanging fruit:

- Touch controls (`client/src/javascript/World/Controls.js` already has a `setTouch()` method scaffold — joystick + buttons exist but aren't fully wired)
- Adaptive interpolation delay based on measured ping (currently fixed 80 ms)
- Server-side HP authority (currently client-trusted)
- Spectator mode for full rooms
- More arena obstacle layouts as separate files (currently hard-coded in `Arena.js`)
- Localized strings (the UI text is currently hard-coded English/Spanish)

### Conventions

- **Commits**: imperative mood, present tense, no trailing period (`Add boost zone visual`, not `Added boost zone visual.`)
- **Network events**: `colon:case` (e.g. `combat:kill`, `player:joined`)
- **Magic numbers**: lift them to module-level constants with a comment

## Acknowledgments

REDLINE began as an educational fork of [**Bruno Simon's `folio-2019`**](https://github.com/brunosimon/folio-2019) — the matcap shader pipeline, shadow system, GLTF loader integration, and base car physics setup are derived from his original work. This repo evolved into a separate game (multiplayer, lap timing, combat, arena, weapons, hazards, REDLINE branding) but the foundation is his.
