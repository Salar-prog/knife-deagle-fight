import CANNON from 'cannon'
import * as THREE from 'three'
import { FOOT } from '../../../../shared/constants.js'

export default class Physics
{
    constructor(_options)
    {
        this.config = _options.config
        this.debug = _options.debug
        this.time = _options.time
        this.sizes = _options.sizes
        this.controls = _options.controls
        this.sounds = _options.sounds

        // Set up
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('physics')
            // this.debugFolder.open()
        }

        this.setWorld()
        this.setModels()
        this.setMaterials()
        this.setFloor()
        this.setFootPlayer()

        this.time.on('tick', () =>
        {
            this.world.step(this.time.delta / 1000)
        })
    }

    setWorld()
    {
        this.world = new CANNON.World()
        this.world.gravity.set(0, 0, - 3.25 * 4)
        this.world.allowSleep = true
        // this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        this.world.defaultContactMaterial.friction = 0
        this.world.defaultContactMaterial.restitution = 0.2

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this.world.gravity, 'z').step(0.001).min(- 20).max(20).name('gravity')
        }
    }

    setModels()
    {
        this.models = {}
        this.models.container = new THREE.Object3D()
        this.models.container.visible = false
        this.models.materials = {}
        this.models.materials.static = new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: true })
        this.models.materials.dynamic = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        this.models.materials.dynamicSleeping = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this.models.container, 'visible').name('modelsVisible')
        }
    }

    setMaterials()
    {
        this.materials = {}

        // All materials
        this.materials.items = {}
        this.materials.items.floor = new CANNON.Material('floorMaterial')
        this.materials.items.dummy = new CANNON.Material('dummyMaterial')
        this.materials.items.foot = new CANNON.Material('foot')

        // Contact between materials
        this.materials.contacts = {}

        this.materials.contacts.floorDummy = new CANNON.ContactMaterial(this.materials.items.floor, this.materials.items.dummy, { friction: 0.05, restitution: 0.3, contactEquationStiffness: 1000 })
        this.world.addContactMaterial(this.materials.contacts.floorDummy)

        this.materials.contacts.dummyDummy = new CANNON.ContactMaterial(this.materials.items.dummy, this.materials.items.dummy, { friction: 0.5, restitution: 0.3, contactEquationStiffness: 1000 })
        this.world.addContactMaterial(this.materials.contacts.dummyDummy)

        this.materials.contacts.floorFoot = new CANNON.ContactMaterial(this.materials.items.floor, this.materials.items.foot, { friction: 0.8, restitution: 0 })
        this.world.addContactMaterial(this.materials.contacts.floorFoot)
    }

    setFloor()
    {
        this.floor = {}
        this.floor.body = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(),
            material: this.materials.items.floor
        })

        // this.floor.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), - Math.PI * 0.5)

        this.world.addBody(this.floor.body)
    }

    setFootPlayer()
    {
        const r = FOOT.radius
        this.foot = {}
        this.foot.body = new CANNON.Body({ mass: FOOT.mass, material: this.materials.items.foot })
        this.foot.body.allowSleep = false
        this.foot.body.fixedRotation = true   // never tips
        this.foot.body.addShape(new CANNON.Cylinder(r, r, FOOT.cylinderHeight, 12))
        this.foot.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0,  FOOT.cylinderHeight / 2))
        this.foot.body.addShape(new CANNON.Sphere(r), new CANNON.Vec3(0, 0, -FOOT.cylinderHeight / 2))
        this.foot.body.linearDamping = 0.9          // no ice-skating
        this.foot.body.position.set(0, 0, FOOT.spawnZ)
        this.world.addBody(this.foot.body)

        // Reuse the old bumper-car collide handler, keyed on isBumperCar —
        // the body we collide with now belongs to a RemotePlayer.
        this.foot.body.addEventListener('collide', (event) => {
            const body = event.body
            if(body?.isBumperCar && this.foot.onBump) {
                const now = performance.now()
                if(this.foot.lastBumpTime && now - this.foot.lastBumpTime < 400) return
                this.foot.lastBumpTime = now
                this.foot.onBump(body.remotePlayerId)
            }
        })

        this.foot.lastBumpTime = 0
        this.foot.onBump = null  // set by World.js to relay bump to remote player

        this.foot.receiveBump = () => { /* small shake + sound only, no impulse — fits a foot duel */ }
        this.foot.jump = () => { this.foot.body.velocity.z = FOOT.jumpVelocity }
    }

    addObjectFromThree(_options)
    {
        // Set up
        const collision = {}

        collision.model = {}
        collision.model.meshes = []
        collision.model.container = new THREE.Object3D()
        this.models.container.add(collision.model.container)

        collision.children = []

        // Material
        const bodyMaterial = this.materials.items.dummy

        // Body
        collision.body = new CANNON.Body({
            position: new CANNON.Vec3(_options.offset.x, _options.offset.y, _options.offset.z),
            mass: _options.mass,
            material: bodyMaterial
        })
        collision.body.allowSleep = true
        collision.body.sleepSpeedLimit = 0.01
        if(_options.sleep)
        {
            collision.body.sleep()
        }

        this.world.addBody(collision.body)

        // Rotation
        if(_options.rotation)
        {
            const rotationQuaternion = new CANNON.Quaternion()
            rotationQuaternion.setFromEuler(_options.rotation.x, _options.rotation.y, _options.rotation.z, _options.rotation.order)
            collision.body.quaternion = collision.body.quaternion.mult(rotationQuaternion)
        }

        // Center
        collision.center = new CANNON.Vec3(0, 0, 0)

        // Shapes
        const shapes = []

        // Each mesh
        for(let i = 0; i < _options.meshes.length; i++)
        {
            const mesh = _options.meshes[i]

            // Define shape
            let shape = null

            if(mesh.name.match(/^cube_?[0-9]{0,3}?|box[0-9]{0,3}?$/i))
            {
                shape = 'box'
            }
            else if(mesh.name.match(/^cylinder_?[0-9]{0,3}?$/i))
            {
                shape = 'cylinder'
            }
            else if(mesh.name.match(/^sphere_?[0-9]{0,3}?$/i))
            {
                shape = 'sphere'
            }
            else if(mesh.name.match(/^center_?[0-9]{0,3}?$/i))
            {
                shape = 'center'
            }

            // Shape is the center
            if(shape === 'center')
            {
                collision.center.set(mesh.position.x, mesh.position.y, mesh.position.z)
            }

            // Other shape
            else if(shape)
            {
                // Geometry
                let shapeGeometry = null

                if(shape === 'cylinder')
                {
                    shapeGeometry = new CANNON.Cylinder(mesh.scale.x, mesh.scale.x, mesh.scale.z, 8)
                }
                else if(shape === 'box')
                {
                    const halfExtents = new CANNON.Vec3(mesh.scale.x * 0.5, mesh.scale.y * 0.5, mesh.scale.z * 0.5)
                    shapeGeometry = new CANNON.Box(halfExtents)
                }
                else if(shape === 'sphere')
                {
                    shapeGeometry = new CANNON.Sphere(mesh.scale.x)
                }

                // Position
                const shapePosition = new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z)

                // Quaternion
                const shapeQuaternion = new CANNON.Quaternion(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w)
                if(shape === 'cylinder')
                {
                    // Rotate cylinder
                    // shapeQuaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), - Math.PI * 0.5)
                }

                // Save
                shapes.push({ shapeGeometry, shapePosition, shapeQuaternion })

                // Create model object
                let modelGeometry = null
                if(shape === 'cylinder')
                {
                    modelGeometry = new THREE.CylinderGeometry(1, 1, 1, 8, 1)
                    modelGeometry.rotateX(Math.PI * 0.5)
                }
                else if(shape === 'box')
                {
                    modelGeometry = new THREE.BoxGeometry(1, 1, 1)
                }
                else if(shape === 'sphere')
                {
                    modelGeometry = new THREE.SphereGeometry(1, 8, 8)
                }

                const modelMesh = new THREE.Mesh(modelGeometry, this.models.materials[_options.mass === 0 ? 'static' : 'dynamic'])
                modelMesh.position.copy(mesh.position)
                modelMesh.scale.copy(mesh.scale)
                modelMesh.quaternion.copy(mesh.quaternion)

                collision.model.meshes.push(modelMesh)
            }
        }

        // Update meshes to match center
        for(const _mesh of collision.model.meshes)
        {
            _mesh.position.x -= collision.center.x
            _mesh.position.y -= collision.center.y
            _mesh.position.z -= collision.center.z

            collision.model.container.add(_mesh)
        }

        // Update shapes to match center
        for(const _shape of shapes)
        {
            // Create physic object
            _shape.shapePosition.x -= collision.center.x
            _shape.shapePosition.y -= collision.center.y
            _shape.shapePosition.z -= collision.center.z

            collision.body.addShape(_shape.shapeGeometry, _shape.shapePosition, _shape.shapeQuaternion)
        }

        // Update body to match center
        collision.body.position.x += collision.center.x
        collision.body.position.y += collision.center.y
        collision.body.position.z += collision.center.z

        // Save origin
        collision.origin = {}
        collision.origin.position = collision.body.position.clone()
        collision.origin.quaternion = collision.body.quaternion.clone()
        collision.origin.sleep = _options.sleep

        // Time tick update
        this.time.on('tick', () =>
        {
            collision.model.container.position.set(collision.body.position.x, collision.body.position.y, collision.body.position.z)
            collision.model.container.quaternion.set(collision.body.quaternion.x, collision.body.quaternion.y, collision.body.quaternion.z, collision.body.quaternion.w)

            if(this.models.container.visible && _options.mass > 0)
            {
                for(const _mesh of collision.model.container.children)
                {
                    _mesh.material = collision.body.sleepState === 2 ? this.models.materials.dynamicSleeping : this.models.materials.dynamic
                }
            }
        })

        // Reset
        collision.reset = () =>
        {
            collision.body.position.copy(collision.origin.position)
            collision.body.quaternion.copy(collision.origin.quaternion)

            if(collision.origin.sleep)
            {
                collision.body.sleep()
            }
        }

        return collision
    }
}
