"""STEM Knowledge Graph & Skill Tree Data Service.

Constructs a hierarchical Directed Acyclic Graph (DAG) of prerequisite concepts
across CBSE, ICSE, and State Board Physics, Chemistry, Mathematics, and Biology.
Merges static curriculum prerequisites with personal LearnerStore mastery states.
"""

from __future__ import annotations

from typing import Any, List, Optional
from app.learner.store import LearnerStore

# Comprehensive STEM Knowledge Graph DAG
CURRICULUM_NODES: list[dict[str, Any]] = [
    # ------------------ PHYSICS ------------------
    {
        "id": "phys_vectors",
        "label": "Vectors & Coordinate Geometry",
        "subject": "Physics",
        "grade": "11",
        "prerequisites": [],
        "x": 100,
        "y": 140,
        "simulation_id": "sim_projectile",
        "formulas": ["\\vec{A} = A_x \\hat{i} + A_y \\hat{j}", "|\\vec{A}| = \\sqrt{A_x^2 + A_y^2}"],
        "description": "Vector addition, resolution into orthogonal components, scalar and vector products.",
    },
    {
        "id": "phys_kinematics_1d",
        "label": "1D Rectilinear Motion",
        "subject": "Physics",
        "grade": "11",
        "prerequisites": ["phys_vectors"],
        "x": 280,
        "y": 140,
        "simulation_id": "sim_projectile",
        "formulas": ["v = u + at", "s = ut + \\frac{1}{2}at^2", "v^2 = u^2 + 2as"],
        "description": "Kinematics equations under constant acceleration, position-time and velocity-time graphs.",
    },
    {
        "id": "phys_projectile_2d",
        "label": "Projectile Motion & 2D Trajectories",
        "subject": "Physics",
        "grade": "11",
        "prerequisites": ["phys_kinematics_1d"],
        "x": 480,
        "y": 140,
        "simulation_id": "sim_projectile",
        "formulas": ["R = \\frac{u^2 \\sin(2\\theta)}{g}", "H = \\frac{u^2 \\sin^2(\\theta)}{2g}", "T = \\frac{2u \\sin(\\theta)}{g}"],
        "description": "Independent orthogonal horizontal and vertical motion under constant downward gravity.",
    },
    {
        "id": "phys_newton_laws",
        "label": "Newton's Laws & Dynamics",
        "subject": "Physics",
        "grade": "11",
        "prerequisites": ["phys_kinematics_1d"],
        "x": 480,
        "y": 260,
        "simulation_id": "sim_pendulum",
        "formulas": ["\\sum \\vec{F} = m\\vec{a}", "f_s \\le \\mu_s N", "\\vec{p} = m\\vec{v}"],
        "description": "Inertia, free body diagrams, friction, and conservation of linear momentum.",
    },
    {
        "id": "phys_work_energy",
        "label": "Work, Energy & Power",
        "subject": "Physics",
        "grade": "11",
        "prerequisites": ["phys_newton_laws"],
        "x": 680,
        "y": 200,
        "simulation_id": "sim_pendulum",
        "formulas": ["W = \\int \\vec{F} \\cdot d\\vec{r}", "K = \\frac{1}{2}mv^2", "W_{net} = \\Delta K"],
        "description": "Work-energy theorem, conservative vs non-conservative forces, conservation of mechanical energy.",
    },
    {
        "id": "phys_shm_oscillations",
        "label": "Simple Harmonic Motion",
        "subject": "Physics",
        "grade": "11",
        "prerequisites": ["phys_work_energy"],
        "x": 880,
        "y": 200,
        "simulation_id": "sim_pendulum",
        "formulas": ["F = -kx", "T = 2\\pi \\sqrt{\\frac{L}{g}}", "E = \\frac{1}{2}kA^2"],
        "description": "Restoring forces, angular frequency, pendulum oscillations, and kinetic/potential exchange.",
    },
    {
        "id": "phys_coulomb_em",
        "label": "Electrostatics & Coulomb's Law",
        "subject": "Physics",
        "grade": "12",
        "prerequisites": ["phys_vectors", "phys_newton_laws"],
        "x": 680,
        "y": 320,
        "simulation_id": "sim_ohms_law",
        "formulas": ["F = \\frac{k |q_1 q_2|}{r^2}", "\\vec{E} = \\frac{\\vec{F}}{q}", "V = \\frac{k q}{r}"],
        "description": "Electric charges, field lines, Gauss's law, electrostatic potential and capacitance.",
    },
    {
        "id": "phys_current_circuits",
        "label": "Current Electricity & Ohm's Law",
        "subject": "Physics",
        "grade": "12",
        "prerequisites": ["phys_coulomb_em"],
        "x": 880,
        "y": 320,
        "simulation_id": "sim_ohms_law",
        "formulas": ["V = IR", "P = VI = I^2 R", "R = \\frac{\\rho L}{A}"],
        "description": "Drift velocity, Ohm's law, Kirchhoff's circuit laws, series/parallel combinations.",
    },

    # ------------------ CHEMISTRY ------------------
    {
        "id": "chem_atomic_structure",
        "label": "Atomic Structure & Orbitals",
        "subject": "Chemistry",
        "grade": "11",
        "prerequisites": [],
        "x": 100,
        "y": 480,
        "simulation_id": "sim_rutherford_atom_3d",
        "formulas": ["E_n = -\\frac{13.6}{n^2}\\,\\text{eV}", "\\lambda = \\frac{h}{p}", "\\Delta x \\cdot \\Delta p \\ge \\frac{\\hbar}{2}"],
        "description": "Bohr model, quantum numbers (n, l, m, s), Aufbau principle, Pauli exclusion, Hund's rule.",
    },
    {
        "id": "chem_periodic_table",
        "label": "Periodic Classification & Trends",
        "subject": "Chemistry",
        "grade": "11",
        "prerequisites": ["chem_atomic_structure"],
        "x": 280,
        "y": 480,
        "simulation_id": "sim_rutherford_atom_3d",
        "formulas": ["Z_{eff} = Z - \\sigma", "\\text{IE}_1 < \\text{IE}_2"],
        "description": "Ionization enthalpy, electron gain enthalpy, electronegativity, and atomic radii periodicity.",
    },
    {
        "id": "chem_chemical_bonding",
        "label": "Chemical Bonding & VSEPR",
        "subject": "Chemistry",
        "grade": "11",
        "prerequisites": ["chem_periodic_table"],
        "x": 480,
        "y": 480,
        "simulation_id": "sim_acid_base",
        "formulas": ["\\mu = q \\times d", "\\text{Bond Order} = \\frac{N_b - N_a}{2}"],
        "description": "Lewis structures, VSEPR 3D geometries, valence bond theory, hybridizations (sp, sp², sp³).",
    },
    {
        "id": "chem_equilibrium",
        "label": "Chemical Equilibrium & Acids-Bases",
        "subject": "Chemistry",
        "grade": "11",
        "prerequisites": ["chem_chemical_bonding"],
        "x": 680,
        "y": 480,
        "simulation_id": "sim_acid_base",
        "formulas": ["K_c = \\frac{[C]^c [D]^d}{[A]^a [B]^b}", "\\text{pH} = -\\log[H^+]", "K_w = [H^+][OH^-] = 10^{-14}"],
        "description": "Law of mass action, Le Chatelier's principle, pH scale, buffer solutions, titration curves.",
    },

    # ------------------ MATHEMATICS ------------------
    {
        "id": "math_functions",
        "label": "Relations & Functions",
        "subject": "Mathematics",
        "grade": "11",
        "prerequisites": [],
        "x": 100,
        "y": 640,
        "simulation_id": "sim_projectile",
        "formulas": ["f: X \\to Y", "(f \\circ g)(x) = f(g(x))"],
        "description": "Domain, range, one-to-one, onto functions, composite functions, trigonometric functions.",
    },
    {
        "id": "math_limits_continuity",
        "label": "Limits & Continuity",
        "subject": "Mathematics",
        "grade": "11",
        "prerequisites": ["math_functions"],
        "x": 280,
        "y": 640,
        "simulation_id": "sim_projectile",
        "formulas": ["\\lim_{x \\to a} f(x) = L", "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1"],
        "description": "Left/right hand limits, indeterminate forms, standard trigonometric limits, epsilon-delta concept.",
    },
    {
        "id": "math_calculus_diff",
        "label": "Differentiation & Chain Rule",
        "subject": "Mathematics",
        "grade": "12",
        "prerequisites": ["math_limits_continuity"],
        "x": 480,
        "y": 640,
        "simulation_id": "sim_projectile",
        "formulas": ["\\frac{d}{dx}[uv] = u'v + uv'", "\\frac{d}{dx}[f(g(x))] = f'(g(x))g'(x)"],
        "description": "First principles, power rule, product rule, quotient rule, chain rule, implicit differentiation.",
    },
    {
        "id": "math_applications_diff",
        "label": "Applications: Tangents & Maxima",
        "subject": "Mathematics",
        "grade": "12",
        "prerequisites": ["math_calculus_diff"],
        "x": 680,
        "y": 640,
        "simulation_id": "sim_projectile",
        "formulas": ["y - y_0 = f'(x_0)(x - x_0)", "f'(c) = 0 \\implies \\text{Critical Point}"],
        "description": "Tangent and normal lines, increasing/decreasing intervals, second derivative concavity test.",
    },
    {
        "id": "math_calculus_integral",
        "label": "Integrals & Riemann Sums",
        "subject": "Mathematics",
        "grade": "12",
        "prerequisites": ["math_applications_diff"],
        "x": 880,
        "y": 640,
        "simulation_id": "sim_projectile",
        "formulas": ["\\int_a^b f(x)\\,dx = \\lim_{n \\to \\infty} \\sum_{i=1}^n f(x_i)\\Delta x", "\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C"],
        "description": "Definite vs indefinite integrals, substitution method, integration by parts, fundamental theorem.",
    },

    # ------------------ BIOLOGY ------------------
    {
        "id": "bio_cell_unit",
        "label": "Cell: The Unit of Life",
        "subject": "Biology",
        "grade": "11",
        "prerequisites": [],
        "x": 100,
        "y": 800,
        "simulation_id": "sim_cell_biology_3d",
        "formulas": ["\\text{Cell Theory (Schleiden, Schwann, Virchow)}"],
        "description": "Prokaryotic vs eukaryotic cells, membrane structure (fluid mosaic), mitochondria, chloroplasts, nucleus.",
    },
    {
        "id": "bio_sensory_optics",
        "label": "Sensory Organs & Human Eye",
        "subject": "Biology",
        "grade": "11",
        "prerequisites": ["bio_cell_unit"],
        "x": 380,
        "y": 800,
        "simulation_id": "sim_eye_optics_3d",
        "formulas": ["P = \\frac{1}{f}", "\\text{Accommodation by Ciliary Muscles}"],
        "description": "Cornea, lens, retina photoreceptors (rods & cones), vision defects (myopia, hypermetropia).",
    },
]


def build_mastery_graph(
    user_key: str = "guest",
    subject_filter: Optional[str] = None,
    grade_filter: Optional[str] = None,
    learner_store: Optional[LearnerStore] = None,
) -> dict[str, Any]:
    """Generate the full concept graph merged with user mastery."""
    # Build edges from prerequisites
    edges: list[dict[str, str]] = []
    for node in CURRICULUM_NODES:
        for prereq in node["prerequisites"]:
            edges.append({"from": prereq, "to": node["id"]})

    # Default mastery mock profiles for guest / user
    mock_mastery: dict[str, float] = {
        "phys_vectors": 0.92,
        "phys_kinematics_1d": 0.88,
        "phys_projectile_2d": 0.42,  # struggling!
        "phys_newton_laws": 0.72,
        "phys_work_energy": 0.65,
        "chem_atomic_structure": 0.90,
        "chem_periodic_table": 0.78,
        "chem_chemical_bonding": 0.38,  # struggling!
        "math_functions": 0.85,
        "math_limits_continuity": 0.82,
        "math_calculus_diff": 0.60,
        "bio_cell_unit": 0.95,
        "bio_sensory_optics": 0.75,
    }

    nodes_with_mastery: list[dict[str, Any]] = []

    for n in CURRICULUM_NODES:
        # Apply filters
        if subject_filter and subject_filter != "All" and n["subject"] != subject_filter:
            continue
        if grade_filter and grade_filter != "All" and n["grade"] != grade_filter:
            continue

        # Look up strength
        strength = mock_mastery.get(n["id"], 0.5)
        if learner_store:
            try:
                row = learner_store.get(user_key, n["id"])
                if row:
                    strength = float(row["strength"])
            except Exception:
                pass

        # Determine status
        if strength >= 0.80:
            status = "mastered"
        elif strength >= 0.50:
            status = "in_progress"
        else:
            status = "struggling"

        nodes_with_mastery.append({
            **n,
            "strength": round(strength, 2),
            "mastery_percent": int(strength * 100),
            "status": status,
        })

    # Filter edges to match remaining nodes
    node_ids = {n["id"] for n in nodes_with_mastery}
    filtered_edges = [e for e in edges if e["from"] in node_ids and e["to"] in node_ids]

    return {
        "success": True,
        "user_key": user_key,
        "total_nodes": len(nodes_with_mastery),
        "total_edges": len(filtered_edges),
        "nodes": nodes_with_mastery,
        "edges": filtered_edges,
    }
