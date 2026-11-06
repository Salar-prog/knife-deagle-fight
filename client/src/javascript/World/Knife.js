import * as THREE from 'three'
import gsap from 'gsap'
import MatcapMaterial from '../Materials/Matcap.js'
import { KNIFE } from '../../../../shared/constants.js'
import { knifeArcHit } from '../../../../shared/combat.js'

// Same reveal-complete uniform set as humanMesh.js — fresh instances per material
const SHADE_UNIFORMS = {
    uRevealProgress:             1,
    uIndirectDistanceAmplitude:  1.75,
    uIndirectDistanceStrength:   0.5,
    uIndirectDistancePower:      2.0,
    uIndirectAngleStrength:      1.5,
    uIndirectAngleOffset:        0.6,
    uIndirectAnglePower:         1.0,
    uIndirectColor:              new THREE.Color('#d04500'),
}

const _fallbackTextures = {}
const _texture = (resources, key, path) =>
{
    if(resources?.items?.[key]) return resources.items[key]
    if(!_fallbackTextures[key]) _fallbackTextures[key] = new THREE.TextureLoader().load(path)
    return _fallbackTextures[key]
}

const _matcap = (resources, key, path) =>
{
    const mat = MatcapMaterial()
    mat.uniforms.matcap.value = _texture(resources, key, path)
    for(const [uniformName, value] of Object.entries(SHADE_UNIFORMS))
    {
        mat.uniforms[uniformName].value = value
    }
    return mat
}

// Melee sidearm — 120° arc in front of the local player, tested in 2D (x, y).
// View forward = (cos yaw, sin yaw), the same angle the movement code uses.
export default class Knife
{
    constructor(_options)
    {
        const o = _options ?? {}
        this.camera              = o.camera              ?? null
        this.player              = o.player              ?? null
        this.remotePlayerManager = o.remotePlayerManager ?? null
        this.sounds              = o.sounds              ?? null
        this.resources           = o.resources           ?? null
        this.onHitCar            = o.onHitCar            ?? null
        this.onHitLocal          = o.onHitLocal          ?? null

        this.cooldownUntil = 0
        this.name          = 'knife'

        this.mesh = this._buildViewmodel()
        this.mesh.visible = false
        o.viewmodel?.add(this.mesh)
    }

    get remotes()
    {
        return this.remotePlayerManager?.players ?? new Map()
    }

    setVisible(visible)
    {
        this.mesh.visible = visible
    }

    fire()
    {
        if(this.cooldownUntil > performance.now()) return false
        this.cooldownUntil = performance.now() + KNIFE.cooldownMs

        this._swing()

        const me  = this._playerPosition()
        const yaw = this.camera?.yaw ?? 0
        for(const [id, rp] of this.remotes)
        {
            const p = rp.container.position
            if(knifeArcHit({ origin: me, yaw: yaw, target: { x: p.x, y: p.y }, reach: KNIFE.reach, arc: KNIFE.arc }))
            {
                this.onHitCar?.(id, KNIFE.damage)
                this._hitmarker()
            }
        }

        this.sounds?.play('bowlingPin', 6)   // stopgap slash sound
        return true
    }

    update()
    {
        // Cooldowns run off performance.now(); the swing is gsap-driven — nothing to tick
    }

    // ── Fire helpers ──────────────────────────────────────────────────────────

    _playerPosition()
    {
        const p = this.player?.position ?? this.camera?.targetEased ?? { x: 0, y: 0 }
        return { x: p.x, y: p.y }
    }

    _swing()
    {
        const rot = this.mesh.rotation
        gsap.killTweensOf(rot)
        gsap.fromTo(rot,
            { z: 0.9 },
            { z: -1.5, duration: 0.2, ease: 'power3.out',
              onComplete: () => gsap.to(rot, { z: 0, duration: 0.15, ease: 'power2.inOut' }) }
        )
    }

    _hitmarker()
    {
        const el = document.getElementById('hitmarker')
        if(!el) return
        el.classList.add('flash')
        setTimeout(() => el.classList.remove('flash'), 120)
    }

    // ── Viewmodel ─────────────────────────────────────────────────────────────

    _buildViewmodel()
    {
        const metal  = _matcap(this.resources, 'matcapMetalTexture', './models/matcaps/metal.png')
        const handle = _matcap(this.resources, 'matcapRedTexture',   './models/matcaps/red.png')
        const group  = new THREE.Group()
        group.name   = 'knife-viewmodel'

        // Tapered blade (4-sided cylinder → tapered box), flattened to blade profile
        const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.032, 0.27, 4, 1), metal)
        blade.rotation.x = -Math.PI / 2     // cylinder axis Y → Z; tip (top) points to −Z (into view)
        blade.scale.set(0.45, 1, 1)
        blade.position.set(0, 0.01, -0.185)
        group.add(blade)

        // Guard
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.018), metal)
        guard.position.set(0, 0, -0.045)
        group.add(guard)

        // Red handle, angled down toward the grip
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.042, 0.13), handle)
        grip.position.set(0, -0.012, 0.03)
        grip.rotation.x = 0.18
        group.add(grip)

        return group
    }
}
