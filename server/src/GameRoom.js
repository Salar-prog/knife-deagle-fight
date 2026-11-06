import { PhysicsWorld } from './PhysicsWorld.js'
import { NETWORK, ARENA_SPAWN_GRID, FOOT } from '../../shared/constants.js'
import { pickSpawnSlotIndex } from '../../shared/combat.js'

const { tickRate, physicsRate, maxPlayers } = NETWORK

export class GameRoom {
  constructor(io) {
    this.io      = io
    this.physics = new PhysicsWorld()
    this.players = new Map() // socketId → { id, name, carColor, carType, actions, spawnIndex, spawnXY }
    this._spawnSlots = new Set()

    this._startLoop()
    this._setupSocketEvents()
  }

  _setupSocketEvents() {
    this.io.on('connection', (socket) => {
      if (this.players.size >= maxPlayers) {
        socket.emit('room:full')
        socket.disconnect()
        return
      }

      console.log(`[+] ${socket.id}`)

      socket.on('ping', (cb) => {
        // Return the server's current epoch time so clients can compute
        // (clock skew + half RTT) and align interpolation timestamps
        if(typeof cb === 'function') cb(Date.now())
      })

      socket.on('player:join', ({ name, carColor, carType }) => {
        const spawnPos = this._getSpawnPosition()
        this.physics.addPlayer(socket.id, spawnPos)

        this.players.set(socket.id, {
          id:       socket.id,
          name:     name || 'Anonymous',
          carColor: carColor ?? 0,
          carType:  carType || 'default',
          actions:  { up: false, down: false, left: false, right: false, brake: false, boost: false },
          spawnIndex: spawnPos.index,
          spawnXY:  { x: spawnPos.x, y: spawnPos.y },
        })

        // Send existing players to new joiner
        const existingPlayers = [...this.players.values()]
          .filter(p => p.id !== socket.id)
          .map(({ id, name, carColor, carType }) => ({ id, name, carColor, carType }))

        // Include spawn position so client can initialise the local player at the same spot
        socket.emit('room:joined', { id: socket.id, existingPlayers, spawnPos: { x: spawnPos.x, y: spawnPos.y, z: FOOT.spawnZ, index: spawnPos.index } })

        // Notify everyone else
        socket.broadcast.emit('player:joined', {
          id: socket.id,
          name: name || 'Anonymous',
          carColor: carColor ?? 0,
          carType:  carType || 'default',
        })

        console.log(`[join] ${name} (${socket.id}) — ${this.players.size} online`)
      })

      socket.on('player:ready', () => {
        // Client reveal animation just started — reset server player to spawn so both fall together
        const playerBody = this.physics.players.get(socket.id)
        const player     = this.players.get(socket.id)
        if (playerBody && player) {
          const { x, y } = player.spawnXY
          playerBody.body.position.set(x, y, FOOT.spawnZ)
          playerBody.body.velocity.set(0, 0, 0)
          playerBody.body.angularVelocity.set(0, 0, 0)
          playerBody.body.quaternion.set(0, 0, 0, 1)
          console.log(`[ready] ${player.name} — player reset to (${x.toFixed(2)}, ${y.toFixed(2)}, ${FOOT.spawnZ})`)
        }
      })

      socket.on('player:input', (actions) => {
        const player = this.players.get(socket.id)
        if (player) player.actions = actions
      })

      socket.on('player:bump', ({ targetId, fromPos }) => {
        // Relay bump to the target player so their car reacts too
        const targetSocket = this.io.sockets.sockets.get(targetId)
        if (targetSocket) {
          targetSocket.emit('player:bumped', { fromId: socket.id, fromPos })
        }
      })

      socket.on('chat:message', ({ text }) => {
        const player = this.players.get(socket.id)
        if (!player || !text || typeof text !== 'string') return
        const clean = text.slice(0, 120).trim()
        if (!clean) return
        // Broadcast to everyone else
        socket.broadcast.emit('chat:message', {
          name: player.name,
          text: clean,
          color: player.carColor ?? 0,
        })
      })

      socket.on('combat:missile', (data) => {
        console.log(`[combat] missile from ${socket.id}`, data)
        socket.broadcast.emit('combat:missile', { fromId: socket.id, ...data })
      })

      socket.on('player:combatDamage', ({ targetId, amount }) => {
        console.log(`[combat] damage from ${socket.id} → ${targetId} (${amount}hp)`)
        const targetSocket = this.io.sockets.sockets.get(targetId)
        if (targetSocket) {
          targetSocket.emit('player:combatDamage', { fromId: socket.id, amount })
        } else {
          console.warn(`[combat] target socket ${targetId} not found`)
        }
      })

      socket.on('combat:explosion', (data) => {
        // Broadcast explosion position to all other players
        socket.broadcast.emit('combat:explosion', { fromId: socket.id, ...data })
      })

      socket.on('combat:playerDown', (data) => {
        console.log(`[combat] player down: ${socket.id}`)
        socket.broadcast.emit('combat:playerDown', { fromId: socket.id, ...data })
      })

      socket.on('player:snapshot', (state) => {
        // Client sends its own authoritative physics state.
        // We cache it and use it in world:snapshot broadcasts so that remote
        // players see exactly the same thing as the local player.
        const player = this.players.get(socket.id)
        if (player) player.clientSnapshot = state
      })

      socket.on('disconnect', () => {
        this.physics.removePlayer(socket.id)
        const player = this.players.get(socket.id)
        if (player) this._spawnSlots.delete(player.spawnIndex)
        this.players.delete(socket.id)
        this.io.emit('player:left', { id: socket.id })
        console.log(`[-] ${player?.name ?? socket.id} — ${this.players.size} online`)
      })
    })
  }

  _startLoop() {
    const physicsInterval  = 1000 / physicsRate
    const broadcastInterval = 1000 / tickRate
    let last             = Date.now()
    let broadcastAccum   = 0

    setInterval(() => {
      const now   = Date.now()
      const delta = (now - last) / 1000
      last = now

      // Step physics
      this.physics.step(delta)

      // Broadcast at tickRate — use client-reported snapshots so remote players
      // see exactly what the local player sees (same physics, no server divergence).
      broadcastAccum += delta * 1000
      if (broadcastAccum >= broadcastInterval) {
        broadcastAccum -= broadcastInterval
        const cars = []
        for (const [id, player] of this.players) {
          if (player.clientSnapshot) {
            cars.push({ id, ...player.clientSnapshot })
          }
        }
        if (cars.length > 0) {
          this.io.emit('world:snapshot', { t: now, cars })
        }
      }
    }, physicsInterval)
  }

  _getSpawnPosition() {
    const index = pickSpawnSlotIndex(this._spawnSlots, ARENA_SPAWN_GRID.length)
    this._spawnSlots.add(index)
    const { x, y } = ARENA_SPAWN_GRID[index]
    return { x, y, z: FOOT.spawnZ, index }
  }
}
