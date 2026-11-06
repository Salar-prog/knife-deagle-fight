import CANNON from 'cannon'
import { FOOT } from '../../shared/constants.js'

export class PlayerFoot {
  constructor(world, spawnPos = { x: 0, y: 0, z: FOOT.spawnZ }) {
    const r = FOOT.radius
    // cannon 0.6.2 has no angularFactor — fixedRotation is the equivalent "never tips"
    this.body = new CANNON.Body({ mass: FOOT.mass, fixedRotation: true })
    this.body.allowSleep = false
    this.body.addShape(new CANNON.Cylinder(r, r, FOOT.cylinderHeight, 12)) // axis = Z (cannon default)
    this.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0,  FOOT.cylinderHeight / 2))
    this.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0, -FOOT.cylinderHeight / 2))
    this.body.position.set(spawnPos.x, spawnPos.y, spawnPos.z)
    world.addBody(this.body)
  }
  applyActions() {}   // client-authoritative on the wire; server physics is only for collision realism
  removeFromWorld(world) { world.remove(this.body) }
}
