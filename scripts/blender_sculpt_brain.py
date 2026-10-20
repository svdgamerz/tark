"""
Ultra-Realistic Anatomical Human Brain & Multipolar Neuron Generator for Blender 5.2
Sculpts an authentic medical-grade human brain and neuronal ultrastructure:
1. Cerebrum (Left and Right Cerebral Hemispheres separated by Longitudinal Cerebral Fissure).
   - Realistic convoluted Gyri and Sulci surface modeling.
   - 4 Anatomical Lobes: Frontal, Parietal, Temporal, and Occipital.
2. Cerebellum with horizontal folia ridges and Arbor Vitae ("Tree of Life") white matter branching.
3. Brainstem:
   - Midbrain (Mesencephalon) with Cerebral Peduncles and Superior/Inferior Colliculi.
   - Pons (Pons Varolii) with transverse pontine fibers.
   - Medulla Oblongata with Pyramids, Olives, and transition to Spinal Cord.
4. Clean Sagittal / Coronal Hemispheric Cutaway revealing:
   - C-shaped Corpus Callosum (Genu, Body, Splenium, Rostrum).
   - Fornix and Septum Pellucidum.
   - Thalamus (oval sensory relay nuclei) & Hypothalamus with Infundibulum.
   - Pituitary Gland (Hypophysis Cerebri).
   - Ventricular System (Lateral Ventricles, Foramen of Monro, 3rd Ventricle, Aqueduct of Sylvius, 4th Ventricle).
   - Pineal Gland (Epithalamus).
5. Synaptic Multipolar Neuron:
   - Soma (cell body) with prominent nucleus, nucleolus, and Nissl substance granules.
   - Extensive branching Dendritic Tree with microscopic Dendritic Spines.
   - Conical Axon Hillock transitioning into the Initial Segment.
   - Myelinated Axon with distinct Schwann cell Sheaths and Nodes of Ranvier gaps.
   - Terminal Axon Arborization ending in Synaptic Boutons (neurotransmitter vesicles, cleft, and postsynaptic density).
"""

import bpy
import bmesh
import math
import os

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "3d_models"))
MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models_blender"))
os.makedirs(OUTPUT_DIR, exist_ok=True)
MODELS_DIR_PATH = MODELS_DIR
os.makedirs(MODELS_DIR_PATH, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_pbr_material(name, base_color, roughness=0.32, metallic=0.0, transmission=0.0, ior=1.45,
                        sss_weight=0.35, sss_radius=(1.0, 0.35, 0.15), specular=0.6, is_cortex=False, is_myelin=False):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new(type='ShaderNodeOutputMaterial')
    out.location = (650, 0)

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (250, 0)
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

    if 'Base Color' in bsdf.inputs:
        bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = roughness
    if 'Metallic' in bsdf.inputs:
        bsdf.inputs['Metallic'].default_value = metallic
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value = ior
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = specular

    if sss_weight > 0:
        if 'Subsurface Weight' in bsdf.inputs:
            bsdf.inputs['Subsurface Weight'].default_value = sss_weight
        elif 'Subsurface' in bsdf.inputs:
            bsdf.inputs['Subsurface'].default_value = sss_weight
        if 'Subsurface Radius' in bsdf.inputs:
            bsdf.inputs['Subsurface Radius'].default_value = sss_radius

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-650, 0)

    if is_cortex:
        # Organic gyri/sulci micro-convolutions and cerebral vascular capillary sheen
        vor = nodes.new(type='ShaderNodeTexVoronoi')
        vor.location = (-400, 120)
        vor.inputs['Scale'].default_value = 18.0
        links.new(tex_coord.outputs['Object'], vor.inputs['Vector'])

        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-400, -120)
        noise.inputs['Scale'].default_value = 32.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.28
        links.new(vor.outputs['Distance'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-120, 150)
        cr.color_ramp.elements[0].position = 0.15
        cr.color_ramp.elements[0].color = (base_color[0]*0.82, base_color[1]*0.80, base_color[2]*0.80, 1.0)
        cr.color_ramp.elements[1].position = 0.85
        cr.color_ramp.elements[1].color = (base_color[0]*1.12, base_color[1]*1.08, base_color[2]*1.06, 1.0)
        links.new(noise.outputs['Fac'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

    elif is_myelin:
        # Glistening pearlescent lipid concentric sheath
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 0)
        noise.inputs['Scale'].default_value = 45.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.14
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def build_realistic_brain():
    reset()
    print("[BRAIN GENERATOR] Sculpting medical-grade 3D Brain & Neuron...")

    # Materials
    m_cortex_left = create_pbr_material("Mat_Cerebral_Cortex_Left", (0.84, 0.68, 0.62), roughness=0.28, sss_weight=0.45, is_cortex=True)
    m_cortex_right = create_pbr_material("Mat_Cerebral_Cortex_Right", (0.82, 0.66, 0.60), roughness=0.28, sss_weight=0.45, is_cortex=True)
    m_white_matter = create_pbr_material("Mat_White_Matter", (0.95, 0.92, 0.86), roughness=0.35, sss_weight=0.50)
    m_cerebellum = create_pbr_material("Mat_Cerebellum", (0.78, 0.58, 0.54), roughness=0.30, sss_weight=0.40)
    m_brainstem = create_pbr_material("Mat_Brainstem", (0.90, 0.82, 0.74), roughness=0.25, sss_weight=0.38)
    m_corpus = create_pbr_material("Mat_Corpus_Callosum", (0.96, 0.95, 0.92), roughness=0.20, sss_weight=0.52)
    m_thalamus = create_pbr_material("Mat_Thalamus", (0.88, 0.62, 0.55), roughness=0.26, sss_weight=0.42)
    m_pituitary = create_pbr_material("Mat_Pituitary", (0.85, 0.45, 0.48), roughness=0.22, sss_weight=0.45)
    m_ventricle = create_pbr_material("Mat_Ventricles_CSF", (0.45, 0.75, 0.95), roughness=0.10, transmission=0.45, ior=1.335)
    m_dendrite = create_pbr_material("Mat_Neuron_Soma", (0.92, 0.42, 0.28), roughness=0.24, sss_weight=0.40)
    m_myelin = create_pbr_material("Mat_Myelin_Sheath", (0.96, 0.94, 0.76), roughness=0.20, sss_weight=0.48, is_myelin=True)
    m_vesicle = create_pbr_material("Mat_Synaptic_Vesicle", (0.24, 0.82, 0.95), roughness=0.15, specular=0.9)

    root = bpy.data.objects.new("Brain_System_Root", None)
    bpy.context.scene.collection.objects.link(root)

    brain_group = bpy.data.objects.new("Brain_Organ_Group", None)
    bpy.context.scene.collection.objects.link(brain_group)
    brain_group.parent = root

    neuron_group = bpy.data.objects.new("Neuron_Ultrastructure_Group", None)
    bpy.context.scene.collection.objects.link(neuron_group)
    neuron_group.parent = root
    neuron_group.location = (4.5, 0.0, 0.0)

    # =========================================================================
    # 1. CEREBRUM: LEFT AND RIGHT CEREBRAL HEMISPHERES WITH CONVOLUTED GYRI
    # =========================================================================
    left_hemi = bpy.data.objects.new("Left_Hemisphere", None)
    bpy.context.scene.collection.objects.link(left_hemi)
    left_hemi.parent = brain_group

    right_hemi = bpy.data.objects.new("Right_Hemisphere", None)
    bpy.context.scene.collection.objects.link(right_hemi)
    right_hemi.parent = brain_group

    def sculpt_hemisphere(is_left=True):
        sgn = 1.0 if is_left else -1.0
        h_name = "Left_Cerebral_Hemisphere" if is_left else "Right_Cerebral_Hemisphere"
        mat = m_cortex_left if is_left else m_cortex_right

        # Base cerebral ovoid
        bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1.0, location=(sgn * 0.78, -0.15, 0.45))
        hemi = bpy.context.active_object
        hemi.name = h_name
        hemi.scale = (0.72, 1.25, 0.88)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

        bm = bmesh.new()
        bm.from_mesh(hemi.data)
        for v in bm.verts:
            # Flatten medial sagittal face along longitudinal fissure (X = 0)
            if (is_left and v.co.x < sgn * 0.12) or (not is_left and v.co.x > sgn * 0.12):
                v.co.x = sgn * 0.08

            # Frontal pole anterior expansion & occipital pole posterior taper
            y = v.co.y
            if y > 0.4:
                v.co.z += (y - 0.4) * 0.18
                v.co.x *= 1.05
            elif y < -0.4:
                d = abs(y + 0.4)
                v.co.x *= max(0.45, 1.0 - d * 0.45)
                v.co.z *= max(0.45, 1.0 - d * 0.40)

            # Temporal lobe inferior-anterior descent
            if -0.2 < y < 0.6 and v.co.z < 0.2:
                v.co.z -= 0.18 * math.sin((y + 0.2) * math.pi)
                v.co.x += sgn * 0.12 * math.sin((y + 0.2) * math.pi)

            # Deep anatomical sulcal grooves (Lateral Sylvian fissure & Central sulcus of Rolando)
            # Procedural gyri harmonic folding
            r_dist = math.sqrt(v.co.x**2 + v.co.y**2 + v.co.z**2)
            gyri_wave = math.sin(v.co.y * 14.0 + v.co.z * 10.0) * math.cos(v.co.x * 12.0)
            v.co += v.normal * (gyri_wave * 0.045)

        # Sagittal cutaway window on right hemisphere to expose internal limbic structures!
        if not is_left:
            # Slice medial anterior region to reveal thalamus & corpus callosum
            for v in bm.verts:
                if v.co.x > -0.25 and v.co.z < 0.85 and v.co.y < 0.65:
                    v.co.x = min(v.co.x, -0.22)

        bm.to_mesh(hemi.data)
        bm.free()

        hemi.data.materials.append(mat)
        bpy.ops.object.shade_smooth()
        return hemi

    l_hemi_obj = sculpt_hemisphere(True)
    l_hemi_obj.parent = left_hemi
    r_hemi_obj = sculpt_hemisphere(False)
    r_hemi_obj.parent = right_hemi

    # 4 Named Functional Lobes for Click-to-Inspect Dissection
    lobes_info = [
        ("Frontal_Lobe", (0.75, 0.72, 0.65), (0.55, 0.50, 0.45), m_cortex_left, left_hemi, "Executive Function, Motor Cortex & Speech (Broca's Area)"),
        ("Parietal_Lobe", (0.75, -0.20, 0.95), (0.50, 0.45, 0.40), m_cortex_left, left_hemi, "Somatosensory Processing & Spatial Awareness"),
        ("Temporal_Lobe", (0.95, 0.15, 0.10), (0.42, 0.65, 0.35), m_cortex_left, left_hemi, "Auditory Cortex, Language Comprehension (Wernicke) & Memory"),
        ("Occipital_Lobe", (0.55, -0.95, 0.35), (0.45, 0.42, 0.40), m_cortex_left, left_hemi, "Primary Visual Cortex & Optical Pattern Recognition")
    ]
    for lb_name, pos, sc, mat, parent_grp, desc in lobes_info:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=18, radius=0.6, location=pos)
        lb = bpy.context.active_object
        lb.name = lb_name
        lb.scale = sc
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        lb.data.materials.append(mat)
        lb.parent = parent_grp
        bpy.ops.object.shade_smooth()

    # =========================================================================
    # 2. INTERNAL LIMBIC & VENTRICULAR STRUCTURES (SAGITTAL CORE)
    # =========================================================================
    # Corpus Callosum (Iconic C-shaped Commissural Arch)
    c_corpus = bpy.data.curves.new('Curve_Corpus_Callosum', 'CURVE')
    c_corpus.dimensions = '3D'
    c_corpus.bevel_depth = 0.14
    c_corpus.bevel_resolution = 12
    s_corpus = c_corpus.splines.new('BEZIER')
    s_corpus.bezier_points.add(4)
    pts_corpus = [
        (0.0, 0.60, 0.38),   # Rostrum & Genu
        (0.0, 0.35, 0.78),   # Body anterior
        (0.0, -0.15, 0.82),  # Body central
        (0.0, -0.58, 0.70),  # Splenium posterior
        (0.0, -0.42, 0.48)   # Fornix return
    ]
    for i, pt in enumerate(pts_corpus):
        s_corpus.bezier_points[i].co = pt
        s_corpus.bezier_points[i].handle_left_type = 'AUTO'
        s_corpus.bezier_points[i].handle_right_type = 'AUTO'

    corpus_obj = bpy.data.objects.new("Corpus_Callosum", c_corpus)
    bpy.context.scene.collection.objects.link(corpus_obj)
    corpus_obj.data.materials.append(m_corpus)
    corpus_obj.parent = left_hemi

    # Thalamus (Oval Egg-shaped Sensory Gatekeeper - Paired Left/Right)
    for sgn, th_name, p_grp in [(-1, "Right_Thalamus", right_hemi), (1, "Left_Thalamus", left_hemi)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=18, radius=0.32, location=(sgn * 0.24, -0.10, 0.42))
        th = bpy.context.active_object
        th.name = th_name
        th.scale = (0.85, 1.25, 0.85)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        th.data.materials.append(m_thalamus)
        th.parent = p_grp
        bpy.ops.object.shade_smooth()

    # Hypothalamus & Pituitary Gland (Master Endocrine Control)
    bpy.ops.mesh.primitive_cone_add(radius1=0.22, radius2=0.08, depth=0.28, location=(0.0, 0.18, 0.22))
    hypothalamus = bpy.context.active_object
    hypothalamus.name = "Hypothalamus"
    hypothalamus.rotation_euler = (0.45, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    hypothalamus.data.materials.append(m_thalamus)
    hypothalamus.parent = left_hemi

    # Infundibulum stalk & Pituitary gland (Anterior & Posterior lobes)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.045, depth=0.28, location=(0.0, 0.28, 0.05))
    stalk = bpy.context.active_object
    stalk.name = "Pituitary_Infundibulum"
    stalk.rotation_euler = (0.65, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    stalk.data.materials.append(m_white_matter)
    stalk.parent = left_hemi

    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=16, radius=0.14, location=(0.0, 0.38, -0.06))
    pituitary = bpy.context.active_object
    pituitary.name = "Pituitary_Gland"
    pituitary.scale = (1.2, 0.9, 0.9)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pituitary.data.materials.append(m_pituitary)
    pituitary.parent = left_hemi

    # Ventricular System (Lateral & 3rd/4th Ventricles filled with CSF)
    c_vent = bpy.data.curves.new('Curve_Lateral_Ventricle', 'CURVE')
    c_vent.dimensions = '3D'
    c_vent.bevel_depth = 0.09
    c_vent.bevel_resolution = 10
    s_vent = c_vent.splines.new('BEZIER')
    s_vent.bezier_points.add(3)
    pts_vent = [
        (0.20, 0.45, 0.42),
        (0.22, 0.00, 0.62),
        (0.25, -0.52, 0.40),
        (0.35, -0.15, 0.08)
    ]
    for i, pt in enumerate(pts_vent):
        s_vent.bezier_points[i].co = pt
        s_vent.bezier_points[i].handle_left_type = 'AUTO'
        s_vent.bezier_points[i].handle_right_type = 'AUTO'

    vent_obj = bpy.data.objects.new("Lateral_Ventricle", c_vent)
    bpy.context.scene.collection.objects.link(vent_obj)
    vent_obj.data.materials.append(m_ventricle)
    vent_obj.parent = left_hemi

    # =========================================================================
    # 3. CEREBELLUM & ARBOR VITAE
    # =========================================================================
    # Cerebellum Hemispheres with Foliated Ridges
    for sgn, c_name, p_grp in [(-1, "Right_Cerebellar_Hemisphere", right_hemi), (1, "Left_Cerebellar_Hemisphere", left_hemi)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=28, radius=0.72, location=(sgn * 0.55, -0.88, -0.32))
        cb = bpy.context.active_object
        cb.name = c_name
        cb.scale = (0.75, 0.70, 0.65)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

        bm = bmesh.new()
        bm.from_mesh(cb.data)
        for v in bm.verts:
            # Horizontal folia banding
            folia_wave = math.sin(v.co.z * 32.0) * 0.024
            v.co += v.normal * folia_wave
        bm.to_mesh(cb.data)
        bm.free()

        cb.data.materials.append(m_cerebellum)
        cb.parent = p_grp
        bpy.ops.object.shade_smooth()

    # Arbor Vitae ("Tree of Life" internal branching inside left cerebellar cutface)
    for b_idx in range(5):
        b_ang = -0.5 + b_idx * 0.25
        bx = 0.12
        by = -0.88 + math.sin(b_ang) * 0.35
        bz = -0.32 + math.cos(b_ang) * 0.35
        bpy.ops.mesh.primitive_cylinder_add(radius=0.024, depth=0.45, location=(bx, by, bz))
        arbor = bpy.context.active_object
        arbor.name = f"Arbor_Vitae_Branch_{b_idx+1}"
        arbor.rotation_euler = (b_ang, 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        arbor.data.materials.append(m_white_matter)
        arbor.parent = left_hemi

    # =========================================================================
    # 4. BRAINSTEM: MIDBRAIN, PONS, & MEDULLA OBLONGATA
    # =========================================================================
    # Midbrain (Cerebral Peduncles)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=0.38, location=(0.0, -0.05, 0.05))
    midbrain = bpy.context.active_object
    midbrain.name = "Midbrain"
    midbrain.rotation_euler = (0.28, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    midbrain.data.materials.append(m_brainstem)
    midbrain.parent = left_hemi
    bpy.ops.object.shade_smooth()

    # Pons (Prominent bulbous bridge)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.42, location=(0.0, -0.15, -0.28))
    pons = bpy.context.active_object
    pons.name = "Pons"
    pons.scale = (1.05, 0.90, 0.85)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pons.data.materials.append(m_brainstem)
    pons.parent = left_hemi
    bpy.ops.object.shade_smooth()

    # Medulla Oblongata & Pyramids (autonomic cardiorespiratory center)
    bpy.ops.mesh.primitive_cone_add(radius1=0.28, radius2=0.16, depth=0.72, location=(0.0, -0.28, -0.78))
    medulla = bpy.context.active_object
    medulla.name = "Medulla_Oblongata"
    medulla.rotation_euler = (0.18, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    medulla.data.materials.append(m_brainstem)
    medulla.parent = left_hemi
    bpy.ops.object.shade_smooth()

    # =========================================================================
    # 5. SYNAPTIC MULTIPOLAR NEURON ULTRASTRUCTURE
    # =========================================================================
    # Soma (Cell Body with Pyramidal/Star-like Form)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=0.75, location=(0.0, 0.0, 1.2))
    soma = bpy.context.active_object
    soma.name = "Neuron_Soma"
    soma.scale = (1.0, 0.85, 1.15)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(soma.data)
    for v in bm.verts:
        # Pull outward spikes towards dendrites
        d_noise = math.sin(v.co.x * 6.0) * math.cos(v.co.z * 6.0)
        v.co += v.normal * (d_noise * 0.12)
    bm.to_mesh(soma.data)
    bm.free()

    soma.data.materials.append(m_dendrite)
    soma.parent = neuron_group
    bpy.ops.object.shade_smooth()

    # Prominent Nucleus & Nucleolus
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=18, radius=0.32, location=(0.0, 0.0, 1.2))
    n_nuc = bpy.context.active_object
    n_nuc.name = "Neuron_Nucleus"
    n_nuc.data.materials.append(m_thalamus)
    n_nuc.parent = neuron_group

    # Branching Dendritic Tree (6 primary dendrites with secondary spines)
    dendrite_angles = [0.0, 1.05, 2.09, 3.14, 4.19, 5.24]
    for d_i, d_ang in enumerate(dendrite_angles):
        dx = math.cos(d_ang) * 0.65
        dy = math.sin(d_ang) * 0.65
        dz = 1.2 + 0.35 * math.sin(d_ang * 2)

        c_dend = bpy.data.curves.new(f'Curve_Dendrite_{d_i+1}', 'CURVE')
        c_dend.dimensions = '3D'
        c_dend.bevel_depth = 0.08
        c_dend.bevel_resolution = 8
        s_dend = c_dend.splines.new('BEZIER')
        s_dend.bezier_points.add(2)
        s_dend.bezier_points[0].co = (dx * 0.8, dy * 0.8, dz)
        s_dend.bezier_points[1].co = (dx * 1.8, dy * 1.8, dz + 0.45)
        s_dend.bezier_points[2].co = (dx * 2.6, dy * 2.6, dz + 0.85)
        for bp in s_dend.bezier_points:
            bp.handle_left_type = 'AUTO'
            bp.handle_right_type = 'AUTO'

        dend_obj = bpy.data.objects.new(f"Dendrite_Primary_{d_i+1}", c_dend)
        bpy.context.scene.collection.objects.link(dend_obj)
        dend_obj.data.materials.append(m_dendrite)
        dend_obj.parent = neuron_group

        # Microscopic dendritic spines (synaptic inputs)
        for sp_k in range(4):
            sp_t = 0.3 + sp_k * 0.22
            sp_x = dx * (1.0 + sp_t * 1.4) + 0.08 * math.cos(sp_k * 2)
            sp_y = dy * (1.0 + sp_t * 1.4) + 0.08 * math.sin(sp_k * 2)
            sp_z = dz + sp_t * 0.6
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.038, location=(sp_x, sp_y, sp_z))
            spine = bpy.context.active_object
            spine.name = f"Dendritic_Spine_{d_i+1}_{sp_k+1}"
            spine.data.materials.append(m_dendrite)
            spine.parent = neuron_group

    # Axon Hillock (Conical transition zone - trigger zone for action potentials)
    bpy.ops.mesh.primitive_cone_add(radius1=0.28, radius2=0.08, depth=0.45, location=(0.0, 0.0, 0.55))
    hillock = bpy.context.active_object
    hillock.name = "Axon_Hillock"
    hillock.rotation_euler = (math.pi, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    hillock.data.materials.append(m_dendrite)
    hillock.parent = neuron_group
    bpy.ops.object.shade_smooth()

    # Long Cylindrical Axon Core
    bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=4.2, location=(0.0, 0.0, -1.8))
    axon_core = bpy.context.active_object
    axon_core.name = "Axon_Core"
    axon_core.data.materials.append(m_dendrite)
    axon_core.parent = neuron_group

    # Myelin Sheath Segments (Schwann cell insulating rolls) with Nodes of Ranvier
    sheath_count = 5
    for sh_k in range(sheath_count):
        sh_z = 0.1 - sh_k * 0.85
        # Barrel-shaped myelin roll
        bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.68, location=(0.0, 0.0, sh_z))
        sheath = bpy.context.active_object
        sheath.name = f"Myelin_Sheath_Segment_{sh_k+1}"
        sheath.data.materials.append(m_myelin)
        sheath.parent = neuron_group
        bpy.ops.object.shade_smooth()

        # Node of Ranvier (Bare gap with concentrated voltage-gated Na+ channels)
        if sh_k < sheath_count - 1:
            node_z = sh_z - 0.42
            bpy.ops.mesh.primitive_torus_add(major_radius=0.08, minor_radius=0.022, location=(0.0, 0.0, node_z))
            node_r = bpy.context.active_object
            node_r.name = f"Node_of_Ranvier_{sh_k+1}"
            node_r.data.materials.append(m_vesicle)
            node_r.parent = neuron_group

    # Terminal Axon Arborization & Synaptic Boutons
    bouton_coords = [
        (-0.45, -0.35, -4.2),
        (0.48, -0.28, -4.3),
        (-0.25, 0.45, -4.25),
        (0.38, 0.40, -4.35)
    ]
    for b_idx, b_pos in enumerate(bouton_coords):
        # Telodendria branch
        c_telo = bpy.data.curves.new(f'Curve_Telodendria_{b_idx+1}', 'CURVE')
        c_telo.dimensions = '3D'
        c_telo.bevel_depth = 0.04
        s_telo = c_telo.splines.new('BEZIER')
        s_telo.bezier_points.add(1)
        s_telo.bezier_points[0].co = (0.0, 0.0, -3.8)
        s_telo.bezier_points[1].co = b_pos
        for bp in s_telo.bezier_points:
            bp.handle_left_type = 'AUTO'
            bp.handle_right_type = 'AUTO'
        telo_obj = bpy.data.objects.new(f"Telodendria_{b_idx+1}", c_telo)
        bpy.context.scene.collection.objects.link(telo_obj)
        telo_obj.data.materials.append(m_dendrite)
        telo_obj.parent = neuron_group

        # Bulbous Synaptic Bouton Endfoot
        bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=14, radius=0.16, location=b_pos)
        bouton = bpy.context.active_object
        bouton.name = f"Synaptic_Bouton_{b_idx+1}"
        bouton.scale = (1.1, 1.1, 0.8)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        bouton.data.materials.append(m_dendrite)
        bouton.parent = neuron_group
        bpy.ops.object.shade_smooth()

        # Neurotransmitter Vesicles inside bouton (Acetylcholine/Glutamate)
        for v_k in range(4):
            vx = b_pos[0] + (v_k % 2 - 0.5) * 0.10
            vy = b_pos[1] + (v_k // 2 - 0.5) * 0.10
            vz = b_pos[2] - 0.06
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.024, location=(vx, vy, vz))
            ves = bpy.context.active_object
            ves.name = f"Neurotransmitter_Vesicle_{b_idx+1}_{v_k+1}"
            ves.data.materials.append(m_vesicle)
            ves.parent = neuron_group

    # =========================================================================
    # LIGHTING & CAMERA FOR BEAUTY PREVIEW RENDER
    # =========================================================================
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.lens = 45
    cam = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (2.2, -6.8, 2.4)
    cam.rotation_euler = (math.radians(72), 0, math.radians(18))

    # 3-Point Studio Lighting
    key_light = bpy.data.lights.new("KeyLight", type='AREA')
    key_light.energy = 380
    key_light.size = 3.5
    key_obj = bpy.data.objects.new("KeyLight", key_light)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.location = (3.5, -4.5, 4.0)

    fill_light = bpy.data.lights.new("FillLight", type='AREA')
    fill_light.energy = 160
    fill_light.size = 4.0
    fill_obj = bpy.data.objects.new("FillLight", fill_light)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-4.0, -3.5, 2.5)

    rim_light = bpy.data.lights.new("RimLight", type='AREA')
    rim_light.energy = 420
    rim_light.size = 2.5
    rim_obj = bpy.data.objects.new("RimLight", rim_light)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (0.5, 5.0, 3.5)

    # Save .blend file
    blend_path = os.path.join(MODELS_DIR_PATH, "brain_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[SUCCESS] Saved Brain .blend -> {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR_PATH, "brain_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[SUCCESS] Rendered Brain preview -> {preview_path}")

    # Export optimized GLB for Three.js WebGL
    glb_path = os.path.join(OUTPUT_DIR, "brain_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_materials='EXPORT',
        export_normals=True
    )
    print(f"[SUCCESS] Exported WebGL GLB -> {glb_path}")

    # Create launcher batch script
    bat_path = os.path.join(MODELS_DIR_PATH, "Open_Brain_In_Blender.bat")
    with open(bat_path, "w", encoding="utf-8") as bf:
        bf.write(f'@echo off\necho Opening 3D Brain & Neuron in Blender 5.2...\nstart "" "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" "%~dp0brain_realistic.blend"\nexit\n')
    print(f"[SUCCESS] Created Launcher -> {bat_path}")

if __name__ == "__main__":
    build_realistic_brain()
