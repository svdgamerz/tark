import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface Props {
  isOpen: boolean
  onClose: () => void
}

type DisplayStyle = 'ball_and_stick' | 'space_filling' | 'wireframe'

interface AtomData {
  element: string
  x: number
  y: number
  z: number
  color: string
  radius: number
  vdwRadius: number
  charge?: string
  hybridization?: string
  electronegativity?: number
}

interface BondData {
  from: number
  to: number
  order?: number // 1, 2, or aromatic
}

interface MoleculeSpec {
  id: string
  name: string
  formula: string
  geometry: string
  category: 'Inorganic' | 'Organic' | 'Biochemistry' | 'Solid State'
  dipoleMoment?: string
  description: string
  atoms: AtomData[]
  bonds: BondData[]
  hasDelocalizedRing?: boolean
}

// Curriculum molecules with accurate bond geometries and 3D coordinates
const MOLECULES: MoleculeSpec[] = [
  {
    id: 'water',
    name: 'Water',
    formula: 'H₂O',
    geometry: 'Bent (104.5°)',
    category: 'Inorganic',
    dipoleMoment: '1.85 Debye (Highly Polar)',
    description: 'VSEPR bent geometry due to two lone pairs on oxygen. Forms extensive hydrogen bonds.',
    atoms: [
      { element: 'O', x: 0, y: 0.12, z: 0, color: '#ef4444', radius: 0.36, vdwRadius: 0.75, charge: 'δ⁻ (Partial Negative)', hybridization: 'sp³', electronegativity: 3.44 },
      { element: 'H', x: -0.76, y: -0.47, z: 0, color: '#f8fafc', radius: 0.22, vdwRadius: 0.52, charge: 'δ⁺ (Partial Positive)', hybridization: '1s', electronegativity: 2.20 },
      { element: 'H', x: 0.76, y: -0.47, z: 0, color: '#f8fafc', radius: 0.22, vdwRadius: 0.52, charge: 'δ⁺ (Partial Positive)', hybridization: '1s', electronegativity: 2.20 },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
    ],
  },
  {
    id: 'methane',
    name: 'Methane',
    formula: 'CH₄',
    geometry: 'Tetrahedral (109.5°)',
    category: 'Organic',
    dipoleMoment: '0.00 Debye (Non-polar)',
    description: 'Archetypal sp³ hybridized carbon. Symmetrical tetrahedral arrangement cancels all dipole vectors.',
    atoms: [
      { element: 'C', x: 0, y: 0, z: 0, color: '#334155', radius: 0.38, vdwRadius: 0.78, charge: 'Neutral', hybridization: 'sp³', electronegativity: 2.55 },
      { element: 'H', x: 0.63, y: 0.63, z: 0.63, color: '#f8fafc', radius: 0.22, vdwRadius: 0.52, charge: 'Neutral', hybridization: '1s', electronegativity: 2.20 },
      { element: 'H', x: -0.63, y: -0.63, z: 0.63, color: '#f8fafc', radius: 0.22, vdwRadius: 0.52, charge: 'Neutral', hybridization: '1s', electronegativity: 2.20 },
      { element: 'H', x: -0.63, y: 0.63, z: -0.63, color: '#f8fafc', radius: 0.22, vdwRadius: 0.52, charge: 'Neutral', hybridization: '1s', electronegativity: 2.20 },
      { element: 'H', x: 0.63, y: -0.63, z: -0.63, color: '#f8fafc', radius: 0.22, vdwRadius: 0.52, charge: 'Neutral', hybridization: '1s', electronegativity: 2.20 },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
      { from: 0, to: 4, order: 1 },
    ],
  },
  {
    id: 'ammonia',
    name: 'Ammonia',
    formula: 'NH₃',
    geometry: 'Trigonal Pyramidal (107.8°)',
    category: 'Inorganic',
    dipoleMoment: '1.47 Debye (Polar)',
    description: 'Nitrogen with one unshared electron pair causing bond angle compression from 109.5° to 107.8°.',
    atoms: [
      { element: 'N', x: 0, y: 0.15, z: 0, color: '#3b82f6', radius: 0.36, vdwRadius: 0.74, charge: 'δ⁻', hybridization: 'sp³', electronegativity: 3.04 },
      { element: 'H', x: 0.94, y: -0.25, z: 0, color: '#f8fafc', radius: 0.22, vdwRadius: 0.52, charge: 'δ⁺', hybridization: '1s', electronegativity: 2.20 },
      { element: 'H', x: -0.47, y: -0.25, z: 0.81, color: '#f8fafc', radius: 0.22, vdwRadius: 0.52, charge: 'δ⁺', hybridization: '1s', electronegativity: 2.20 },
      { element: 'H', x: -0.47, y: -0.25, z: -0.81, color: '#f8fafc', radius: 0.22, vdwRadius: 0.52, charge: 'δ⁺', hybridization: '1s', electronegativity: 2.20 },
    ],
    bonds: [
      { from: 0, to: 1, order: 1 },
      { from: 0, to: 2, order: 1 },
      { from: 0, to: 3, order: 1 },
    ],
  },
  {
    id: 'benzene',
    name: 'Benzene',
    formula: 'C₆H₆',
    geometry: 'Planar Hexagonal (120°)',
    category: 'Organic',
    dipoleMoment: '0.00 Debye (Aromatic)',
    description: 'Complete cyclic conjugation with delocalized 6 π-electrons satisfying Hückel 4n+2 rule.',
    hasDelocalizedRing: true,
    atoms: [
      // 6 carbons in hexagon
      ...Array.from({ length: 6 }).map((_, i) => {
        const ang = (i * Math.PI) / 3
        const r = 1.4
        return {
          element: 'C',
          x: Math.cos(ang) * r,
          y: Math.sin(ang) * r,
          z: 0,
          color: '#334155',
          radius: 0.35,
          vdwRadius: 0.75,
          charge: 'Aromatic Ring',
          hybridization: 'sp²',
          electronegativity: 2.55,
        }
      }),
      // 6 hydrogens
      ...Array.from({ length: 6 }).map((_, i) => {
        const ang = (i * Math.PI) / 3
        const r = 2.45
        return {
          element: 'H',
          x: Math.cos(ang) * r,
          y: Math.sin(ang) * r,
          z: 0,
          color: '#f8fafc',
          radius: 0.22,
          vdwRadius: 0.52,
          charge: 'Neutral',
          hybridization: '1s',
          electronegativity: 2.20,
        }
      }),
    ],
    bonds: [
      { from: 0, to: 1, order: 2 },
      { from: 1, to: 2, order: 1 },
      { from: 2, to: 3, order: 2 },
      { from: 3, to: 4, order: 1 },
      { from: 4, to: 5, order: 2 },
      { from: 5, to: 0, order: 1 },
      { from: 0, to: 6, order: 1 },
      { from: 1, to: 7, order: 1 },
      { from: 2, to: 8, order: 1 },
      { from: 3, to: 9, order: 1 },
      { from: 4, to: 10, order: 1 },
      { from: 5, to: 11, order: 1 },
    ],
  },
  {
    id: 'nacl_crystal',
    name: 'Sodium Chloride (Halite Lattice)',
    formula: 'NaCl Unit Cell',
    geometry: 'Face-Centered Cubic (FCC)',
    category: 'Solid State',
    dipoleMoment: 'Ionic Lattice (Coordination 6:6)',
    description: 'Each Na⁺ ion is octahedrally coordinated by 6 Cl⁻ ions, and vice-versa. Demonstrates ionic close packing.',
    atoms: [
      // Na+ ions (violet/purple) and Cl- ions (green) alternating in 3x3x3 grid
      ...(() => {
        const list: AtomData[] = []
        for (let ix = -1; ix <= 1; ix++) {
          for (let iy = -1; iy <= 1; iy++) {
            for (let iz = -1; iz <= 1; iz++) {
              const isNa = (ix + iy + iz) % 2 === 0
              list.push({
                element: isNa ? 'Na⁺' : 'Cl⁻',
                x: ix * 1.15,
                y: iy * 1.15,
                z: iz * 1.15,
                color: isNa ? '#a855f7' : '#10b981',
                radius: isNa ? 0.28 : 0.42,
                vdwRadius: isNa ? 0.45 : 0.68,
                charge: isNa ? '+1 Cation' : '-1 Anion',
                hybridization: 'Ionic Octahedral',
                electronegativity: isNa ? 0.93 : 3.16,
              })
            }
          }
        }
        return list
      })(),
    ],
    bonds: [
      // Connect adjacent lattice points
      ...(() => {
        const b: BondData[] = []
        // Simple neighbor bonds along axes
        for (let i = 0; i < 27; i++) {
          for (let j = i + 1; j < 27; j++) {
            // Distance check ~1.15
            // calculated dynamically in viewer
          }
        }
        return b
      })(),
    ],
  },
  {
    id: 'dna_helix',
    name: 'DNA Double Helix Segment',
    formula: 'B-DNA (A-T, G-C)',
    geometry: 'Right-handed Double Helix',
    category: 'Biochemistry',
    dipoleMoment: 'Polyanionic Phosphate Backbone',
    description: 'Major and minor grooves with complementary hydrogen-bonded purine and pyrimidine base pairs.',
    atoms: [
      ...(() => {
        const list: AtomData[] = []
        const numPairs = 8
        const pitch = 0.55
        const radius = 1.35
        for (let p = 0; p < numPairs; p++) {
          const theta = (p * Math.PI) / 4
          const y = (p - numPairs / 2) * pitch
          // Strand 1 Backbone
          list.push({
            element: 'P',
            x: Math.cos(theta) * radius,
            y,
            z: Math.sin(theta) * radius,
            color: '#f59e0b',
            radius: 0.32,
            vdwRadius: 0.6,
            charge: 'Phosphate -1',
            hybridization: 'Backbone',
          })
          // Strand 2 Backbone (opposite by PI)
          list.push({
            element: 'P',
            x: Math.cos(theta + Math.PI) * radius,
            y,
            z: Math.sin(theta + Math.PI) * radius,
            color: '#f59e0b',
            radius: 0.32,
            vdwRadius: 0.6,
            charge: 'Phosphate -1',
            hybridization: 'Backbone',
          })
          // Base 1 (Adenine/Guanine)
          list.push({
            element: p % 2 === 0 ? 'A' : 'G',
            x: Math.cos(theta) * (radius * 0.45),
            y,
            z: Math.sin(theta) * (radius * 0.45),
            color: p % 2 === 0 ? '#38bdf8' : '#3b82f6',
            radius: 0.28,
            vdwRadius: 0.55,
            charge: 'Purine Base',
          })
          // Base 2 (Thymine/Cytosine)
          list.push({
            element: p % 2 === 0 ? 'T' : 'C',
            x: Math.cos(theta + Math.PI) * (radius * 0.45),
            y,
            z: Math.sin(theta + Math.PI) * (radius * 0.45),
            color: p % 2 === 0 ? '#ec4899' : '#10b981',
            radius: 0.28,
            vdwRadius: 0.55,
            charge: 'Pyrimidine Base',
          })
        }
        return list
      })(),
    ],
    bonds: [],
  },
]

export function MolecularViewerModal({ isOpen, onClose }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [selectedMoleculeId, setSelectedMoleculeId] = useState<string>('water')
  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>('ball_and_stick')
  const [autoRotate, setAutoRotate] = useState<boolean>(true)
  const [showDipole, setShowDipole] = useState<boolean>(true)
  const [inspectedAtom, setInspectedAtom] = useState<AtomData | null>(null)

  const activeMolecule = MOLECULES.find((m) => m.id === selectedMoleculeId) || MOLECULES[0]

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Setup Three.js 3D Scene
  useEffect(() => {
    if (!isOpen || !mountRef.current) return

    const container = mountRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x060913)

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(0, 1.5, 6.5)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    // Studio Lighting
    const amb = new THREE.AmbientLight(0xffffff, 0.65)
    scene.add(amb)

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3)
    keyLight.position.set(5, 8, 6)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.8)
    fillLight.position.set(-6, -4, 4)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.7)
    rimLight.position.set(0, 6, -6)
    scene.add(rimLight)

    // Molecular Group
    const molGroup = new THREE.Group()
    scene.add(molGroup)

    // Material caches
    const sphereGeoLow = new THREE.SphereGeometry(1, 32, 32)
    const cylGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 16)

    // Raycaster for clicking atoms
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const atomMeshes: { mesh: THREE.Mesh; atom: AtomData }[] = []

    // Populate Molecule Atoms
    activeMolecule.atoms.forEach((atom) => {
      const atomRadius = displayStyle === 'space_filling' ? atom.vdwRadius : atom.radius
      const atomMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(atom.color),
        roughness: 0.18,
        metalness: 0.15,
        clearcoat: 0.45,
        clearcoatRoughness: 0.1,
      })
      const mesh = new THREE.Mesh(sphereGeoLow, atomMat)
      mesh.scale.setScalar(atomRadius)
      mesh.position.set(atom.x, atom.y, atom.z)
      molGroup.add(mesh)
      atomMeshes.push({ mesh, atom })
    })

    // Populate Bonds
    if (displayStyle !== 'space_filling') {
      const bondMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.35,
        metalness: 0.3,
      })

      // Explicit bonds
      if (activeMolecule.bonds.length > 0) {
        activeMolecule.bonds.forEach((b) => {
          const a1 = activeMolecule.atoms[b.from]
          const a2 = activeMolecule.atoms[b.to]
          if (!a1 || !a2) return

          const p1 = new THREE.Vector3(a1.x, a1.y, a1.z)
          const p2 = new THREE.Vector3(a2.x, a2.y, a2.z)
          const dist = p1.distanceTo(p2)
          const mid = p1.clone().add(p2).multiplyScalar(0.5)

          const bondMesh = new THREE.Mesh(cylGeo, bondMat)
          bondMesh.scale.set(1, dist, 1)
          bondMesh.position.copy(mid)
          bondMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize())
          molGroup.add(bondMesh)
        })
      } else if (activeMolecule.id === 'nacl_crystal') {
        // Build lattice bonds dynamically
        const atoms = activeMolecule.atoms
        for (let i = 0; i < atoms.length; i++) {
          for (let j = i + 1; j < atoms.length; j++) {
            const p1 = new THREE.Vector3(atoms[i].x, atoms[i].y, atoms[i].z)
            const p2 = new THREE.Vector3(atoms[j].x, atoms[j].y, atoms[j].z)
            const d = p1.distanceTo(p2)
            if (Math.abs(d - 1.15) < 0.1) {
              const mid = p1.clone().add(p2).multiplyScalar(0.5)
              const bondMesh = new THREE.Mesh(cylGeo, bondMat)
              bondMesh.scale.set(0.6, d, 0.6)
              bondMesh.position.copy(mid)
              bondMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p2.clone().sub(p1).normalize())
              molGroup.add(bondMesh)
            }
          }
        }
      }
    }

    // Dipole Moment Vector Arrow
    if (showDipole && activeMolecule.dipoleMoment && activeMolecule.dipoleMoment.includes('Debye') && !activeMolecule.dipoleMoment.includes('0.00')) {
      const dir = new THREE.Vector3(0, -1, 0) // e.g. for water points towards O
      const origin = new THREE.Vector3(0, 1.2, 0)
      const length = 1.4
      const hex = 0xf43f5e
      const arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex, 0.35, 0.22)
      molGroup.add(arrowHelper)
    }

    // Benzene Pi-Electron Delocalization Torus Rings
    if (activeMolecule.hasDelocalizedRing) {
      const ringGeo = new THREE.TorusGeometry(1.0, 0.12, 16, 48)
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        wireframe: false,
      })
      const ringTop = new THREE.Mesh(ringGeo, ringMat)
      ringTop.position.set(0, 0, 0.45)
      molGroup.add(ringTop)

      const ringBottom = new THREE.Mesh(ringGeo, ringMat)
      ringBottom.position.set(0, 0, -0.45)
      molGroup.add(ringBottom)
    }

    // Smooth Orbit & Damping Mouse
    let isDragging = false
    let prevMouseX = 0
    let prevMouseY = 0
    let rotX = 0.2
    let rotY = 0.4
    let targetRotX = rotX
    let targetRotY = rotY
    let targetZoom = 6.5
    let curZoom = 6.5

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true
      prevMouseX = e.clientX
      prevMouseY = e.clientY

      // Check click raycast for atom inspection
      const rect = container.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(atomMeshes.map((a) => a.mesh))
      if (hits.length > 0) {
        const found = atomMeshes.find((a) => a.mesh === hits[0].object)
        if (found) setInspectedAtom(found.atom)
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - prevMouseX
      const dy = e.clientY - prevMouseY
      targetRotY += dx * 0.008
      targetRotX += dy * 0.008
      prevMouseX = e.clientX
      prevMouseY = e.clientY
    }

    const onMouseUp = () => {
      isDragging = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      targetZoom = Math.max(3.0, Math.min(14.0, targetZoom + e.deltaY * 0.006))
    }

    const dom = renderer.domElement
    dom.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    dom.addEventListener('wheel', onWheel, { passive: false })

    // Animation Loop
    let animId: number
    const animate = () => {
      animId = requestAnimationFrame(animate)

      // Auto rotation
      if (autoRotate && !isDragging) {
        targetRotY += 0.005
      }

      // Smooth damping interpolation
      rotX += (targetRotX - rotX) * 0.08
      rotY += (targetRotY - rotY) * 0.08
      curZoom += (targetZoom - curZoom) * 0.08

      molGroup.rotation.x = rotX
      molGroup.rotation.y = rotY
      camera.position.z = curZoom

      renderer.render(scene, camera)
    }

    animate()

    // Resize
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(animId)
      dom.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      dom.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      sphereGeoLow.dispose()
      cylGeo.dispose()
    }
  }, [isOpen, selectedMoleculeId, displayStyle, autoRotate, showDipole])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1240px',
          height: '92vh',
          background: '#070d18',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(15, 23, 42, 0.8), rgba(7, 13, 24, 0.95))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #059669, #10b981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)',
                fontSize: '20px',
              }}
            >
              🧪
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  Interactive 3D Molecular & Crystal Viewer
                </h2>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontWeight: 600,
                  }}
                >
                  Three.js PBR Engine
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                Explore molecular geometries, orbital hybridizations, dipole vectors, and solid-state crystal lattices.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff'
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#94a3b8'
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 3D WebGL Canvas */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

            {/* In-Canvas Title Overlay */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(10px)',
                padding: '12px 18px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {activeMolecule.name}
                </span>
                <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600, fontFamily: 'monospace' }}>
                  {activeMolecule.formula}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                Geometry: <strong style={{ color: '#e2e8f0' }}>{activeMolecule.geometry}</strong>
              </div>
            </div>

            {/* Clicked Atom Inspector Tooltip */}
            {inspectedAtom && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '20px',
                  background: 'rgba(11, 19, 36, 0.95)',
                  backdropFilter: 'blur(12px)',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
                  width: '280px',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: inspectedAtom.color,
                        display: 'inline-block',
                      }}
                    />
                    <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>
                      Atom: {inspectedAtom.element}
                    </strong>
                  </div>
                  <button
                    onClick={() => setInspectedAtom(null)}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>State: <span style={{ color: '#38bdf8' }}>{inspectedAtom.charge || 'Neutral'}</span></div>
                  {inspectedAtom.hybridization && <div>Hybridization: <span style={{ color: '#a855f7' }}>{inspectedAtom.hybridization}</span></div>}
                  {inspectedAtom.electronegativity && <div>Pauling Electronegativity: <span style={{ color: '#fbbf24' }}>{inspectedAtom.electronegativity}</span></div>}
                </div>
              </div>
            )}
          </div>

          {/* Right Control & Library Sidebar */}
          <div
            style={{
              width: '340px',
              background: 'rgba(11, 19, 36, 0.95)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
            }}
          >
            {/* Molecule Library */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', marginBottom: '8px' }}>
                Curriculum Library
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {MOLECULES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMoleculeId(m.id)
                      setInspectedAtom(null)
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: selectedMoleculeId === m.id ? 'rgba(16, 185, 129, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                      border: selectedMoleculeId === m.id ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.06)',
                      color: selectedMoleculeId === m.id ? '#34d399' : '#e2e8f0',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{m.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '1px' }}>{m.geometry}</div>
                    </div>
                    <span style={{ fontSize: '0.74rem', fontFamily: 'monospace', color: '#10b981' }}>{m.formula}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Display Models */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '14px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                Display Model
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: 'ball_and_stick', label: 'Ball & Stick' },
                  { id: 'space_filling', label: 'Space Filling (vdW)' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setDisplayStyle(mode.id as DisplayStyle)}
                    style={{
                      flex: 1,
                      padding: '8px 6px',
                      borderRadius: '8px',
                      background: displayStyle === mode.id ? '#059669' : 'rgba(255, 255, 255, 0.05)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoRotate}
                  onChange={(e) => setAutoRotate(e.target.checked)}
                  style={{ accentColor: '#10b981' }}
                />
                <span>Smooth 3D Orbit Rotation</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: '#e2e8f0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showDipole}
                  onChange={(e) => setShowDipole(e.target.checked)}
                  style={{ accentColor: '#f43f5e' }}
                />
                <span>Net Dipole Moment Vector (μ)</span>
              </label>
            </div>

            {/* Chemistry Pedagogical Insights Card */}
            <div
              style={{
                marginTop: 'auto',
                padding: '14px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>
                {activeMolecule.category} Analysis
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.5 }}>
                {activeMolecule.description}
              </div>
              {activeMolecule.dipoleMoment && (
                <div style={{ fontSize: '0.74rem', color: '#fbbf24', marginTop: '4px' }}>
                  ⚡ Dipole: {activeMolecule.dipoleMoment}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
