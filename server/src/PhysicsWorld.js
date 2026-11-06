import CANNON from 'cannon'
import { PHYSICS } from '../../shared/constants.js'
import { PlayerFoot } from './PlayerFoot.js'

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World()
    this.world.gravity.set(
      PHYSICS.gravity.x,
      PHYSICS.gravity.y,
      PHYSICS.gravity.z
    )
    this.world.broadphase = new CANNON.SAPBroadphase(this.world)
    this.world.allowSleep = true
    this.world.defaultContactMaterial.restitution = PHYSICS.defaultRestitution

    this.players = new Map() // playerId → PlayerFoot

    this._setupFloor()
  }

  _setupFloor() {
    const floorBody = new CANNON.Body({ mass: 0 })
    floorBody.addShape(new CANNON.Plane())
    this.world.addBody(floorBody)
  }

  addPlayer(playerId, spawnPosition) {
    const player = new PlayerFoot(this.world, spawnPosition)
    this.players.set(playerId, player)
    return player
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId)
    if (player) {
      player.removeFromWorld(this.world)
      this.players.delete(playerId)
    }
  }

  step(delta) {
    this.world.step(1 / 60, delta, 3)
  }
}
