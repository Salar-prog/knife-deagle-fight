import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import gsap from 'gsap'

export default class Camera
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.sizes = _options.sizes
        this.renderer = _options.renderer
        this.debug = _options.debug
        this.config = _options.config

        // Set up
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        this.target = new THREE.Vector3(0, 0, 0)
        this.targetEased = new THREE.Vector3(0, 0, 0)
        this.easing = 0.15

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('camera')
            // this.debugFolder.open()
        }

        this.setAngle()
        this.setInstance()
        this.setAim()
        this.setZoom()
        this.setPan()
        this.setOrbitControls()
    }

    setAngle()
    {
        // Set up
        this.angle = {}

        // Items
        this.angle.items = {
            default: new THREE.Vector3(1.135, - 1.45, 1.15),
            projects: new THREE.Vector3(0.38, - 1.4, 1.63)
        }

        // Value
        this.angle.value = new THREE.Vector3()
        this.angle.value.copy(this.angle.items.default)

        // Set method
        this.angle.set = (_name) =>
        {
            const angle = this.angle.items[_name]
            if(typeof angle !== 'undefined')
            {
                gsap.to(this.angle.value, { ...angle, duration: 2, ease: 'power1.inOut' })
            }
        }

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this, 'easing').step(0.0001).min(0).max(1).name('easing')
            this.debugFolder.add(this.angle.value, 'x').step(0.001).min(- 2).max(2).name('invertDirectionX').listen()
            this.debugFolder.add(this.angle.value, 'y').step(0.001).min(- 2).max(2).name('invertDirectionY').listen()
            this.debugFolder.add(this.angle.value, 'z').step(0.001).min(- 2).max(2).name('invertDirectionZ').listen()
        }
    }

    setInstance()
    {
        // Set up
        this.instance = new THREE.PerspectiveCamera(40, this.sizes.viewport.width / this.sizes.viewport.height, 1, 80)
        this.instance.up.set(0, 0, 1)
        this.instance.position.copy(this.angle.value)
        this.instance.lookAt(new THREE.Vector3())
        this.container.add(this.instance)

        // Resize event
        this.sizes.on('resize', () =>
        {
            this.instance.aspect = this.sizes.viewport.width / this.sizes.viewport.height
            this.instance.updateProjectionMatrix()
        })

        // Time tick
        this.time.on('tick', () =>
        {
            this.targetEased.x += (this.target.x - this.targetEased.x) * this.easing
            this.targetEased.y += (this.target.y - this.targetEased.y) * this.easing
            this.targetEased.z += (this.target.z - this.targetEased.z) * this.easing

            // Over-the-shoulder offset; the view direction is opposite the offset
            const cosPitch = Math.cos(this.pitch)
            const offset = new THREE.Vector3(
                Math.cos(this.yaw) * cosPitch,
                Math.sin(this.yaw) * cosPitch,
                Math.sin(this.pitch)
            ).multiplyScalar(this.distance)

            this.instance.position.copy(this.targetEased).add(offset)

            // Look at target
            this.instance.lookAt(this.targetEased)
        })
    }

    setAim()
    {
        this.yaw = -Math.PI / 2         // face -Y (into arena center from south)
        this.pitch = 0.35               // slight downward tilt
        this.pitchMin = -0.2; this.pitchMax = 1.1
        this.sensitivity = 0.0023
        this.distance = 4.2             // shoulder offset (replaces zoom default)
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement !== this.renderer.domElement) return
            this.yaw   -= e.movementX * this.sensitivity
            this.pitch += e.movementY * this.sensitivity
            this.pitch = Math.min(this.pitchMax, Math.max(this.pitchMin, this.pitch))
        })
        document.addEventListener('pointerlockchange', () => {
            const locked = document.pointerLockElement === this.renderer.domElement
            document.getElementById('aim-prompt')?.classList.toggle('hidden', locked)
            document.getElementById('crosshair')?.classList.toggle('hidden', !locked)
        })
        this.renderer.domElement.addEventListener('click', () => {
            if (document.pointerLockElement !== this.renderer.domElement) {
                this.renderer.domElement.requestPointerLock()
            }
        })
    }

    setZoom()
    {
        // Zoom is a fixed shoulder offset now — click-drag pan/wheel-zoom are gone
        // (wheel swaps weapons via Controls). Kept as a distance constant for compatibility.
        this.zoom = {}
        this.zoom.value = 0.5
        this.zoom.distance = this.distance
    }

    setPan()
    {
        // Pan disabled — pointer-lock aim replaces it. Kept as a safe stub because
        // Controls calls camera.pan.reset() on W/S and World calls pan.enable().
        this.pan = {}
        this.pan.enabled = false
        this.pan.value = { x: 0, y: 0 }
        this.pan.targetValue = { x: 0, y: 0 }
        this.pan.reset = () =>
        {
            this.pan.targetValue.x = 0
            this.pan.targetValue.y = 0
        }
        this.pan.enable = () => { this.pan.enabled = false }
        this.pan.disable = () => { this.pan.enabled = false }
    }

    setOrbitControls()
    {
        // Set up
        this.orbitControls = new OrbitControls(this.instance, this.renderer.domElement)
        this.orbitControls.enabled = false
        this.orbitControls.enableKeys = false
        this.orbitControls.zoomSpeed = 0.5

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this.orbitControls, 'enabled').name('orbitControlsEnabled')
        }
    }
}
