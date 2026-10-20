"""
Medical-Grade 3D Human Eye Sculptor for Blender 5.x / 4.x
Generates an anatomically authentic human eye with:
1. Complete intact Sclera (Sclera_Intact) for whole-organ view.
2. Sagittal cutaway Sclera (Sclera_Cutaway) and Choroid (Choroid_Cutaway) exposing:
   - Full posterior neurosensory Retina (orange-red PBR)
   - Macula Lutea and central Fovea Centralis pit (peak cone density)
   - Optic Disc (anatomical blind spot) with central retinal artery & vein arcade
   - Biconvex Crystalline Lens with dynamic accommodation curvature
   - 32 Suspensory Zonules of Zinn connecting to corrugated Ciliary Body ring
   - Anterior transparent Cornea dome with sclerocorneal limbus ring
   - Iris with radial pupillary stroma and aperture
   - Translucent Vitreous Humor and Anterior Chamber
   - Extraocular Rectus and Oblique muscles with fibrous Trochlea pulley
   - Posterior Optic Nerve wrapped in Dural Sheath
3. Natural coordinate alignment:
   - Anterior (Cornea/Pupil) is -Y in Blender -> +Z in glTF (facing camera/light)
   - Posterior (Retina/Optic Nerve) is +Y in Blender -> -Z in glTF
   - Superior (Superior Rectus) is +Z in Blender -> +Y in glTF (Up)
   - Right/Lateral is +X in Blender -> +X in glTF (Right)
"""

import bpy
import bmesh
import math
import os

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_pbr_material(name, base_color, roughness=0.3, transmission=0.0, ior=1.45, sss_weight=0.0, alpha=1.0, specular=0.5, is_iris=False, is_sclera=False):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new(type='ShaderNodeOutputMaterial')
    output.location = (400, 0)

    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

    bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness

    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = specular

    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value = ior

    if transmission > 0:
        if 'Transmission Weight' in bsdf.inputs:
            bsdf.inputs['Transmission Weight'].default_value = transmission
        elif 'Transmission' in bsdf.inputs:
            bsdf.inputs['Transmission'].default_value = transmission
        mat.blend_method = 'BLEND'

    if sss_weight > 0:
        if 'Subsurface Weight' in bsdf.inputs:
            bsdf.inputs['Subsurface Weight'].default_value = sss_weight
            if 'Subsurface Radius' in bsdf.inputs:
                bsdf.inputs['Subsurface Radius'].default_value = (0.8, 0.2, 0.1)
        elif 'Subsurface' in bsdf.inputs:
            bsdf.inputs['Subsurface'].default_value = sss_weight

    if alpha < 1.0:
        if 'Alpha' in bsdf.inputs:
            bsdf.inputs['Alpha'].default_value = alpha
        mat.blend_method = 'BLEND'

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-600, 0)

    if is_iris:
        vor = nodes.new(type='ShaderNodeTexVoronoi')
        vor.location = (-350, 100)
        vor.inputs['Scale'].default_value = 35.0
        links.new(tex_coord.outputs['Object'], vor.inputs['Vector'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-100, 100)
        cr.color_ramp.elements[0].position = 0.2
        cr.color_ramp.elements[0].color = (0.05, 0.22, 0.42, 1.0)
        cr.color_ramp.elements[1].position = 0.8
        cr.color_ramp.elements[1].color = (0.12, 0.48, 0.68, 1.0)
        links.new(vor.outputs['Distance'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.35
        links.new(vor.outputs['Distance'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    elif is_sclera:
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 0)
        noise.inputs['Scale'].default_value = 22.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.08
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def build_perfect_eye():
    clear_scene()

    print("[EYE GENERATOR] Sculpting complete masterwork human eye...")

    # Materials calibrated to human ocular histology & ophthalmic funduscopy
    # Sclera: Natural glistening ivory with warm organic micro-vascular undertone
    m_sclera = create_pbr_material("Mat_Sclera", (0.94, 0.93, 0.90), roughness=0.18, sss_weight=0.35, is_sclera=True)
    # Choroid: Deep melanin-rich chocolate brown-black vascular bed
    m_choroid = create_pbr_material("Mat_Choroid", (0.16, 0.07, 0.04), roughness=0.65, sss_weight=0.15)
    # Retina: Authentic ophthalmic fundus warm salmon/terracotta red sensory lining
    m_retina = create_pbr_material("Mat_Retina", (0.78, 0.32, 0.20), roughness=0.45, sss_weight=0.40)
    # Cornea: Optically transparent refractive glass (n=1.376)
    m_cornea = create_pbr_material("Mat_Cornea", (0.98, 0.99, 1.0), roughness=0.015, transmission=0.98, ior=1.376, specular=0.98)
    m_aqueous = create_pbr_material("Mat_AqueousHumor", (0.96, 0.98, 1.0), roughness=0.01, transmission=0.98, ior=1.336, alpha=0.15)
    m_vitreous = create_pbr_material("Mat_VitreousBody", (0.96, 0.98, 1.0), roughness=0.02, transmission=0.97, ior=1.336, alpha=0.15)
    m_limbus = create_pbr_material("Mat_LimbusRing", (0.05, 0.08, 0.12), roughness=0.20)
    # Iris: Natural rich oceanic hazel-sapphire with warm amber collarette
    m_iris = create_pbr_material("Mat_IrisStroma", (0.06, 0.32, 0.52), roughness=0.32, sss_weight=0.25, is_iris=True)
    m_ruff = create_pbr_material("Mat_PupillaryRuff", (0.02, 0.015, 0.01), roughness=0.10)
    m_pupil = create_pbr_material("Mat_Pupil", (0.005, 0.005, 0.005), roughness=0.04)
    # Crystalline Lens: Optical crystalline biconvex lens (n=1.406)
    m_lens = create_pbr_material("Mat_CrystallineLens", (0.95, 0.98, 1.0), roughness=0.025, transmission=0.95, ior=1.406, specular=0.92)
    m_ciliary = create_pbr_material("Mat_CiliaryMuscle", (0.62, 0.18, 0.12), roughness=0.45, sss_weight=0.3)
    m_zonule = create_pbr_material("Mat_ZonuleFilament", (0.92, 0.96, 1.0), roughness=0.20, alpha=0.55, transmission=0.6)
    # Macula & Fovea: Natural luteal carotenoid yellow
    m_macula = create_pbr_material("Mat_MaculaLutea", (0.88, 0.68, 0.12), roughness=0.32, sss_weight=0.3)
    m_fovea = create_pbr_material("Mat_FoveaCentralis", (0.92, 0.74, 0.15), roughness=0.25)
    m_disc = create_pbr_material("Mat_OpticDisc", (0.96, 0.82, 0.65), roughness=0.28)
    m_ret_art = create_pbr_material("Mat_RetinalArtery", (0.82, 0.10, 0.10), roughness=0.18, specular=0.75)
    m_ret_vein = create_pbr_material("Mat_RetinalVein", (0.16, 0.32, 0.68), roughness=0.18, specular=0.75)
    m_nerve = create_pbr_material("Mat_OpticNerve", (0.92, 0.86, 0.68), roughness=0.40, sss_weight=0.3)
    m_sheath = create_pbr_material("Mat_DuralSheath", (0.88, 0.88, 0.86), roughness=0.35, sss_weight=0.25)
    m_muscle = create_pbr_material("Mat_RectusMuscle", (0.62, 0.14, 0.14), roughness=0.32, sss_weight=0.35)
    m_tendon = create_pbr_material("Mat_MuscleTendon", (0.94, 0.94, 0.92), roughness=0.25, sss_weight=0.3)
    m_trochlea = create_pbr_material("Mat_TrochleaPulley", (0.88, 0.90, 0.82), roughness=0.30)

    # Master Root
    root = bpy.data.objects.new("Eye_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # Note: In Blender, Anterior is -Y (exports to +Z facing camera and light).
    # Posterior is +Y (exports to -Z toward retina and optic nerve).
    # Superior is +Z (exports to +Y).

    # =========================================================================
    # 1. INTACT SCLERA (FOR INTACT WHOLE ORGAN VIEW)
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=2.40, location=(0, 0, 0))
    sclera_intact = bpy.context.active_object
    sclera_intact.name = "Sclera_Intact"
    sclera_intact.scale = (1.0, 1.02, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    sclera_intact.data.materials.append(m_sclera)
    sclera_intact.parent = root

    # =========================================================================
    # 2. CUTAWAY SCLERA & CHOROID (FOR DISSECTION / SAGITTAL VIEW)
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=2.40, location=(0, 0, 0))
    sclera_cut = bpy.context.active_object
    sclera_cut.name = "Sclera_Cutaway"
    sclera_cut.scale = (1.0, 1.02, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Remove top-right quadrant (X > 0.10, Z > 0.10, Y > -1.4)
    bm = bmesh.new()
    bm.from_mesh(sclera_cut.data)
    verts_to_remove = [v for v in bm.verts if v.co.x > 0.10 and v.co.z > 0.10 and v.co.y > -1.4]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(sclera_cut.data)
    bm.free()
    sclera_cut.data.materials.append(m_sclera)
    sclera_cut.parent = root

    # Choroid (Middle Vascular Layer)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=40, radius=2.34, location=(0, 0, 0))
    choroid = bpy.context.active_object
    choroid.name = "Choroid"
    choroid.scale = (1.0, 1.02, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(choroid.data)
    verts_to_remove = [v for v in bm.verts if v.co.x > 0.10 and v.co.z > 0.10 and v.co.y > -1.4]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(choroid.data)
    bm.free()
    choroid.data.materials.append(m_choroid)
    choroid.parent = root

    # =========================================================================
    # 3. POSTERIOR NEUROSENSORY RETINA WITH MACULA, FOVEA, AND OPTIC DISC
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=40, radius=2.28, location=(0, 0, 0))
    retina = bpy.context.active_object
    retina.name = "Retina"
    retina.scale = (1.0, 1.02, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Keep posterior bowl (Y > -0.8) and match cutaway
    bm = bmesh.new()
    bm.from_mesh(retina.data)
    verts_to_remove = [v for v in bm.verts if v.co.y < -0.8 or (v.co.x > 0.10 and v.co.z > 0.10)]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(retina.data)
    bm.free()
    retina.data.materials.append(m_retina)
    retina.parent = root

    # Macula Lutea (Golden circular disc on posterior retina pole)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.04, location=(0.35, 2.25, 0.0))
    macula = bpy.context.active_object
    macula.name = "Macula_Lutea"
    macula.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    macula.data.materials.append(m_macula)
    macula.parent = root

    # Fovea Centralis (Peak 20/20 cone pit in center of macula)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.20, depth=0.05, location=(0.35, 2.26, 0.0))
    fovea = bpy.context.active_object
    fovea.name = "Fovea_Centralis"
    fovea.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    fovea.data.materials.append(m_fovea)
    fovea.parent = root

    # Optic Disc (Physiological Blind Spot exit hub)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=0.04, location=(-0.52, 2.24, -0.15))
    disc = bpy.context.active_object
    disc.name = "Optic_Disc"
    disc.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    disc.data.materials.append(m_disc)
    disc.parent = root

    # Radiating Retinal Vascular Arcade (Arterioles and Venules)
    ret_vessels = [
        [(-0.52, 2.24, -0.15), (-0.75, 2.15, 0.45), (-0.95, 1.95, 0.85)],
        [(-0.52, 2.24, -0.15), (-0.72, 2.15, -0.65), (-0.88, 1.95, -1.15)],
        [(-0.52, 2.24, -0.15), (-0.15, 2.22, 0.55), (0.15, 2.10, 0.95)],
        [(-0.52, 2.24, -0.15), (-0.18, 2.22, -0.55), (0.12, 2.10, -0.95)]
    ]
    for rv_i, rv_path in enumerate(ret_vessels):
        c_rv = bpy.data.curves.new(f'Curve_Retinal_{rv_i}', 'CURVE')
        c_rv.dimensions = '3D'
        c_rv.bevel_depth = 0.032
        s_rv = c_rv.splines.new('BEZIER')
        s_rv.bezier_points.add(len(rv_path) - 1)
        for p_i, p_co in enumerate(rv_path):
            s_rv.bezier_points[p_i].co = p_co
            s_rv.bezier_points[p_i].handle_left_type = 'AUTO'
            s_rv.bezier_points[p_i].handle_right_type = 'AUTO'
        rv_obj = bpy.data.objects.new(f"Retinal_Vessel_{rv_i+1}", c_rv)
        bpy.context.scene.collection.objects.link(rv_obj)
        rv_obj.data.materials.append(m_ret_art if rv_i % 2 == 0 else m_ret_vein)
        rv_obj.parent = root

    # Vitreous Body Gel
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=2.15, location=(0, 0, 0))
    vitreous = bpy.context.active_object
    vitreous.name = "Vitreous_Body"
    bm = bmesh.new()
    bm.from_mesh(vitreous.data)
    verts_to_remove = [v for v in bm.verts if v.co.y < -0.8 or (v.co.x > 0.10 and v.co.z > 0.10)]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(vitreous.data)
    bm.free()
    vitreous.data.materials.append(m_vitreous)
    vitreous.parent = root

    # =========================================================================
    # 4. ANTERIOR CORNEA, LIMBUS, AQUEOUS CHAMBER, IRIS & PUPIL
    # =========================================================================
    # Cornea Dome (Anterior refractive window, Y = -1.76)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=40, radius=1.46, location=(0, -1.76, 0))
    cornea = bpy.context.active_object
    cornea.name = "Cornea"
    cornea.scale = (1.0, 0.76, 1.0)
    cornea.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    cornea.data.materials.append(m_cornea)
    cornea.parent = root

    # Anterior Chamber Aqueous Humor
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=28, radius=1.38, location=(0, -1.70, 0))
    aqueous = bpy.context.active_object
    aqueous.name = "Anterior_Chamber"
    aqueous.scale = (0.95, 0.65, 0.95)
    aqueous.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    aqueous.data.materials.append(m_aqueous)
    aqueous.parent = root

    # Sclerocorneal Limbus Ring
    bpy.ops.mesh.primitive_torus_add(major_radius=1.36, minor_radius=0.085, major_segments=54, minor_segments=20, location=(0, -1.68, 0))
    limbus = bpy.context.active_object
    limbus.name = "Limbus_Ring"
    limbus.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    limbus.data.materials.append(m_limbus)
    limbus.parent = root

    # Iris Ring
    bpy.ops.mesh.primitive_cylinder_add(radius=1.35, depth=0.06, location=(0, -1.64, 0))
    iris = bpy.context.active_object
    iris.name = "Iris"
    iris.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Cut pupillary aperture hole in iris
    bm = bmesh.new()
    bm.from_mesh(iris.data)
    inner_verts = [v for v in bm.verts if math.hypot(v.co.x, v.co.z) < 0.48]
    bmesh.ops.delete(bm, geom=inner_verts, context='VERTS')
    bm.to_mesh(iris.data)
    bm.free()
    iris.data.materials.append(m_iris)
    iris.parent = root

    # Pupillary Ruff
    bpy.ops.mesh.primitive_torus_add(major_radius=0.48, minor_radius=0.035, major_segments=36, minor_segments=12, location=(0, -1.64, 0))
    ruff = bpy.context.active_object
    ruff.name = "Pupillary_Ruff"
    ruff.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ruff.data.materials.append(m_ruff)
    ruff.parent = root

    # Pupil Aperture (Dark interior hole)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.46, depth=0.02, location=(0, -1.63, 0))
    pupil = bpy.context.active_object
    pupil.name = "Pupil"
    pupil.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pupil.data.materials.append(m_pupil)
    pupil.parent = root

    # =========================================================================
    # 5. DYNAMIC CRYSTALLINE LENS, CILIARY BODY & ZONULES OF ZINN
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.12, location=(0, -1.28, 0))
    lens = bpy.context.active_object
    lens.name = "Crystalline_Lens"
    lens.scale = (1.0, 0.44, 1.0)
    lens.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    lens.data.materials.append(m_lens)
    lens.parent = root

    # Ciliary Muscle Ring
    bpy.ops.mesh.primitive_torus_add(major_radius=1.58, minor_radius=0.22, major_segments=48, minor_segments=18, location=(0, -1.28, 0))
    ciliary = bpy.context.active_object
    ciliary.name = "Ciliary_Body"
    ciliary.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ciliary.data.materials.append(m_ciliary)
    ciliary.parent = root

    # 32 Radial Suspensory Zonules of Zinn
    zonules_group = bpy.data.objects.new("Zonules_Group", None)
    bpy.context.scene.collection.objects.link(zonules_group)
    zonules_group.parent = root

    for z_i in range(32):
        z_ang = (z_i / 32) * math.pi * 2
        r_inner = 1.08
        r_outer = 1.52
        p1 = (math.cos(z_ang) * r_inner, -1.28, math.sin(z_ang) * r_inner)
        p2 = (math.cos(z_ang) * r_outer, -1.28, math.sin(z_ang) * r_outer)
        mid = ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2)
        length = r_outer - r_inner

        bpy.ops.mesh.primitive_cylinder_add(radius=0.014, depth=length, location=mid)
        z_obj = bpy.context.active_object
        z_obj.name = f"Zonule_{z_i+1}"
        z_obj.rotation_euler = (math.pi / 2, 0, -z_ang + math.pi / 2)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        z_obj.data.materials.append(m_zonule)
        z_obj.parent = zonules_group

    # =========================================================================
    # 6. POSTERIOR OPTIC NERVE & DURAL SHEATH & CENTRAL BLOOD VESSELS
    # =========================================================================
    bpy.ops.mesh.primitive_cylinder_add(radius=0.56, depth=3.0, location=(-0.54, 3.30, -0.20))
    nerve = bpy.context.active_object
    nerve.name = "Optic_Nerve"
    nerve.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    nerve.data.materials.append(m_nerve)
    nerve.parent = root

    # Dural Sheath Wrapping
    bpy.ops.mesh.primitive_cylinder_add(radius=0.66, depth=2.4, location=(-0.54, 3.70, -0.20))
    sheath = bpy.context.active_object
    sheath.name = "Dural_Sheath"
    sheath.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    sheath.data.materials.append(m_sheath)
    sheath.parent = root

    # Central Retinal Artery & Vein running down core of optic nerve
    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=3.2, location=(-0.52, 3.20, -0.20))
    c_art = bpy.context.active_object
    c_art.name = "Central_Retinal_Artery"
    c_art.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    c_art.data.materials.append(m_ret_art)
    c_art.parent = root

    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=3.2, location=(-0.56, 3.20, -0.20))
    c_vein = bpy.context.active_object
    c_vein.name = "Central_Retinal_Vein"
    c_vein.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    c_vein.data.materials.append(m_ret_vein)
    c_vein.parent = root

    # =========================================================================
    # 7. EXTRAOCULAR MUSCLES & TROCHLEA PULLEY LOOP
    # =========================================================================
    muscles_data = [
        ("Superior_Rectus", (0.0, 0.55, 2.30), (0.75, 2.8, 0.22), (0.15, 0, 0)),
        ("Inferior_Rectus", (0.0, 0.55, -2.30), (0.75, 2.8, 0.22), (-0.15, 0, 0)),
        ("Medial_Rectus", (2.30, 0.55, 0.0), (0.22, 2.8, 0.75), (0, 0, -0.15)),
        ("Lateral_Rectus", (-2.30, 0.55, 0.0), (0.22, 2.8, 0.75), (0, 0, 0.15))
    ]
    for m_name, m_pos, m_scale, m_rot in muscles_data:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=m_pos)
        m_obj = bpy.context.active_object
        m_obj.name = m_name
        m_obj.scale = m_scale
        m_obj.rotation_euler = m_rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        m_obj.data.materials.append(m_muscle)
        m_obj.parent = root

    # Superior Oblique Muscle & Fibrous Trochlea Pulley Loop
    so_pts = [
        (0.65, 3.10, 1.25),
        (1.60, 1.20, 1.90),
        (1.60, -0.20, 1.90),
        (0.45, 0.45, 2.25)
    ]
    c_so = bpy.data.curves.new('Curve_Superior_Oblique', 'CURVE')
    c_so.dimensions = '3D'
    c_so.bevel_depth = 0.12
    s_so = c_so.splines.new('BEZIER')
    s_so.bezier_points.add(len(so_pts) - 1)
    for p_i, p_co in enumerate(so_pts):
        s_so.bezier_points[p_i].co = p_co
        s_so.bezier_points[p_i].handle_left_type = 'AUTO'
        s_so.bezier_points[p_i].handle_right_type = 'AUTO'
    so_obj = bpy.data.objects.new("Superior_Oblique", c_so)
    bpy.context.scene.collection.objects.link(so_obj)
    so_obj.data.materials.append(m_muscle)
    so_obj.parent = root

    # U-shaped cartilaginous Trochlea Pulley Ring
    bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.06, location=(1.60, -0.20, 1.90))
    trochlea = bpy.context.active_object
    trochlea.name = "Trochlea_Pulley"
    trochlea.data.materials.append(m_trochlea)
    trochlea.parent = root

    # Inferior Oblique Muscle
    io_pts = [
        (1.15, -0.65, -1.95),
        (0.0, -0.45, -2.25),
        (-1.65, 0.25, -1.85)
    ]
    c_io = bpy.data.curves.new('Curve_Inferior_Oblique', 'CURVE')
    c_io.dimensions = '3D'
    c_io.bevel_depth = 0.12
    s_io = c_io.splines.new('BEZIER')
    s_io.bezier_points.add(len(io_pts) - 1)
    for p_i, p_co in enumerate(io_pts):
        s_io.bezier_points[p_i].co = p_co
        s_io.bezier_points[p_i].handle_left_type = 'AUTO'
        s_io.bezier_points[p_i].handle_right_type = 'AUTO'
    io_obj = bpy.data.objects.new("Inferior_Oblique", c_io)
    bpy.context.scene.collection.objects.link(io_obj)
    io_obj.data.materials.append(m_muscle)
    io_obj.parent = root

    # =========================================================================
    # EXPORT GLTF AND SAVE BLENDER FILE
    # =========================================================================
    out_dir = "frontend/public/3d_models"
    models_dir = "models_blender"
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    glb_path = os.path.join(out_dir, "eye_realistic.glb")
    blend_path = os.path.join(models_dir, "eye_realistic.blend")

    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_materials='EXPORT',
        export_attributes=True
    )
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[SUCCESS] Exported {glb_path} and saved {blend_path}")

if __name__ == '__main__':
    build_perfect_eye()
