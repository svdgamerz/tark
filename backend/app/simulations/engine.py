"""Interactive Visual Simulations Engine (Virtualization).

Provides curriculum-aligned interactive simulations with live variable sliders,
pedagogical readouts, and HTML5 canvas animations for physics, math, chemistry, and biology.
"""
from __future__ import annotations

import re
import json
import asyncio
import logging
from typing import Any

from app.simulations.grounding import find_textbook_grounding_for_topic

logger = logging.getLogger(__name__)

# Matchers for core curriculum simulations
_SIM_TRIGGERS: list[tuple[str, str, str, str, str, dict[str, float]]] = [
    # 3D Photorealistic WebGL Interactive Lab Simulators
    (
        "projectile_3d",
        r"\b(projectile|trajectory|launch angle|time of flight|horizontal range|cannonball|parabolic motion|law[s]? of motion|newton'?s (?:first|second|third|1st|2nd|3rd)?\s*law|f\s*=\s*m\s*a|inertia|action[- ]reaction|force and acceleration|momentum and impulse|kinematics)\b",
        "3D Projectile Motion Cannon & Field",
        "Physics - Mechanics",
        "Newton's Laws of Motion & 3D Kinematics",
        {"angle": 45, "azimuth": 0, "speed": 28, "gravity": 9.8},
    ),
    (
        "solar_system_3d",
        r"\b(solar system|planet[s]?|orbit[s]?|kepler'?s? (?:law|laws)|gravitat.*orbit|heliocentric|earth.*sun|planetary motion)\b",
        "3D Solar System & Planetary Orbits",
        "Physics - Astrophysics",
        "Kepler's Laws & Gravitational Orbits",
        {"speedMult": 1.0, "scaleDist": 1.0, "gravityConst": 1.0},
    ),
    (
        "bohr_atom_3d",
        r"\b(bohr'?s? (?:atom|model)|energy level|balmer|lyman|paschen|spectral (?:line|series)|electron jump|quantum jump|orbital[s]?)\b",
        "3D Bohr Atom & Quantum Orbitals",
        "Chemistry / Physics - Quantum",
        "Bohr Postulates & Photon Energy Transitions",
        {"nInitial": 3, "nFinal": 2, "orbitalMode": 0},
    ),
    (
        "molecules_3d",
        r"\b(molecule[s]?|vsepr|chemical bond.*3d|molecular geometry|bond angle|tetrahedral|h2o structure|methane.*structure|polar.*molecule)\b",
        "3D Molecular Geometry & VSEPR Bonding",
        "Chemistry - Chemical Structure",
        "VSEPR Molecular Geometry & Polarity",
        {"moleculeId": 0, "bondScale": 1.0, "showDipoles": 1},
    ),
    (
        "dna_helix_3d",
        r"\b(dna|double helix|nucleotide[s]?|base pair[s]?|adenine|thymine|guanine|cytosine|replication fork|helicase)\b",
        "3D DNA Double Helix & Base Pairing",
        "Biology - Genetics",
        "Antiparallel Strands & Base Complementarity",
        {"twistSpeed": 1.0, "baseRadius": 3.2, "unzipping": 0},
    ),
    (
        "heart_3d",
        r"\b(heart|cardiac|circulat.*system|atrium|ventricle|bicuspid|tricuspid|blood flow|heartbeat|pulse|systole|diastole)\b",
        "3D Beating Human Heart & Circulation",
        "Biology - Physiology",
        "4-Chambered Double Circulation & Cardiac Cycle",
        {"bpm": 72, "strokeVolume": 70, "showValves": 1},
    ),
    (
        "epidermis_3d",
        r"\b(epidermis|stratum\s*(?:corneum|lucidum|granulosum|spinosum|basale)|skin layer[s]?|human skin|dermis|integumentary|keratinocyte[s]?|melanocyte[s]?)\b",
        "3D Epidermal Layers & Skin Architecture",
        "Biology - Histology & Anatomy",
        "Stratified Squamous Epithelium: Corneum to Basale",
        {"layerSeparation": 0, "activeLayer": 0, "showCells": 1},
    ),
    (
        "lorenz_3d",
        r"\b(lorenz|strange attractor|chaos theory|butterfly effect|nonlinear dynamics|phase space)\b",
        "3D Lorenz Strange Attractor & Chaos",
        "Mathematics - Dynamical Systems",
        "Deterministic Chaos & Phase Space Flow",
        {"sigma": 10, "rho": 28, "beta": 2.67},
    ),
    # 2D Built-ins Fallbacks
    (
        "projectile",
        r"\b(projectile 2d|flat trajectory)\b",
        "Projectile Motion & Newton's Laws Simulator",
        "Physics - Mechanics",
        "Newton's Laws of Motion & 2D Kinematics",
        {"angle": 45, "speed": 25, "gravity": 9.8},
    ),
    (
        "pendulum",
        r"\b(pendulum|oscillat|time period.*pendulum|simple harmonic motion|shm|bob)\b",
        "Simple Pendulum & Energy Exchange",
        "Physics - Oscillations",
        "Simple Harmonic Motion & Energy Conservation",
        {"length": 1.5, "angle": 30, "gravity": 9.8},
    ),
    (
        "ohms_law",
        r"\b(ohm'?s law|v\s*=\s*i\s*r|electric circuit|resistor.*voltage|current and resistance|lightbulb.*circuit)\b",
        "Ohm's Law & Circuit Lab",
        "Physics - Electricity",
        "Voltage, Resistance & Electric Current (V = IR)",
        {"voltage": 9, "resistance": 15},
    ),
    (
        "waves",
        r"\b(double[- ]slit|interference.*light|young'?s double|fringe width|wave optics|fringe pattern)\b",
        "Wave Interference & Double-Slit Pattern",
        "Physics - Wave Optics",
        "Young's Double Slit Experiment & Fringe Spacing",
        {"wavelength": 550, "slitDist": 0.25, "screenDist": 1.2},
    ),
    (
        "gas_law",
        r"\b(ideal gas|boyle'?s law|charles'?s law|pv\s*=\s*nrt|gas pressure|piston.*gas|gas cylinder)\b",
        "Ideal Gas Law & Piston Chamber",
        "Chemistry / Physics - Thermodynamics",
        "Boyle's, Charles's & Ideal Gas Law (PV = nRT)",
        {"temp": 300, "volume": 5, "moles": 1.0},
    ),
    (
        "quadratic",
        r"\b(quadratic.*curve|parabola|vertex.*parabola|roots.*quadratic|ax\^?2|quadratic function)\b",
        "Quadratic Curves & Roots Explorer",
        "Mathematics - Algebra",
        "Parabola Properties, Vertex & Discriminant",
        {"a": 1, "b": -2, "c": -3},
    ),
    (
        "ray_optics",
        r"\b(convex lens|concave lens|ray optics|lens formula|1/v|ray diagram.*lens|thin lens)\b",
        "Geometric Optics & Ray Tracing",
        "Physics - Optics",
        "Thin Lens Equation & Image Formation",
        {"focal": 15, "objDist": 30, "objHeight": 25},
    ),
    # Chemistry Built-ins
    (
        "titration",
        r"\b(titrat|acid[- ]base|ph curve|neutraliz|equivalence point|burette|phenolphthalein)\b",
        "Acid-Base Titration Curve & pH",
        "Chemistry - Analytical",
        "Strong Acid - Strong Base Titration (HCl + NaOH)",
        {"vAdded": 18, "cAcid": 0.1, "cBase": 0.1},
    ),
    (
        "atomic_orbitals",
        r"\b(bohr'?s? (?:atom|model)|energy level|balmer|lyman|paschen|spectral (?:line|series)|electron jump)\b",
        "Bohr Hydrogen Atom & Spectral Lines",
        "Chemistry / Physics - Quantum",
        "Bohr Postulates & Photon Energy Transitions",
        {"nInitial": 3, "nFinal": 2},
    ),
    (
        "electrolysis",
        r"\b(electrolysis|hoffman voltameter|split.*water|water electrolysis|anode.*cathode.*(?:hydrogen|oxygen))\b",
        "Electrolysis of Water & Faraday",
        "Chemistry - Electrochemistry",
        "Hoffman Voltameter: 2H2O -> 2H2 + O2 (2:1 Ratio)",
        {"voltage": 6, "current": 2.0, "timeElapsed": 25},
    ),
    # Physics Electromagnetism
    (
        "magnetic_fields",
        r"\b(bar magnet|magnetic dipole|field lines.*magnet|compass.*magnet|magnetic field.*dipole)\b",
        "Magnetic Field Lines & Dipole",
        "Physics - Magnetism",
        "Bar Magnet Vector Field & Compass Orientation",
        {"strength": 25, "compassX": 65, "compassY": -45},
    ),
    (
        "em_induction",
        r"\b(faraday'?s law|electromagnetic induction|induced emf|lenz'?s law|magnet.*coil|solenoid.*induction)\b",
        "Electromagnetic Induction & Faraday's Law",
        "Physics - Electromagnetism",
        "Faraday's & Lenz's Law: EMF = -N(dΦ/dt)",
        {"turns": 200, "speed": 3, "magnetStrength": 1.5},
    ),
    # Biology Built-ins
    (
        "mitosis",
        r"\b(mitosis|cell division|prophase|metaphase|anaphase|telophase|spindle fiber|chromatid.*separat)\b",
        "Cell Division (Stages of Mitosis)",
        "Biology - Cell Biology",
        "Somatic Equational Division (2n -> 2n)",
        {"stage": 2},
    ),
    (
        "circulatory_heart",
        r"\b(human heart|double circulation|atrium.*ventricle|cardiac cycle|systole|diastole|heart.*blood flow|ecg.*heart)\b",
        "Heart & Double Circulation System",
        "Biology - Human Physiology",
        "4-Chamber Cardiac Cycle & Pulmonary/Systemic Loops",
        {"bpm": 72, "strokeVol": 70},
    ),
    (
        "dna_replication",
        r"\b(dna replication|replication fork|okazaki|helicase|dna polymerase|base pairing|leading strand|lagging strand)\b",
        "DNA Replication & Base Pairing",
        "Biology - Genetics & Molecular Biology",
        "Semi-Conservative Replication Fork & Polymerase III",
        {"speed": 40, "proofreading": 99},
    ),
    (
        "photosynthesis",
        r"\b(photosynthesis|thylakoid|light reaction|photolysis|photosystem|atp synthase|chloroplast.*light)\b",
        "Photosynthesis & Light Reactions",
        "Biology - Plant Physiology",
        "Thylakoid Membrane Z-Scheme & ATP Synthase",
        {"lightIntensity": 80, "co2Level": 400},
    ),
    (
        "chemical_bonding",
        r"\b(chemical bond|covalent bond|ionic bond|lennard[- ]jones|molecular orbital|electron sharing|inter-?nuclear distance|electronegativity diff)\b",
        "Chemical Bonding (Ionic vs Covalent)",
        "Chemistry - Chemical Structure",
        "Lennard-Jones Potential & Orbital Electron Overlap",
        {"distance": 74, "bondMode": 1, "enDiff": 0.4},
    ),
    (
        "neuron_action_potential",
        r"\b(action potential|neuron.*potential|synapse|synaptic|neurotransmitter|depolariz.*axon|hodgkin|resting potential.*-70)\b",
        "Neuron Action Potential & Synapse",
        "Biology - Neurobiology",
        "Axon Voltage-Gated Channels & Synaptic Exocytosis",
        {"stimulus": -50, "caLevel": 70},
    ),
    (
        "osmosis",
        r"\b(osmosis|semi[- ]permeable|water potential|hypotonic|hypertonic|isotonic|plasmolysis|osmotic pressure|turgor pressure|u[- ]tube.*membrane|reverse osmosis)\b",
        "Osmosis & Water Potential Lab",
        "Biology - Cell Physiology",
        "Semipermeable Membrane & Water Potential (Ψ = Ψs + Ψp)",
        {"mode": 0, "cLeft": 0.05, "cRight": 0.85, "poreSize": 1.2, "appliedP": 0},
    ),
]


# Non-STEM Disqualifiers: Subjects, Historical/Literary/Social themes that MUST NOT produce simulations
_INELIGIBLE_SUBJECTS = {
    "history", "civics", "political science", "geography", "economics",
    "english", "hindi", "marathi", "sanskrit", "literature", "social studies",
    "social science", "sst", "moral science", "accountancy", "business studies",
    "commerce", "arts", "music", "physical education",
}

_INELIGIBLE_PATTERNS = [
    # Historical personalities, rulers, dynasties, wars, freedom movement
    re.compile(
        r"\b(akbar|birbal|babur|humayun|shah jahan|aurangzeb|shivaji|ashoka|chandragupta|"
        r"maratha|mughal|british|east india company|harappa|mohenjo|french revolution|"
        r"russian revolution|nazism|hitler|world war|independence|constitution|parliament|"
        r"lok sabha|rajya sabha|judiciary|democracy|election|prime minister|president|"
        r"governor|emperor|king|queen|sultan|nawab|ruler|dynasty|empire|treaty|battle of|"
        r"gandhi|nehru|patel|bhagat singh|subhash|ambedkar|viceroy|mansabdar|jizya)\b",
        re.I,
    ),
    # Biographical / person-focused queries
    re.compile(
        r"\b(who was|who is|biography|autobiography|life of|character sketch of|born in|"
        r"died in|ruled by|reign of|famous king|great emperor)\b",
        re.I,
    ),
    # Languages, grammar, literature, creative writing
    re.compile(
        r"\b(grammar|essay|speech|letter writing|story of|poem|poet|stanza|rhyme scheme|"
        r"metaphor|simile|comprehension|tense|active voice|passive voice|direct speech|"
        r"indirect speech|noun|verb|adjective|adverb|preposition|conjunction|idiom|"
        r"antonym|synonym|dialogue writing|summary of the poem|theme of the story)\b",
        re.I,
    ),
    # Commerce, economics, accounting
    re.compile(
        r"\b(journal entry|ledger|balance sheet|trial balance|debit and credit|gdp|"
        r"inflation|central bank|rbi|monetary policy|fiscal policy|taxation|shares and debentures)\b",
        re.I,
    ),
    # General non-scientific trivia & syllabus queries
    re.compile(
        r"\b(recipe|capital of|currency of|full form of|meaning of word|how to make|"
        r"name of chp|name of chapter|which chapter|list of chapters|table of contents)\b",
        re.I,
    ),
]

_STEM_SIMULATION_SIGNALS = [
    # Physics dynamic mechanics & kinematics
    re.compile(r"\b(projectile|trajectory|launch angle|cannonball|parabolic motion|kinematics|pendulum|oscillat|shm|simple harmonic|spring mass|gravity|gravitation|free fall|collision|momentum conservation|centripetal|circular motion|torque|moment of inertia|friction|work energy)\b", re.I),
    # Physics electromagnetism & circuits
    re.compile(r"\b(ohm'?s law|electric circuit|resistor|v\s*=\s*i\s*r|current electricity|parallel circuit|series circuit|magnetic field|bar magnet|field lines|faraday'?s law|electromagnetic induction|induced emf|lenz'?s law|solenoid|lorentz force)\b", re.I),
    # Physics optics & waves
    re.compile(r"\b(convex lens|concave lens|ray optics|lens formula|snell'?s law|refraction of light|reflection of light|dispersion|prism|young'?s double|double[- ]slit|interference.*light|wave optics|fringe width|diffraction|sound wave|doppler effect)\b", re.I),
    # Physics / Chemistry thermodynamics & gases
    re.compile(r"\b(ideal gas|boyle'?s law|charles'?s law|pv\s*=\s*nrt|gas pressure|piston.*gas|thermodynamics|carnot engine|heat engine|brownian motion)\b", re.I),
    # Chemistry laboratory reactions & electrochemistry
    re.compile(r"\b(titrat|acid[- ]base titration|ph curve|neutralization curve|electrolysis|hoffman voltameter|water electrolysis|galvanic cell|voltaic cell|daniell cell|bohr'?s? (?:atom|model)|energy level.*electron|spectral line|balmer series|chemical bond.*distance|lennard[- ]jones|reaction rate|activation energy)\b", re.I),
    # Biology cellular & physiological dynamic mechanisms
    re.compile(r"\b(mitosis|meiosis|cell division|prophase|metaphase|anaphase|telophase|spindle fiber|human heart|double circulation|cardiac cycle|atrium.*ventricle|ecg|blood flow|dna replication|replication fork|helicase|dna polymerase|photosynthesis|thylakoid|light reaction|photolysis|action potential|neuron potential|synapse|synaptic transmission|osmosis|semi[- ]permeable|water potential|hypotonic|hypertonic|plasmolysis|u[- ]tube.*membrane)\b", re.I),
    # Mathematics interactive graphs & curves
    re.compile(r"\b(quadratic.*curve|parabola|vertex.*parabola|roots.*quadratic|unit circle|trigonometric circle|sine wave.*slider|pythagorean theorem|vector addition)\b", re.I),
]


def is_simulation_eligible_topic(text: str, subject: str = "", context: str = "") -> bool:
    """Strict gate: Determines whether a topic is an experimentable STEM laboratory concept.

    Rejects humanities, history, literature, biographies, non-STEM subjects, general queries,
    and static facts (e.g. 'who was akbar and birbal' -> strictly False).
    """
    if not text or not text.strip():
        return False

    s_clean = (subject or "").strip().lower()
    if s_clean in _INELIGIBLE_SUBJECTS:
        return False

    combined = f"{text} {context}".strip()

    # 1. Reject any query that matches non-STEM disqualifiers
    for pat in _INELIGIBLE_PATTERNS:
        if pat.search(combined):
            return False

    # 2. Must match positive STEM simulation dynamic phenomena
    has_stem_signal = any(pat.search(combined) for pat in _STEM_SIMULATION_SIGNALS)
    if has_stem_signal:
        return True

    # 3. Check if text matches any built-in simulation trigger pattern
    for _, pattern, _, _, _, _ in _SIM_TRIGGERS:
        if re.search(pattern, text, re.IGNORECASE):
            return True

    return False


def detect_simulation_candidate(text: str, subject: str = "") -> dict[str, Any] | None:
    """Detect if a user prompt matches one of the high-yield built-in simulation templates."""
    if not text or not is_simulation_eligible_topic(text, subject=subject):
        return None

    # Check against known curriculum models
    for sim_type, pattern, title, sim_subject, concept, default_params in _SIM_TRIGGERS:
        if re.search(pattern, text, re.IGNORECASE):
            return {
                "id": f"sim_{sim_type}_{abs(hash(text)) % 10000}",
                "type": sim_type,
                "title": title,
                "subject": sim_subject,
                "concept": concept,
                "description": f"Interactive model for {concept}. Adjust sliders to explore the concept in real time.",
                "params": default_params,
            }

    return None


CUSTOM_SIM_SYSTEM_PROMPT = """You are a world-class principal educational simulation architect, computational scientist, and visual learning engineer.
The student needs a high-fidelity, interactive simulation for a STEM curriculum topic.

Generate a COMPLETE, self-contained single-page HTML5 application with embedded CSS and JavaScript that runs directly inside an iframe.
CRITICAL MANDATE: The simulation must look and feel authentic, educational, and engaging—NOT a crude cartoon. It must be dynamically alive at 60 FPS immediately upon load with ZERO lag.

DOMAIN-SPECIFIC DESIGN & BACKDROP SPECIFICATIONS:
1. Environment & Studio Backdrop (NO PITCH-BLACK VOIDS FOR BIOLOGY):
   - For Biology, Anatomy, Cells, Physiology & Life Sciences: Use a clean medical studio backdrop with soft slate/gray gradients (e.g. #0f172a to #1e293b, or clean clinical #f8fafc with dark text) and gentle soft ambient illumination. NEVER use a pitch-black abyss or optical breadboard for anatomical or biological simulations!
   - For Physics, Astronomy & Space: Sleek dark studio or workbench theme (#080d1a or #0b1120) with subtle coordinate or optical breadboard grid.
   - For Chemistry & Glassware: Clean lab bench lighting with volumetric fluid refraction, meniscus curvature, and translucent glassware.

2. Presentation Choice (3D vs Clean Plain 2D):
   - Some topics demand 3D: Volumetric organs (heart, eye, skin layers, brain), celestial orbits, molecular geometry, projectile arcs, magnetic field toroids. Include Three.js via `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>` with OrbitControls for 360° rotation.
   - Some topics should be CLEAN & PLAIN: For histological cross-sections, cellular division steps, or simple harmonic oscillators, a crisp, elegant 2D canvas with layered callouts is often much clearer than an overcomplicated 3D mesh. Choose whichever best teaches the concept without visual clutter.

3. Domain-Appropriate Instrumentation (DO NOT FORCE NUMERIC PHYSICS FORMULAS ON BIOLOGY):
   - For Biology & Anatomy: Provide interactive anatomical callouts, layer visibility toggles, histological cell descriptions, and physiological function cards (e.g., "Stratum Corneum: Anucleate keratinized squames", "Water-impermeable barrier"). NEVER invent senseless physics formulas (like F=ma) or fake numeric velocity sensors for biological layers!
   - For Physics & Math: Sleek telemetry cards displaying calculated physical quantities with exact units (N, m/s, J, V, Hz) and textbook formula cards (e.g. F = ma, v = f·λ).
   - Only include numeric sliders or values when they are genuinely relevant to the experiment.

4. Performance & Interactivity:
   - Auto-play on load with 60 FPS smooth animation loop (`requestAnimationFrame`).
   - Direct mouse/touch interaction (drag, rotate, toggle layers, inspect elements on click/hover).
   - High-DPI crispness using `window.devicePixelRatio`.

5. Output Format:
   - Return ONLY the raw valid HTML document starting with <!DOCTYPE html> and ending with </html>.
   - Do NOT wrap in markdown fences (no ```html ... ```), no introductory or concluding text."""


async def generate_custom_simulation_html(question: str, context: str = "", subject: str = "") -> dict[str, Any] | None:
    """Generate a custom interactive HTML5 Canvas simulation grounded in official textbooks."""
    if not is_simulation_eligible_topic(question, subject=subject, context=context):
        logger.info(f"Topic '{question[:40]}' is not eligible for simulation. Skipping generation.")
        return None

    from app.main import _llm_text

    # Search indexed textbooks (NCERT, ICSE, State Boards) for official curriculum grounding
    grounding = find_textbook_grounding_for_topic(question)
    tb_section = ""
    citations = []
    if grounding.get("found"):
        citations = grounding.get("citations", [])
        tb_section = (
            f"\n\nOFFICIAL CURRICULUM TEXTBOOK GROUNDING & APPARATUS (from {', '.join(citations)}):\n"
            f"{grounding['grounding_text']}\n"
            f"IMPORTANT: Faithfully model the official textbook apparatus, physical laws, and variables described above in your simulation."
        )

    prompt = (
        f"Scientific Topic to simulate: {question.strip()}\n"
        f"Pedagogical Context: {context.strip()[:600] if context else 'Standard STEM curriculum laboratory experiment'}"
        f"{tb_section}\n\n"
        f"INSTRUCTION: Create an authentic, photorealistic, 60 FPS interactive HTML5 canvas simulation of this topic. "
        f"Include realistic 3D-shaded apparatus, fluid/spring physics, active auto-playing animation on load, direct mouse/touch drag manipulation, live digital sensors, and textbook formulas."
    )
    raw_html = ""

    # Prioritize fast, high-capacity models with low latency (Groq / OpenRouter)
    for mid in ("gpt-oss-120b", "llama-70b", "deepseek-chat"):
        try:
            logger.info(f"Generating photorealistic simulation with {mid} for topic: {question[:40]}...")
            raw_html = await asyncio.wait_for(
                _llm_text(CUSTOM_SIM_SYSTEM_PROMPT, prompt, mid),
                timeout=20.0,
            )
            if raw_html and len(raw_html.strip()) > 500:
                break
        except Exception as e:
            logger.warning(f"Simulation generation failed on {mid}: {e}")
            continue

    if not raw_html:
        return None

    # Clean any accidental markdown code blocks
    clean_html = re.sub(r"^```(?:html)?\s*", "", raw_html.strip(), flags=re.IGNORECASE)
    clean_html = re.sub(r"```\s*$", "", clean_html.strip())

    # Verify basic HTML integrity
    lower_html = clean_html.lower()
    if "<html" not in lower_html or ("<canvas" not in lower_html and "<svg" not in lower_html and "<script" not in lower_html):
        logger.warning("Generated HTML did not meet minimum canvas/svg requirements")
        return None

    desc = f"Interactive model for {question}. Adjust sliders to observe real-time behavior."
    if citations:
        desc = f"Curriculum-grounded simulation for {question}, aligned with {', '.join(citations[:2])}."

    return {
        "id": f"sim_custom_{abs(hash(question)) % 100000}",
        "type": "custom_html",
        "title": f"Lab: {question[:40]}",
        "subject": "Interactive Virtual Lab",
        "concept": question[:60],
        "description": desc,
        "htmlContent": clean_html,
        "html_content": clean_html,
        "textbook_sources": citations,
        "grounded": bool(grounding.get("found") or citations),
    }
