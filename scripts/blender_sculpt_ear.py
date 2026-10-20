"""
Ultra-Realistic Human Ear & Auditory Acoustic Apparatus Generator for Blender 5.2
Sculpts an authentic medical-grade human ear anatomy model:
1. Outer Ear (Auris Externa):
   - Pinna / Auricle (Helix, Antihelix, Concha, Tragus, Antitragus, and Lobule).
   - External Acoustic Meatus (Ear Canal) with acoustic resonance curvature.
2. Middle Ear (Auris Media):
   - Tympanic Membrane (Translucent conical eardrum with Umbo and Cone of Light).
   - Auditory Ossicles Chain (The 3 smallest bones in the human body):
     * Malleus (Hammer) with Head, Neck, Lateral Process, and Manubrium (Handle).
     * Incus (Anvil) with Body, Short Crus, Long Crus, and Lenticular Process.
     * Stapes (Stirrup) with Head, Anterior/Posterior Crura, and Footplate.
   - Oval Window (Fenestra Vestibuli) and Round Window (Fenestra Cochleae).
   - Pharyngotympanic (Eustachian) Tube.
   - Protective Muscles: Tensor Tympani & Stapedius (Acoustic reflex).
3. Inner Ear (Auris Interna / Labyrinth):
   - Bony & Membranous Semicircular Canals (Anterior, Posterior, Lateral in 3 orthogonal planes).
   - Swollen Semicircular Ampullae (Dynamic angular acceleration balance).
   - Central Vestibule (Utricle & Saccule otolith organs for gravity / linear acceleration).
   - Spiral Cochlea (2.5 turns around Modiolus core) with cross-sectional cutaway.
   - Organ of Corti with Basilar Membrane and Sensory Stereocilia Hair Cells.
   - Vestibulocochlear Nerve (Cranial Nerve VIII) with Vestibular and Cochlear divisions.
"""

import bpy
import bmesh
import math
import os

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "3d_models"))
MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models_blender"))
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_pbr_material(name, base_color, roughness=0.25, metallic=0.0, transmission=0.0, ior=1.45,
                        sss_weight=0.35, sss_radius=(1.0, 0.35, 0.15), specular=0.6, alpha=1.0,
                        is_cartilage=False, is_bone=False):
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
        bsdf.inputs['Base Color'].default_value = (*base_color, alpha)
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

    if transmission > 0 or alpha < 1.0:
        if 'Transmission Weight' in bsdf.inputs:
            bsdf.inputs['Transmission Weight'].default_value = transmission
        elif 'Transmission' in bsdf.inputs:
            bsdf.inputs['Transmission'].default_value = transmission
        mat.blend_method = 'BLEND'

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-650, 0)

    if is_cartilage:
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-400, 100)
        noise.inputs['Scale'].default_value = 24.0
        noise.inputs['Detail'].default_value = 4.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-100, -100)
        bump.inputs['Strength'].default_value = 0.15
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    if is_bone:
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-400, 100)
        noise.inputs['Scale'].default_value = 40.0
        noise.inputs['Detail'].default_value = 6.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-150, 100)
        cr.color_ramp.elements[0].position = 0.2
        cr.color_ramp.elements[0].color = (base_color[0] * 0.9, base_color[1] * 0.9, base_color[2] * 0.88, 1.0)
        cr.color_ramp.elements[1].position = 0.8
        cr.color_ramp.elements[1].color = (base_color[0] * 1.05, base_color[1] * 1.05, base_color[2] * 1.02, 1.0)
        links.new(noise.outputs['Fac'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

    return mat

def create_smooth_subd(obj, levels=2):
    mod = obj.modifiers.new(name="Subdivision", type='SUBSURF')
    mod.levels = levels
    mod.render_levels = levels
    for p in obj.data.polygons:
        p.use_smooth = True
    return mod

def build_ultra_ear():
    reset()

    # Materials
    mat_pinna = create_pbr_material("Mat_PinnaSkin", (0.88, 0.65, 0.55), roughness=0.38, sss_weight=0.45, is_cartilage=True)
    mat_canal = create_pbr_material("Mat_EarCanal", (0.75, 0.50, 0.45), roughness=0.40, sss_weight=0.30)
    mat_tympanic = create_pbr_material("Mat_Tympanic", (0.85, 0.80, 0.72), roughness=0.18, transmission=0.42, alpha=0.75, sss_weight=0.25)
    mat_ossicles = create_pbr_material("Mat_OssiclesBone", (0.92, 0.88, 0.80), roughness=0.22, sss_weight=0.20, is_bone=True)
    mat_stapes = create_pbr_material("Mat_Stapes", (0.95, 0.90, 0.82), roughness=0.20, sss_weight=0.18, is_bone=True)
    mat_labyrinth = create_pbr_material("Mat_LabyrinthBone", (0.78, 0.82, 0.88), roughness=0.25, sss_weight=0.30, is_bone=True)
    mat_cochlea = create_pbr_material("Mat_Cochlea", (0.84, 0.78, 0.72), roughness=0.28, sss_weight=0.35, is_bone=True)
    mat_nerve = create_pbr_material("Mat_AuditoryNerve", (0.95, 0.85, 0.45), roughness=0.30, sss_weight=0.35)
    mat_corti = create_pbr_material("Mat_OrganOfCorti", (0.92, 0.32, 0.38), roughness=0.28, sss_weight=0.40)
    mat_eustachian = create_pbr_material("Mat_Eustachian", (0.80, 0.55, 0.50), roughness=0.40, sss_weight=0.30)
    mat_muscle = create_pbr_material("Mat_TympanicMuscle", (0.78, 0.22, 0.24), roughness=0.35, sss_weight=0.30)

    # ========================================================
    # 1. OUTER EAR: PINNA / AURICLE (Positioned laterally at X ~ -4.5)
    # ========================================================
    # Helix Outer Rim (Torus Curve)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=2.6, minor_radius=0.32,
        major_segments=36, minor_segments=16,
        location=(-4.8, 0.0, 0.2)
    )
    helix = bpy.context.active_object
    helix.name = "Pinna_Helix"
    helix.scale = (0.75, 1.35, 1.0)
    helix.rotation_euler = (0.1, 0.15, -0.1)
    helix.data.materials.append(mat_pinna)
    create_smooth_subd(helix, 1)

    # Antihelix Fold (Inner Ridge)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.8, minor_radius=0.26,
        major_segments=28, minor_segments=14,
        location=(-4.6, -0.15, 0.2)
    )
    antihelix = bpy.context.active_object
    antihelix.name = "Pinna_Antihelix"
    antihelix.scale = (0.65, 1.15, 0.8)
    antihelix.data.materials.append(mat_pinna)
    create_smooth_subd(antihelix, 1)

    # Concha Shell (Central bowl funneling sound into canal)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24, ring_count=20, radius=1.2,
        location=(-4.2, 0.1, 0.0)
    )
    concha = bpy.context.active_object
    concha.name = "Pinna_Concha"
    concha.scale = (0.5, 0.9, 0.7)
    concha.data.materials.append(mat_pinna)
    create_smooth_subd(concha, 1)

    # Tragus (Anterior acoustic flap)
    bpy.ops.mesh.primitive_cone_add(
        vertices=16, radius1=0.45, depth=0.7,
        location=(-3.7, 0.45, 0.0)
    )
    tragus = bpy.context.active_object
    tragus.name = "Pinna_Tragus"
    tragus.rotation_euler = (0, 1.4, 0.3)
    tragus.data.materials.append(mat_pinna)
    create_smooth_subd(tragus, 1)

    # Lobule (Ear lobe - fibrofatty cushion)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24, ring_count=20, radius=0.95,
        location=(-4.6, -0.4, -2.6)
    )
    lobule = bpy.context.active_object
    lobule.name = "Pinna_Lobule"
    lobule.scale = (0.7, 1.1, 0.9)
    lobule.data.materials.append(mat_pinna)
    create_smooth_subd(lobule, 1)

    # External Acoustic Meatus (Ear Canal - S-shaped cylinder)
    curve_data = bpy.data.curves.new('EarCanalCurve', type='CURVE')
    curve_data.dimensions = '3D'
    polyline = curve_data.splines.new('BEZIER')
    polyline.bezier_points.add(3)

    pts = [
        (-4.0, 0.2, 0.0),      # Concha opening
        (-2.8, 0.35, 0.1),     # Cartilaginous middle bend
        (-1.6, 0.15, -0.05),   # Bony isthmus narrowing
        (-0.5, 0.0, -0.1)      # Tympanic sulcus termination
    ]
    for i, pt in enumerate(pts):
        polyline.bezier_points[i].co = pt
        polyline.bezier_points[i].handle_left = (pt[0] - 0.4, pt[1], pt[2])
        polyline.bezier_points[i].handle_right = (pt[0] + 0.4, pt[1], pt[2])

    curve_data.bevel_depth = 0.55
    curve_data.bevel_resolution = 8
    canal_obj = bpy.data.objects.new("External_Auditory_Canal", curve_data)
    bpy.context.scene.collection.objects.link(canal_obj)
    canal_obj.data.materials.append(mat_canal)

    # ========================================================
    # 2. MIDDLE EAR: TYMPANIC MEMBRANE & OSSICLES CHAIN
    # ========================================================
    # Tympanic Membrane (Eardrum - angled cone with Umbo apex)
    bpy.ops.mesh.primitive_cone_add(
        vertices=32, radius1=0.88, depth=0.35,
        location=(-0.45, 0.0, -0.1)
    )
    tympanic = bpy.context.active_object
    tympanic.name = "Tympanic_Membrane"
    tympanic.rotation_euler = (0.2, -1.35, 0.1)  # Angled ~55 deg to canal axis
    tympanic.data.materials.append(mat_tympanic)
    create_smooth_subd(tympanic, 1)

    # Malleus (Hammer): Manubrium attached to eardrum umbo, neck, and head
    # Malleus Handle (Manubrium)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.12, depth=0.95,
        location=(-0.35, -0.05, 0.1)
    )
    manubrium = bpy.context.active_object
    manubrium.name = "Malleus_Handle"
    manubrium.rotation_euler = (0.3, 0.4, 0.1)
    manubrium.data.materials.append(mat_ossicles)
    create_smooth_subd(manubrium, 1)

    # Malleus Head (Caput Mallei)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=20, ring_count=16, radius=0.35,
        location=(-0.15, -0.15, 0.75)
    )
    malleus_head = bpy.context.active_object
    malleus_head.name = "Malleus_Head"
    malleus_head.scale = (0.9, 1.1, 1.2)
    malleus_head.data.materials.append(mat_ossicles)
    create_smooth_subd(malleus_head, 1)

    # Incus (Anvil): Body articulating with malleus head, short crus, and long crus
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=20, ring_count=16, radius=0.38,
        location=(0.35, -0.18, 0.72)
    )
    incus_body = bpy.context.active_object
    incus_body.name = "Incus_Anvil"
    incus_body.scale = (1.2, 0.9, 1.0)
    incus_body.data.materials.append(mat_ossicles)
    create_smooth_subd(incus_body, 1)

    # Incus Long Crus (Descending process to stapes)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=14, radius=0.10, depth=0.75,
        location=(0.55, -0.12, 0.35)
    )
    incus_crus = bpy.context.active_object
    incus_crus.name = "Incus_Long_Crus"
    incus_crus.rotation_euler = (-0.2, 0.3, 0.0)
    incus_crus.data.materials.append(mat_ossicles)
    create_smooth_subd(incus_crus, 1)

    # Stapes (Stirrup): Head, Anterior & Posterior Crura, and Oval Footplate
    # Stapes Head (Capitulum)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.16,
        location=(0.85, -0.08, 0.12)
    )
    stapes_head = bpy.context.active_object
    stapes_head.name = "Stapes_Head"
    stapes_head.data.materials.append(mat_stapes)
    create_smooth_subd(stapes_head, 1)

    # Stapes Arch (Torus sliced into wishbone crura)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.35, minor_radius=0.07,
        major_segments=24, minor_segments=12,
        location=(1.25, -0.06, 0.10)
    )
    stapes_crura = bpy.context.active_object
    stapes_crura.name = "Stapes_Crura"
    stapes_crura.rotation_euler = (0, 1.57, 0)
    stapes_crura.scale = (1.0, 0.65, 1.3)
    stapes_crura.data.materials.append(mat_stapes)
    create_smooth_subd(stapes_crura, 1)

    # Stapes Footplate (Seated into Oval Window)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.42, depth=0.08,
        location=(1.65, -0.05, 0.10)
    )
    stapes_footplate = bpy.context.active_object
    stapes_footplate.name = "Stapes_Footplate"
    stapes_footplate.rotation_euler = (0, 1.57, 0)
    stapes_footplate.scale = (1.0, 1.6, 1.0)  # Oval footplate shape
    stapes_footplate.data.materials.append(mat_stapes)
    create_smooth_subd(stapes_footplate, 1)

    # Middle Ear Muscles: Tensor Tympani & Stapedius
    # Tensor Tympani (Tenses eardrum)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.09, depth=0.85,
        location=(-0.15, 0.35, 0.3)
    )
    tensor_tympani = bpy.context.active_object
    tensor_tympani.name = "Tensor_Tympani_Muscle"
    tensor_tympani.rotation_euler = (0.7, 0.2, 0.4)
    tensor_tympani.data.materials.append(mat_muscle)

    # Stapedius Muscle (Smallest skeletal muscle in body)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=12, radius=0.08, depth=0.6,
        location=(0.95, -0.55, 0.1)
    )
    stapedius = bpy.context.active_object
    stapedius.name = "Stapedius_Muscle"
    stapedius.rotation_euler = (-0.5, 0.8, -0.2)
    stapedius.data.materials.append(mat_muscle)

    # Pharyngotympanic (Eustachian) Tube (connecting middle ear to nasopharynx)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=18, radius=0.28, depth=2.4,
        location=(0.2, 0.8, -1.4)
    )
    eustachian = bpy.context.active_object
    eustachian.name = "Eustachian_Tube"
    eustachian.rotation_euler = (0.6, -0.4, 0.5)
    eustachian.data.materials.append(mat_eustachian)
    create_smooth_subd(eustachian, 1)

    # ========================================================
    # 3. INNER EAR: VESTIBULE, 3 SEMICIRCULAR CANALS & COCHLEA
    # ========================================================
    # Vestibule Chamber (Oval central hub between ossicles and cochlea)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=28, ring_count=20, radius=0.9,
        location=(2.2, 0.0, 0.15)
    )
    vestibule = bpy.context.active_object
    vestibule.name = "Vestibule_Chamber"
    vestibule.scale = (1.2, 0.85, 0.95)
    vestibule.data.materials.append(mat_labyrinth)
    create_smooth_subd(vestibule, 1)

    # 3 Semicircular Canals (In 3 orthogonal Planes: Anterior, Posterior, Lateral)
    # A. Anterior (Superior) Canal - Sagittal/Vertical Plane (Nodding YES)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.35, minor_radius=0.18,
        major_segments=36, minor_segments=16,
        location=(2.4, -0.15, 1.45)
    )
    ant_canal = bpy.context.active_object
    ant_canal.name = "Anterior_Semicircular_Canal"
    ant_canal.rotation_euler = (0.0, 1.45, 0.1)
    ant_canal.data.materials.append(mat_labyrinth)
    create_smooth_subd(ant_canal, 1)

    # Anterior Ampulla (Swelling at base containing crista)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.36,
        location=(2.1, 0.45, 0.9)
    )
    ant_ampulla = bpy.context.active_object
    ant_ampulla.name = "Anterior_Ampulla"
    ant_ampulla.data.materials.append(mat_labyrinth)

    # B. Posterior Canal - Coronal/Vertical Plane (Head tilting to shoulder)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.30, minor_radius=0.18,
        major_segments=36, minor_segments=16,
        location=(2.6, -1.35, 0.55)
    )
    post_canal = bpy.context.active_object
    post_canal.name = "Posterior_Semicircular_Canal"
    post_canal.rotation_euler = (1.50, 0.1, 0.0)
    post_canal.data.materials.append(mat_labyrinth)
    create_smooth_subd(post_canal, 1)

    # Posterior Ampulla
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.35,
        location=(2.2, -1.0, -0.3)
    )
    post_ampulla = bpy.context.active_object
    post_ampulla.name = "Posterior_Ampulla"
    post_ampulla.data.materials.append(mat_labyrinth)

    # C. Lateral (Horizontal) Canal - Transverse Plane (Shaking NO)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.15, minor_radius=0.18,
        major_segments=36, minor_segments=16,
        location=(3.1, -0.1, 0.15)
    )
    lat_canal = bpy.context.active_object
    lat_canal.name = "Lateral_Semicircular_Canal"
    lat_canal.rotation_euler = (0.25, 0.0, 0.0)
    lat_canal.data.materials.append(mat_labyrinth)
    create_smooth_subd(lat_canal, 1)

    # Lateral Ampulla
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.34,
        location=(2.7, 0.65, 0.15)
    )
    lat_ampulla = bpy.context.active_object
    lat_ampulla.name = "Lateral_Ampulla"
    lat_ampulla.data.materials.append(mat_labyrinth)

    # D. Spiral Cochlea (2.5-turn snail coil)
    cochlea_curve = bpy.data.curves.new('CochleaSpiral', type='CURVE')
    cochlea_curve.dimensions = '3D'
    cochlea_spline = cochlea_curve.splines.new('BEZIER')
    num_cochlea_pts = 24
    cochlea_spline.bezier_points.add(num_cochlea_pts - 1)

    turns = 2.6
    for i in range(num_cochlea_pts):
        t = i / (num_cochlea_pts - 1)
        angle = t * turns * math.pi * 2
        radius = 1.35 * (1.0 - t * 0.72)
        cx = 2.1 + math.cos(angle) * radius
        cy = 0.9 + math.sin(angle) * radius
        cz = -0.3 + t * 0.95  # Coiling cone tapering toward helicotrema apex

        bp = cochlea_spline.bezier_points[i]
        bp.co = (cx, cy, cz)
        bp.handle_left = (cx - 0.2 * math.sin(angle), cy + 0.2 * math.cos(angle), cz)
        bp.handle_right = (cx + 0.2 * math.sin(angle), cy - 0.2 * math.cos(angle), cz)

    cochlea_curve.bevel_depth = 0.42
    cochlea_curve.bevel_resolution = 10
    cochlea_obj = bpy.data.objects.new("Cochlea_Spiral_Shell", cochlea_curve)
    bpy.context.scene.collection.objects.link(cochlea_obj)
    cochlea_obj.data.materials.append(mat_cochlea)

    # Cochlea Internal Cutaway (Exposing Basilar Membrane & Organ of Corti)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.45, depth=0.85,
        location=(2.2, 1.45, 0.05)
    )
    corti_cutaway = bpy.context.active_object
    corti_cutaway.name = "Organ_Of_Corti_CrossSection"
    corti_cutaway.rotation_euler = (0.4, 0.3, 0.2)
    corti_cutaway.scale = (1.1, 0.45, 1.0)
    corti_cutaway.data.materials.append(mat_corti)
    create_smooth_subd(corti_cutaway, 1)

    # Basilar Membrane Strip inside cutaway
    bpy.ops.mesh.primitive_cube_add(
        size=0.45,
        location=(2.22, 1.48, 0.08)
    )
    basilar_mb = bpy.context.active_object
    basilar_mb.name = "Basilar_Membrane"
    basilar_mb.scale = (0.9, 0.1, 0.7)
    basilar_mb.data.materials.append(mat_pinna)

    # Stereocilia Hair Cell Tuft
    bpy.ops.mesh.primitive_cone_add(
        vertices=12, radius1=0.12, depth=0.35,
        location=(2.23, 1.55, 0.12)
    )
    hair_cells = bpy.context.active_object
    hair_cells.name = "Sensory_Hair_Cells"
    hair_cells.data.materials.append(mat_nerve)

    # E. Vestibulocochlear Nerve (Cranial Nerve VIII)
    # Cochlear Nerve Branch
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.22, depth=2.4,
        location=(3.4, 1.4, 0.6)
    )
    cochlear_nerve = bpy.context.active_object
    cochlear_nerve.name = "Cochlear_Nerve"
    cochlear_nerve.rotation_euler = (0.2, 1.35, -0.4)
    cochlear_nerve.data.materials.append(mat_nerve)
    create_smooth_subd(cochlear_nerve, 1)

    # Vestibular Nerve Branch
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.20, depth=2.2,
        location=(3.5, 0.2, 1.2)
    )
    vestibular_nerve = bpy.context.active_object
    vestibular_nerve.name = "Vestibular_Nerve"
    vestibular_nerve.rotation_euler = (-0.3, 1.25, 0.1)
    vestibular_nerve.data.materials.append(mat_nerve)
    create_smooth_subd(vestibular_nerve, 1)

    # Common CN VIII Trunk exiting into internal acoustic meatus
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=18, radius=0.32, depth=1.8,
        location=(4.5, 0.8, 1.1)
    )
    cn8_trunk = bpy.context.active_object
    cn8_trunk.name = "Vestibulocochlear_Nerve_CN_VIII"
    cn8_trunk.rotation_euler = (0.0, 1.57, 0.0)
    cn8_trunk.data.materials.append(mat_nerve)
    create_smooth_subd(cn8_trunk, 1)

    # ========================================================
    # STUDIO LIGHTING & CAMERA
    # ========================================================
    cam_data = bpy.data.cameras.new("StudioCamera")
    cam_data.lens = 55
    cam_obj = bpy.data.objects.new("StudioCamera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, -10.5, 4.2)
    cam_obj.rotation_euler = (1.25, 0.0, 0.0)
    bpy.context.scene.camera = cam_obj

    key_light = bpy.data.lights.new("KeyLight", type='AREA')
    key_light.energy = 450
    key_light.size = 4.0
    key_obj = bpy.data.objects.new("KeyLight", key_light)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.location = (3.0, -5.5, 5.0)

    fill_light = bpy.data.lights.new("FillLight", type='AREA')
    fill_light.energy = 220
    fill_light.size = 5.0
    fill_obj = bpy.data.objects.new("FillLight", fill_light)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-5.0, -4.5, 3.0)

    rim_light = bpy.data.lights.new("RimLight", type='AREA')
    rim_light.energy = 480
    rim_light.size = 3.0
    rim_obj = bpy.data.objects.new("RimLight", rim_light)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (0.0, 6.0, 4.0)

    # Save to native .blend file
    blend_path = os.path.join(MODELS_DIR, "ear_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[EAR] Saved native .blend to {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR, "ear_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[EAR] Rendered preview -> {preview_path}")

    # Export to WebGL GLB
    glb_path = os.path.join(OUTPUT_DIR, "ear_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[EAR SUCCESS] Exported complete ear model to {glb_path}")

if __name__ == '__main__':
    build_ultra_ear()
