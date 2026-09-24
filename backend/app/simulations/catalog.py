"""Curated Simulation Catalog for Tark Virtual Lab.

Provides 19 curriculum-aligned interactive simulations across Physics, Chemistry,
Biology, and Mathematics, combining instant Canvas templates with Gemini-generated
interactive laboratories.
"""
from __future__ import annotations
from typing import Any

SIMULATION_CATALOG: list[dict[str, Any]] = [
    # --- PHYSICS ---
    {
        "id": "sim_projectile",
        "title": "Projectile Motion Simulator",
        "subject": "Physics",
        "category": "Mechanics & Kinematics",
        "emoji": "🚀",
        "difficulty": "Beginner",
        "description": "Explore 2D parabolic trajectories, launch angle optimization, flight time, and maximum range.",
        "builtin_type": "projectile",
        "default_params": {"angle": 45, "speed": 25, "gravity": 9.8},
    },
    {
        "id": "sim_pendulum",
        "title": "Simple Pendulum & SHM",
        "subject": "Physics",
        "category": "Oscillations & Waves",
        "emoji": "⏱️",
        "difficulty": "Beginner",
        "description": "Investigate simple harmonic motion, period vs length, and dynamic kinetic/potential energy transfer.",
        "builtin_type": "pendulum",
        "default_params": {"length": 1.5, "angle": 30, "gravity": 9.8},
    },
    {
        "id": "sim_ohms_law",
        "title": "Ohm's Law & Circuit Lab",
        "subject": "Physics",
        "category": "Electricity & Magnetism",
        "emoji": "⚡",
        "difficulty": "Beginner",
        "description": "Adjust DC voltage and resistance to observe live current flow, lamp brightness, and electron drift.",
        "builtin_type": "ohms_law",
        "default_params": {"voltage": 9, "resistance": 15},
    },
    {
        "id": "sim_waves",
        "title": "Wave Interference & Double-Slit",
        "subject": "Physics",
        "category": "Wave Optics",
        "emoji": "🌊",
        "difficulty": "Intermediate",
        "description": "Young's double-slit experiment: see interference fringe patterns and light wave superposition in real time.",
        "builtin_type": "waves",
        "default_params": {"wavelength": 550, "slitDist": 0.25, "screenDist": 1.2},
    },
    {
        "id": "sim_gas_law",
        "title": "Ideal Gas Law Piston",
        "subject": "Physics",
        "category": "Thermodynamics",
        "emoji": "🔥",
        "difficulty": "Intermediate",
        "description": "Simulate kinetic molecular theory (PV = nRT) in a movable piston chamber with live pressure gauge.",
        "builtin_type": "gas_law",
        "default_params": {"temp": 300, "volume": 5, "moles": 1.0},
    },
    {
        "id": "sim_ray_optics",
        "title": "Ray Optics & Thin Lens",
        "subject": "Physics",
        "category": "Geometric Optics",
        "emoji": "🔍",
        "difficulty": "Intermediate",
        "description": "Trace principal rays through convex and concave lenses. Calculate image distance, magnification, and real vs virtual images.",
        "builtin_type": "ray_optics",
        "default_params": {"focal": 15, "objDist": 30, "objHeight": 25},
    },
    {
        "id": "sim_magnetic_fields",
        "title": "Magnetic Field Lines & Dipole",
        "subject": "Physics",
        "category": "Magnetism",
        "emoji": "🧲",
        "difficulty": "Intermediate",
        "description": "Visualize magnetic vector field lines around bar magnets, moving charges, and interactive compass needles.",
        "builtin_type": "magnetic_fields",
        "default_params": {"strength": 25, "compassX": 65, "compassY": -45},
        "generation_prompt": "Interactive Physics simulation of Magnetic Field Lines around a Bar Magnet. Include sliders for Magnet Strength (B) and Distance (r), movable compass needles that orient along field lines, and real-time calculation of magnetic field vector strength (Tesla) using formula B = (μ0/4π)*(2M/r^3).",
    },
    {
        "id": "sim_em_induction",
        "title": "Electromagnetic Induction & Faraday's Law",
        "subject": "Physics",
        "category": "Electromagnetism",
        "emoji": "💡",
        "difficulty": "Advanced",
        "description": "Demonstrate Faraday's & Lenz's Laws: move a magnet through a wire coil to generate induced EMF and light up a bulb.",
        "builtin_type": "em_induction",
        "default_params": {"turns": 200, "speed": 3, "magnetStrength": 1.5},
        "generation_prompt": "Interactive Physics laboratory demonstrating Faraday's Law of Electromagnetic Induction (EMF = -N * dΦ/dt). Show a solenoid coil with adjustable number of turns (N), a movable bar magnet with adjustable speed (v), magnetic flux graph Φ(t), and an attached galvanometer/lightbulb showing induced current direction according to Lenz's law.",
    },

    # --- CHEMISTRY ---
    {
        "id": "sim_atomic_orbitals",
        "title": "Bohr Atom & Electron Orbitals",
        "subject": "Chemistry",
        "category": "Atomic Structure",
        "emoji": "⚛️",
        "difficulty": "Beginner",
        "description": "Explore electron energy levels (n=1 to 5), photon absorption, and emission spectra for Hydrogen.",
        "builtin_type": "atomic_orbitals",
        "default_params": {"nInitial": 3, "nFinal": 2},
        "generation_prompt": "Interactive Chemistry simulation of the Bohr Hydrogen Atom and Quantum Energy Levels (E_n = -13.6/n^2 eV). Let the user click or slide to jump an electron between orbits (n=1 to n=5), animate photon absorption (inbound wavy photon) and photon emission (outbound photon with exact spectral color based on ΔE = hc/λ), and display the live Balmer/Lyman emission line on a spectral chart.",
    },
    {
        "id": "sim_chemical_bonding",
        "title": "Chemical Bonding (Ionic vs Covalent)",
        "subject": "Chemistry",
        "category": "Chemical Structure",
        "emoji": "🧪",
        "difficulty": "Intermediate",
        "description": "Compare electron transfer in Ionic bonds (NaCl) vs electron sharing in Covalent bonds (H2O, O2, CH4).",
        "builtin_type": "chemical_bonding",
        "default_params": {"distance": 74, "bondMode": 1, "enDiff": 0.4},
        "generation_prompt": "Interactive Chemistry lab comparing Ionic vs Covalent bonding. Let the user switch between molecules (NaCl, H2O, O2, CH4), adjust inter-nuclear distance (r) to see Lennard-Jones potential energy curve with equilibrium bond length, and animate valence electron orbital overlap or electron transfer with electronegativity difference (ΔEN) readout.",
    },
    {
        "id": "sim_titration",
        "title": "Acid-Base Titration Curve & pH",
        "subject": "Chemistry",
        "category": "Analytical Chemistry",
        "emoji": "💧",
        "difficulty": "Intermediate",
        "description": "Titrate strong/weak acids with NaOH. Observe the S-shaped pH curve, indicator color transitions, and equivalence point.",
        "builtin_type": "titration",
        "default_params": {"vAdded": 18, "cAcid": 0.1, "cBase": 0.1},
        "generation_prompt": "Interactive Chemistry Acid-Base Titration Simulator. Show a burette dripping NaOH into an Erlenmeyer flask with magnetic stirrer. Include slider/buttons to add titrant volume (mL), selectable indicators (Phenolphthalein, Methyl Orange) that dynamically change flask color, and a real-time plotted pH curve showing the steep equivalence point (pH 7 for strong acid, pH > 7 for weak acid).",
    },
    {
        "id": "sim_electrolysis",
        "title": "Electrolysis of Water & Faraday's Laws",
        "subject": "Chemistry",
        "category": "Electrochemistry",
        "emoji": "🔋",
        "difficulty": "Intermediate",
        "description": "Split water into Hydrogen (2x volume at cathode) and Oxygen (at anode) with live gas volume collection tubes.",
        "builtin_type": "electrolysis",
        "default_params": {"voltage": 6, "current": 2.0, "timeElapsed": 25},
        "generation_prompt": "Interactive Electrochemistry simulation of the Electrolysis of Water (Hoffman Apparatus). Include a DC power supply slider (Voltage & Current), animated bubbles rising at Platinum electrodes (2H2 + O2), live gas volume cylinders showing the strict 2:1 stoichiometric ratio of H2 to O2, and Faraday's law mass/moles readout (m = (I*t*M)/(z*F)).",
    },
    {
        "id": "sim_periodic_trends",
        "title": "Periodic Table Trends Explorer",
        "subject": "Chemistry",
        "category": "Inorganic Chemistry",
        "emoji": "📊",
        "difficulty": "Beginner",
        "description": "Visualize Atomic Radius, Electronegativity, and Ionization Energy trends across periods and groups.",
        "builtin_type": None,
        "generation_prompt": "Interactive Periodic Table Trends Explorer. Render a sleek periodic table grid (Elements 1-36). Let the user toggle heatmaps for Atomic Radius (pm), Electronegativity (Pauling scale), and 1st Ionization Energy (kJ/mol). Clicking an element shows its electronic configuration, effective nuclear charge (Z_eff), and a 3D-styled animated atomic sphere size comparison.",
    },

    # --- BIOLOGY ---
    {
        "id": "sim_mitosis",
        "title": "Cell Division (Stages of Mitosis)",
        "subject": "Biology",
        "category": "Cell Biology",
        "emoji": "🔬",
        "difficulty": "Intermediate",
        "description": "Step through Prophase, Metaphase, Anaphase, Telophase, and Cytokinesis with animated chromosome alignment and spindle fibers.",
        "builtin_type": "mitosis",
        "default_params": {"stage": 2},
        "generation_prompt": "Interactive Biology simulation of Cell Division / Mitosis Stages (Interphase, Prophase, Metaphase, Anaphase, Telophase, Cytokinesis). Include a stage progress slider and play/pause animation, clearly showing nuclear envelope breakdown, centrioles forming spindle fibers, chromosome condensation, equatorial alignment, chromatid separation, and cleavage furrow formation with clear pedagogical annotations.",
    },
    {
        "id": "sim_circulatory_heart",
        "title": "Heart & Double Circulation System",
        "subject": "Biology",
        "category": "Human Physiology",
        "emoji": "🫀",
        "difficulty": "Intermediate",
        "description": "Pumping 4-chambered human heart with cardiac cycle valve animations, oxygenated vs deoxygenated blood circuits, and ECG readout.",
        "builtin_type": "circulatory_heart",
        "default_params": {"bpm": 72, "strokeVol": 70},
        "generation_prompt": "Interactive Human Heart & Double Circulation System simulation. Show an anatomical cross-section of the 4 chambers (Atria & Ventricles) with tricuspid, bicuspid, and semilunar valves opening and closing in sync with a rhythmic heartbeat slider (40-160 BPM). Animate blue (deoxygenated) and red (oxygenated) blood particle flow through pulmonary and systemic loops, alongside a synchronized P-Q-R-S-T ECG wave.",
    },
    {
        "id": "sim_photosynthesis",
        "title": "Photosynthesis & Light Reactions",
        "subject": "Biology",
        "category": "Plant Physiology",
        "emoji": "🌱",
        "difficulty": "Intermediate",
        "description": "Inside the Thylakoid membrane: photon excitation in Photosystems II & I, photolysis of water, electron transport chain, and ATP synthesis.",
        "builtin_type": "photosynthesis",
        "default_params": {"lightIntensity": 80, "co2Level": 400},
        "generation_prompt": "Interactive Plant Physiology simulation of Photosynthesis (Light-dependent reactions in the Thylakoid membrane). Include sliders for Light Intensity (lux) and CO2 Concentration. Animate light photons exciting Photosystem II (P680) and PS I (P700), water photolysis (H2O -> 2H+ + 1/2 O2 + 2e-), proton gradient pumping into the thylakoid lumen, and rotating ATP Synthase generating ATP and NADPH.",
    },
    {
        "id": "sim_neuron_action_potential",
        "title": "Neuron Action Potential & Synapse",
        "subject": "Biology",
        "category": "Neurobiology",
        "emoji": "🧠",
        "difficulty": "Advanced",
        "description": "Simulate voltage-gated Na+/K+ ion channels, threshold stimulus (-55 mV), depolarization, repolarization, and neurotransmitter vesicle release.",
        "builtin_type": "neuron_action_potential",
        "default_params": {"stimulus": -50, "caLevel": 70},
        "generation_prompt": "Interactive Neurobiology simulation of a Neuron Action Potential and Axon transmission. Include a stimulus voltage slider (-70 mV resting to +40 mV peak), animated lipid bilayer with opening/closing Na+ and K+ voltage-gated channels, real-time membrane potential graph V_m(t) showing depolarization/hyperpolarization, and synaptic terminal neurotransmitter vesicle exocytosis.",
    },
    {
        "id": "sim_dna_replication",
        "title": "DNA Replication & Base Pairing",
        "subject": "Biology",
        "category": "Genetics & Molecular Biology",
        "emoji": "🧬",
        "difficulty": "Advanced",
        "description": "Unwind the double helix with Helicase and watch DNA Polymerase synthesize leading and lagging strands with complementary A-T, G-C bases.",
        "builtin_type": "dna_replication",
        "default_params": {"speed": 40, "proofreading": 99},
        "generation_prompt": "Interactive Molecular Genetics simulation of DNA Replication. Show the double-helix unwinding at the replication fork with Helicase, complementary base pairing (Adenine-Thymine with 2 H-bonds, Guanine-Cytosine with 3 H-bonds), continuous synthesis on the Leading strand by DNA Polymerase III, and Okazaki fragments on the Lagging strand with RNA Primase and DNA Ligase.",
    },
    {
        "id": "sim_osmosis",
        "title": "Osmosis & Water Potential Lab",
        "subject": "Biology",
        "category": "Cell Physiology & Transport",
        "emoji": "💧",
        "difficulty": "Intermediate",
        "description": "U-Tube semipermeable membrane experiment: observe Brownian diffusion of water, solute impermeability, hydrostatic head displacement, and reverse osmosis.",
        "builtin_type": "osmosis",
        "default_params": {"mode": 0, "cLeft": 0.05, "cRight": 0.85, "poreSize": 1.2, "appliedP": 0},
        "generation_prompt": "Interactive Cell Physiology simulation of Osmosis in a U-Tube with a central semipermeable membrane (SPM). Left and right arms with variable solute molarity, water molecules in Brownian motion, solute particles blocked by pore size, osmotic pressure, and hydrostatic water column height shift.",
    },

    # --- MATHEMATICS ---
    {
        "id": "sim_quadratic",
        "title": "Quadratic Curves & Parabola Explorer",
        "subject": "Mathematics",
        "category": "Algebra & Coordinate Geometry",
        "emoji": "📐",
        "difficulty": "Beginner",
        "description": "Manipulate coefficients a, b, c in y = ax² + bx + c. Trace roots, vertex, axis of symmetry, and discriminant in real time.",
        "builtin_type": "quadratic",
        "default_params": {"a": 1, "b": -2, "c": -3},
    },
    {
        "id": "sim_lorenz_chaos",
        "title": "Lorenz Strange Attractor & Chaos Theory",
        "subject": "Mathematics",
        "category": "Dynamical Systems & Nonlinear ODEs",
        "emoji": "🦋",
        "difficulty": "Advanced",
        "description": "Explore 3D deterministic chaos and the butterfly effect in the Lorenz 1963 system. Compute the Maximal Lyapunov Exponent (MLE λ ≈ 0.902) and observe sensitive dependence on initial conditions.",
        "builtin_type": "lorenz",
        "default_params": {"sigma": 10, "rho": 28, "beta": 2.67},
    },
    {
        "id": "sim_complex_roots",
        "title": "Durand-Kerner Complex Roots & Polynomials",
        "subject": "Mathematics",
        "category": "Complex Analysis & Numerical Algebra",
        "emoji": "🌀",
        "difficulty": "Advanced",
        "description": "Visualize Weierstrass (Durand-Kerner) simultaneous root-finding on the Argand plane for degree-N monic polynomials. Observe Aberth-Ehrlich circle convergence and fractal basins.",
        "builtin_type": "complex_roots",
        "default_params": {"degree": 5, "rotation": 0, "scale": 1.2},
    },
    {
        "id": "sim_fourier_spectral",
        "title": "Fourier Transform & Spectral Decomposition",
        "subject": "Mathematics",
        "category": "Harmonic Analysis & Signal Theory",
        "emoji": "🎼",
        "difficulty": "Advanced",
        "description": "Deconstruct complex signals and wavepackets into orthogonal sinusoids via Radix-2 Fast Fourier Transform. Watch rotating epicycle phasors synthesize square, sawtooth, and chirp waves.",
        "builtin_type": "fourier_spectral",
        "default_params": {"freq": 2, "harmonics": 9, "waveform": 0},
    },
    {
        "id": "sim_heat_pde",
        "title": "2D Heat Diffusion & Fourier PDE Solver",
        "subject": "Mathematics",
        "category": "Partial Differential Equations",
        "emoji": "🔥",
        "difficulty": "Advanced",
        "description": "Simulate the 2D parabolic heat equation (∂u/∂t = α∇²u) on an interactive grid. Watch thermal dissipation, Dirichlet boundary flux, and entropy growth.",
        "builtin_type": "heat_pde",
        "default_params": {"diffusivity": 0.25, "sourceTemp": 100, "decay": 0.01},
    },
]

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Persistent file path for dynamically discovered & grounded curriculum labs
_CUSTOM_CATALOG_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "custom_catalog.json"


def load_custom_catalog() -> list[dict[str, Any]]:
    """Load persistent custom simulations that were generated and grounded in textbooks."""
    try:
        if _CUSTOM_CATALOG_FILE.exists():
            with open(_CUSTOM_CATALOG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
    except Exception as e:
        logger.warning(f"Failed reading custom catalog from {_CUSTOM_CATALOG_FILE}: {e}")
    return []


def save_custom_catalog_item(item: dict[str, Any]) -> dict[str, Any]:
    """Persist a new curriculum simulation to custom_catalog.json and return the saved item."""
    try:
        _CUSTOM_CATALOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        items = load_custom_catalog()

        # Update if ID exists, or prepend if new
        existing_idx = next((i for i, existing in enumerate(items) if existing.get("id") == item.get("id")), -1)
        if existing_idx >= 0:
            items[existing_idx] = item
        else:
            items.insert(0, item)

        with open(_CUSTOM_CATALOG_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved custom simulation '{item.get('title')}' ({item.get('id')}) to {_CUSTOM_CATALOG_FILE}")
    except Exception as e:
        logger.warning(f"Failed saving custom catalog item: {e}")
    return item


def get_catalog() -> list[dict[str, Any]]:
    """Return the merged list of curated built-in and textbook-grounded custom simulations."""
    custom_items = load_custom_catalog()
    # Return custom labs at top of catalog, followed by standard curated catalog
    return custom_items + SIMULATION_CATALOG


def get_catalog_item(sim_id: str) -> dict[str, Any] | None:
    """Find a specific simulation entry by ID from built-ins or custom catalog."""
    # Check custom labs first
    for item in load_custom_catalog():
        if item.get("id") == sim_id:
            return item
    for item in SIMULATION_CATALOG:
        if item["id"] == sim_id:
            return item
    return None
