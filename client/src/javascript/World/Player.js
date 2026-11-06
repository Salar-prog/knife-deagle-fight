import * as THREE from 'three'
import { FOOT } from '../../../../shared/constants.js'
import { buildHumanMesh } from './humanMesh.js'

export default class Player
{
    constructor(_options)
    {
        this.physics  = _options.physics
        this.scene    = _options.scene
        this.shadows  = _options.shadows
        this.camera   = _options.camera
        this.controls = _options.controls
        this.config   = _options.config ?? {}

        this.container = new THREE.Object3D()
        this.position  = new THREE.Vector3()  // mirrors the foot body position (capsule center)
        this.yaw       = 0

        this.mesh = buildHumanMesh(this.config.carColor ?? 0, this.config.resources)
        this.container.add(this.mesh)
        this.scene.add(this.container)

        // Feet sit at container z = 0; body origin is the capsule center
        const body = this.physics?.foot?.body
        if(body)
        {
            this.container.position.set(body.position.x, body.position.y, body.position.z - FOOT.spawnZ)
            this.position.set(body.position.x, body.position.y, body.position.z)
        }

        this.shadow = this.shadows?.add(this.container, { sizeX: 1, sizeY: 1, offsetZ: 0.1 })
    }

    setVisible(visible)
    {
        this.container.visible = visible
        if(this.shadow?.mesh) this.shadow.mesh.visible = visible
    }

    // Tick — movement intent + body → mesh sync. Called by World each frame.
    update()
    {
        const body = this.physics?.foot?.body
        if(!body) return

        // camera.yaw is set by Camera.js (Task 6); tolerate its absence
        const yaw     = this.camera?.yaw ?? 0
        const actions = this.controls?.actions ?? {}

        const cos = Math.cos(yaw)
        const sin = Math.sin(yaw)
        const fwd    = (actions.up ? 1 : 0) - (actions.down ? 1 : 0)
        const strafe = (actions.right ? 1 : 0) - (actions.left ? 1 : 0)

        // Camera-relative wish direction on the XY plane
        let wishX = cos * fwd - sin * strafe
        let wishY = sin * fwd + cos * strafe
        const len = Math.hypot(wishX, wishY)
        const moving = len > 0.0001
        if(moving)
        {
            wishX /= len
            wishY /= len
            this.yaw = Math.atan2(wishY, wishX)
            this.container.rotation.z = this.yaw
        }
        else
        {
            wishX = 0
            wishY = 0
        }

        const speed = FOOT.runSpeed * (actions.boost ? FOOT.sprintMultiplier : 1)
        body.velocity.x = wishX * speed
        body.velocity.y = wishY * speed
        // z is owned by gravity/jump

        // Body → mesh (feet at container origin → subtract capsule half-height)
        this.position.set(body.position.x, body.position.y, body.position.z)
        this.container.position.set(body.position.x, body.position.y, body.position.z - FOOT.spawnZ)
    }
}
