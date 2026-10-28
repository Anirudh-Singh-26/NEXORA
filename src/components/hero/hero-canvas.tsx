import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useMotionReduced } from '@/lib/motion'

/**
 * NEXORA hero scene — a lit observatory model.
 *
 * Depth layers (back → front), each with its own pointer parallax:
 *   back   atmosphere glow · far dust shell
 *   mid    nucleus (glass sphere + limb light) · debris disk · three orbits with
 *          comets, one carrying a lit moon · instrument tick ring
 *   front  a handful of large, faint out-of-focus motes (bokeh) for atmosphere
 *
 * All shader-driven: no scene lights, no textures, no extra dependencies, one
 * transparent canvas. Pauses off-screen / on hidden tabs; renders a single
 * static frame under reduced motion.
 */

const VIOLET = new THREE.Color('#8b6cff')
const VIOLET_SOFT = new THREE.Color('#b9a8ff')
const CYAN = new THREE.Color('#4fd8ea')
const NAVY = new THREE.Color('#080a18')

/** Small deterministic PRNG so the scene is identical on every load. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* -------------------------------------------------------------------------- */
/* Shared lit-body shader (nucleus + moon)                                     */
/* -------------------------------------------------------------------------- */

const bodyVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vObj;
  varying vec3 vView;
  void main() {
    vObj = normalize(position);
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const bodyFrag = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uViolet;
  uniform vec3 uCyan;
  uniform float uGrid;     // 0 = smooth body (moon), 1 = meridian grid (nucleus)
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vObj;
  varying vec3 vView;

  float gridLine(float v, float freq, float width) {
    float x = v * freq;
    float d = abs(fract(x - 0.5) - 0.5) / max(fwidth(x), 1e-4);
    return 1.0 - smoothstep(width, width + 1.0, d);
  }

  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(-vView);
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.6);

    vec3 L1 = normalize(vec3(0.65, 0.55, 0.52));   // violet key, upper right
    vec3 L2 = normalize(vec3(-0.75, -0.45, 0.35)); // cyan kicker, lower left
    float key = clamp(dot(n, L1), 0.0, 1.0);
    float kick = clamp(dot(n, L2), 0.0, 1.0);

    vec3 col = uBase;
    col += uViolet * pow(key, 2.2) * 0.34;
    col += uCyan * pow(kick, 2.6) * 0.30;

    // Slow inner glow so the disc never reads as a flat black hole.
    float breathe = 0.5 + 0.5 * sin(uTime * 0.45);
    col += uViolet * pow(ndv, 3.0) * (0.045 + 0.03 * breathe) * uGrid;

    float side = smoothstep(-0.7, 0.7, n.x * 0.8 + n.y * 0.6);
    vec3 rim = mix(uCyan, uViolet, side);
    col += rim * fres * 0.9;

    if (uGrid > 0.5) {
      float lat = asin(clamp(vObj.y, -1.0, 1.0)) / 3.14159265;
      float lon = atan(vObj.z, vObj.x) / 6.2831853;
      float g = max(gridLine(lat, 12.0, 0.15), gridLine(lon, 16.0, 0.15));
      float gridMask = smoothstep(0.0, 0.55, ndv) * (0.25 + 0.75 * key);
      col += mix(uViolet, vec3(1.0), 0.35) * g * gridMask * 0.16;
    }

    vec3 h = normalize(L1 + v);
    col += vec3(0.85, 0.82, 1.0) * pow(clamp(dot(n, h), 0.0, 1.0), 90.0) * 0.28;

    gl_FragColor = vec4(col, 1.0);
  }
`

function useBodyMaterial(grid: number, base: THREE.Color) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: bodyVert,
        fragmentShader: bodyFrag,
        uniforms: {
          uBase: { value: base },
          uViolet: { value: VIOLET },
          uCyan: { value: CYAN },
          uGrid: { value: grid },
          uTime: { value: 0 },
        },
        toneMapped: false,
      }),
    [grid, base],
  )
  useEffect(() => () => material.dispose(), [material])
  return material
}

/* -------------------------------------------------------------------------- */
/* Nucleus + limb light                                                        */
/* -------------------------------------------------------------------------- */

const limbFrag = /* glsl */ `
  uniform vec3 uViolet;
  uniform vec3 uCyan;
  varying vec3 vN;
  varying vec3 vObj;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(-vView);
    float f = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.4);
    float side = smoothstep(-0.7, 0.7, n.x * 0.8 + n.y * 0.6);
    vec3 c = mix(uCyan, uViolet, side);
    gl_FragColor = vec4(c * f * 1.25, f * 0.9);
  }
`

const NUCLEUS_BASE = NAVY.clone().lerp(new THREE.Color('#161247'), 0.55)

function Nucleus({ animate }: { animate: boolean }) {
  const group = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>(null)
  const body = useBodyMaterial(1, NUCLEUS_BASE)
  const limb = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: bodyVert,
        fragmentShader: limbFrag,
        uniforms: { uViolet: { value: VIOLET }, uCyan: { value: CYAN } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => () => limb.dispose(), [limb])

  useFrame((state, delta) => {
    if (!animate || !group.current) return
    group.current.rotation.y += Math.min(delta, 0.05) * 0.06
    if (meshRef.current?.material) {
      meshRef.current.material.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <group ref={group} rotation={[0.18, 0.6, 0.05]}>
      <mesh ref={meshRef} material={body}>
        <sphereGeometry args={[1.22, 96, 64]} />
      </mesh>
      {/* thin additive shell: a luminous edge that bleeds just past the silhouette */}
      <mesh material={limb} renderOrder={2}>
        <sphereGeometry args={[1.255, 64, 48]} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Orbits (comet tail + node, optional lit moon)                               */
/* -------------------------------------------------------------------------- */

const ringVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// uv.x runs around the torus' major circle; the travelling body sits at u = 0,
// so its tail trails behind at u -> 1.
const ringFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBase;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    float t = 1.0 - vUv.x;
    float tail = pow(1.0 - t, uPower);
    float a = uBase + (1.0 - uBase) * tail;
    gl_FragColor = vec4(uColor * (0.8 + 1.0 * tail), a);
  }
`

const MOON_BASE = new THREE.Color('#2a2470')
const WHITE = new THREE.Color('#ffffff')

function Moon({ radius, color, animate }: { radius: number; color: THREE.Color; animate: boolean }) {
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>(null)
  const material = useBodyMaterial(0, MOON_BASE)
  useFrame((state) => {
    if (animate && meshRef.current?.material) {
      meshRef.current.material.uniforms.uTime.value = state.clock.elapsedTime
    }
  })
  return (
    <group>
      <mesh ref={meshRef} material={material}>
        <sphereGeometry args={[radius, 40, 28]} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 2.6, 20, 14]} />
        <meshBasicMaterial color={color} transparent opacity={0.045} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  )
}

interface OrbitProps {
  radius: number
  tilt: [number, number, number]
  color: THREE.Color
  speed: number
  tube?: number
  base?: number
  power?: number
  node?: number
  phase?: number
  moon?: number
  animate: boolean
}

function Orbit({ radius, tilt, color, speed, tube = 0.007, base = 0.16, power = 3, node = 0.035, phase = 0, moon, animate }: OrbitProps) {
  const spin = useRef<THREE.Group>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ringVert,
        fragmentShader: ringFrag,
        uniforms: { uColor: { value: color }, uBase: { value: base }, uPower: { value: power } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color, base, power],
  )
  useEffect(() => () => material.dispose(), [material])
  const nodeColor = useMemo(() => color.clone().lerp(WHITE, 0.55), [color])

  useFrame((_, delta) => {
    if (animate && spin.current) spin.current.rotation.z += Math.min(delta, 0.05) * speed
  })

  return (
    <group rotation={tilt}>
      <group ref={spin} rotation={[0, 0, phase]}>
        <mesh material={material}>
          <torusGeometry args={[radius, tube, 6, 256]} />
        </mesh>
        <group position={[radius, 0, 0]}>
          {moon ? (
            <Moon radius={moon} color={color} animate={animate} />
          ) : (
            <>
              <mesh>
                <sphereGeometry args={[node, 16, 12]} />
                <meshBasicMaterial color={nodeColor} toneMapped={false} />
              </mesh>
              <mesh>
                <sphereGeometry args={[node * 2.2, 16, 12]} />
                <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
              </mesh>
            </>
          )}
        </group>
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Instrument tick ring                                                        */
/* -------------------------------------------------------------------------- */

function TickRing({ radius, tilt, animate }: { radius: number; tilt: [number, number, number]; animate: boolean }) {
  const spin = useRef<THREE.Group>(null)
  const { geometry, material } = useMemo(() => {
    const ticks = 144
    const pos = new Float32Array(ticks * 6)
    for (let i = 0; i < ticks; i += 1) {
      const a = (i / ticks) * Math.PI * 2
      const len = i % 12 === 0 ? 0.11 : i % 4 === 0 ? 0.06 : 0.03
      const c = Math.cos(a)
      const s = Math.sin(a)
      pos.set([c * radius, s * radius, 0, c * (radius + len), s * (radius + len), 0], i * 6)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const m = new THREE.LineBasicMaterial({ color: '#9d92f0', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    return { geometry: g, material: m }
  }, [radius])
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])

  useFrame((_, delta) => {
    if (animate && spin.current) spin.current.rotation.z -= Math.min(delta, 0.05) * 0.03
  })

  return (
    <group rotation={tilt}>
      <group ref={spin}>
        <lineSegments geometry={geometry} material={material} />
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Atmosphere (camera-facing glow behind everything)                           */
/* -------------------------------------------------------------------------- */

const glowVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const glowFrag = /* glsl */ `
  uniform vec3 uViolet;
  uniform vec3 uCyan;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 9.0;
    float r = length(p);
    float edge = 1.0 - smoothstep(3.0, 4.5, r);

    float halo = exp(-max(r - 1.2, 0.0) * 2.6) * step(1.0, r + 0.2);
    float haze = exp(-r * 0.62);
    float cy = exp(-length(p - vec2(-1.5, -1.2)) * 0.85);
    float vi = exp(-length(p - vec2(1.6, 1.3)) * 0.8);

    vec3 col = uViolet * (halo * 0.30 + haze * 0.16 + vi * 0.16)
             + uCyan   * (halo * 0.08 + cy * 0.15);
    float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0) * edge;
    gl_FragColor = vec4(col * edge, a);
  }
`

function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glowVert,
        fragmentShader: glowFrag,
        uniforms: { uViolet: { value: VIOLET }, uCyan: { value: CYAN } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh position={[0, 0, -1.8]} material={material} renderOrder={-2}>
      <planeGeometry args={[9.5, 9.5]} />
    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/* Soft point clouds (far dust shell · debris disk · front bokeh)              */
/* -------------------------------------------------------------------------- */

const dustVert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aMix;
  uniform float uTime;
  uniform float uPx;
  uniform float uScale;
  varying float vAlpha;
  varying float vMix;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.6 + aPhase * 0.9) + aPhase * 40.0);
    float depth = clamp(1.0 - (-mv.z - 3.0) / 7.0, 0.15, 1.0);
    gl_PointSize = aSize * uPx * uScale * (5.5 / -mv.z) * (0.6 + depth);
    vAlpha = twinkle * depth;
    vMix = aMix;
  }
`

const dustFrag = /* glsl */ `
  uniform vec3 uViolet;
  uniform vec3 uCyan;
  uniform float uAlpha;
  uniform float uSoft;
  varying float vAlpha;
  varying float vMix;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float soft = pow(clamp(1.0 - d, 0.0, 1.0), uSoft);
    vec3 col = mix(uViolet, uCyan, vMix);
    gl_FragColor = vec4(col, soft * vAlpha * uAlpha);
  }
`

type Mote = { x: number; y: number; z: number; size: number; mix: number }

interface CloudProps {
  count: number
  seed: number
  make: (rand: () => number, i: number) => Mote
  alpha?: number
  soft?: number
  scale?: number
  spin?: number
  tilt?: [number, number, number]
  animate: boolean
}

function PointCloud({ count, seed, make, alpha = 1.6, soft = 2, scale = 1.6, spin = 0, tilt = [0, 0, 0], animate }: CloudProps) {
  const group = useRef<THREE.Group>(null)
  const dpr = useThree((s) => s.viewport.dpr)

  const { geometry, material } = useMemo(() => {
    const rand = rng(seed)
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const phase = new Float32Array(count)
    const mix = new Float32Array(count)
    for (let i = 0; i < count; i += 1) {
      const m = make(rand, i)
      pos.set([m.x, m.y, m.z], i * 3)
      size[i] = m.size
      phase[i] = rand()
      mix[i] = m.mix
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    g.setAttribute('aMix', new THREE.BufferAttribute(mix, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: dustVert,
      fragmentShader: dustFrag,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: 1 },
        uScale: { value: scale },
        uAlpha: { value: alpha },
        uSoft: { value: soft },
        uViolet: { value: VIOLET_SOFT },
        uCyan: { value: CYAN },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    return { geometry: g, material: m }
    // `make` is a stable module-level / memoised generator at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, seed, alpha, soft, scale])

  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useEffect(() => { material.uniforms.uPx.value = dpr }, [dpr, material])

  useFrame((state, delta) => {
    if (!animate) return
    material.uniforms.uTime.value = state.clock.elapsedTime
    if (group.current && spin) group.current.rotation.y += Math.min(delta, 0.05) * spin
  })

  return (
    <group rotation={tilt}>
      <group ref={group}>
        <points geometry={geometry} material={material} />
      </group>
    </group>
  )
}

const gauss = (r: () => number) => (r() + r() + r() - 1.5) / 1.5

const makeShell = (r: () => number): Mote => {
  const rr = 2.7 + Math.pow(r(), 1.4) * 2.3
  const theta = r() * Math.PI * 2
  const phi = Math.acos(2 * r() - 1)
  return {
    x: rr * Math.sin(phi) * Math.cos(theta),
    y: rr * Math.sin(phi) * Math.sin(theta) * 0.8,
    z: rr * Math.cos(phi),
    size: 0.7 + r() * 1.9,
    mix: r() > 0.55 ? 1 : 0.15,
  }
}

// Thin debris disk hugging the nucleus, violet inside → cyan outside.
const makeDisk = (r: () => number): Mote => {
  const t = Math.pow(r(), 1.25)
  const rr = 1.62 + t * 0.78
  const a = r() * Math.PI * 2
  return { x: Math.cos(a) * rr, y: gauss(r) * 0.03 * rr, z: Math.sin(a) * rr, size: 0.45 + r() * 0.9, mix: t }
}

// Few, big, faint motes close to the camera: out-of-focus depth cue.
const makeBokeh = (r: () => number): Mote => ({
  x: (r() - 0.5) * 6.2,
  y: (r() - 0.5) * 3.8,
  z: 2.2 + r() * 1.4,
  size: 9 + r() * 14,
  mix: r() > 0.5 ? 0.9 : 0.1,
})

/* -------------------------------------------------------------------------- */
/* Rig: responsive framing, intro dolly, damped pointer + layer parallax        */
/* -------------------------------------------------------------------------- */

/** Wraps a depth layer and nudges it with the pointer (negative = recedes). */
function Layer({ depth, animate, children }: { depth: number; animate: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state, delta) => {
    const g = ref.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const px = animate ? state.pointer.x : 0
    const py = animate ? state.pointer.y : 0
    g.position.x = THREE.MathUtils.damp(g.position.x, px * depth, 2.4, dt)
    g.position.y = THREE.MathUtils.damp(g.position.y, py * depth * 0.7, 2.4, dt)
  })
  return <group ref={ref}>{children}</group>
}

const REST_Z = 6.6

function Rig({ animate, children }: { animate: boolean; children: ReactNode }) {
  const group = useRef<THREE.Group>(null)
  const size = useThree((s) => s.size)

  const fit = useMemo(() => {
    const aspect = size.width / Math.max(size.height, 1)
    const halfH = Math.tan(THREE.MathUtils.degToRad(36 / 2)) * REST_Z
    const halfW = halfH * aspect
    return THREE.MathUtils.clamp(Math.min(halfH, halfW) / 2.55, 0.6, 1.12)
  }, [size.width, size.height])

  // Cinematic push-in on first paint (skipped for reduced motion).
  const camera = useThree((s) => s.camera)
  const cameraRef = useRef(camera)
  useEffect(() => {
    cameraRef.current = camera
  }, [camera])
  useEffect(() => {
    if (cameraRef.current) cameraRef.current.position.z = animate ? 7.6 : REST_Z
  }, [animate])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    if (animate) state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, REST_Z, 1.6, dt)
    const px = animate ? state.pointer.x : 0
    const py = animate ? state.pointer.y : 0
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, px * 0.16, 2.2, dt)
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -py * 0.1, 2.2, dt)
    g.position.y = THREE.MathUtils.damp(g.position.y, animate ? Math.sin(t * 0.35) * 0.04 : 0, 2, dt)
  })

  return (
    <group scale={fit}>
      <group ref={group}>{children}</group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Canvas                                                                      */
/* -------------------------------------------------------------------------- */

function useSceneActivity() {
  const hostRef = useRef<HTMLDivElement>(null)
  // OS preference OR the in-app html[data-motion="reduced"] switch.
  const reduced = useMotionReduced()
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || !document.hidden)

  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    let io: IntersectionObserver | undefined
    if (hostRef.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.01 })
      io.observe(hostRef.current)
    }
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      io?.disconnect()
    }
  }, [])

  return { hostRef, reduced, running: !reduced && inView && tabVisible }
}

export default function HeroCanvas() {
  const { hostRef, reduced, running } = useSceneActivity()
  const animate = !reduced

  return (
    <div
      ref={hostRef}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'transparent',
        // Dissolve the canvas edges so the scene melts into the panel, never a rectangle.
        WebkitMaskImage: 'radial-gradient(ellipse 72% 78% at 50% 50%, #000 55%, transparent 100%)',
        maskImage: 'radial-gradient(ellipse 72% 78% at 50% 50%, #000 55%, transparent 100%)',
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.1, REST_Z], fov: 36, near: 0.1, far: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false, depth: true }}
        frameloop={running ? 'always' : 'demand'}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 0)
          gl.setClearAlpha(0)
          scene.background = null
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
        style={{ background: 'transparent', display: 'block', width: '100%', height: '100%' }}
        aria-label="Animated abstract NEXORA orbital network"
      >
        <Atmosphere />
        <Rig animate={animate}>
          {/* back: recedes against the pointer */}
          <Layer depth={-0.16} animate={animate}>
            <PointCloud count={220} seed={11} make={makeShell} animate={animate} spin={0.018} />
          </Layer>

          {/* mid: the model */}
          <Layer depth={0} animate={animate}>
            <PointCloud count={1100} seed={29} make={makeDisk} alpha={1.9} scale={4.2} tilt={[0.36, 0, -0.3]} spin={0.05} animate={animate} />
            <group rotation={[0.28, 0, -0.12]}>
              <Orbit radius={1.74} tilt={[Math.PI / 2.35, 0.2, -0.18]} color={CYAN} speed={0.2} base={0.22} power={3.2} phase={0.8} animate={animate} />
              <Orbit radius={2.02} tilt={[0.42, Math.PI / 3.2, 0.5]} color={VIOLET_SOFT} speed={-0.14} base={0.2} power={2.6} moon={0.12} phase={3.1} animate={animate} />
              <Orbit radius={2.3} tilt={[1.12, 0.45, 0.12]} color={VIOLET} speed={0.09} tube={0.005} base={0.14} power={2.2} node={0.028} phase={5.2} animate={animate} />
              <TickRing radius={2.58} tilt={[1.38, -0.2, 0.3]} animate={animate} />
            </group>
            <Nucleus animate={animate} />
          </Layer>

          {/* front: faint out-of-focus motes that drift with the pointer */}
          <Layer depth={0.34} animate={animate}>
            <PointCloud count={9} seed={73} make={makeBokeh} alpha={0.11} soft={1.1} scale={1} animate={animate} />
          </Layer>
        </Rig>
      </Canvas>
    </div>
  )
}
