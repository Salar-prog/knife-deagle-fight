# Knife Deagle Fight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the REDLINE fork into a playable mouse-aimed, on-foot knife+Deagle FFA arena duel — first to 5 kills — reusing REDLINE's arena, netcode, physics and HUD.

**Architecture:** Client-authoritative movement snapshots relayed by the Socket.IO server (unchanged envelope). The vehicle layer (`Car.js`, `RemoteCar*.js`, vehicle sections of `Physics.js`) is deleted and replaced by a Cannon compound-capsule foot controller. Combat is Deagle hitscan (50 HP) + knife frontal-arc melee (35 HP), both client-side vs `RemotePlayer` interpolated primitives. Kill attribution stays REDLINE's local 1500 ms damage-recency heuristic. Server loses the meteor scheduler; snapshot relay, damage relay, room lifecycle unchanged.

**Tech Stack:** Three.js r164 · Cannon.js 0.6.2 · Socket.IO 4.8 · Vite 5 · Node ≥18 (`node --test` for pure helpers)

**Spec:** `docs/superpowers/specs/2026-11-05-knife-deagle-fight-design.md` — read it first.

**Working directory for all commands:** the fork root (this repo), e.g. `client/`, `server/`, `shared/`. Line numbers reference upstream redline at initial import; verify with `grep -n` before editing.

## Global Constraints

- z-up world everywhere (`gravity (0,0,-13)`, yaw around Z, forward +X, ojects spawn at z≈0.85 for the foot capsule — never "fix" y-axis assumptions locally).
- Capsule: cylinder axis along **Z** (cannon 0.6.2 `Cylinder` default axis is Z); radius 0.35 m, cylinder height 1.0 m, spheres at z = ±0.5 m, total height 1.7 m; body center spawn z = 0.85 m; `fixedRotation: true` (never tips — cannon 0.6.2 has no angularFactor).
- Deagle: 50 HP/hit, 600 ms cooldown, no spread, no falloff, 10 start / 20 max ammo, pickups refill, **no reload**.
- Knife: 35 HP, reach 2.1 m, 120° frontal arc, 250 ms cooldown, infinite ammo.
- 100 HP · 3 s respawn, ammo resets to 10 · first to **5 kills** · kill attribution = local 1500 ms damage-recency heuristic (unchanged).
- Client-trusted damage model (accepted); pointer lock **required** for shooting; no keyboard-aim fallback — show "Click to enable mouse aim" instead.
- Network event renames in this plan: `combat:carDestroyed` → `combat:playerDown` (emitter `sendCarDestroyed` → `sendPlayerDown`). `player:combatDamage` **unchanged**.
- Spawn bug fix: server assigns a deterministic arena spawn index at join time; client honors it and no longer remaps to `ARENA_SPAWN_GRID[0]`.
- 4-space indent, no semicolons inside the files you touch is *not* uniformly enforced — match each file's existing local style; single quotes.
- ID checks: `git grep -n "sendCarDestroyed\|combat:carDestroyed"` must return zero hits after Task 8.

---

## Task 1: Repo hygiene — metadata, license credit, README fork block

**Files:**
- Modify: `package.json` (root)
- Rewrite: `README.md` (keep technical content, swap identity/credits)
- Create: `.gitignore` (node_modules, dist, logs) — *this clone has none*
- Modify: `client/src/index.html` (`<title>` only — HUD text comes in Task 7)

- [ ] **Step 1: .gitignore**

```gitignore
node_modules/
client/node_modules/
server/node_modules/
client/dist/
*.log
.DS_Store
```

- [ ] **Step 2: root package.json** — set `"name": "knife-deagle-fight"`, `"description": "Knife Deagle Fight — browser multiplayer knife+Deagle arena duel (fork of REDLINE). Three.js + Cannon.js + Socket.IO."`, `"repository": { "type": "git", "url": "https://github.com/techforge-cli/knife-deagle-fight.git" }`, `"homepage": ""`, keep `author` (Victor Galvez is upstream author — add `"contributors": ["Victor Galvez <hello@victorgalvez.dev>"]` and keep license MIT).

- [ ] **Step 3: README.md** — replace header block with:

```markdown
# KNIFE DEAGLE FIGHT

> Two-hit Deagle. Swing first.

A browser-based multiplayer on-foot knife + Deagle arena duel, forked from
[REDLINE](https://github.com/victorgalvez56/redline) by **Victor Galvez**
(foundation: Bruno Simon's folio-2019). MIT license — see LICENSE.

Everything except the vehicle layer and race mode is REDLINE's: arena,
matcap rendering, Cannon physics, Socket.IO relay, pickups, respawn flow.
```

Keep the quick-start/architecture/controls sections but: controls table becomes {WASD move, Shift sprint, Space jump, Mouse aim (pointer lock), LMB/F fire · 1/2/Q swap, Enter chat, M mute} — no R respawn (death auto-respawns after the 3 s countdown); remove race-mode sections and car screenshots/GIFs; keep `upstream` remote documented (`git fetch upstream`).

- [ ] **Step 4: index.html title** → `<title>KNIFE DEAGLE FIGHT — Two-hit Deagle. Swing first.</title>`

- [ ] **Step 5: sanity check + commit**

```bash
git status --short   # expect: M package.json README.md client/src/index.html ; ?? .gitignore
git add -A && git commit -m "Rebrand fork as Knife Deagle Fight, add gitignore"
```

---

## Task 2: Shared combat core + constants + pure-test helpers

**Files:**
- Create: `shared/combat.js` (pure, dependency-free)
- Create: `tests/combat.test.mjs`
- Modify: `shared/constants.js` (append `FOOT`, `ARENA_SPAWN_GRID`, export stays backward compatible)
- Test: `node --test`

**Interfaces (later tasks consume these exact names):**
- `pickSpawnSlotIndex(usedIndexes: Set<number>, count: number): number` — lowest free index; wraps modulo `count` when full.
- `knifeArcHit({ origin: {x,y}, yaw, target: {x,y}, reach, arc }): boolean` — true iff target within reach and angle ≤ arc/2 of forward vector.
- `FOOT` constant (see below). `ARENA_SPAWN_GRID` (moved from `World/Arena.js:128`).

- [ ] **Step 1: append to `shared/constants.js`**

```js
// Foot-player tuning (z-up world). Server and client must agree on values.
export const FOOT = {
  mass: 70,
  radius: 0.35,
  cylinderHeight: 1.0,   // 1.7 total with 2 spheres
  height: 1.7,
  spawnZ: 0.85,
  runSpeed: 5,           // m/s
  sprintMultiplier: 1.4, // Shift
  jumpVelocity: 5,       // m/s +Z
  spawnSlots: 4,
}

// South-side arena spawn slots (deterministic; replaces race SPAWN_GRID for combat)
export const ARENA_SPAWN_GRID = [
  { x: -6, y: -42 }, { x: 6, y: -42 }, { x: -18, y: -42 }, { x: 18, y: -42 },
]

export const DEAGLE = { damage: 50, cooldownMs: 600, ammoStart: 10, ammoMax: 20 }
export const KNIFE  = { damage: 35, cooldownMs: 250, reach: 2.1, arc: Math.PI * (120 / 180) }
```

- [ ] **Step 2: write `shared/combat.js`**

```js
export function pickSpawnSlotIndex(usedIndexes, count) {
  for (let i = 0; i < count; i++) if (!usedIndexes.has(i)) return i
  return 0 // all slots used — wrap (room is effectively capped first-free anyway)
}

export function knifeArcHit({ origin, yaw, target, reach, arc }) {
  const dx = target.x - origin.x, dy = target.y - origin.y
  const distSq = dx * dx + dy * dy
  if (distSq > reach * reach || distSq === 0) return false
  const forward = { x: Math.cos(yaw), y: Math.sin(yaw) } // forward = +X local
  const len = Math.sqrt(distSq)
  const dot = (dx / len) * forward.x + (dy / len) * forward.y
  return dot >= Math.cos(arc / 2)
}
```

- [ ] **Step 3: write `tests/combat.test.mjs`**

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pickSpawnSlotIndex, knifeArcHit } from '../shared/combat.js'

test('spawn picker takes lowest free slot', () => {
  assert.equal(pickSpawnSlotIndex(new Set(), 4), 0)
  assert.equal(pickSpawnSlotIndex(new Set([0, 1]), 4), 2)
  assert.equal(pickSpawnSlotIndex(new Set([0, 1, 2, 3]), 4), 0)
})

test('knife arc hits in front within reach', () => {
  const o = { x: 0, y: 0 }
  assert.equal(knifeArcHit({ origin: o, yaw: 0, target: { x: 2.0, y: 0.5 }, reach: 2.1, arc: Math.PI * (120 / 180) }), true)
})

test('knife arc misses behind and out of reach', () => {
  const o = { x: 0, y: 0 }
  assert.equal(knifeArcHit({ origin: o, yaw: 0, target: { x: -1, y: 0 }, reach: 2.1, arc: Math.PI * (120 / 180) }), false)
  assert.equal(knifeArcHit({ origin: o, yaw: 0, target: { x: 5, y: 0 }, reach: 2.1, arc: Math.PI * (120 / 180) }), false)
})
```

- [ ] **Step 4: run tests**

Run: `node --test`
Expected: PASS (3 tests)

- [ ] **Step 5: commit**

```bash
git add shared/ tests/ && git commit -m "Add shared foot-combat tuning and pure spawn/knife helpers"
```

---

## Task 3: Server — capsule players, meteor removal, deterministic arena spawn, event rename

**Files:**
- Replace: `server/src/PlayerCar.js` → `server/src/PlayerFoot.js` (git mv)
- Modify: `server/src/PhysicsWorld.js`, `server/src/GameRoom.js`
- Test: `node --check` on each; server smoke after deps install

**Interfaces produced:** `PhysicsWorld.addPlayer(id, {x,y,z})`, `.removePlayer(id)`, `.step(delta)`; Farther tasks keep `GameRoom` internals private — client only sees socket events.

- [ ] **Step 1: `git mv server/src/PlayerCar.js server/src/PlayerFoot.js`** and rewrite its body to a compound capsule (drop RaycastVehicle, wheels, bumper impulses):

```js
import CANNON from 'cannon'
import { FOOT } from '../../shared/constants.js'

export class PlayerFoot {
  constructor(world, spawnPos = { x: 0, y: 0, z: FOOT.spawnZ }) {
    const r = FOOT.radius
    this.body = new CANNON.Body({ mass: FOOT.mass })
    this.body.allowSleep = false
    this.body.fixedRotation = true                      // never tips (cannon 0.6.2 has no angularFactor)
    this.body.addShape(new CANNON.Cylinder(r, r, FOOT.cylinderHeight, 12)) // axis = Z (cannon default)
    this.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0,  FOOT.cylinderHeight / 2))
    this.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0, -FOOT.cylinderHeight / 2))
    this.body.position.set(spawnPos.x, spawnPos.y, spawnPos.z)
    world.addBody(this.body)
  }
  applyActions() {}   // client-authoritative on the wire; server physics is only for collision realism
  removeFromWorld(world) { world.remove(this.body) }
}
```

- [ ] **Step 2: `PhysicsWorld.js`** — rename `cars`→`players`; constructor sets floor (keep plane), new `addPlayer/removePlayer/step` delegating to `PlayerFoot`; delete `getSnapshot()` + `applyInputs` delegation glue for vehicles. Keep `DEFAULT` zero-control path.

- [ ] **Step 3: `GameRoom.js`** —
  1. Delete `_startMeteorShower()` and its constructor call (was lines ~18–36, `this._startMeteorShower()`).
  2. Import `ARENA_SPAWN_GRID, FOOT` from shared constants and `pickSpawnSlotIndex` from `../../shared/combat.js`.
  3. In constructor add `this._spawnSlots = new Set()`.
  4. Replace `_getSpawnPosition()` with:

```js
_getSpawnPosition() {
  const index = pickSpawnSlotIndex(this._spawnSlots, ARENA_SPAWN_GRID.length)
  this._spawnSlots.add(index)
  const { x, y } = ARENA_SPAWN_GRID[index]
  return { x, y, z: FOOT.spawnZ, index }
}
```

  5. In `player:join` handler: `this.players.set(id, { ..., spawnIndex: spawnPos.index, spawnXY: { x, y }, ... })`; emit `room:joined` with `spawnPos: { x, y, z: FOOT.spawnZ, index: spawnPos.index }` (z was previously dropped — include it now).
  6. In `disconnect`: `this._spawnSlots.delete(player.spawnIndex)` **before** deleting the record.
  7. `player:ready` handler: reset to `(x, y, FOOT.spawnZ)`, identity quaternion, zero velocities (same shape as before, minus -90° Z rotation).
  8. Rename: `combat:carDestroyed` → `combat:playerDown` (relay handler). Keep `player:combatDamage` untouched.
  9. Remove `player:bump`/`player:bumped`? **No — keep** (capsule bump relay is still used by Task 6).

- [ ] **Step 4: syntax-check both sides + commit**

```bash
node --check server/src/GameRoom.js && node --check server/src/PlayerFoot.js && node --check server/src/PhysicsWorld.js
git add server shared && git commit -m "Server: capsule players, arena spawn indices, drop meteors, rename destroy event"
```

---

## Task 4: Client physics — strip vehicle layer, add capsule `setFootPlayer`

**Files:** `client/src/javascript/World/Physics.js` (edit heavily: keep setWorld/setModels/setMaterials/setFloor/addObjectFromThree, delete chassis/wheels/RaycastVehicle/jump/recreate and the collide bumper block except the `isBumperCar` detection)
**Delete (git rm):** `World/Car.js`, `World/RemoteCar.js`, `World/RemoteCarManager.js` — replacements land in Task 5.

- [ ] **Step 1: git rm** the three vehicle-model files.

- [ ] **Step 2: in `Physics.js`**: delete everything car-specific (chassis creation through bump relays); keep:
  - `setWorld`, `setMaterials` (add one line: `this.materials.items.foot = new CANNON.Material('foot')` + contact pair `floor×foot: { friction: 0.8, restitution: 0 }` in the existing contact-material loop), `setFloor`, `addObjectFromThree`, debug `models.container`.

- [ ] **Step 3: add `setFootPlayer()`** (called where `setCar` was called):

```js
setFootPlayer() {
  const r = FOOT.radius
  this.foot = {}
  this.foot.body = new CANNON.Body({ mass: FOOT.mass, material: this.materials.items.foot })
  this.foot.body.allowSleep = false
  this.foot.body.fixedRotation = true   // never tips
  this.foot.body.addShape(new CANNON.Cylinder(r, r, FOOT.cylinderHeight, 12))
  this.foot.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0,  FOOT.cylinderHeight / 2))
  this.foot.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0, -FOOT.cylinderHeight / 2))
  this.foot.body.linearDamping = 0.9          // no ice-skating
  this.foot.body.position.set(0, 0, FOOT.spawnZ)
  this.world.addBody(this.foot.body)

  // Reuse the old bumper-car collide handler, keyed on isBumperCar —
  // the body we collide with now belongs to a RemotePlayer.
  this.foot.body.addEventListener('collide', (event) => {
    const body = event.body
    if (body?.isBumperCar && this.foot.onBump) {
      const now = performance.now()
      if (this.foot.lastBumpTime && now - this.foot.lastBumpTime < 400) return
      this.foot.lastBumpTime = now
      this.foot.onBump(body.remotePlayerId)
    }
  })

  this.foot.receiveBump = () => { /* small shake + sound only, no impulse — fits a foot duel */ }
  this.foot.jump = () => { this.foot.body.velocity.z = FOOT.jumpVelocity }
}
```

Imports at top: `import { FOOT } from '../../../shared/constants.js'`.

- [ ] **Step 4: keep world stepping** (`time.on('tick', () => this.world.step(delta))`) untouched.

- [ ] **Step 5: commit** — `git add -A && git commit -m "Client physics: strip vehicle layer, add foot capsule body"` (repo does **not** build yet; Task 8 wires World)

---

## Task 5: Player (local) and RemotePlayer (puppet) modules

**Files:**
- Create: `client/src/javascript/World/Player.js` (local visual + movement intent)
- Create: `client/src/javascript/World/RemotePlayer.js`
- Create: `client/src/javascript/World/RemotePlayerManager.js`

**Contracts (consumed by Task 8):**
- `new Player({ physics, time, scene, shadows, camera, controls, sounds, config })`; exposes `.container` (THREE group), `.position` (Vector3 alias of body position), `.yaw` (radians), `.mesh` (group of primitives), `.setVisible(bool)`, `.update()`.
- `RemotePlayerManager({ scene, network, camera, sizes, getPhysicsWorld })` with `.update()` and `.cars` map retained under the name `.players` (Task 8 references `remotePlayerManager.players`).
- `RemotePlayer` mirrors `RemoteCar`'s interpolation exactly, minus wheels/templates: snapshots `{t, pos, quat, vel, angVel}` (drop `wheels` — Task 8 stops emitting it).

- [ ] **Step 1: `Player.js`** — build the low-poly human from matcap primitives added to `this.container`: head = `SphereGeometry(0.18, 8, 6)` z = +1.32; torso = `BoxGeometry(0.34, 0.2, 0.62)` z = +0.92; hips box z=+0.58; upper/lower limbs = thin boxes angled slightly forward (static pose, no anim for MVP); all `MeshMatcapMaterial` reusing an existing shade matcap (`matcaps/shadeRed` for torso, `matcapMetal` for limbs — reuse texture keys already in `Resources`); container position synced from body each tick; `shadows.add(container, { sizeX: 1, sizeY: 1, offsetZ: 0.1 })`.

- [ ] **Step 2: movement** — in `Player.update()` (tick): read `controls.actions` `{up, down, left, right, boost}`; forward = camera yaw vector (Task 6 sets `camera.yaw`): `const yaw = camera.yaw`; axes `f = (cos yaw, sin yaw)`, `r = (-sin yaw, cos yaw)`; `wish = f*(up?1:0 - down?1:0) + r*(right?1:0 - left?1:0)`; normalize; `speed = FOOT.runSpeed * (boost ? FOOT.sprintMultiplier : 1)`; `body.velocity.x = wish.x*speed; body.velocity.y = wish.y*speed` (leave z — gravity/jump own it). Also record `.yaw` from the same vector for mesh rotation (`container.rotation.z = Math.atan2(wish.y, wish.x)` when moving; otherwise keep last).

- [ ] **Step 3: `RemotePlayerManager.js`** — copy `RemoteCarManager.js` structure; replace `_buildTemplates` with nothing (no GLB); on `player:joined` create `RemotePlayer` (passing `color: data.carColor`), on `player:left` destroy, on `room:joined` seed existingPlayers, on `world:snapshot` feed `addSnapshot` (skip `network.localId`).

- [ ] **Step 4: `RemotePlayer.js`** — copy `RemoteCar.js` interpolation (80 ms render delay via `NETWORK.interpolationDelay`, 3 s buffer, extrapolate ≤ 250 ms); geometry: same primitive human as local Player (factor the human-building into `World/humanMesh.js` used by both — one function `buildHumanMesh(colorHex)`); name label div `.remote-player-label` (reuse existing CSS class); lazy static bumper body: `CANNON.Body({ mass: 0 })` + `CANNON.Cylinder(r, r, FOOT.cylinderHeight, 8)` + two spheres, `isBumperCar = true`, `remotePlayerId = id`; sync to interpolated pose each snapshot; `destroy()` removes body + DOM label.

- [ ] **Step 5: commit** — `git commit -m "Add primitive-human Player and RemotePlayer puppets"`

---

## Task 6: Camera — over-the-shoulder pointer-lock aim

**Files:** `client/src/javascript/Camera.js`, `client/src/index.html` (aim overlay), `client/src/styles/redline.css` (aim/crosshair styles)

- [ ] **Step 1: rework `Camera.js`** — keep class shell. Replace `setPan` (disable; `pan.enabled = false`) and orbitControls (stays disabled) usage; **delete the dead `setZoom()` method and any `zoom.*` references** (no readers after the wheel handler moves); add:

```js
setAim() {
  this.yaw = Math.PI / 2          // face +Y (into arena center from south spawn)
  this.pitch = 0.35               // slight downward tilt
  this.pitchMin = -0.2; this.pitchMax = 1.1
  this.sensitivity = 0.0023
  this.distance = 4.2             // shoulder offset (replaces zoom default)
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== this.renderer.domElement) return
    this.yaw   -= e.movementX * this.sensitivity
    this.pitch += e.movementY * this.sensitivity
    this.pitch = Math.min(this.pitchMax, Math.max(this.pitchMin, this.pitch))
  })
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === this.renderer.domElement
    document.getElementById('aim-prompt')?.classList.toggle('hidden', locked)
    document.getElementById('crosshair')?.classList.toggle('hidden', !locked)
  })
  this.renderer.domElement.addEventListener('click', () => {
    if (document.pointerLockElement !== this.renderer.domElement) {
      this.renderer.domElement.requestPointerLock()
    }
  })
}
```

`setInstance()` tick replacement: the view forward is `(cos yaw, sin yaw)` (matches Player movement in Task 5), so the camera sits BEHIND: `offset = (-cos yaw*cos pitch, -sin yaw*cos pitch, sin pitch) * distance`; `instance.position.copy(targetEased).add(offset)`; `instance.lookAt(targetEased)` — z-up `up` stays `(0,0,1)`. The offset is the negative of the view direction: Task 5 walks INTO the screen with W.

- [ ] **Step 2: crosshair & aim prompt DOM** (append into `<body>` overlay area):

```html
<div id="crosshair" class="hidden"><div class="ch-dot"></div></div>
<div id="hitmarker" class="hidden">✕</div>
<div id="aim-prompt">Click to enable mouse aim</div>
```

CSS (`styles/redline.css`): `#crosshair` fixed center, 14px ring + 2px dot, redline `#FF2E4D`; `#hitmarker` center ✕, flashes 120 ms on `.flash`; `#aim-prompt` fixed center-bottom pill, semi-transparent, pointer-events none; `.hidden { display: none !important }`.

- [ ] **Step 3: `Controls.js`** — add LMB fire: in `setKeyboard.keyDown` nothing needed (mouse handled by camera); add separate mousedown listener: if `document.pointerLockElement === renderer.domElement` on `mousedown` (button 0) → `this.trigger('action', ['fire'])`. Unify ALL weapon-swap input onto one bus `swap` with a payload, gated on pointer lock (same guard as LMB fire): `KeyQ` → `trigger('swap', [0])` (toggle), mousewheel → `trigger('swap', [deltaY > 0 ? 1 : -1])`, `Digit1` → `trigger('swap', ['deagle'])`, `Digit2` → `trigger('swap', ['knife'])`. Task 8 interprets the payload: `'deagle'`/`'knife'` → `weapons.select(payload)`; `±1` → step; `0` → `weapons.swap()`. The camera zoom wheel handler stays deleted. Scrolling menus/chat must not swap weapons.

- [ ] **Step 4: `ControlsOverlay.js`** — chips must include a `W A S D` chip with desc `MOVE`; full list: `WASD MOVE · SHIFT SPRINT · SPACE JUMP · F FIRE · 1/2 WEAPON (now bound to Digit1/Digit2) · Q/wheel swap` — every chip carries a desc label.

- [ ] **Step 5: commit** — `git commit -m "Over-the-shoulder pointer-lock camera with crosshair and aim prompt"`

---

## Task 7: Weapons — Deagle, Knife, coordinator

**Files:** Create `client/src/javascript/World/Deagle.js`, `Knife.js`, `humanMesh.js` (done in Task 5); **overwrite** `client/src/javascript/World/Weapons.js` as slim coordinator; **delete** missile internals (they die with the overwrite).

**Interfaces produced (Task 8 wires these):** `weapons.fire()`, `weapons.current` (`'deagle'|'knife'`), `weapons.ammo`, `weapons.addAmmo(n)`, `weapons.update(dt)`, `weapons.swap()`, `weapons.select('deagle'|'knife')`, plus callbacks `onHitCar(id, dmg)` (reuse name) and `onHitLocal()`; and `weapons.getHUD()` returning `{ name, ammoLabel }` — Task 8 writes DOM from it.

Viewmodels: build the Deagle (box + cylinder stub, matcap metal) and the knife (tapered box blade, matcap metal + red handle) as primitive meshes, attach both to a `viewmodel` group added to `camera.instance` (camera local space: forward is **−Z**, so place the group at ~`(0.32, -0.28, -0.6)`, i.e. lower-right of frame), and toggle child visibility on `select()`. Hits are raycast from the camera so the viewmodel is cosmetic only. The `hitmarker` element (`#hitmarker`, already in DOM from Task 6) is flashed via `classList.add('flash')` + `setTimeout(() => classList.remove('flash'), 120)` in `_hitmarker()`.

- [ ] **Step 1: Deagle fire path** (camera raycast):

```js
fire() {
  if (this.cooldownUntil > performance.now() || this.ammo <= 0) return false
  this.ammo--
  this.cooldownUntil = performance.now() + DEAGLE.cooldownMs
  this._muzzleFlash()                       // sprite at camera, 60 ms
  const dir = new THREE.Vector3(0, 0, 0)    // screen center — build from camera
  // origin at camera instance world position; direction = camera forward (world)
  const origin = this.camera.instance.getWorldPosition(new THREE.Vector3())
  const forward = new THREE.Vector3(1, 0, 0) // z-up: forward may vary — derive from camera
  forward.set(0, 0, 0).subVectors(this.camera.targetEased, origin).normalize()
  const ray = new THREE.Raycaster(origin, forward, 0, 120)
  const hits = ray.intersectObjects(this.targets(), true)   // remote player meshes + arena collision meshes
  const hit = hits.find(h => h.distance > 0.1)
  if (hit) {
    const rp = this.remoteHitOf(hit.object)                 // walk up parents to find userData.remotePlayerId
    if (rp) { this.onHitCar?.(rp, DEAGLE.damage); this._hitmarker() }
  }
  this._tracer(origin, forward, hit?.distance ?? 100)       // additive Line, fade 80 ms
  return true
}
```

`targets()` = arena static meshes (mark them `userData.solid = true` in `Arena.js`/`Objects.js` when building collision GLBs — Task 8 adds that) + `remotePlayerManager.players` meshes. `hit?.distance` clamps the tracer.

Sound: `sounds.play('carHit', 12)` for the shot (closest existing boom; recorded stopgap).

- [ ] **Step 2: Knife fire path** — uses Task 2's `knifeArcHit`:

```js
fire() {
  if (this.cooldownUntil > performance.now()) return false
  this.cooldownUntil = performance.now() + KNIFE.cooldownMs
  this._swing()                              // 200 ms gsap rotate of knife mesh on camera
  const me = this.playerPosition()            // local body position (x,y)
  const yaw = this.camera.yaw                 // view forward = (cos yaw, sin yaw) — same angle Player uses
  for (const [id, rp] of this.remotes) {
    const p = rp.container.position
    if (knifeArcHit({ origin: me, yaw: yaw, target: { x: p.x, y: p.y }, reach: KNIFE.reach, arc: KNIFE.arc })) {
      this.onHitCar?.(id, KNIFE.damage)
      this._hitmarker()
    }
  }
  this.sounds?.play('bowlingPin', 6)          // stopgap slash sound
  return true
}
```

View forward equals `(cos yaw, sin yaw)` — the same angle the movement code uses; the camera is placed BEHIND the player (offset = negated forward).

- [ ] **Step 3: coordinator `Weapons.js`** — holds `deagle`, `knife`, `current='deagle'`, `ammo = DEAGLE.ammoStart` shared with Deagle; `fire()` delegates; `swap()` toggles; `step(direction)` moves `DEAGLE↔KNIFE` by `direction` (clamped, `±1`); `select(name)` sets `current` to `'deagle'|'knife'` (ignores invalid); swaps arrive via `controls.on('swap', (payload) => …)`: `'deagle'`/`'knife'` → `select(payload)`, `±1` → `step(payload)`, `0` → `swap()` (Task 8 wires); `getHUD()` returns `{ name: current.toUpperCase(), ammoLabel: current==='deagle' ? '×'+this.ammo : '∞' }`; keeps the class name `Weapons` so Task 8's `setCombat` edits stay local.

- [ ] **Step 4: delete meteor spawn/update paths** (already deleted server-side in Task 3); remove `import Meteors` consumers in Task 8.

- [ ] **Step 5: commit** — `git commit -m "Add Deagle hitscan, Knife arc melee and slim weapon coordinator"`

---

## Task 8: World wiring — the big splice of `World/index.js`

**Files:** `client/src/javascript/World/index.js`, `client/src/index.html` (weapon label), `client/src/javascript/ControlsOverlay.js` (already done), `client/src/javascript/World/Arena.js` (tag collision meshes `userData.solid`), `client/src/javascript/World/Objects.js` (same tag)

Work through `World/index.js` **in order**; the pinned sections are marked by current line numbers (from the fork at import).

- [ ] **Step 1: imports** — minus `Track, LapTimer, HUD, Minimap, BoostPads, SkidMarks, SmokeParticles, Meteors, RemoteCarManager, Arena.ARENA_SPAWN_GRID`; plus `Player, RemotePlayerManager, weapons stays`.

```bash
git rm -r remotion ecosystem.config.cjs
```

- [ ] **Step 2: mode stays internal `combat`** (rename would churn everything; README calls it the knife-deagle mode). Delete the `race` branches and their calls: `setMinimap`, `setLapTimer`, `setSectorMarkers`, `setHUD`, `_setupOffTrackDetection`, `_setupWrongWayDetection`, `_setupRaceEnd`, `_setupBoostPads`, race parts of `_showCountdown`, Track `setTrack`. Delete `setReveal`'s lap-timer reference comment only (keep reveal). Replace `setSkidMarks/setSmokeParticles` block with nothing.

- [ ] **Step 3: `setPhysics`** — construct `new Physics(...)` then `physics.setFootPlayer()` (Task 4).

- [ ] **Step 4: two-phase start** — `room:joined` handler: `this._serverSpawnPos = { x, y, z, index }` honored as-is; **delete the `ARENA_SPAWN_GRID[0]` remap** (was lines ~338–339); spawn uses `z` from server (Task 3 emits it).

- [ ] **Step 5: `reveal.go`** — `body.position/sleep/wakeUp` block → use `physics.foot.body`, `spawnPos {x, y, z: spawnPos.z ?? FOOT.spawnZ}`, identity quaternion.

- [ ] **Step 6: `setArena`** — keep; delete the remap lines; keep `this.arena` exposed. Tag arena collision meshes: after creating Arena, `this.arena.container.traverse(o => { if (o.isMesh) o.userData.solid = true })` — same for `Objects` container.

- [ ] **Step 7: remotes** — replace `setRemoteCars` body with RemotePlayerManager equivalents (same room:joined/left/world:snapshot flow); `remoteCarManager` name → `remotePlayerManager` everywhere; drop `_setupBumpHandling` impulse flavor, keep `physics.foot.onBump = (targetId) => network.sendBump(targetId)` + `player:bumped` → shake + `carHit`.

- [ ] **Step 8: `setPlayer`** (was setCar) — construct `new Player(...)`; `_setupYouLabel` stays (labels `.remote-player-label`/YOU above head — reuse); camera target each tick = player position + z 1.1 (already eased in Task 6 Camera rework — set `this.camera.target.set(p.x, p.y, p.z + 1.1)` in a new small tick inside `setPlayer`); **delete `_setupCameraEffects` FOV/steering look-ahead** (or reduce to static FOV — keep function minimal: no speed readout anymore). `_setupJump` → `controls.on('action','jump')` → `physics.foot.jump()` gated on grounded: `Math.abs(body.velocity.z) < 2`. Do **not** re-add an R-respawn/teleport handler — manual respawn was removed from the project (death auto-respawns via HealthSystem's 3 s countdown).

- [ ] **Step 9: `setCombat`** — rewire against Tasks 5–7:
  - `this.weapons = new Weapons({ scene, physics: this.physics, remotePlayerManager: this.remotePlayerManager, player: this.player, camera: this.camera, sounds: this.sounds, onHitCar: (id, dmg) => { this.network?.sendCombatDamage(id, dmg); (this._recentDamage ??= new Map()).set(id, Date.now()) }, onFire: () => this.sounds?.play('carHit', 10) })`
  - `controls.on('action', 'fire')` → `weapons.fire()`; `NO AMMO` toast on false return stays.
  - `controls.on('swap', (payload) => { payload === 'deagle' || payload === 'knife' ? weapons.select(payload) : payload === 0 ? weapons.swap() : weapons.step(payload) })` then `_updateCombatHUD()`. (Unified swap bus from Task 6 — never `action`.)
  - **Network.js (`client/src/javascript/Network.js`)**: rename `sendCarDestroyed(...)` → `sendPlayerDown(x, y, z, vx, vy, color)` emitting `combat:playerDown`; rename the `combat:carDestroyed` socket listener → `combat:playerDown`; delete `sendMissileFired`, `sendExplosion`, the `combat:missile`/`combat:explosion`/`combat:meteor` senders/listeners entirely.
  - `_updateCombatHUD()`: `#hp-fill/#hp-val` as before; `#weapon-ammo` = `weapons.getHUD().ammoLabel`; `#weapon-name` (new span in #weapon-status — Task 8 index.html edit) = `DEAGLE`/`KNIFE`.
  - `GOT AMMO pickup` unchanged → `weapons.addAmmo(value)`.
  - Death/respawn handlers: `_destroyLocalCar` hides `player.container`, sends `sendPlayerDown(x, y, z, vx, vy)` (renamed), shows `#death-overlay`; `_showLocalCar` re-shows; `weapons ammo = DEAGLE.ammoStart` on respawn.
  - Remote puppet events: `combat:playerDown` → build a one-shot particle burst inline (THREE.Points, ~40 additive particles, 0.5 s life, random sphere velocities, world z-up) at the victim's last snapshot position + hide `remotePlayerManager.players[id]` for 3 s (do not import anything from the deleted Weapons.js).
  - Minimap: `ArenaMinimap` — rename its `_options.remoteCarManager` to `remotePlayerManager` and the loop at ~line 211 from `.cars.values()` to `.players.values()` (verify it reads only `.container.position` and a color field — both exist on RemotePlayer); keep the rest unchanged. Remove race `Minimap` refs.
  - **Speed pads**: `HazardZones.js` — the two corridor boost zones currently apply `force` along velocity; change to: while `foot.body` stays within the zone radius, scale `velocity.x/y` by 1.6 on each `update(dt)` tick (do not touch z). Rename the zone entries to `speed: true` (or similar — keep class shape minimal).
  - `_setupCombatEnd`: rename event listener to `combat:playerDown`; heuristic unchanged (1500 ms, `#kill-counter`, `#race-complete` reused).
  - Toasts keep writing `#hud-lap-note`.
  - Delete: `_setupSnapshotSender` **unchanged** except drop `wheels` from the emitted state (emit `{pos, quat, vel, angVel}` only); delete meter/meteor tick lines; combat tick = `weapons.update, pickups, hazardZones, arenaMinimap`.

- [ ] **Step 10: index.html** — `#weapon-status` inner: `🦅 <span id="weapon-name">DEAGLE</span> <span id="weapon-ammo">×10</span>`; `#death-title` copy → `💀 DOWN`; add `aria-hidden` on crosshair.

- [ ] **Step 11: build**

Run: `npm run build`
Expected: `✓ built` (fix whatever the splice missed — mostly dangling references to deleted identifiers. Deterministic check: `grep -n "car\|Car\|Track\|LapTimer\|Meteor\|Skid\|Smoke\|boostPads\|RemoteCar\|sendMissileFired\|sendExplosion\|combat:missile\|combat:explosion\|combat:meteor\|combat:carDestroyed\|sendCarDestroyed" client/src/javascript/World/index.js client/src/javascript/Network.js` must print nothing but comments/attribution text)

- [ ] **Step 12: commit** — `git commit -m "Rewire world: on-foot combat, pointer-lock camera, arena spawn honored"`

Checkpoint A: build green before proceeding.

---

## Task 9: Controls polish + touch sanity + R binding removal

- [ ] **Step 0: remove the R→reset binding** — in `Controls.js` `setKeyboard()` `keyUp` handler, delete the `case 'KeyR': → trigger('action', ['reset'])` block. `git grep -n "'reset'\|KeyR"` must show nothing except unrelated uses; the death auto-respawn path (HealthSystem → World death handler) is the only respawn.

- [ ] **Step 1:** verify touch fire button triggers `fire` (already wired), joystick maps to `up/right/down/left` (foot controller reads the same booleans — works), boost → sprint. Nothing to add.
- [ ] **Step 2:** `Controls.js` visibilitychange reset already clears the same actions — no knife-specific keys get stuck.
- [ ] **Step 3:** pointer-lock edge: when pointer unlocked, `fire` trigger from keyboard F still calls `weapons.fire()` — gate it: in World fire handler, `if (document.pointerLockElement !== renderer.domElement) return` — implement inside `Player`? Simplest: in the `fire` action handler, bail unless locked or touch. Add that one-liner.
- [ ] **Step 4:** commit — `git commit -m "Require pointer lock for firing; verify touch path"`

---

## Task 10: Menu/branding/assets cleanup

- [ ] **Step 1: delete `LobbyPreview.js`** (already orphaned — zero references confirmed by grep) and its GLB list entries in `Resources.js` (`carDefault*`, `carCyberTruck*`) — also delete `client/static/models/car/` (git rm). Keep antenna/backLights/bowlingBall GLBs? They're only for the car — delete the car model folder wholesale; keep matcap textures.
- [ ] **Step 2: grep stragglers** — `grep -rni "car\b\|cybertruck\|missile\|meteor\|lap" client/src --exclude=*.glb -l` — each hit must be either intended (`combat`) or removed. `client/src/javascript/World/Environment.js` may reference gameMode names — leave as-is.
- [ ] **Step 3: title screen text** — `EntryFlow.js` title: replace "REDLINE" strings with "KNIFE DEAGLE FIGHT"; tagline "Two-hit Deagle. Swing first."; keep the title→lobby flow unchanged.
- [ ] **Step 4: build + commit** — `npm run build && git commit -m "Prune car assets, rebrand entry flow"`

Checkpoint B: build green with zero car/missile/meteor references except docs/LICENSE/attribution.

---

## Task 11: Two-profile verification (manual) + release commit

Use two browser profiles (or one normal + one incognito). `npm run dev` → open `http://localhost:5173` in both, join with two names.

- [ ] **Step 1:** both spawn at distinct arena slots (spawn fix regression — neither on slot 0 unless both).
- [ ] **Step 2:** movement: WASD camera-relative, Shift sprint visibly faster, Space jumps/lands, arena collisions (plateau, ramps, perimeter walls) stop you.
- [ ] **Step 3:** aim: click canvas → pointer locked, crosshair visible; Esc unlocks → aim prompt reappears; F without lock does nothing.
- [ ] **Step 4:** Deagle: 2 hits kill; tracer visible; hitmarker on confirmed hit; shot blocked by arena geometry; ammo decrements, pickups refill to +5, death resets to 10.
- [ ] **Step 5:** Knife: hits inside 2.1 m/120° arc only; behind you = no hit; 3 slashes kill; 250 ms swing cadence.
- [ ] **Step 6:** combat systems: heal zone +8 HP/s south side; speed pads boost corridor traversal; kill counter `/5`, `+1 KILL` toast, hitmarker; two-attackers-on-victim both get credit (expected); `#race-complete` VICTORY overlay at 5 kills; refresh → lobby rejoin works.
- [ ] **Step 7:** kill Attribution attribution event fires from renamed event — `grep -n "combat:playerDown" client/src server/src` non-empty, `git grep -n "combat:carDestroyed"` empty.
- [ ] **Step 8:** 20-client room cap unchanged (spot-check with a second server instance if handy — otherwise trust inherited behavior).
- [ ] **Step 9:** fix any failures inline; final commit `git commit -am "Verify two-profile MVP; ship 0.1.0"`; `git tag v0.1.0` optional.

---

## Spec coverage map

| Spec section | Task |
|---|---|
| Fork/upstream honor, MIT credit, .gitignore, name | 1 |
| SHARED combat tests (knife arc, spawn picker) | 2 |
| Deagle/Knife numbers, no reload | 2, 7 |
| Server: meteors out, deterministic spawn, `combat:playerDown`, capsule | 3 |
| Physics stripped, capsule body + bumper-collide reuse | 4 |
| Player + RemotePlayer primitive human, interpolation | 5 |
| Pointer-lock OTS camera, crosshair, aim prompt, no fallback | 6, 9 |
| Weapon swap 1/2/Q/wheel, LMB/F parity | 6, 7 |
| HUD: hp/ammo/kill counter/hitmarker/weapon-name, race UI deleted | 8, 10 |
| Pickups, heal zone, speed-pad conversion | 8 (HazardZones conversion lives in Task 8 — convert force-along-velocity to speed multiplier) |
| Spawn bug fix end-to-end | 2, 3, 8 |
| Race mode / cars / meteors / remotion / PM2 deleted | 4, 8, 10 (remotion + ecosystem deleted in Task 8 Step 1 via `git rm`) |
| Verification checklist (spec §Verification) | 11 |

**Known accepted limits (documented, not bugs):** client-trusted damage; both clients can declare victory simultaneously; knife sound is a stopgap; remote players don't see your tracer; camera clips geometry; spawn wraps past 4 players (20-player cap means slots repeat — inherent to 4 arena slots, unchanged from upstream design).
