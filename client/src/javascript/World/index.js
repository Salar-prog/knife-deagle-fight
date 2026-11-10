import * as THREE from 'three'
import Materials from './Materials.js'
import Floor from './Floor.js'
import Shadows from './Shadows.js'
import Physics from './Physics.js'
import Objects from './Objects.js'
import Areas from './Areas.js'
import Controls from './Controls.js'
import Sounds from './Sounds.js'
import RemotePlayerManager from './RemotePlayerManager.js'
import Arena from './Arena.js'
import gsap from 'gsap'
import ControlsOverlay from '../ControlsOverlay.js'
import Environment from './Environment.js'
import Player from './Player.js'
import Weapons from './Weapons.js'
import HealthSystem from './HealthSystem.js'
import CombatPickups from './CombatPickups.js'
import HazardZones from './HazardZones.js'
import ArenaMinimap from './ArenaMinimap.js'
import { ARENA_PICKUPS } from './CombatPickups.js'
import { FOOT, DEAGLE } from '../../../../shared/constants.js'

export default class World
{
    constructor(_options)
    {
        this.config    = _options.config
        this.debug     = _options.debug
        this.resources = _options.resources
        this.time      = _options.time
        this.sizes     = _options.sizes
        this.camera    = _options.camera
        this.scene     = _options.scene
        this.renderer  = _options.renderer
        this.passes    = _options.passes
        this.network   = _options.network || null

        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('world')
            this.debugFolder.open()
        }

        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        this.setSounds()
        this.setControls()
        this.setFloor()
        this.setAreas()
        this.setRemotePlayers()
        this.setStartingScreen()
    }

    // Called by Application when resources finish loading
    onResourcesReady()
    {
        this._resourcesReady = true
        this._tryStart()
    }

    // Called by Application (via LobbyUI callback) when solo mode lobby is submitted
    onSoloJoin()
    {
        this._playerJoined = true
        this._tryStart()
    }

    start()
    {
        window.setTimeout(() => { this.camera.pan.enable() }, 2000)

        // Mode stays internal 'combat' (knife-deagle mode) — no race branch.
        this.setReveal()
        this.setMaterials()
        this.setShadows()
        this.setPhysics()
        this.setArena()

        if(this.network) this._setupSnapshotSender()
        if(this.network) this._setupBumpHandling()
        this.setObjects()
        this.setPlayer()
        this.areas.car = this.player
        this._setupYouLabel()

        this.setEnvironment()
        this._setupMuteButton()
        this._setupCameraEffects()
        this._setupJump()

        this.setCombat()
        this._setupCombatEnd()
    }

    setReveal()
    {
        this.reveal = {}
        this.reveal.matcapsProgress = 0
        this.reveal.floorShadowsProgress = 0
        this.reveal.previousMatcapsProgress = null
        this.reveal.previousFloorShadowsProgress = null

        this.reveal.go = () =>
        {
            gsap.fromTo(this.reveal, { matcapsProgress: 0 }, { matcapsProgress: 1, duration: 3 })
            gsap.fromTo(this.reveal, { floorShadowsProgress: 0 }, { floorShadowsProgress: 1, duration: 3, delay: 0.5 })
            gsap.fromTo(this.shadows, { alpha: 0 }, { alpha: 0.5, duration: 3, delay: 0.5 })

            const spawn = this._serverSpawnPos || { x: 5, y: -35 }
            this.physics.foot.body.sleep()
            this.physics.foot.body.position.set(spawn.x, spawn.y, spawn.z ?? FOOT.spawnZ)
            this.physics.foot.body.quaternion.set(0, 0, 0, 1)

            window.setTimeout(() =>
            {
                this.physics.foot.body.wakeUp()
                if(this.network) this.network.playerReady()
            }, 300)

            gsap.fromTo(this.sounds.engine.volume, { master: 0 }, { master: 0.7, duration: 0.5, delay: 0.3, ease: 'power2.in' })
            window.setTimeout(() => { this.sounds.play('reveal') }, 400)

            if(this.controls.touch)
            {
                window.setTimeout(() => { this.controls.touch.reveal() }, 400)
            }

            if(!this.controls.touch)
            {
                const overlay = new ControlsOverlay()
                window.setTimeout(() => overlay.show(), 1500)
            }

            // Start lights then start lap timer
            window.setTimeout(() => this._showCountdown(), 800)
        }

        this.time.on('tick', () =>
        {
            if(this.reveal.matcapsProgress !== this.reveal.previousMatcapsProgress)
            {
                for(const _materialKey in this.materials.shades.items)
                {
                    this.materials.shades.items[_materialKey].uniforms.uRevealProgress.value = this.reveal.matcapsProgress
                }
                this.reveal.previousMatcapsProgress = this.reveal.matcapsProgress
            }

            if(this.reveal.floorShadowsProgress !== this.reveal.previousFloorShadowsProgress)
            {
                for(const _mesh of this.objects.floorShadows)
                {
                    _mesh.material.uniforms.uAlpha.value = this.reveal.floorShadowsProgress
                }
                this.reveal.previousFloorShadowsProgress = this.reveal.floorShadowsProgress
            }
        })
    }

    setStartingScreen()
    {
        this._resourcesReady = false
        this._playerJoined   = false

        // In solo mode, resources ready is the only gate (player "joins" via lobby submit)
        // In multiplayer, we also wait for room:joined (handled in setRemotePlayers)

        this._tryStart = () =>
        {
            if(!this._resourcesReady || !this._playerJoined) return
            this._tryStart = () => {}  // prevent double-start
            this.start()
            window.setTimeout(() => { this.reveal.go() }, 600)
        }
    }

    setSounds()
    {
        this.sounds = new Sounds({ debug: this.debugFolder, time: this.time })
    }

    setControls()
    {
        this.controls = new Controls({
            config: this.config,
            sizes:  this.sizes,
            time:   this.time,
            camera: this.camera,
            sounds: this.sounds
        })
    }

    setMaterials()
    {
        this.materials = new Materials({ resources: this.resources, debug: this.debugFolder })
    }

    setFloor()
    {
        this.floor = new Floor({ debug: this.debugFolder })
        this.container.add(this.floor.container)
    }

    setShadows()
    {
        this.shadows = new Shadows({
            time:     this.time,
            debug:    this.debugFolder,
            renderer: this.renderer,
            camera:   this.camera
        })
        this.container.add(this.shadows.container)
    }

    setPhysics()
    {
        this.physics = new Physics({
            config:   this.config,
            debug:    this.debug,
            scene:    this.scene,
            time:     this.time,
            sizes:    this.sizes,
            controls: this.controls,
            sounds:   this.sounds
        })
        this.container.add(this.physics.models.container)
    }

    setObjects()
    {
        this.objects = new Objects({
            time:      this.time,
            resources: this.resources,
            materials: this.materials,
            physics:   this.physics,
            shadows:   this.shadows,
            sounds:    this.sounds,
            debug:     this.debugFolder
        })
        this.container.add(this.objects.container)
        this.objects.container.traverse(o => { if (o.isMesh) o.userData.solid = true })
    }

    setPlayer()
    {
        this.player = new Player({
            physics:  this.physics,
            time:     this.time,
            scene:    this.scene,
            shadows:  this.shadows,
            camera:   this.camera,
            controls: this.controls,
            sounds:   this.sounds,
            config:   this.config
        })
        this.time.on('tick', () =>
        {
            if(!this.player) return
            this.player.update()
            const p = this.player.position
            this.camera.target.set(p.x, p.y, p.z + 0.85)
        })
    }

    setAreas()
    {
        this.areas = new Areas({
            config:    this.config,
            resources: this.resources,
            debug:     this.debug,
            renderer:  this.renderer,
            camera:    this.camera,
            car:       this.player,
            sounds:    this.sounds,
            time:      this.time
        })
        this.container.add(this.areas.container)
    }

    setArena()
    {
        this.arena = new Arena({
            world:         this.physics.world,
            floorMaterial: this.physics.materials.items.floor,
            resources:     this.resources,
        })
        this.container.add(this.arena.container)
        this.arena.container.traverse(o => { if (o.isMesh) o.userData.solid = true })
    }

    setRemotePlayers()
    {
        if(!this.network) return

        this.controls.network = this.network

        this._serverSpawnPos = null
        this.network.on('room:joined', ({ spawnPos }) =>
        {
            this._serverSpawnPos = spawnPos
            this._playerJoined = true
            this._tryStart?.()
        })

        this.remotePlayerManager = new RemotePlayerManager({
            scene:           this.scene,
            resources:       this.resources,
            network:         this.network,
            camera:          this.camera,
            sizes:           this.sizes,
            getPhysicsWorld: () => this.physics?.world,
        })

        this.time.on('tick', () => { this.remotePlayerManager.update() })
    }

    _setupSnapshotSender()
    {
        let _lastSend = 0
        this.time.on('tick', () =>
        {
            if(!this.network || !this.physics) return
            const now = Date.now()
            if(now - _lastSend < 50) return
            _lastSend = now

            const body = this.physics.foot.body

            this.network.sendSnapshot({
                pos:    [body.position.x,        body.position.y,        body.position.z],
                quat:   [body.quaternion.x,      body.quaternion.y,      body.quaternion.z,      body.quaternion.w],
                vel:    [body.velocity.x,        body.velocity.y,        body.velocity.z],
                angVel: [body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z],
            })
        })
    }

    _setupBumpHandling()
    {
        this.physics.foot.onBump = (targetId) =>
        {
            this.network.sendBump(targetId)
        }

        this.network.on('player:bumped', () =>
        {
            this.sounds.play('carHit', 10)
            this._shakeCamera()
        })
    }

    _shakeCamera()
    {
        const canvas = document.querySelector('canvas')
        if(!canvas) return
        canvas.style.transition = 'none'
        canvas.style.transform  = `translate(${(Math.random() - 0.5) * 10}px, ${(Math.random() - 0.5) * 10}px) rotate(${(Math.random() - 0.5) * 0.6}deg)`
        requestAnimationFrame(() =>
        {
            canvas.style.transition = 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            canvas.style.transform  = 'translate(0, 0) rotate(0deg)'
        })
    }

    _setupYouLabel()
    {
        const $you = document.getElementById('mp-you')
        if(!$you) return

        $you.textContent   = this.network?.localPlayerName || this.config.playerName || 'YOU'
        $you.style.display = 'block'

        this.time.on('tick', () =>
        {
            if(!this.player?.position) return

            const worldPos = this.player.position.clone()
            worldPos.z    += 1.5
            const projected = worldPos.project(this.camera.instance)

            if(projected.z > 1) { $you.style.display = 'none'; return }

            const x = (projected.x *  0.5 + 0.5) * this.sizes.viewport.width
            const y = (projected.y * -0.5 + 0.5) * this.sizes.viewport.height
            $you.style.display = 'block'
            $you.style.left    = `${x}px`
            $you.style.top     = `${y}px`
        })
    }

    // Space — foot jump, only fires when grounded (small vertical speed)
    _setupJump()
    {
        this.controls.on('action', (name) =>
        {
            if(name !== 'jump') return
            if(this.healthSystem?.isDead?.()) return

            const body = this.physics?.foot?.body
            if(!body) return
            if(Math.abs(body.velocity.z) >= 2) return

            this.physics.foot.jump()
            this.sounds?.play('uiArea', 0)
        })
    }

    setEnvironment()
    {
        this.environment = new Environment({
            resources: this.resources,
            renderer:  this.renderer,
            gameMode:  this.config.gameMode || 'arcade',
        })
        this.container.add(this.environment.container)
    }

    _setupCameraEffects()
    {
        // No speed-driven FOV on foot — keep a static FOV.
    }

    // ── Combat (knife + deagle, on foot) ─────────────────────────────────────

    setCombat()
    {
        // ── Weapon system ──
        this.weapons = new Weapons({
            scene:               this.scene,
            physics:             this.physics,
            remotePlayerManager: this.remotePlayerManager || null,
            player:              this.player,
            camera:              this.camera,
            sounds:              this.sounds,
            resources:           this.resources,
            onHitCar: (id, dmg) =>
            {
                if(this.network) this.network.sendCombatDamage(id, dmg)
                // Record damage so _setupCombatEnd can attribute kills
                if(!this._recentDamage) this._recentDamage = new Map()
                this._recentDamage.set(id, Date.now())
            },
        })

        // ── Receive remote player-down events ──
        if(this.network)
        {
            this.network.on('combat:playerDown', ({ fromId, x, y, z, vx, vy, color }) =>
            {
                this._destroyRemotePlayer(fromId, x, y, z, vx, vy, color)
            })
        }

        // ── Health system ──
        this.healthSystem = new HealthSystem({
            physics:  this.physics,
            spawnPos: this._serverSpawnPos || { x: 5, y: -35 },
        })

        // ── Pickups ──
        this.combatPickups = new CombatPickups({
            scene:   this.scene,
            physics: this.physics,
            layout:  (this.config.gameMode === 'combat') ? 'arena' : 'track',   // combat = arena pickups; race never gets here
            onCollect: ({ type, value }) =>
            {
                if(type === 'ammo')
                {
                    this.weapons.addAmmo(value)
                    this._showCombatPickup(`+${value} AMMO`, '#ff8800')
                }
                if(type === 'health')
                {
                    this.healthSystem.heal(value)
                    this._showCombatPickup(`+${value} HP`, '#2ecc71')
                }
                this.sounds?.play('uiArea', 0)
                this._updateCombatHUD()
            },
        })

        // ── Controls: F key / LMB fires; unified swap bus switches weapons ──
        this.controls.on('action', (name) =>
        {
            if(name !== 'fire') return
            // Pointer-lock gate: F must not fire from lobby/menus/hover. Touch has no lock — allow when touch UI built.
            if(document.pointerLockElement !== this.camera.renderer.domElement && !this.controls.touch) return
            const ok = this.weapons.fire()
            if(!ok && this.weapons.ammo <= 0)
                this._showCombatPickup('NO AMMO', '#e74c3c')
            if(ok) this._updateCombatHUD()
        })

        this.controls.on('swap', (payload) =>
        {
            if(payload === 'deagle' || payload === 'knife') this.weapons.select(payload)
            else if(payload === 0) this.weapons.swap()
            else this.weapons.step(payload)
            this._updateCombatHUD()
        })

        // ── Health events ──
        this.healthSystem.on('damage', ({ hp }) =>
        {
            this._updateCombatHUD()
            this._shakeCamera()
            this._flashDamage()
        })

        this.healthSystem.on('healed', () => { this._updateCombatHUD() })

        this.healthSystem.on('death', () =>
        {
            this._updateCombatHUD()
            this._destroyLocalPlayer()

            const $ov = document.getElementById('death-overlay')
            if($ov) $ov.classList.add('visible')
            let t = 3
            const $timer = document.getElementById('death-timer')
            const tick = () =>
            {
                if($timer) $timer.textContent = t
                if(t > 0) { t--; setTimeout(tick, 1000) }
            }
            tick()
        })

        this.healthSystem.on('respawn', () =>
        {
            // Reset ammo back to starting count on respawn
            if(this.weapons) this.weapons.ammo = DEAGLE.ammoStart
            this._updateCombatHUD()
            this._showLocalPlayer()
            const $ov = document.getElementById('death-overlay')
            if($ov) $ov.classList.remove('visible')
        })

        // ── Receive damage from multiplayer ──
        if(this.network)
        {
            this.network.on('player:combatDamage', ({ amount }) =>
            {
                this.healthSystem.takeDamage(amount)
            })
        }

        // ── Show combat HUD ──
        const $hp  = document.getElementById('hp-container')
        const $wpn = document.getElementById('weapon-status')
        if($hp)  $hp.style.display  = 'block'
        if($wpn) $wpn.style.display = 'block'
        this._updateCombatHUD()

        // Show the touch fire button if the user is on a touch device
        this.controls.touch?.showFire?.()

        // ── Hazard zones (boost + healing) — only meaningful inside the arena ──
        this.hazardZones = new HazardZones({
            scene:        this.scene,
            physics:      this.physics,
            healthSystem: this.healthSystem,
        })

        // ── Arena minimap (fixed top-down view) ──
        const $map = document.getElementById('mp-minimap')
        if($map) $map.style.display = 'block'

        this.arenaMinimap = new ArenaMinimap({
            physics:             this.physics,
            remotePlayerManager: this.remotePlayerManager,
            localCarColor:       this.config.carColor ?? 0,
            pickups:             ARENA_PICKUPS,
            hazards:             this.hazardZones.getMinimapZones(),
        })

        // ── Tick ──
        this.time.on('tick', () =>
        {
            const dt = Math.min(this.time.delta, 60)
            this.weapons.update(dt)
            this.combatPickups.update(dt)
            this.hazardZones?.update(dt)
            this.arenaMinimap?.update(dt)
        })
    }

    _updateCombatHUD()
    {
        const hp   = this.healthSystem?.hp ?? 100
        const hud  = this.weapons?.getHUD() ?? { name: 'DEAGLE', ammoLabel: `×${this.weapons?.ammo ?? 0}` }

        const $fill  = document.getElementById('hp-fill')
        const $val   = document.getElementById('hp-val')
        const $ammo  = document.getElementById('weapon-ammo')
        const $name  = document.getElementById('weapon-name')

        if($fill)
        {
            $fill.style.width = `${hp}%`
            $fill.style.background =
                hp > 60 ? '#2ecc71' :
                hp > 30 ? '#f39c12' : '#e74c3c'
        }
        if($val)  $val.textContent  = hp
        if($name) $name.textContent = hud.name
        if($ammo) $ammo.textContent = hud.ammoLabel
    }

    _flashDamage()
    {
        const $flash = document.getElementById('respawn-flash')
        if(!$flash) return
        $flash.style.animation = 'none'
        void $flash.offsetWidth
        $flash.style.animation = 'respawn-flash 0.4s ease-out forwards'
    }

    _showCombatPickup(text, color)
    {
        const $note = document.getElementById('hud-lap-note')
        if(!$note) return
        $note.textContent   = text
        $note.style.color   = color
        $note.style.opacity = '1'
        clearTimeout(this._pickupNoteTimer)
        this._pickupNoteTimer = setTimeout(() =>
        {
            if($note) $note.style.opacity = '0'
        }, 2000)
    }

    _destroyLocalPlayer()
    {
        const body = this.physics?.foot?.body
        if(!body) return
        const px = body.position.x, py = body.position.y, pz = body.position.z
        const vx = body.velocity.x, vy = body.velocity.y

        const bodyColor = [
            0xff3333, 0x3366ff, 0x33cc66, 0xff8833,
            0xaa44ff, 0x33cccc, 0xff66aa, 0xeeeeee,
        ][this.config.carColor ?? 0] || 0xff3333

        this.sounds?.play('carHit', 18)
        this._shakeCamera()
        setTimeout(() => this._shakeCamera(), 80)
        setTimeout(() => this._shakeCamera(), 180)

        // Hide local player mesh
        this.player?.setVisible?.(false)

        // Sync to other players
        if(this.network) this.network.sendPlayerDown(px, py, pz, vx, vy, bodyColor)
    }

    _showLocalPlayer()
    {
        this.player?.setVisible?.(true)
    }

    _destroyRemotePlayer(id, x, y, z, vx, vy, color)
    {
        this._shakeCamera()  // distant shake

        // Hide that remote player for 3s (matches RESPAWN_MS)
        const victim = this.remotePlayerManager?.players?.get(id)
        if(victim)
        {
            victim.setVisible?.(false)
            setTimeout(() => victim.setVisible?.(true), 3000)
        }

        // One-shot particle burst at the victim's last position
        const bx = x ?? victim?.container?.position?.x ?? 0
        const by = y ?? victim?.container?.position?.y ?? 0
        const bz = z ?? victim?.container?.position?.z ?? 0
        this._spawnDownBurst(bx, by, bz, color)
    }

    _spawnDownBurst(x, y, z, color)
    {
        const COUNT = 40
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(COUNT * 3)
        const velocities = []
        for(let i = 0; i < COUNT; i++)
        {
            positions[i * 3]     = x
            positions[i * 3 + 1] = y
            positions[i * 3 + 2] = z
            // Random sphere velocities (world z-up)
            const theta = Math.random() * Math.PI * 2
            const phi   = Math.acos(2 * Math.random() - 1)
            const speed = 2 + Math.random() * 4
            velocities.push(new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed,
            ))
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const material = new THREE.PointsMaterial({ color: color ?? 0xffffff, size: 0.3, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
        const points = new THREE.Points(geometry, material)
        this.scene.add(points)

        const start = performance.now()
        const step = () =>
        {
            const t = (performance.now() - start) / 500
            if(t >= 1)
            {
                this.scene.remove(points)
                geometry.dispose()
                material.dispose()
                return
            }
            const arr = points.geometry.attributes.position.array
            for(let i = 0; i < COUNT; i++)
            {
                arr[i * 3]     = x + velocities[i].x * t * 3
                arr[i * 3 + 1] = y + velocities[i].y * t * 3
                arr[i * 3 + 2] = z + velocities[i].z * t * 3
            }
            points.geometry.attributes.position.needsUpdate = true
            material.opacity = 1 - t
            requestAnimationFrame(step)
        }
        step()
    }

    _setupMuteButton()
    {
        const $btn = document.getElementById('btn-mute')
        if(!$btn) return
        $btn.style.display = 'flex'
        $btn.textContent   = this.sounds.isMuted() ? '🔇' : '🔊'
        $btn.addEventListener('click', () =>
        {
            this.sounds.toggleMute()
            $btn.textContent = this.sounds.isMuted() ? '🔇' : '🔊'
        })
    }

    _showCountdown()
    {
        const $overlay = document.getElementById('start-lights-overlay')
        const pods     = [0, 1, 2, 3, 4].map(i => document.getElementById(`sl-${i}`))
        if(!$overlay || pods.some(p => !p)) return

        $overlay.style.display    = 'block'
        $overlay.style.animation  = ''
        $overlay.style.opacity    = '1'
        pods.forEach(p => p.className = 'sl-pod')

        // Light each pod red 600ms apart
        pods.forEach((pod, i) =>
        {
            setTimeout(() => pod.classList.add('red'), i * 600)
        })

        // After all are red, hold briefly then go green and fade
        const allRedAt = pods.length * 600
        setTimeout(() =>
        {
            pods.forEach(p => { p.classList.remove('red'); p.classList.add('green') })

            setTimeout(() =>
            {
                $overlay.style.animation = 'sl-fade 0.55s ease-out forwards'
                setTimeout(() =>
                {
                    $overlay.style.display = 'none'
                    pods.forEach(p => p.className = 'sl-pod')
                }, 560)
            }, 600)
        }, allRedAt + 400)
    }

    // ── Combat: kill counter + win condition (first to 5) ───────────────────

    _setupCombatEnd()
    {
        const TARGET_KILLS = 5
        this._kills = 0
        this._combatOver = false

        const $kc = document.getElementById('kill-counter')
        if($kc) $kc.classList.add('visible')
        this._updateKillCounter(0, TARGET_KILLS)

        // Heuristic: if a player was downed within 1500ms of us hitting them,
        // attribute the kill to us. Server-side tracking would be more accurate
        // but this is a solid signal for the common case.
        if(this.network)
        {
            this.network.on('combat:playerDown', ({ fromId }) =>
            {
                if(this._combatOver) return
                if(!this._recentDamage) return
                const stamp = this._recentDamage.get(fromId)
                if(!stamp) return
                if(Date.now() - stamp > 1500) return

                this._recentDamage.delete(fromId)
                this._kills++
                this._updateKillCounter(this._kills, TARGET_KILLS)
                this._showCombatPickup?.(`+1 KILL`, '#FF2E4D')

                if(this._kills >= TARGET_KILLS)
                {
                    this._combatOver = true
                    setTimeout(() => this._showCombatComplete(this._kills), 1000)
                }
            })
        }
    }

    _updateKillCounter(kills, target)
    {
        const $val = document.getElementById('kc-value')
        if($val) $val.textContent = kills
    }

    _showCombatComplete(kills)
    {
        const $overlay = document.getElementById('race-complete')
        if(!$overlay) return

        const $trophy = $overlay.querySelector('.rc-trophy')
        const $title  = $overlay.querySelector('.rc-title')
        const $sub    = document.getElementById('rc-sub')
        const $list   = document.getElementById('rc-laps')
        const $footer = document.getElementById('rc-footer')

        if($trophy) $trophy.textContent = '🏆'
        if($title)  $title.textContent  = 'VICTORY'
        if($sub)    $sub.textContent    = `${kills} kills · last player standing`
        if($list)   $list.innerHTML     = ''
        if($footer) $footer.textContent = 'Free-for-all complete'

        const $again = document.getElementById('rc-again')
        if($again) $again.onclick = () => window.location.reload()

        $overlay.classList.add('visible')
    }
}
