# Knife Deagle Fight — Design

**Date:** 2026-11-05
**Status:** Approved
**Upstream:** Fork of [victorgalvez56/redline](https://github.com/victorgalvez56/redline) (forked as `techforge-cli/redline`, renamed `techforge-cli/knife-deagle-fight`). REDLINE by Victor Galvez; foundation from Bruno Simon's `folio-2019`. MIT license retained with attribution.

## What this is

A browser-based, real-time multiplayer knife + Deagle arena duel built on REDLINE's stack and codebase: third-person on-foot combat in REDLINE's 100×100 m skatepark arena. Players spawn with a Deagle (ranged) and a knife (melee); first to 5 kills wins. REDLINE's netcode, arena, physics, combat-relay model, HUD shell, and pickups/heal/speed systems are reused; the car layer is deleted and replaced with an on-foot player layer plus mouse-aim combat.

## Scope

**In scope (MVP):** local multiplayer via two browser profiles against one dev server; foot movement, knife and Deagle combat; arena services (pickups, healing zone, speed pads); first-to-5 flow; REDLINE-style HUD.

**Out of scope:** headshot detection, reload mechanic, meteor shower, race mode, teams, server-authoritative HP (inherited client-trusted model is kept deliberately), camera-vs-wall pull-in, deployment beyond `npm run dev` (deploy recipe exists in `deploy/`, unverified here).

## Approach

Surgical fork & prune (approach A): delete aggressively, keep the working skeleton, replace only the player/weapon layer. `upstream` remote (`victorgalvez56/redline`) is registered in the fork for future syncs.

## Repository changes

1. Fork + rename + clone (done): `gh repo fork victorgalvez56/redline` → `gh repo rename knife-deagle-fight` → clone into this repo root → `git remote add upstream …`.
2. README rewritten: new title, fork provenance and credit block (Victor Galvez; Bruno Simon), same quick-start commands.
3. `docs/superpowers/specs/` holds this document.

## Modules deleted

- Race mode: `Track.js`, `LapTimer.js`, race flow in `EntryFlow.js`, race HUD, `BoostPads.js` (race boost pads; combat zones are converted instead)
- Vehicle layer: `Car.js`, `RemoteCar.js`, `RemoteCarManager.js` (replaced, see below)
- Missile weapons: `Weapons.js` (replaced by `Deagle.js` + `Knife.js`)
- Hazard: `Meteors.js` (client) and the meteor scheduler in `server/src/GameRoom.js`
- `remotion/` trailer pipeline, `ecosystem.config.cjs` (legacy PM2)

## Modules kept (unchanged except where noted)

- `World/Arena.js` — 100×100 m skatepark (central plateau + 4 ramps, NE bowl, NW stairs deck, SE kicker, SW spine, L-cover walls, perimeter walls), static Cannon bodies, canvas textures, `ARENA_SPAWN_GRID`
- `Network.js` — Socket.IO client transport (snapshots, ping/clock-sync, interpolation source)
- `server/src/GameRoom.js` — room lifecycle, snapshot relay, event routing (meteor scheduler removed)
- `server/src/PhysicsWorld.js`, `PlayerCar.js` — server capsule bodies for player-vs-player collision (car tuning removed)
- `World/HealthSystem.js` — 100 HP, death event, 3 s respawn
- `World/CombatPickups.js` — nine spawn points; health = green octahedron, ammo = missile-like mesh; 9 s respawn
- `World/HazardZones.js` — south healing zone (+8 HP/s) kept; two corridor boost zones converted to **speed pads** (force-along-velocity → temporary speed multiplier applied to the foot controller)
- `World/Controls.js` — keyboard mapping reused and extended (see controls table)
- `HUD.js`, lobby/entry flow, chat, minimap (platform silhouette data updated to arena layout)

## New / replaced modules (client)

- **`Player.js`** (replaces `Car.js`): Cannon capsule (radius 0.35 m, height 1.7 m), rotation locked to yaw, camera-relative WASD in the arena's z-up space, `Shift` sprint ×1.4, `Space` jump, velocity-driven (no wheel/engine physics).
- **`RemotePlayer.js` / `RemotePlayerManager.js`** (replace remote cars): same interpolation design — 80 ms render delay, 3 s buffer, velocity extrapolation fallback, static capsule collision body per remote; rendered as a low-poly humanoid assembled from matcap primitives (box torso/limbs, sphere head) with a name tag; no new art assets.
- **`Camera` rework**: over-the-shoulder third person, **pointer lock required**; mouse yaw + clamped pitch; crosshair as a DOM element centered on screen; `F` retained as fire alias. If pointer lock is unavailable/denied (iframe, old browser, or user pressed Esc), the game stays playable for navigation but shooting is disabled with an on-screen "Click to enable mouse aim" prompt — no silent keyboard-aim fallback.
- **`Deagle.js`** (replaces missile fire): camera-forward hitscan raycast; 50 HP flat damage (2 hits kill); 600 ms cooldown; hitmarker (HUD) + tracer beam + muzzle-flash sprite + shot sound; ammo 10 start / 20 max, refilled by pickups; **no reload mechanic**; no spread, no falloff (arena range).
- **`Knife.js`**: frontal arc 120°, reach 2.1 m; 35 HP per slash (3 slashes kill); 250 ms cooldown; swing tween on the knife mesh (local arms/weapon are shown attached to the over-shoulder camera, like the missile origin was).
- **`Weapons` coordinator (thin)**: owns `current` (`deagle` | `knife`), swap via `1`, `2`, `Q` (toggle) or mouse wheel. Delegates spawn/cooldown/HUD to the active weapon.

## Combat numbers (final)

| | Deagle | Knife |
|---|---|---|
| Damage | 50 HP | 35 HP |
| Geometry | Hitscan raycast (camera forward) | Frontal arc 120°, reach 2.1 m |
| Cooldown | 600 ms | 250 ms |
| Ammo | 10 start / 20 max, pickups refill | ∞ |

- HP 100 · respawn 3 s, ammo resets to 10 · first to **5 kills**
- **Kill attribution unchanged**: local 1500 ms damage-recency heuristic (shooter records `targetId + timestamp`; `combat:playerDown` from server relay within the window credits the kill; five credits → victory overlay). Known false positives/negatives inherited from REDLINE (two attackers on same victim both credited; meteor/ram/self kills credit nobody — meteors are gone, ram damage remains unattributed).
- All damage client-trusted: the firing client raycasts, applies/reports `player:combatDamage {targetId, amount}`, server relays to target only, victim applies locally. Server verifies nothing (accepted — same trust envelope as REDLINE).
- Self-damage: knife can self-hit if arc wraps (prevented: arc check ignores local player); Deagle hitscan originates at camera and can target anything including arena geometry (blocked shot, nothing applied).

## Controls

| Action | Keys |
|---|---|
| Move | `WASD` / arrows |
| Sprint | `Shift` |
| Jump | `Space` |
| Aim | Mouse (pointer lock) |
| Fire / slash | LMB (alias `F`) |
| Swap weapon | `1` Deagle · `2` Knife · `Q` toggle · wheel |
| Chat | `Enter` |
| Mute | UI button · `M` for sound toggle if already wired |

No manual respawn key — death auto-respawns after the 3 s countdown; R is unbound.

## Server changes

- `GameRoom.js`: meteor scheduler deleted; snapshot relay, join/leave, `combat:missile`-equivalent events unchanged except rename below.
- **Event rename:** `combat:carDestroyed` → `combat:playerDown` (both ends live in this fork; updates `Network.js`, `GameRoom.js`, HUD/lobby listeners, control overlay text). `player:combatDamage` is already generic and unchanged.
- `PlayerCar.js` → foot-player capsule representation (name may stay `PlayerCar.js` internally to minimize diff, documented in README; tuning from `shared/constants.js`).
- **Spawn-grid fix (inherited bug):** combat spawns currently risk stacking on `ARENA_SPAWN_GRID[0]` because the arena spawn logic reads a missing `_index` property. Fix: server assigns a deterministic spawn index at join time; client honors it. Regression-checked in the two-profile test below.
- `shared/constants.js`: foot tuning constants (capsule dims, run speed ≈ 5 m/s, spring/speed-pad multiplier, sprint multiplier, knife/Deagle damage, cooldowns, spawn grid), fixed broadcast rates (60 Hz physics / 20 Hz snapshot / 80 ms interp — unchanged).

## HUD

HP bar · ammo `DEAGLE ×12` or `KNIFE ∞` · kill counter `/5` · centered crosshair · red **hitmarker** on confirmed local hit · respawn overlay with countdown · controls overlay updated (swap keys, `F`/LMB) · minimap shows arena silhouette + player dots (hardcoded data updated) · lap-timer UI deleted · victory overlay reuses the `#race-complete` pattern with `VICTORY` copy.

## Data flow (unchanged from REDLINE)

```
WASD/aim → local simulation → snapshot @20 Hz → server relay @all peers
→ RemotePlayer interpolate 80 ms (velocity extrapolation on empty buffer)

LMB → raycast/arc check → hit? → network.sendCombatDamage(targetId, amount)
→ server → target only → victim HealthSystem.applyDamage → 0 HP → death flow
→ network.sendPlayerDown() → relay → peers + local kill-attribution heuristic
```

## Error handling / known limits (documented, not fixed)

- Client-trusted HP, damage, kills — cheating trivially possible; kept deliberately for MVP parity with upstream.
- No server-side win arbitration: if two players hit 5 concurrently, both clients declare victory locally (same as REDLINE combat).
- Chat not rate-limited (inherited).
- Camera may clip arena geometry (no collision pull-in).
- Pointer lock mandatory for shooting by design decision (no keyboard-aim fallback).

## Verification (manual, two browser profiles)

1. `npm install && npm install --prefix client && npm install --prefix server && npm run dev`
2. Both profiles join same room; movement/jump/sprint; arena collisions (plateau, ramps, walls)
3. Deagle: raycast hits at range, blocked by arena geometry, 2-hit kill
4. Knife: arc edge cases (reach boundary, behind decoy angle, self ignored)
5. Pickups refill health/ammo on respawn cycle; heal zone ticks +8 HP/s; speed pads boost corridors
6. Kill attribution: two attackers on one victim (both credited — expected), meteor-free environment
7. Respawn resets HP/ammo; first-to-5 victory overlay; refresh → rejoin loses identity/loadout (expected)
8. Spawn grid: no two players stacked on slot 0 on join (bug fix regression check)
9. Room full at 20 clients (basic connection, no crash)

## Decisions log (from brainstorming, 2026-11-05)

- REDLINE-style third-person on-foot arena duel, not first-person and not top-down
- Fork the GitHub repo officially via `gh` (fork count 4→5), honoring upstream; fork renamed `knife-deagle-fight`; `upstream` remote preserved
- Free-for-all first to 5 (no teams); single dev-machine MVP
- REDLINE-style chunk damage for Deagle (not CS one-shot, not headshot system)
- Knife fast & low damage (35 HP / 250 ms), not a CS-style swing-or-die
- No meteor shower; pickups + heal zone + speed pads kept
- Client-trusted combat model kept; spawn-grid bug fixed opportunistically
- Pointer lock mandatory for mouse aim; no keyboard-aim fallback ("Click to enable mouse aim")
- Manual R respawn removed entirely — death auto-respawns after the 3 s countdown; R is unbound
