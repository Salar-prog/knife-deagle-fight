import * as THREE from 'three'
import { CAR_COLORS } from '../../../../shared/constants.js'
import MatcapMaterial from '../Materials/Matcap.js'

// Same SHADE_UNIFORMS as RemoteCar.js — fresh instances, uRevealProgress = 1
// (puppets and the MVP local player are fully revealed, no fade-in)
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

// Fallback texture cache — used when no Resources handle is available
// (Player/RemotePlayer contracts don't carry one). Same URLs as Resources.js.
const _fallbackTextures = {}
const _texture = (resources, key, path) =>
{
    if(resources?.items?.[key]) return resources.items[key]
    if(!_fallbackTextures[key]) _fallbackTextures[key] = new THREE.TextureLoader().load(path)
    return _fallbackTextures[key]
}

const _makeMatcap = (resources, key, path, tint) =>
{
    const mat = MatcapMaterial()
    mat.uniforms.matcap.value = _texture(resources, key, path)
    if(tint) mat.uniforms.diffuse.value = new THREE.Color(tint)
    for(const [uniformName, value] of Object.entries(SHADE_UNIFORMS))
    {
        mat.uniforms[uniformName].value = value
    }
    return mat
}

// Accepts a hex string ('#e74c3c') or a CAR_COLORS index (number/numeric string)
const _toHex = (color) =>
{
    if(typeof color === 'string' && color.startsWith('#')) return color
    const idx = Number(color)
    const safe = Number.isFinite(idx) ? Math.trunc(idx) : 0
    return CAR_COLORS[((safe % CAR_COLORS.length) + CAR_COLORS.length) % CAR_COLORS.length]
}

// Low-poly human, feet at local z = 0, symmetric around Z (z-up world).
// Callers place the container at (body.x, body.y, body.z - FOOT.spawnZ).
// `color` → torso/head/hips tint (CAR_COLORS index or hex); limbs stay metal.
export const buildHumanMesh = (color, resources) =>
{
    const hex = _toHex(color)

    const torsoMat = _makeMatcap(resources, 'matcapRedTexture', './models/matcaps/red.png', hex)
    const limbMat  = _makeMatcap(resources, 'matcapMetalTexture', './models/matcaps/metal.png')

    const human = new THREE.Group()
    human.name = 'human'

    const add = (geometry, material, x, y, z, rotY = 0) =>
    {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, y, z)
        if(rotY) mesh.rotation.y = rotY
        human.add(mesh)
        return mesh
    }

    // Head
    add(new THREE.SphereGeometry(0.18, 8, 6), torsoMat, 0, 0, 1.32)

    // Torso + hips
    add(new THREE.BoxGeometry(0.34, 0.2, 0.62), torsoMat, 0, 0, 0.92)
    add(new THREE.BoxGeometry(0.3, 0.18, 0.18), torsoMat, 0, 0, 0.58)

    // Arms — thin boxes angled slightly forward (static pose)
    for(const side of [1, -1])
    {
        add(new THREE.BoxGeometry(0.09, 0.09, 0.34), limbMat, 0.05, side * 0.235, 1.0, 0.35)
        add(new THREE.BoxGeometry(0.08, 0.08, 0.3),  limbMat, 0.13, side * 0.245, 0.72, 0.65)
    }

    // Legs
    for(const side of [1, -1])
    {
        add(new THREE.BoxGeometry(0.12, 0.12, 0.32), limbMat, 0, side * 0.09, 0.35)
        add(new THREE.BoxGeometry(0.1, 0.1, 0.2),    limbMat, 0.02, side * 0.09, 0.1)
    }

    return human
}
