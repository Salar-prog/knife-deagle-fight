import * as THREE from 'three'
import gsap from 'gsap'
import MatcapMaterial from '../Materials/Matcap.js'
import { DEAGLE } from '../../../../shared/constants.js'

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

const _metalMatcap = (resources) =>
{
    const mat = MatcapMaterial()
    mat.uniforms.matcap.value = _texture(resources, 'matcapMetalTexture', './models/matcaps/metal.png')
    for(const [uniformName, value] of Object.entries(SHADE_UNIFORMS))
    {
        mat.uniforms[uniformName].value = value
    }
    return mat
}

let _flashTex = null
const _makeFlashTex = () =>
{
    if(_flashTex) return _flashTex
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0,   'rgba(255, 240, 180, 1)')
    g.addColorStop(0.4, 'rgba(255, 180,  60, 0.9)')
    g.addColorStop(1,   'rgba(255, 120,   0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    _flashTex = new THREE.CanvasTexture(c)
    return _flashTex
}

// Hitscan sidearm. Cosmetic viewmodel on the camera; the hit test raycasts from the camera.
export default class Deagle
{
    constructor(_options)
    {
        const o = _options ?? {}
        this.scene               = o.scene               ?? null
        this.camera              = o.camera              ?? null
        this.remotePlayerManager = o.remotePlayerManager ?? null
        this.sounds              = o.sounds              ?? null
        this.resources           = o.resources           ?? null
        this.weapons             = o.weapons             ?? null   // coordinator — shares ammo
        this.onHitCar            = o.onHitCar            ?? null
        this.onHitLocal          = o.onHitLocal          ?? null
        this.onFired             = o.onFired             ?? null

        this.cooldownUntil = 0
        this.name          = 'deagle'

        this.mesh = this._buildViewmodel()
        this.mesh.visible = true
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
        if(this.weapons && this.weapons.ammo <= 0) return false

        if(this.weapons) this.weapons.ammo--
        this.cooldownUntil = performance.now() + DEAGLE.cooldownMs

        const origin = this.camera.instance.getWorldPosition(new THREE.Vector3())
        const forward = this.camera.targetEased
            ? new THREE.Vector3().subVectors(this.camera.targetEased, origin).normalize()
            : new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.instance.getWorldQuaternion(new THREE.Quaternion())).normalize()

        const ray = new THREE.Raycaster(origin, forward, 0, 120)
        const hit = this._hitscan(ray)

        if(hit?.remotePlayerId)
        {
            this.onHitCar?.(hit.remotePlayerId, DEAGLE.damage)
            this._hitmarker()
        }

        this._muzzleFlash()
        this._tracer(origin, forward, hit?.distance ?? 100)
        this.sounds?.play('carHit', 12)   // stopgap shot sound (closest existing boom)
        this.onFired?.()
        return true
    }

    update()
    {
        // Cooldowns run off performance.now(); effects are gsap-driven — nothing to tick
    }

    // ── Hit test ──────────────────────────────────────────────────────────────

    _hitscan(ray)
    {
        const hits = []

        // Arena collision meshes — Task 8 tags them userData.solid = true (empty until then)
        const solids = []
        this.scene?.traverse((obj) =>
        {
            if(obj.userData?.solid === true) solids.push(obj)
        })
        if(solids.length) hits.push(...ray.intersectObjects(solids, true))

        // Remote players — tag each hit with the id from the Map key
        for(const [id, rp] of this.remotes)
        {
            for(const h of ray.intersectObject(rp.container, true))
            {
                h.remotePlayerId = id
                hits.push(h)
            }
        }

        hits.sort((a, b) => a.distance - b.distance)
        return hits.find((h) => h.distance > 0.1) ?? null
    }

    // ── Viewmodel & FX ────────────────────────────────────────────────────────

    _buildViewmodel()
    {
        const metal = _metalMatcap(this.resources)
        const group = new THREE.Group()
        group.name  = 'deagle-viewmodel'

        // Slide / frame
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.24), metal)
        body.position.set(0, 0, 0)
        group.add(body)

        // Barrel stub (cylinder axis Y → rotate to Z)
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.17, 10), metal)
        barrel.rotation.x = Math.PI / 2
        barrel.position.set(0, 0.012, -0.19)
        group.add(barrel)

        // Grip, angled back
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.055), metal)
        grip.position.set(0, -0.075, 0.09)
        grip.rotation.x = 0.28
        group.add(grip)

        // Front sight
        const sight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.02, 0.03), metal)
        sight.position.set(0, 0.048, -0.095)
        group.add(sight)

        return group
    }

    _muzzleFlash()
    {
        const mat = new THREE.SpriteMaterial({
            map:         _makeFlashTex(),
            color:       0xffffff,
            transparent: true,
            opacity:     1,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
            depthTest:   false,
        })
        const sprite = new THREE.Sprite(mat)
        sprite.scale.setScalar(0.09)
        sprite.position.set(0, 0.012, -0.3)   // barrel tip, viewmodel-local
        this.mesh.add(sprite)
        gsap.to(mat, {
            opacity:  0,
            duration: 0.06,
            onComplete: () =>
            {
                this.mesh.remove(sprite)
                mat.dispose()
            },
        })
    }

    _tracer(origin, forward, length)
    {
        if(!this.scene) return
        const end = origin.clone().addScaledVector(forward, Math.min(length, 120))
        const geo = new THREE.BufferGeometry().setFromPoints([origin, end])
        const mat = new THREE.LineBasicMaterial({
            color:       0xffe08a,
            transparent: true,
            opacity:     0.9,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
        })
        const line = new THREE.Line(geo, mat)
        line.frustumCulled = false
        this.scene.add(line)
        gsap.to(mat, {
            opacity:  0,
            duration: 0.08,
            onComplete: () =>
            {
                this.scene.remove(line)
                geo.dispose()
                mat.dispose()
            },
        })
    }

    _hitmarker()
    {
        const el = document.getElementById('hitmarker')
        if(!el) return
        el.classList.add('flash')
        setTimeout(() => el.classList.remove('flash'), 120)
    }
}
