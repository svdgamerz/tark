# -*- coding: utf-8 -*-
"""Three.js 3D Master Procedural Laboratory Engine for Tark.

Generates university/research-grade 3D WebGL apparatus models with:
- 100% procedural Three.js geometries (zero external .gltf downloads, 0ms load, offline safe)
- OrbitControls (free 360-degree rotation, pinch/scroll zoom, pan)
- Camera view angle HUD ([📐 Front], [🔝 Top], [💎 Iso], [🔍 Macro], [🔄 Auto])
- High-fidelity PBR/Phong materials (refractive glassware, brushed metals, glowing plasma)
- Dynamic 60 FPS 3D motion graphics:
  * Fluid meniscus and 3D vortex swirl
  * Rising effervescent micro-bubble particles
  * Streaming electron particle clouds along circuit conductors
  * Rotating armature coils with pulsing magnetic flux lines
  * Pascal hydraulic pistons lifting industrial loads
  * Real-time harmonic SHM oscillators with dynamic force/velocity vectors
  * Snell's law refracted laser beams with prismatic rainbow dispersion
  * Cellular lipid bilayer undulation and catalytic enzyme substrate docking
"""

import json
from typing import Any


def get_three_scripts_html() -> str:
    """Return Three.js bundle loader with local bundle priority and CDN fallback."""
    return """
<!-- Standalone Three.js + OrbitControls Engine -->
<script src="/vendor/three.bundle.js"></script>
<script>
if (typeof THREE === 'undefined') {
  document.write('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\\/script>');
  document.write('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"><\\/script>');
}
</script>
"""


def get_three_ui_html() -> str:
    """Return HTML elements for WebGL container and camera controls."""
    return """
    <!-- Three.js 3D WebGL Apparatus Viewport -->
    <div id="webglContainer"></div>

    <!-- Quick Camera Angle Switcher HUD -->
    <div id="cameraControls3D" class="camera-hud-3d">
      <span class="camera-hud-title">🎥 3D VIEW</span>
      <button type="button" class="cam-btn active" data-cam="iso" title="Isometric 3D Perspective">💎 Iso</button>
      <button type="button" class="cam-btn" data-cam="front" title="Front Apparatus View">📐 Front</button>
      <button type="button" class="cam-btn" data-cam="top" title="Top-Down Overhead View">🔝 Top</button>
      <button type="button" class="cam-btn" data-cam="macro" title="Macro Close-Up View">🔍 Macro</button>
      <button type="button" class="cam-btn" data-cam="orbit" title="Toggle Auto-Rotation">🔄 Auto</button>
      <button type="button" class="cam-btn" data-cam="reset" title="Reset Viewport">↺ Reset</button>
    </div>

    <!-- Viewport Interaction Guide -->
    <div class="viewport-hint-3d">
      <span>🖱️ Left-Click: Orbit · Right-Click: Pan · Scroll: Zoom</span>
    </div>
"""


def get_three_css() -> str:
    """Return CSS styles for 3D viewport, camera HUD, and responsive layout."""
    return """
/* Three.js 3D Master WebGL Viewport */
#webglContainer {
  position: absolute;
  top: 0;
  left: 0;
  width: 62%;
  height: 100%;
  z-index: 1;
  background: radial-gradient(circle at 35% 35%, #0d1b2e 0%, #070d18 70%);
  cursor: grab;
}
#webglContainer:active {
  cursor: grabbing;
}

/* Semi-transparent 2D HUD Canvas overlaying the 3D scene */
#simCanvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none; /* Allows mouse events to pass directly to 3D OrbitControls! */
}

/* Quick 3D Camera Controls HUD */
.camera-hud-3d {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(11, 19, 41, 0.90);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 8px;
  padding: 4px 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.65);
  pointer-events: auto;
  user-select: none;
}
.camera-hud-title {
  font-size: 0.68rem;
  font-weight: 800;
  color: #38bdf8;
  letter-spacing: 0.05em;
  margin-right: 3px;
}
.cam-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #cbd5e1;
  padding: 3px 8px;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.cam-btn:hover {
  background: rgba(56, 189, 248, 0.25);
  border-color: rgba(56, 189, 248, 0.6);
  color: #38bdf8;
}
.cam-btn.active {
  background: rgba(56, 189, 248, 0.3);
  border-color: #38bdf8;
  color: #38bdf8;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
}

/* 3D Interaction Navigation Pill */
.viewport-hint-3d {
  position: absolute;
  bottom: 12px;
  left: 14px;
  z-index: 15;
  background: rgba(11, 19, 41, 0.75);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-radius: 6px;
  padding: 3px 9px;
  font-size: 0.68rem;
  font-weight: 600;
  color: #94a3b8;
  pointer-events: none;
  user-select: none;
}
"""


def get_three_js_engine(title: str, subject: str, formula: str, params: list[dict[str, Any]]) -> str:
    """Return the JavaScript code for the Three.js 3D Master Procedural Engine."""
    return f"""
  // =========================================================================
  // Master Three.js 3D Procedural Laboratory Engine
  // =========================================================================

  let threeLabActive = false;
  let scene3D = null, camera3D = null, renderer3D = null, controls3D = null;
  let anim3DObjects = {{}};
  let autoRotate3D = false;

  const CAM_PRESETS = {{
    iso:   {{ pos: [12, 11, 15], target: [0, 0, 0] }},
    front: {{ pos: [0, 1.5, 18], target: [0, 0, 0] }},
    top:   {{ pos: [0, 19, 0.1], target: [0, 0, 0] }},
    macro: {{ pos: [4.5, 2.0, 7.0], target: [0, 0.5, 0] }}
  }};

  function initThreeLab() {{
    const container = document.getElementById('webglContainer');
    if (!container || typeof THREE === 'undefined') {{
      console.warn('Three.js not available, falling back to 2D canvas apparatus.');
      return false;
    }}

    try {{
      const width = container.clientWidth || 500;
      const height = container.clientHeight || 400;

      // 1. Scene & Atmosphere
      scene3D = new THREE.Scene();
      scene3D.fog = new THREE.FogExp2(0x070d18, 0.012);

      // 2. Camera
      camera3D = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
      camera3D.position.set(12, 11, 15);

      // 3. Renderer with high visual fidelity & anti-aliasing
      renderer3D = new THREE.WebGLRenderer({{ antialias: true, alpha: true, powerPreference: 'high-performance' }});
      renderer3D.setSize(width, height);
      renderer3D.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer3D.toneMapping = THREE.ACESFilmicToneMapping;
      renderer3D.toneMappingExposure = 1.15;
      container.innerHTML = '';
      container.appendChild(renderer3D.domElement);

      // 4. OrbitControls
      if (typeof THREE.OrbitControls === 'function') {{
        controls3D = new THREE.OrbitControls(camera3D, renderer3D.domElement);
        controls3D.enableDamping = true;
        controls3D.dampingFactor = 0.06;
        controls3D.maxPolarAngle = Math.PI * 0.82;
        controls3D.minDistance = 3.5;
        controls3D.maxDistance = 55;
        controls3D.target.set(0, 0, 0);
      }}

      // 5. Studio Laboratory Lighting Rig
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
      scene3D.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
      keyLight.position.set(14, 22, 16);
      scene3D.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
      fillLight.position.set(-16, 12, -10);
      scene3D.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0x818cf8, 0.4);
      rimLight.position.set(0, -10, -16);
      scene3D.add(rimLight);

      // 6. Scientific Pedestal Grid Floor
      const grid = new THREE.GridHelper(32, 32, 0x38bdf8, 0x1e293b);
      grid.position.y = -4.5;
      scene3D.add(grid);

      // Shadow pedestal disk
      const pedGeo = new THREE.CylinderGeometry(8.5, 9.0, 0.25, 48);
      const pedMat = new THREE.MeshStandardMaterial({{ color: 0x091428, roughness: 0.8, metalness: 0.2 }});
      const pedestal = new THREE.Mesh(pedGeo, pedMat);
      pedestal.position.y = -4.62;
      scene3D.add(pedestal);

      // Glowing cyan accent ring
      const ringGeo = new THREE.RingGeometry(8.4, 8.6, 48);
      const ringMat = new THREE.MeshBasicMaterial({{ color: 0x38bdf8, side: THREE.DoubleSide }});
      const pedRing = new THREE.Mesh(ringGeo, ringMat);
      pedRing.rotation.x = -Math.PI / 2;
      pedRing.position.y = -4.49;
      scene3D.add(pedRing);

      // 7. Build Archetype-Specific 3D Apparatus
      buildProcedural3DApparatus(scene3D, state.params);

      // 8. Wire Camera Switcher HUD Buttons
      setupCameraButtons();

      threeLabActive = true;
      return true;
    }} catch (e) {{
      console.error('Failed to initialize Three.js 3D lab:', e);
      threeLabActive = false;
      return false;
    }}
  }}

  function setupCameraButtons() {{
    const btns = document.querySelectorAll('.cam-btn');
    btns.forEach(btn => {{
      btn.addEventListener('click', (e) => {{
        e.stopPropagation();
        const mode = btn.getAttribute('data-cam');
        if (mode === 'orbit') {{
          autoRotate3D = !autoRotate3D;
          btn.classList.toggle('active', autoRotate3D);
          return;
        }}
        if (mode === 'reset') {{
          setCameraView('iso');
          return;
        }}
        btns.forEach(b => {{ if (b.getAttribute('data-cam') !== 'orbit') b.classList.remove('active'); }});
        btn.classList.add('active');
        setCameraView(mode);
      }});
    }});
  }}

  function setCameraView(presetName) {{
    const p = CAM_PRESETS[presetName] || CAM_PRESETS.iso;
    if (!camera3D || !controls3D) return;
    camera3D.position.set(...p.pos);
    controls3D.target.set(...p.target);
    controls3D.update();
  }}

  // =========================================================================
  // Procedural 3D Apparatus Builders (7 Core Archetypes)
  // =========================================================================

  function buildProcedural3DApparatus(scene, p) {{
    const titleStr = {json.dumps(title)}.toLowerCase();
    const subjectStr = {json.dumps(subject)}.toLowerCase();

    const isElectrochem = titleStr.includes('redox') || titleStr.includes('cell') || titleStr.includes('titration') || 
                          titleStr.includes('electrolysis') || titleStr.includes('cu') || titleStr.includes('zinc') || 
                          titleStr.includes('acid') || titleStr.includes('solution') || subjectStr.includes('chem');

    const isCircuit = titleStr.includes('ohm') || titleStr.includes('circuit') || titleStr.includes('resistor') || 
                      titleStr.includes('voltage') || titleStr.includes('current') || titleStr.includes('induction') || 
                      titleStr.includes('faraday') || titleStr.includes('magnetic') || titleStr.includes('electricity') ||
                      titleStr.includes('motor') || titleStr.includes('generator');

    const isFluid = titleStr.includes('piston') || titleStr.includes('hydraulic') || titleStr.includes('pascal') || 
                    titleStr.includes('gas') || titleStr.includes('pressure') || titleStr.includes('boyle') || 
                    titleStr.includes('charles');

    const isMechanics = titleStr.includes('pendulum') || titleStr.includes('spring') || titleStr.includes('projectile') || 
                        titleStr.includes('motion') || titleStr.includes('gravity') || titleStr.includes('harmonic') || 
                        titleStr.includes('oscillation');

    const isOptics = titleStr.includes('optic') || titleStr.includes('ray') || titleStr.includes('lens') || 
                     titleStr.includes('snell') || titleStr.includes('focal') || titleStr.includes('refract') || 
                     titleStr.includes('prism') || titleStr.includes('laser');

    const isBio = titleStr.includes('bio') || titleStr.includes('dna') || titleStr.includes('enzyme') || 
                  titleStr.includes('cell') || titleStr.includes('membrane') || subjectStr.includes('bio');

    if (isElectrochem) {{
      build3DElectrochemistry(scene, p);
    }} else if (isCircuit) {{
      build3DCircuits(scene, p);
    }} else if (isFluid) {{
      build3DFluids(scene, p);
    }} else if (isMechanics) {{
      build3DMechanics(scene, p);
    }} else if (isOptics) {{
      build3DOptics(scene, p);
    }} else if (isBio) {{
      build3DBiology(scene, p);
    }} else {{
      build3DUniversal(scene, p);
    }}
  }}

  // 1. 3D Electrochemistry: Dual Pyrex Beakers, Electrodes, Salt Bridge, Multimeter, Bubbles & Electrons
  function build3DElectrochemistry(scene, p) {{
    const group = new THREE.Group();
    anim3DObjects = {{ type: 'electrochem', bubbles: [], electrons: [] }};

    const glassMat = new THREE.MeshPhysicalMaterial({{
      color: 0xe0f2fe, transmission: 0.92, opacity: 0.45, transparent: true,
      roughness: 0.1, metalness: 0.05, depthWrite: false, side: THREE.DoubleSide
    }});

    // Left Beaker (ZnSO4)
    const beakerGeo = new THREE.CylinderGeometry(2.0, 2.0, 5.0, 32, 1, true);
    const leftBeaker = new THREE.Mesh(beakerGeo, glassMat);
    leftBeaker.position.set(-3.5, -1.5, 0);
    group.add(leftBeaker);

    // Left Beaker base
    const baseGeo = new THREE.CylinderGeometry(2.0, 2.0, 0.1, 32);
    const leftBase = new THREE.Mesh(baseGeo, glassMat);
    leftBase.position.set(-3.5, -4.0, 0);
    group.add(leftBase);

    // Left Solution (light zinc grey)
    const solGeoL = new THREE.CylinderGeometry(1.95, 1.95, 3.4, 32);
    const solMatL = new THREE.MeshStandardMaterial({{ color: 0x94a3b8, transparent: true, opacity: 0.65, roughness: 0.2 }});
    const leftSol = new THREE.Mesh(solGeoL, solMatL);
    leftSol.position.set(-3.5, -2.3, 0);
    group.add(leftSol);

    // Right Beaker (CuSO4)
    const rightBeaker = new THREE.Mesh(beakerGeo, glassMat);
    rightBeaker.position.set(3.5, -1.5, 0);
    group.add(rightBeaker);

    const rightBase = new THREE.Mesh(baseGeo, glassMat);
    rightBase.position.set(3.5, -4.0, 0);
    group.add(rightBase);

    // Right Solution (vibrant copper blue)
    const solGeoR = new THREE.CylinderGeometry(1.95, 1.95, 3.4, 32);
    const solMatR = new THREE.MeshStandardMaterial({{ color: 0x0284c7, transparent: true, opacity: 0.82, roughness: 0.15 }});
    const rightSol = new THREE.Mesh(solGeoR, solMatR);
    rightSol.position.set(3.5, -2.3, 0);
    group.add(rightSol);
    anim3DObjects.rightSol = rightSol;

    // Zinc Anode Plate (silver-grey metallic)
    const zincGeo = new THREE.BoxGeometry(0.55, 4.8, 0.16);
    const zincMat = new THREE.MeshStandardMaterial({{ color: 0xc8d1dc, metalness: 0.9, roughness: 0.25 }});
    const zincPlate = new THREE.Mesh(zincGeo, zincMat);
    zincPlate.position.set(-3.5, -1.2, 0);
    group.add(zincPlate);

    // Copper Cathode Plate (copper orange metallic)
    const cuGeo = new THREE.BoxGeometry(0.55, 4.8, 0.16);
    const cuMat = new THREE.MeshStandardMaterial({{ color: 0xdf7a44, metalness: 0.95, roughness: 0.2 }});
    const cuPlate = new THREE.Mesh(cuGeo, cuMat);
    cuPlate.position.set(3.5, -1.2, 0);
    group.add(cuPlate);
    anim3DObjects.cuPlate = cuPlate;

    // Glass U-Tube Salt Bridge
    const bridgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.2, -2.8, 0),
      new THREE.Vector3(-2.2, 0.2, 0),
      new THREE.Vector3(0, 0.6, 0),
      new THREE.Vector3(2.2, 0.2, 0),
      new THREE.Vector3(2.2, -2.8, 0)
    ]);
    const bridgeGeo = new THREE.TubeGeometry(bridgeCurve, 32, 0.35, 16, false);
    const bridgeMat = new THREE.MeshPhysicalMaterial({{
      color: 0xfef08a, transmission: 0.85, opacity: 0.7, transparent: true, roughness: 0.2
    }});
    const saltBridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    group.add(saltBridge);

    // 3D Digital Voltmeter / Multimeter Housing
    const meterGeo = new THREE.BoxGeometry(2.4, 1.5, 0.9);
    const meterMat = new THREE.MeshStandardMaterial({{ color: 0x0f172a, roughness: 0.5, metalness: 0.3 }});
    const meter = new THREE.Mesh(meterGeo, meterMat);
    meter.position.set(0, 3.2, 0);
    group.add(meter);

    // Digital Display Screen
    const screenGeo = new THREE.PlaneGeometry(1.8, 0.8);
    const screenMat = new THREE.MeshBasicMaterial({{ color: 0x0284c7 }});
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 3.2, 0.46);
    group.add(screen);

    // External Conductive Wire Spline (from Zn to Multimeter to Cu)
    const wireCurve1 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.5, 1.2, 0),
      new THREE.Vector3(-3.5, 3.2, 0),
      new THREE.Vector3(-1.2, 3.2, 0)
    ]);
    const wireGeo1 = new THREE.TubeGeometry(wireCurve1, 24, 0.08, 8, false);
    const wireMat1 = new THREE.MeshStandardMaterial({{ color: 0xef4444, metalness: 0.5, roughness: 0.3 }});
    group.add(new THREE.Mesh(wireGeo1, wireMat1));

    const wireCurve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.2, 3.2, 0),
      new THREE.Vector3(3.5, 3.2, 0),
      new THREE.Vector3(3.5, 1.2, 0)
    ]);
    const wireGeo2 = new THREE.TubeGeometry(wireCurve2, 24, 0.08, 8, false);
    const wireMat2 = new THREE.MeshStandardMaterial({{ color: 0x0284c7, metalness: 0.5, roughness: 0.3 }});
    group.add(new THREE.Mesh(wireGeo2, wireMat2));

    // Animated Bubble Particles in Solutions
    const bGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const bMat = new THREE.MeshStandardMaterial({{ color: 0xffffff, transparent: true, opacity: 0.7 }});
    for (let i = 0; i < 35; i++) {{
      const b = new THREE.Mesh(bGeo, bMat);
      const isRight = Math.random() > 0.5;
      b.position.set(
        (isRight ? 3.5 : -3.5) + (Math.random() - 0.5) * 2.8,
        -3.8 + Math.random() * 2.8,
        (Math.random() - 0.5) * 2.8
      );
      b.userData = {{ speed: 0.8 + Math.random() * 1.5, baseSide: isRight ? 3.5 : -3.5 }};
      group.add(b);
      anim3DObjects.bubbles.push(b);
    }}

    // Animated Electron Stream Particles along Wire
    const fullWireCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.5, 1.2, 0),
      new THREE.Vector3(-3.5, 3.2, 0),
      new THREE.Vector3(-1.2, 3.2, 0),
      new THREE.Vector3(0, 3.2, 0),
      new THREE.Vector3(1.2, 3.2, 0),
      new THREE.Vector3(3.5, 3.2, 0),
      new THREE.Vector3(3.5, 1.2, 0)
    ]);
    anim3DObjects.wireCurve = fullWireCurve;

    const eGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const eMat = new THREE.MeshBasicMaterial({{ color: 0x38bdf8 }});
    for (let i = 0; i < 20; i++) {{
      const eMesh = new THREE.Mesh(eGeo, eMat);
      eMesh.userData = {{ progress: i / 20 }};
      group.add(eMesh);
      anim3DObjects.electrons.push(eMesh);
    }}

    scene.add(group);
  }}

  // 2. 3D Circuits & Motors: Armature Coil, Magnets, Resistor, Battery, Filament Lightbulb
  function build3DCircuits(scene, p) {{
    const group = new THREE.Group();
    anim3DObjects = {{ type: 'circuit', electrons: [] }};

    // Breadboard Base
    const baseGeo = new THREE.BoxGeometry(15, 0.5, 11);
    const baseMat = new THREE.MeshStandardMaterial({{ color: 0x0b1329, roughness: 0.7, metalness: 0.3 }});
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -3.8;
    group.add(base);

    // North Magnet Pole Shoe (Crimson Red)
    const poleGeo = new THREE.BoxGeometry(2.2, 4.0, 3.5);
    const nMat = new THREE.MeshStandardMaterial({{ color: 0xef4444, metalness: 0.6, roughness: 0.3 }});
    const northPole = new THREE.Mesh(poleGeo, nMat);
    northPole.position.set(-3.2, -1.2, 0);
    group.add(northPole);

    // South Magnet Pole Shoe (Royal Blue)
    const sMat = new THREE.MeshStandardMaterial({{ color: 0x3b82f6, metalness: 0.6, roughness: 0.3 }});
    const southPole = new THREE.Mesh(poleGeo, sMat);
    southPole.position.set(3.2, -1.2, 0);
    group.add(southPole);

    // Rotating Armature Coil (Central Copper Wire Loop)
    const armGroup = new THREE.Group();
    const coilGeo = new THREE.BoxGeometry(2.4, 3.2, 1.2);
    const coilMat = new THREE.MeshStandardMaterial({{ color: 0xd97706, metalness: 0.85, roughness: 0.25, wireframe: false }});
    const coil = new THREE.Mesh(coilGeo, coilMat);
    armGroup.add(coil);

    // Rotating Axle
    const axleGeo = new THREE.CylinderGeometry(0.18, 0.18, 6.5, 16);
    const axleMat = new THREE.MeshStandardMaterial({{ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 }});
    const axle = new THREE.Mesh(axleGeo, axleMat);
    armGroup.add(axle);
    armGroup.position.set(0, -1.2, 0);
    group.add(armGroup);
    anim3DObjects.armature = armGroup;

    // Glowing Filament Lightbulb
    const bulbGroup = new THREE.Group();
    bulbGroup.position.set(0, 2.2, 3.2);

    const bulbSocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.8, 16),
      new THREE.MeshStandardMaterial({{ color: 0x64748b, metalness: 0.9, roughness: 0.2 }})
    );
    bulbGroup.add(bulbSocket);

    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 24, 24),
      new THREE.MeshPhysicalMaterial({{ color: 0xffedd5, transmission: 0.95, opacity: 0.5, transparent: true, roughness: 0.1 }})
    );
    glassDome.position.y = 1.0;
    bulbGroup.add(glassDome);

    const filMat = new THREE.MeshBasicMaterial({{ color: 0xfef08a }});
    const fil = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 16), filMat);
    fil.position.y = 1.0;
    bulbGroup.add(fil);

    // Dynamic 3D PointLight from bulb
    const bulbLight = new THREE.PointLight(0xffedd5, 1.8, 18);
    bulbLight.position.y = 1.0;
    bulbGroup.add(bulbLight);
    anim3DObjects.bulbLight = bulbLight;
    anim3DObjects.filament = fil;
    group.add(bulbGroup);

    // DC Battery
    const batGroup = new THREE.Group();
    batGroup.position.set(-4.5, -2.8, 3.5);
    const batBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 2.2, 20),
      new THREE.MeshStandardMaterial({{ color: 0x1e293b, metalness: 0.6, roughness: 0.4 }})
    );
    batBody.rotation.z = Math.PI / 2;
    batGroup.add(batBody);
    const batCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.3, 16),
      new THREE.MeshStandardMaterial({{ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 }})
    );
    batCap.rotation.z = Math.PI / 2;
    batCap.position.x = 1.2;
    batGroup.add(batCap);
    group.add(batGroup);

    // Ceramic Resistor with Color Bands
    const resGroup = new THREE.Group();
    resGroup.position.set(4.5, -2.8, 3.5);
    const resBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 2.0, 16),
      new THREE.MeshStandardMaterial({{ color: 0xd97706, roughness: 0.5 }})
    );
    resBody.rotation.z = Math.PI / 2;
    resGroup.add(resBody);
    group.add(resGroup);

    // Pulsing Magnetic Flux Lines (Curved lines between N and S poles)
    const fluxLines = [];
    for (let k = -1; k <= 1; k++) {{
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.1, -1.2 + k * 1.1, 0),
        new THREE.Vector3(0, -1.2 + k * 1.4, k * 0.8),
        new THREE.Vector3(2.1, -1.2 + k * 1.1, 0)
      ]);
      const fluxGeo = new THREE.TubeGeometry(curve, 20, 0.05, 8, false);
      const fluxMat = new THREE.MeshBasicMaterial({{ color: 0x38bdf8, transparent: true, opacity: 0.45 }});
      const fl = new THREE.Mesh(fluxGeo, fluxMat);
      group.add(fl);
      fluxLines.push(fl);
    }}
    anim3DObjects.fluxLines = fluxLines;

    scene.add(group);
  }}

  // 3. 3D Fluids & Hydraulics: Pascal Pistons, Communicating Tubes, Pressure Dial, Industrial Load
  function build3DFluids(scene, p) {{
    const group = new THREE.Group();
    anim3DObjects = {{ type: 'fluids', streamParticles: [] }};

    const glassMat = new THREE.MeshPhysicalMaterial({{
      color: 0xe0f2fe, transmission: 0.9, opacity: 0.4, transparent: true, roughness: 0.1, depthWrite: false
    }});
    const fluidMat = new THREE.MeshStandardMaterial({{
      color: 0x0284c7, transparent: true, opacity: 0.85, roughness: 0.2
    }});
    const steelMat = new THREE.MeshStandardMaterial({{
      color: 0x94a3b8, metalness: 0.95, roughness: 0.15
    }});

    // Input Cylinder (Narrow, Left: x = -3.5)
    const inCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6.0, 32, 1, true), glassMat);
    inCyl.position.set(-3.5, -0.5, 0);
    group.add(inCyl);

    // Output Cylinder (Wide, Right: x = 3.2)
    const outCyl = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 6.0, 32, 1, true), glassMat);
    outCyl.position.set(3.2, -0.5, 0);
    group.add(outCyl);

    // Bottom Connecting Manifold Tube
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.5, -3.5, 0),
      new THREE.Vector3(0, -3.5, 0),
      new THREE.Vector3(3.2, -3.5, 0)
    ]);
    const pipeGeo = new THREE.TubeGeometry(pipeCurve, 20, 0.6, 16, false);
    group.add(new THREE.Mesh(pipeGeo, glassMat));

    // Dynamic Fluid Columns
    const inFluid = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 3.0, 32), fluidMat);
    inFluid.position.set(-3.5, -2.0, 0);
    group.add(inFluid);
    anim3DObjects.inFluid = inFluid;

    const outFluid = new THREE.Mesh(new THREE.CylinderGeometry(2.36, 2.36, 3.0, 32), fluidMat);
    outFluid.position.set(3.2, -2.0, 0);
    group.add(outFluid);
    anim3DObjects.outFluid = outFluid;

    // Input Piston Assembly
    const inPistonGroup = new THREE.Group();
    const inDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.4, 32), steelMat);
    const inRod = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.0, 16), steelMat);
    inRod.position.y = 2.0;
    inPistonGroup.add(inDisc);
    inPistonGroup.add(inRod);
    inPistonGroup.position.set(-3.5, -0.5, 0);
    group.add(inPistonGroup);
    anim3DObjects.inPiston = inPistonGroup;

    // Output Heavy Piston Assembly with Industrial Payload
    const outPistonGroup = new THREE.Group();
    const outDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.5, 32), steelMat);
    const loadBlock = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 2.2, 3.6),
      new THREE.MeshStandardMaterial({{ color: 0x334155, roughness: 0.6, metalness: 0.4 }})
    );
    loadBlock.position.y = 1.35;
    outPistonGroup.add(outDisc);
    outPistonGroup.add(loadBlock);
    outPistonGroup.position.set(3.2, -0.5, 0);
    group.add(outPistonGroup);
    anim3DObjects.outPiston = outPistonGroup;

    // Dial Pressure Gauge at center manifold
    const gaugeGroup = new THREE.Group();
    gaugeGroup.position.set(0, -1.8, 0.8);
    const dialHousing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.3, 24),
      new THREE.MeshStandardMaterial({{ color: 0x0f172a, metalness: 0.8, roughness: 0.2 }})
    );
    dialHousing.rotation.x = Math.PI / 2;
    gaugeGroup.add(dialHousing);

    const dialFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 24),
      new THREE.MeshBasicMaterial({{ color: 0xf8fafc }})
    );
    dialFace.position.z = 0.16;
    gaugeGroup.add(dialFace);

    const needle = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.6, 0.02),
      new THREE.MeshBasicMaterial({{ color: 0xef4444 }})
    );
    needle.position.set(0, 0.25, 0.18);
    gaugeGroup.add(needle);
    anim3DObjects.gaugeNeedle = needle;
    group.add(gaugeGroup);

    scene.add(group);
  }}

  // 4. 3D Harmonic Mechanics: Pendulum / Spring Oscillator, Dynamic Vectors, Live Energy Bars
  function build3DMechanics(scene, p) {{
    const group = new THREE.Group();
    anim3DObjects = {{ type: 'mechanics' }};

    const chromeMat = new THREE.MeshStandardMaterial({{ color: 0xc8d1dc, metalness: 0.95, roughness: 0.15 }});

    // Overhead Support Arm Gantry
    const standPost = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 9.0, 16), chromeMat);
    standPost.position.set(-4.5, 0.2, 0);
    group.add(standPost);

    const standArm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.5, 16), chromeMat);
    standArm.rotation.z = Math.PI / 2;
    standArm.position.set(-2.0, 4.5, 0);
    group.add(standArm);

    // Pivot Joint at (0, 4.5, 0)
    const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), chromeMat);
    pivot.position.set(0, 4.5, 0);
    group.add(pivot);

    // Pendulum Cable & Bob Assembly
    const pendGroup = new THREE.Group();
    pendGroup.position.set(0, 4.5, 0);

    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6.0, 12), chromeMat);
    rod.position.y = -3.0;
    pendGroup.add(rod);

    const bobGeo = new THREE.SphereGeometry(1.0, 32, 32);
    const bobMat = new THREE.MeshStandardMaterial({{ color: 0xf59e0b, metalness: 0.95, roughness: 0.15 }});
    const bob = new THREE.Mesh(bobGeo, bobMat);
    bob.position.y = -6.0;
    pendGroup.add(bob);

    // Anchored Dynamic Force Vector (Red Arrow) & Velocity Vector (Green Arrow)
    const fArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -6.0, 0), 1.8, 0xef4444, 0.5, 0.3);
    pendGroup.add(fArrow);
    anim3DObjects.fArrow = fArrow;

    const vArrow = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -6.0, 0), 1.8, 0x10b981, 0.5, 0.3);
    pendGroup.add(vArrow);
    anim3DObjects.vArrow = vArrow;

    group.add(pendGroup);
    anim3DObjects.pendulum = pendGroup;

    // Floating Dynamic Energy Columns (Kinetic & Potential)
    const barBaseGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16);
    const ekBase = new THREE.Mesh(barBaseGeo, chromeMat);
    ekBase.position.set(3.5, -4.0, 0);
    group.add(ekBase);

    const epBase = new THREE.Mesh(barBaseGeo, chromeMat);
    epBase.position.set(5.2, -4.0, 0);
    group.add(epBase);

    const ekBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 4.0, 16),
      new THREE.MeshStandardMaterial({{ color: 0x38bdf8, roughness: 0.2 }})
    );
    ekBar.position.set(3.5, -2.0, 0);
    group.add(ekBar);
    anim3DObjects.ekBar = ekBar;

    const epBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 4.0, 16),
      new THREE.MeshStandardMaterial({{ color: 0xf59e0b, roughness: 0.2 }})
    );
    epBar.position.set(5.2, -2.0, 0);
    group.add(epBar);
    anim3DObjects.epBar = epBar;

    scene.add(group);
  }}

  // 5. 3D Optics & Lasers: Optical Bench, Laser Housing, Glass Prism, Snell's Refraction Beam
  function build3DOptics(scene, p) {{
    const group = new THREE.Group();
    anim3DObjects = {{ type: 'optics' }};

    // Optical Bench Rail
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.4, 2.5),
      new THREE.MeshStandardMaterial({{ color: 0x1e293b, metalness: 0.8, roughness: 0.3 }})
    );
    rail.position.y = -3.8;
    group.add(rail);

    // Laser Emitter Housing (Left: x = -5.5)
    const laserGroup = new THREE.Group();
    laserGroup.position.set(-5.5, -1.5, 0);
    const laserBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 3.2, 24),
      new THREE.MeshStandardMaterial({{ color: 0x0f172a, metalness: 0.7, roughness: 0.3 }})
    );
    laserBody.rotation.z = Math.PI / 2;
    laserGroup.add(laserBody);
    const laserTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.4, 16),
      new THREE.MeshBasicMaterial({{ color: 0xef4444 }})
    );
    laserTip.rotation.z = Math.PI / 2;
    laserTip.position.x = 1.7;
    laserGroup.add(laserTip);
    group.add(laserGroup);

    // Glass Triangular Prism (Center: x = 0)
    const prismShape = new THREE.Shape();
    prismShape.moveTo(-1.8, -1.8);
    prismShape.lineTo(1.8, -1.8);
    prismShape.lineTo(0, 1.8);
    prismShape.closePath();

    const extrudeSettings = {{ depth: 3.5, bevelEnabled: false }};
    const prismGeo = new THREE.ExtrudeGeometry(prismShape, extrudeSettings);
    const prismMat = new THREE.MeshPhysicalMaterial({{
      color: 0xe0f2fe, transmission: 0.96, opacity: 0.45, transparent: true,
      roughness: 0.05, metalness: 0.0, depthWrite: false
    }});
    const prism = new THREE.Mesh(prismGeo, prismMat);
    prism.position.set(0, -1.5, -1.75);
    group.add(prism);

    // Dynamic 3D Laser Beam Cylinders (Incident, Internal Refracted, and Emergent Dispersed Rays)
    const beamMat = new THREE.MeshBasicMaterial({{ color: 0xef4444 }});
    const incidentRay = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.0, 12), beamMat);
    incidentRay.rotation.z = -Math.PI / 2;
    incidentRay.position.set(-2.2, -1.5, 0);
    group.add(incidentRay);

    const internalRay = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 12), beamMat);
    internalRay.rotation.z = -Math.PI / 2.3;
    internalRay.position.set(-0.2, -1.6, 0);
    group.add(internalRay);
    anim3DObjects.internalRay = internalRay;

    // Emergent Spectral Rays (Red, Green, Blue dispersion)
    const colors = [0xef4444, 0x10b981, 0x3b82f6];
    const emergentRays = [];
    for (let c = 0; c < 3; c++) {{
      const rMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 4.5, 12),
        new THREE.MeshBasicMaterial({{ color: colors[c] }})
      );
      rMesh.position.set(2.8, -1.8 - c * 0.35, 0);
      rMesh.rotation.z = -Math.PI / 2.6 - c * 0.08;
      group.add(rMesh);
      emergentRays.push(rMesh);
    }}
    anim3DObjects.emergentRays = emergentRays;

    scene.add(group);
  }}

  // 6. 3D Cellular & Molecular Biology: Lipid Bilayer, Transmembrane Channel, Enzyme Active Site Docking
  function build3DBiology(scene, p) {{
    const group = new THREE.Group();
    anim3DObjects = {{ type: 'biology', ligands: [], lipidHeads: [] }};

    // Fluid Mosaic Lipid Bilayer (Polar head spheres + hydrophobic fatty acid tail sticks)
    const headGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const headMatUpper = new THREE.MeshStandardMaterial({{ color: 0x38bdf8, roughness: 0.3 }});
    const headMatLower = new THREE.MeshStandardMaterial({{ color: 0x0284c7, roughness: 0.3 }});

    for (let x = -6; x <= 6; x += 0.8) {{
      for (let z = -3; z <= 3; z += 0.8) {{
        if (Math.abs(x) < 1.4 && Math.abs(z) < 1.4) continue; // Leave central pore for channel protein
        // Upper leaflet
        const hu = new THREE.Mesh(headGeo, headMatUpper);
        hu.position.set(x, 0.8, z);
        hu.userData = {{ baseX: x, baseZ: z, offset: Math.random() * Math.PI * 2 }};
        group.add(hu);
        anim3DObjects.lipidHeads.push(hu);

        // Lower leaflet
        const hl = new THREE.Mesh(headGeo, headMatLower);
        hl.position.set(x, -0.8, z);
        hl.userData = {{ baseX: x, baseZ: z, offset: Math.random() * Math.PI * 2 }};
        group.add(hl);
        anim3DObjects.lipidHeads.push(hl);
      }}
    }}

    // Transmembrane Channel Protein (Central Cylinder with Pore)
    const channelMat = new THREE.MeshStandardMaterial({{ color: 0x10b981, roughness: 0.4, metalness: 0.1 }});
    const channel = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 24, 1, true), channelMat);
    channel.position.set(0, 0, 0);
    group.add(channel);

    // Large Catalytic Enzyme Macromolecule with Active Site
    const enzymeGroup = new THREE.Group();
    enzymeGroup.position.set(0, 3.2, 0);
    const enMat = new THREE.MeshStandardMaterial({{ color: 0xa855f7, roughness: 0.35 }});
    for (let i = 0; i < 18; i++) {{
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.55 + Math.random() * 0.3, 16, 16), enMat);
      seg.position.set((Math.random() - 0.5) * 2.8, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2.2);
      enzymeGroup.add(seg);
    }}
    group.add(enzymeGroup);
    anim3DObjects.enzyme = enzymeGroup;

    // Substrate Ligand Spheres drifting in 3D Brownian Motion
    const ligGeo = new THREE.SphereGeometry(0.24, 12, 12);
    const ligMat = new THREE.MeshStandardMaterial({{ color: 0xf59e0b, roughness: 0.2 }});
    for (let k = 0; k < 15; k++) {{
      const lig = new THREE.Mesh(ligGeo, ligMat);
      lig.position.set((Math.random() - 0.5) * 8.0, 1.5 + Math.random() * 3.5, (Math.random() - 0.5) * 6.0);
      lig.userData = {{
        vx: (Math.random() - 0.5) * 0.04,
        vy: (Math.random() - 0.5) * 0.04,
        vz: (Math.random() - 0.5) * 0.04
      }};
      group.add(lig);
      anim3DObjects.ligands.push(lig);
    }}

    scene.add(group);
  }}

  // 7. Universal 3D Scientific Chamber: Jacketed Reactor, Spinning Magnetic Vortex, Effervescent Aeration
  function build3DUniversal(scene, p) {{
    const group = new THREE.Group();
    anim3DObjects = {{ type: 'universal', bubbles: [] }};

    const glassMat = new THREE.MeshPhysicalMaterial({{
      color: 0xe0f2fe, transmission: 0.9, opacity: 0.45, transparent: true, roughness: 0.1, depthWrite: false, side: THREE.DoubleSide
    }});
    const steelMat = new THREE.MeshStandardMaterial({{ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 }});

    // Cylindrical Borosilicate Reaction Vessel
    const vessel = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 7.0, 32, 1, true), glassMat);
    vessel.position.set(0, -0.5, 0);
    group.add(vessel);

    // Vessel Base & Stainless Steel Top Flange
    const baseCap = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.2, 32), glassMat);
    baseCap.position.set(0, -4.0, 0);
    group.add(baseCap);

    const topFlange = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 32), steelMat);
    topFlange.position.set(0, 3.0, 0);
    group.add(topFlange);

    // Active Fluid Reaction Column
    const fluidGeo = new THREE.CylinderGeometry(2.95, 2.95, 5.0, 32);
    const fluidMat = new THREE.MeshStandardMaterial({{ color: 0x0284c7, transparent: true, opacity: 0.75, roughness: 0.2 }});
    const fluid = new THREE.Mesh(fluidGeo, fluidMat);
    fluid.position.set(0, -1.5, 0);
    group.add(fluid);
    anim3DObjects.fluid = fluid;

    // Magnetic Stir Bar (White PTFE Cylinder at bottom)
    const stirGeo = new THREE.CylinderGeometry(0.25, 0.25, 1.8, 16);
    const stirMat = new THREE.MeshStandardMaterial({{ color: 0xffffff, roughness: 0.3 }});
    const stirBar = new THREE.Mesh(stirGeo, stirMat);
    stirBar.rotation.x = Math.PI / 2;
    stirBar.position.set(0, -3.8, 0);
    group.add(stirBar);
    anim3DObjects.stirBar = stirBar;

    // Immersion Heating Coil (Torus spiral)
    const coilGroup = new THREE.Group();
    const coilMat = new THREE.MeshStandardMaterial({{ color: 0xef4444, metalness: 0.8, roughness: 0.3 }});
    for (let j = 0; j < 4; j++) {{
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 12, 32), coilMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, -2.8 + j * 0.7, 0);
      coilGroup.add(ring);
    }}
    group.add(coilGroup);
    anim3DObjects.coil = coilGroup;

    // Aeration Bubbles
    const bGeo = new THREE.SphereGeometry(0.09, 8, 8);
    const bMat = new THREE.MeshStandardMaterial({{ color: 0xffffff, transparent: true, opacity: 0.65 }});
    for (let k = 0; k < 45; k++) {{
      const b = new THREE.Mesh(bGeo, bMat);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 2.5;
      b.position.set(Math.cos(angle) * r, -3.8 + Math.random() * 4.6, Math.sin(angle) * r);
      b.userData = {{ angle, r, speed: 0.6 + Math.random() * 1.8 }};
      group.add(b);
      anim3DObjects.bubbles.push(b);
    }}

    scene.add(group);
  }}

  // =========================================================================
  // Continuous 60 FPS 3D Motion Graphics & Slider Reaction Updates
  // =========================================================================

  function updateThreeLab(dt, time, p) {{
    if (!threeLabActive || !scene3D || !camera3D || !renderer3D) return;

    if (controls3D) {{
      controls3D.autoRotate = autoRotate3D;
      controls3D.autoRotateSpeed = 1.8;
      controls3D.update();
    }}

    const type = anim3DObjects.type;

    if (type === 'electrochem') {{
      // 1. Electron particles stream from Zn to Cu along wire
      if (anim3DObjects.electrons && anim3DObjects.wireCurve) {{
        const cuConc = p.cu_conc || p.concentration || 1.0;
        const eSpeed = 0.25 * cuConc;
        anim3DObjects.electrons.forEach(e => {{
          e.userData.progress = (e.userData.progress + dt * eSpeed) % 1.0;
          const pos = anim3DObjects.wireCurve.getPointAt(e.userData.progress);
          e.position.copy(pos);
        }});
      }}
      // 2. Rising bubbles
      if (anim3DObjects.bubbles) {{
        const temp = p.temp || p.temperature || 25;
        const bSpeedMult = 0.8 + (temp / 50);
        anim3DObjects.bubbles.forEach(b => {{
          b.position.y += dt * b.userData.speed * bSpeedMult;
          b.position.x = b.userData.baseSide + Math.sin(time * 3 + b.position.y) * 0.15;
          if (b.position.y > -0.7) {{
            b.position.y = -3.8;
          }}
        }});
      }}
    }} else if (type === 'circuit') {{
      // 1. Fast continuous armature rotation
      if (anim3DObjects.armature) {{
        const v = p.voltage || 12;
        const r = p.resistance || 20;
        const speed = (v / Math.max(1, r)) * 6.0;
        anim3DObjects.armature.rotation.y += dt * speed;
      }}
      // 2. Dynamic lightbulb bloom
      if (anim3DObjects.bulbLight && anim3DObjects.filament) {{
        const v = p.voltage || 12;
        const intensity = (v / 24) * 2.5;
        anim3DObjects.bulbLight.intensity = intensity;
        const filColor = new THREE.Color().setHSL(0.12 - (v / 120), 1.0, 0.4 + (v / 48));
        anim3DObjects.filament.material.color = filColor;
      }}
      // 3. Pulsing flux lines
      if (anim3DObjects.fluxLines) {{
        const pulse = 0.3 + Math.sin(time * 5) * 0.2;
        anim3DObjects.fluxLines.forEach(fl => {{
          fl.material.opacity = pulse;
        }});
      }}
    }} else if (type === 'fluids') {{
      // 1. Hydraulic piston height reactivity
      if (anim3DObjects.inPiston && anim3DObjects.outPiston) {{
        const f1 = p.F1 || p.force || 50;
        const a1 = p.A1 || p.area1 || 25;
        const a2 = p.A2 || p.area2 || 250;
        const dispIn = Math.min(2.0, (f1 / 150) * 1.5);
        const dispOut = dispIn * (a1 / a2);

        anim3DObjects.inPiston.position.y = -0.5 - dispIn;
        if (anim3DObjects.inFluid) anim3DObjects.inFluid.scale.y = 1.0 - (dispIn * 0.25);

        anim3DObjects.outPiston.position.y = -0.5 + dispOut * 2.5;
        if (anim3DObjects.outFluid) anim3DObjects.outFluid.scale.y = 1.0 + (dispOut * 0.25);

        // Needle rotation with pressure P = F1 / A1
        if (anim3DObjects.gaugeNeedle) {{
          const pressure = f1 / a1;
          anim3DObjects.gaugeNeedle.rotation.z = - (pressure / 10) * Math.PI * 1.2;
        }}
      }}
    }} else if (type === 'mechanics') {{
      // 1. Real-time SHM Pendulum Oscillation
      if (anim3DObjects.pendulum) {{
        const len = p.length || 1.5;
        const omega = Math.sqrt(9.8 / Math.max(0.2, len));
        const theta = 0.55 * Math.cos(omega * time);
        anim3DObjects.pendulum.rotation.z = theta;

        // Dynamic Vector Updates
        const thetaDot = -0.55 * omega * Math.sin(omega * time);
        if (anim3DObjects.vArrow) {{
          anim3DObjects.vArrow.setLength(Math.abs(thetaDot) * 2.0, 0.4, 0.25);
          anim3DObjects.vArrow.setDirection(new THREE.Vector3(thetaDot > 0 ? 1 : -1, 0, 0));
        }}
        if (anim3DObjects.fArrow) {{
          anim3DObjects.fArrow.setLength(Math.abs(theta) * 3.5, 0.4, 0.25);
          anim3DObjects.fArrow.setDirection(new THREE.Vector3(theta > 0 ? -1 : 1, 0, 0));
        }}

        // Dynamic Energy Bars
        if (anim3DObjects.ekBar && anim3DObjects.epBar) {{
          const ekRatio = (thetaDot * thetaDot) / (omega * omega * 0.35 + 0.001);
          const epRatio = (theta * theta) / (0.35 + 0.001);
          anim3DObjects.ekBar.scale.y = Math.max(0.05, Math.min(2.0, ekRatio * 1.5));
          anim3DObjects.epBar.scale.y = Math.max(0.05, Math.min(2.0, epRatio * 1.5));
        }}
      }}
    }} else if (type === 'optics') {{
      // 1. Snell's Law angle deflection
      if (anim3DObjects.internalRay && anim3DObjects.emergentRays) {{
        const n = p.n || p.refractive_index || 1.5;
        const angleDeg = p.angle || 45;
        const nRatio = 1.0 / Math.max(1.0, n);
        anim3DObjects.internalRay.rotation.z = -Math.PI / 2.3 - (n - 1.0) * 0.35;
        anim3DObjects.emergentRays.forEach((r, idx) => {{
          r.rotation.z = -Math.PI / 2.6 - (n - 1.0) * 0.45 - idx * 0.06;
        }});
      }}
    }} else if (type === 'biology') {{
      // 1. Membrane fluid undulation
      if (anim3DObjects.lipidHeads) {{
        anim3DObjects.lipidHeads.forEach(h => {{
          h.position.y = (h.position.y > 0 ? 0.8 : -0.8) + Math.sin(time * 2.5 + h.userData.offset) * 0.12;
        }});
      }}
      // 2. Ligands Brownian drift
      if (anim3DObjects.ligands) {{
        anim3DObjects.ligands.forEach(lig => {{
          lig.position.x += lig.userData.vx;
          lig.position.y += lig.userData.vy;
          lig.position.z += lig.userData.vz;
          if (Math.abs(lig.position.x) > 4.5) lig.userData.vx *= -1;
          if (lig.position.y > 5.0 || lig.position.y < 1.2) lig.userData.vy *= -1;
          if (Math.abs(lig.position.z) > 3.5) lig.userData.vz *= -1;
        }});
      }}
    }} else if (type === 'universal') {{
      // 1. Rapid magnetic stir bar rotation
      if (anim3DObjects.stirBar) {{
        const rate = p.rate || p.speed || 30;
        anim3DObjects.stirBar.rotation.y += dt * (rate * 0.4);
      }}
      // 2. Swirling effervescent bubbles
      if (anim3DObjects.bubbles) {{
        anim3DObjects.bubbles.forEach(b => {{
          b.userData.angle += dt * 3.0;
          b.position.x = Math.cos(b.userData.angle) * b.userData.r;
          b.position.z = Math.sin(b.userData.angle) * b.userData.r;
          b.position.y += dt * b.userData.speed;
          if (b.position.y > 1.8) b.position.y = -3.8;
        }});
      }}
      // 3. Fluid color morphing based on intensity slider
      if (anim3DObjects.fluid) {{
        const intensity = p.intensity || 50;
        const hue = (intensity / 100) * 0.65; // smoothly morphs from red to cyan/blue
        anim3DObjects.fluid.material.color.setHSL(hue, 0.85, 0.45);
      }}
    }}

    renderer3D.render(scene3D, camera3D);
  }}

  function resizeThreeLab() {{
    const container = document.getElementById('webglContainer');
    if (!container || !renderer3D || !camera3D) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera3D.aspect = w / h;
    camera3D.updateProjectionMatrix();
    renderer3D.setSize(w, h);
  }}
"""
