import RemotePlayer from './RemotePlayer.js'

export default class RemotePlayerManager
{
    constructor(_options)
    {
        this.scene           = _options.scene
        this.network         = _options.network
        this.camera          = _options.camera
        this.sizes           = _options.sizes
        this.getPhysicsWorld = _options.getPhysicsWorld  // () => CANNON.World | null

        this.players = new Map()  // id → RemotePlayer

        this._setupNetworkEvents()
    }

    _setupNetworkEvents()
    {
        // New player joins — create their puppet
        this.network.on('player:joined', ({ id, name, carColor, color }) =>
        {
            console.log(`[RemotePlayerManager] player:joined → name="${name}" id="${id}"`)
            this._addPlayer(id, name, color ?? carColor)
        })

        // Player leaves — destroy their puppet
        this.network.on('player:left', ({ id }) =>
        {
            this._removePlayer(id)
        })

        // Server snapshot — update all remote players
        this.network.on('world:snapshot', ({ t, cars }) =>
        {
            for(const playerState of cars || [])
            {
                // Skip local player
                if(playerState.id === this.network.localId) continue

                const player = this.players.get(playerState.id)
                if(player)
                {
                    player.addSnapshot({ t, ...playerState })
                }
                else
                {
                    // Player not created yet — log once per unknown id
                    if(!this._warnedIds) this._warnedIds = new Set()
                    if(!this._warnedIds.has(playerState.id))
                    {
                        this._warnedIds.add(playerState.id)
                        console.warn(`[RemotePlayerManager] snapshot for unknown player "${playerState.id}" — player not created yet`)
                    }
                }
            }
        })

        // When we join, add existing players
        this.network.on('room:joined', ({ existingPlayers }) =>
        {
            console.log(`[RemotePlayerManager] room:joined → existingPlayers:`, existingPlayers)
            for(const player of existingPlayers || [])
            {
                this._addPlayer(player.id, player.name, player.color ?? player.carColor)
            }
        })
    }

    _addPlayer(id, name, color)
    {
        if(this.players.has(id)) return

        const player = new RemotePlayer({
            scene:           this.scene,
            id,
            name,
            color,
            getPhysicsWorld: this.getPhysicsWorld,
            network:         this.network,
        })

        this.players.set(id, player)
        console.log(`[remote] +player ${name} (${id})`)
    }

    _removePlayer(id)
    {
        const player = this.players.get(id)
        if(player)
        {
            player.destroy()
            this.players.delete(id)
            console.log(`[remote] -player ${id}`)
        }
    }

    get count()
    {
        return this.players.size
    }

    update()
    {
        for(const player of this.players.values())
        {
            player.update(this.camera, this.sizes, this.network)
        }
    }

    destroy()
    {
        for(const player of this.players.values())
        {
            player.destroy()
        }
        this.players.clear()
    }
}
