import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, Mesh } from 'three'
import * as THREE from 'three'

function Nucleus() {
  const core = useRef<Group>(null)
  const mesh = useRef<Mesh>(null)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.033)
    if (core.current) {
      core.current.rotation.y += dt * 0.075
      const targetX = -state.pointer.y * 0.055
      core.current.rotation.x += (targetX - core.current.rotation.x) * Math.min(1, dt * 0.45)
    }
    if (mesh.current) {
      mesh.current.rotation.y += dt * 0.11
      mesh.current.rotation.x += dt * 0.035
    }
  })

  return (
    <group ref={core}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1.28, 2]} />
        <meshPhysicalMaterial
          color="#7766d9"
          metalness={0.48}
          roughness={0.3}
          clearcoat={0.72}
          clearcoatRoughness={0.22}
          emissive="#261a68"
          emissiveIntensity={0.38}
        />
      </mesh>
      <mesh rotation={[0.2, 0.3, 0]}>
        <icosahedronGeometry args={[1.315, 1]} />
        <meshBasicMaterial color="#b9a9ff" wireframe transparent opacity={0.13} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Rings() {
  const group = useRef<Group>(null)
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.z += Math.min(delta, 0.04) * 0.045
  })

  return (
    <group ref={group}>
      <mesh rotation={[Math.PI / 2.4, 0.2, -0.18]}>
        <torusGeometry args={[1.88, 0.012, 8, 128]} />
        <meshStandardMaterial color="#72dce8" metalness={0.35} roughness={0.48} emissive="#1a7c92" emissiveIntensity={0.24} />
      </mesh>
      <mesh rotation={[0.4, Math.PI / 3, 0.5]}>
        <torusGeometry args={[2.18, 0.009, 8, 128]} />
        <meshStandardMaterial color="#a99aff" metalness={0.32} roughness={0.5} emissive="#4c2e9a" emissiveIntensity={0.2} />
      </mesh>
      <mesh rotation={[1.05, 0.4, 0.1]}>
        <torusGeometry args={[2.42, 0.006, 6, 128]} />
        <meshBasicMaterial color="#7770b9" transparent opacity={0.42} />
      </mesh>
    </group>
  )
}

function Field() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(240)
    // Deterministic pseudo-random distribution keeps the scene stable between renders.
    for (let i = 0; i < 80; i += 1) {
      const a = ((i * 37) % 101) / 101
      const b = ((i * 61 + 17) % 103) / 103
      const r = 3.0 + (((i * 19) % 47) / 47) * 1.15
      const theta = a * Math.PI * 2
      const phi = Math.acos(2 * b - 1)
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return next
  }, [])

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#b4a5ff" size={0.018} sizeAttenuation transparent opacity={0.52} depthWrite={false} />
    </points>
  )
}

export default function HeroCanvas() {
  return (
    <Canvas
      dpr={[1, 1.25]}
      camera={{ position: [0, 0.12, 6.6], fov: 36, near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power', stencil: false, depth: true, preserveDrawingBuffer: false }}
      frameloop="always"
      onCreated={({ gl, scene }) => {
        gl.setClearColor(new THREE.Color('#080a12'), 0)
        scene.background = null
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
      style={{ background: 'transparent', display: 'block' }}
      aria-label="Animated abstract NEXORA orbital network"
    >
      <ambientLight intensity={0.52} color="#a6b5ff" />
      <hemisphereLight args={['#8e8bff', '#080a12', 0.72]} />
      <pointLight position={[3.8, 2.8, 3.6]} intensity={18} distance={12} color="#a99aff" />
      <pointLight position={[-4, -1.5, 2.4]} intensity={12} distance={11} color="#65dbe8" />
      <directionalLight position={[0, 4, -3]} intensity={1.1} color="#dce5ff" />
      <Nucleus />
      <Rings />
      <Field />
    </Canvas>
  )
}
