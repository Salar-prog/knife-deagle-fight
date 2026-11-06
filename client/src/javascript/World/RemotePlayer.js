import * as THREE from 'three'
import CANNON from 'cannon'
import { NETWORK, FOOT } from '../../../../shared/constants.js'
import { buildHumanMesh } from './humanMesh.js'

export default class RemotePlayer
{
    constructor(_options)
    {
        this.scene           = _options.scene
        this.id              = _options.id
        this.name            = _options.name
        this.color           = _options.color ?? 0
        this.getPhysicsWorld = _options.getPhysicsWorld  // () => CANNON.World | null
        this.network         = _options.network || null  // for server-time offset in retention check

        // Snapshot interpolation buffer
        this.snapshots          = []
        this.interpolationDelay = NETWORK.interpolationDelay

        // Collision body (created lazily once physics world is available)
        this._physicsBody  = null
        this._physicsWorld = null

        this.container = new THREE.Object3D()
        this.scene.add(this.container)
        this._visible = true

        // Same primitive human as the local player; feet at container origin
        this.mesh = buildHumanMesh(this.color)
        this.container.add(this.mesh)

        this._buildNameLabel()
    }

    _buildNameLabel()
    {
        this.label = {}
        this.label.$element = document.createElement('div')
        this.label.$element.className    = 'remote-player-label'
        this.label.$element.textContent  = this.name
        this.label.$element.style.cssText = `
            position: fixed;
            background: rgba(0,0,0,0.55);
            color: #fff;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 11px;
            pointer-events: none;
            user-select: none;
            white-space: nowrap;
            transform: translate(-50%, -100%);
            display: none;
        `
        document.body.appendChild(this.label.$element)
        this.label.visible = false
    }

    // ── snapshot handling ───────────────────────────────────────────────────

    setVisible(visible)
    {
        this._visible = visible
        this.container.visible = visible
        if(this.label?.$element) this.label.$element.style.display = visible ? 'block' : 'none'
    }

    addSnapshot(snapshot)
    {
        // Relayed snapshots are unvalidated client data — drop malformed ones silently
        const { t, pos, quat } = snapshot ?? {}
        if(typeof t !== 'number' || !Number.isFinite(t)) return
        if(!Array.isArray(pos) || pos.length !== 3 || !pos.every(Number.isFinite)) return
        if(!Array.isArray(quat) || quat.length !== 4 || !quat.every(Number.isFinite)) return

        this.snapshots.push({
            t,
            pos,
            quat,
            vel:    Array.isArray(snapshot.vel)    && snapshot.vel.length === 3    && snapshot.vel.every(Number.isFinite)    ? snapshot.vel    : null,
            angVel: Array.isArray(snapshot.angVel) && snapshot.angVel.length === 3 && snapshot.angVel.every(Number.isFinite) ? snapshot.angVel : null,
        })

        // Keep only last 3 seconds (server clock), but always retain at least the 2 newest
        const now = Date.now() + (this.network?.serverTimeOffset || 0)
        const cutoff = now - NETWORK.snapshotBufferTime
        while(this.snapshots.length > 2 && this.snapshots[0].t < cutoff)
        {
            this.snapshots.shift()
        }
    }

    // ── update loop ─────────────────────────────────────────────────────────

    update(camera, sizes, network = null)
    {
        if(this.snapshots.length === 0) return

        // Use server-time offset if available so all clients render the
        // same temporal slice (eliminates per-client clock drift)
        const net    = network ?? this.network
        const offset = net?.serverTimeOffset || 0
        const renderTime = (Date.now() + offset) - this.interpolationDelay

        let older = null
        let newer = null

        for(let i = 0; i < this.snapshots.length - 1; i++)
        {
            if(this.snapshots[i].t <= renderTime && this.snapshots[i + 1].t >= renderTime)
            {
                older = this.snapshots[i]
                newer = this.snapshots[i + 1]
                break
            }
        }

        if(older && newer)
        {
            // Standard interpolation between two known snapshots
            const total = newer.t - older.t
            const alpha = total > 0 ? (renderTime - older.t) / total : 0
            this._applySnapshot(older, alpha, newer)
        }
        else
        {
            // Buffer empty for renderTime — extrapolate from the latest using
            // velocity if it's recent enough, otherwise just snap to it.
            const latest = this.snapshots[this.snapshots.length - 1]
            const ahead  = (renderTime - latest.t) / 1000  // seconds past
            if(ahead > 0 && ahead < 0.25 && latest.vel)
            {
                this._applyExtrapolated(latest, ahead)
            }
            else
            {
                this._applySnapshot(latest, 0, latest)
            }
        }

        if(this._visible !== false)
        {
            this._updateLabel(camera, sizes)
        }
        else
        {
            this.label.$element.style.display = 'none'
        }
    }

    // Project the latest known state forward by `dtSec` using its velocity.
    // Caps the extrapolation distance so a stale snapshot can't fling the player.
    _applyExtrapolated(latest, dtSec)
    {
        const px = latest.pos[0] + latest.vel[0] * dtSec
        const py = latest.pos[1] + latest.vel[1] * dtSec
        const pz = latest.pos[2] + latest.vel[2] * dtSec
        this.container.position.set(px, py, pz - FOOT.spawnZ)

        const q = new THREE.Quaternion(latest.quat[0], latest.quat[1], latest.quat[2], latest.quat[3])
        this.container.quaternion.copy(q)

        this._ensurePhysicsBody()
        if(this._physicsBody)
        {
            this._physicsBody.position.set(px, py, pz)
            this._physicsBody.quaternion.set(q.x, q.y, q.z, q.w)
            // Static body — cannon 0.6.2 only recomputes the broadphase AABB
            // when flagged, otherwise pairs never test against it after a teleport
            this._physicsBody.aabbNeedsUpdate = true
        }
    }

    // ── collision body ──────────────────────────────────────────────────────

    _ensurePhysicsBody()
    {
        if(this._physicsBody) return
        const physWorld = this.getPhysicsWorld?.()
        if(!physWorld) return

        this._physicsWorld = physWorld

        // Static capsule matching the local foot body's shape
        const r = FOOT.radius
        this._physicsBody = new CANNON.Body({ mass: 0 })  // mass=0 → static obstacle
        this._physicsBody.addShape(new CANNON.Cylinder(r, r, FOOT.cylinderHeight, 8))
        this._physicsBody.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0,  FOOT.cylinderHeight / 2))
        this._physicsBody.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0, -FOOT.cylinderHeight / 2))
        // Tag so Physics.js collision handler can identify this as a bumper player
        this._physicsBody.isBumperCar = true
        this._physicsBody.remotePlayerId = this.id
        physWorld.addBody(this._physicsBody)
    }

    // ── snapshot application ─────────────────────────────────────────────────

    _applySnapshot(older, alpha, newer)
    {
        // Position (capsule center → feet at container origin)
        const px = older.pos[0] + (newer.pos[0] - older.pos[0]) * alpha
        const py = older.pos[1] + (newer.pos[1] - older.pos[1]) * alpha
        const pz = older.pos[2] + (newer.pos[2] - older.pos[2]) * alpha
        this.container.position.set(px, py, pz - FOOT.spawnZ)

        const q1 = new THREE.Quaternion(older.quat[0], older.quat[1], older.quat[2], older.quat[3])
        const q2 = new THREE.Quaternion(newer.quat[0], newer.quat[1], newer.quat[2], newer.quat[3])
        q1.slerp(q2, alpha)
        this.container.quaternion.copy(q1)

        // Sync collision body with interpolated position — lazy-create if needed
        this._ensurePhysicsBody()
        if(this._physicsBody)
        {
            this._physicsBody.position.set(px, py, pz)
            this._physicsBody.quaternion.set(q1.x, q1.y, q1.z, q1.w)
            // Static body — force broadphase AABB recompute after the teleport
            this._physicsBody.aabbNeedsUpdate = true
        }
    }

    _updateLabel(camera, sizes)
    {
        if(!camera || !sizes) return

        const worldPos = this.container.position.clone()
        worldPos.z += 1.9

        const projected = worldPos.project(camera.instance)

        if(projected.z > 1)
        {
            this.label.$element.style.display = 'none'
            return
        }

        const x = (projected.x *  0.5 + 0.5) * sizes.viewport.width
        const y = (projected.y * -0.5 + 0.5) * sizes.viewport.height

        this.label.$element.style.display = 'block'
        this.label.$element.style.left    = `${x}px`
        this.label.$element.style.top     = `${y}px`
    }

    destroy()
    {
        this.scene.remove(this.container)

        if(this._physicsWorld && this._physicsBody)
        {
            this._physicsWorld.remove(this._physicsBody)
            this._physicsBody  = null
            this._physicsWorld = null
        }

        if(this.label.$element.parentNode)
        {
            this.label.$element.parentNode.removeChild(this.label.$element)
        }
    }
}
