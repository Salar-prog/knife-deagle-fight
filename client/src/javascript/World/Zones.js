import * as THREE from 'three'
import Zone from './Zone.js'

export default class Zones
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.sizes = _options.sizes
        this.physics = _options.physics
        this.debug = _options.debug

        // Set up
        this.container = new THREE.Object3D()
        this.container.visible = false
        this.container.matrixAutoUpdate = false

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('zones')
            this.debugFolder.open()

            this.debugFolder.add(this.container, 'visible').name('visible')
        }

        this.setTester()
        this.setItems()
    }

    setTester()
    {
        this.tester = {}
        this.tester.x = 0
        this.tester.y = 0

        this.time.on('tick', () =>
        {
            const body = this.physics.foot?.body ?? this.physics.car?.chassis?.body
            this.tester.x = body?.position.x ?? 0
            this.tester.y = body?.position.y ?? 0
        })
    }

    setItems()
    {
        this.items = []

        this.time.on('tick', () =>
        {
            for(const _zone of this.items)
            {
                const isIn = this.tester.x < _zone.position.x + _zone.halfExtents.x && this.tester.x > _zone.position.x - _zone.halfExtents.x && this.tester.y < _zone.position.y + _zone.halfExtents.y && this.tester.y > _zone.position.y - _zone.halfExtents.y

                if(isIn && !_zone.isIn)
                {
                    _zone.trigger('in', [_zone.data])
                }
                else if(!isIn && _zone.isIn)
                {
                    _zone.trigger('out', [_zone.data])
                }

                _zone.isIn = isIn
            }
        })
    }

    add(_settings)
    {
        // Set up
        const zone = new Zone(_settings)
        this.container.add(zone.mesh)

        // Save
        this.items.push(zone)

        return zone
    }
}
