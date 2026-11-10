import * as THREE from 'three'
import { DEAGLE } from '../../../../shared/constants.js'
import Deagle from './Deagle.js'
import Knife from './Knife.js'

const ORDER = ['deagle', 'knife']

// Slim weapon coordinator — owns the shared Deagle ammo pool and the camera-local
// viewmodel group, delegates firing to the active weapon.
// Task 8 wires: controls 'swap' events → select()/step()/swap() and reads getHUD().
export default class Weapons
{
    constructor(_options)
    {
        const o = _options ?? {}
        this.scene               = o.scene               ?? null
        this.camera              = o.camera              ?? null
        this.player              = o.player              ?? null
        this.remotePlayerManager = o.remotePlayerManager ?? o.remoteCarManager ?? null
        this.sounds              = o.sounds              ?? null
        this.resources           = o.resources           ?? null
        this.onHitCar            = o.onHitCar            ?? null
        this.onHitLocal          = o.onHitLocal          ?? null
        this.onFired             = o.onFired             ?? null

        this.current = 'deagle'
        this.ammo    = DEAGLE.ammoStart

        // Both viewmodels live in one group on the camera (camera-local forward is −Z),
        // lower-right of frame; select() toggles child visibility
        this.viewmodel = new THREE.Group()
        this.viewmodel.position.set(0.12, -0.28, -0.45)
        this.camera?.instance?.add(this.viewmodel)

        const shared = {
            scene:               this.scene,
            camera:              this.camera,
            player:              this.player,
            remotePlayerManager: this.remotePlayerManager,
            sounds:              this.sounds,
            resources:           this.resources,
            viewmodel:           this.viewmodel,
            onHitCar:            this.onHitCar,
            onHitLocal:          this.onHitLocal,
            onFired:             this.onFired,
        }

        this.deagle = new Deagle({ ...shared, weapons: this })
        this.knife  = new Knife(shared)

        this.knife.setVisible(false)
        this.deagle.setVisible(true)
    }

    // ── Interface used by World (Task 8) ─────────────────────────────────────

    fire()
    {
        return this._active().fire()
    }

    addAmmo(n)
    {
        this.ammo = Math.min(this.ammo + n, DEAGLE.ammoMax)
    }

    update(/* dt */)
    {
        // Cooldowns run off performance.now(); effects are gsap-driven — kept so Task 8's tick call stays valid
    }

    swap()
    {
        this.select(this.current === 'deagle' ? 'knife' : 'deagle')
    }

    step(direction)
    {
        const dir = direction < 0 ? -1 : direction > 0 ? 1 : 0
        const idx = ORDER.indexOf(this.current)
        const next = Math.max(0, Math.min(ORDER.length - 1, idx + dir))
        this.select(ORDER[next])
    }

    select(name)
    {
        if(name !== 'deagle' && name !== 'knife') return
        this.current = name
        this.deagle.setVisible(name === 'deagle')
        this.knife.setVisible(name === 'knife')
    }

    getHUD()
    {
        return {
            name:      this.current.toUpperCase(),
            ammoLabel: this.current === 'deagle' ? `×${this.ammo}` : '∞',
        }
    }

    _active()
    {
        return this.current === 'knife' ? this.knife : this.deagle
    }
}
