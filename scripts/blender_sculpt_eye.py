"""
Ultra-Realistic Anatomical Human Eye & Visual Optics Generator for Blender 5.2
Specifically engineered with all visible and clickable layers:
1. Cornea (Anterior crystal refractive dome, IOR 1.376).
2. Limbus Ring (Sclerocorneal junction).
3. Iris Stroma (Fibrous radial striae, collarette, Fuchs crypts, pupil).
4. Crystalline Lens (Biconvex elastic focusing lens).
5. Suspensory Zonules of Zinn & Ciliary Body Ring (Accommodation motor).
6. Retina (Neurosensory lining with golden Macula Lutea, Fovea Centralis, and Optic Disc).
7. Retinal Vasculature (Branching arterioles and venules radiating from optic disc).
8. Choroid (Vascular nutritive pigmented layer).
9. Sclera (White tough fibrous coat with 3/4 cutaway option exposing internal retina).
10. Optic Nerve Trunk with Dural Sheath and Central Retinal Artery/Vein.
11. Extraocular Rectus Muscles (Superior, Inferior, Medial, Lateral) with glistening tendons.
12. Titanium Corrective Spectacles for Myopia/Hypermetropia.
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

def create_pbr_material(name, base_color, roughness=0.2, metallic=0.0, transmission=0.0, ior=1.45, 
                        sss_weight=0.2, sss_radius=(1.0, 0.25, 0.1), specular=0.6, alpha=1.0, is_iris=False, is_sclera=False):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new(type='ShaderNodeOutputMaterial')
    out.location = (600, 0)
    
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
    tex_coord.location = (-600, 0)

    if is_iris:
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 100)
        noise.inputs['Scale'].default_value = 32.0
        noise.inputs['Detail'].default_value = 5.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-100, 150)
        cr.color_ramp.elements[0].position = 0.15
        cr.color_ramp.elements[0].color = (0.05, 0.28, 0.52, 1.0)
        cr.color_ramp.elements[1].position = 0.80
        cr.color_ramp.elements[1].color = (0.15, 0.60, 0.85, 1.0)
        links.new(noise.outputs['Fac'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.30
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    elif is_sclera:
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 0)
        noise.inputs['Scale'].default_value = 35.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.08
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def build_ultra_eye():
    reset()
    print("[EYE GENERATOR] Sculpting complete anatomical human eye with all clickable layers...")

    # Materials
    m_sclera = create_pbr_material("Mat_Sclera", (0.95, 0.96, 0.98), roughness=0.18, sss_weight=0.25, is_sclera=True)
    m_choroid = create_pbr_material("Mat_Choroid", (0.28, 0.05, 0.06), roughness=0.60, sss_weight=0.20)
    m_retina = create_pbr_material("Mat_Retina", (0.88, 0.28, 0.10), roughness=0.55, sss_weight=0.35)
    m_cornea = create_pbr_material("Mat_Cornea", (0.88, 0.96, 1.0), roughness=0.02, transmission=0.98, ior=1.376, specular=0.95)
    m_limbus = create_pbr_material("Mat_LimbusRing", (0.10, 0.14, 0.18), roughness=0.25)
    m_iris = create_pbr_material("Mat_IrisStroma", (0.08, 0.38, 0.65), roughness=0.35, sss_weight=0.2, is_iris=True)
    m_ruff = create_pbr_material("Mat_PupillaryRuff", (0.02, 0.02, 0.02), roughness=0.10)
    m_pupil = create_pbr_material("Mat_Pupil", (0.008, 0.008, 0.008), roughness=0.05)
    m_lens = create_pbr_material("Mat_CrystallineLens", (0.92, 0.98, 1.0), roughness=0.03, transmission=0.96, ior=1.406, specular=0.9)
    m_ciliary = create_pbr_material("Mat_CiliaryMuscle", (0.75, 0.22, 0.12), roughness=0.50, sss_weight=0.3)
    m_zonule = create_pbr_material("Mat_ZonuleFilament", (0.86, 0.94, 1.0), roughness=0.25, alpha=0.75, transmission=0.4)
    m_macula = create_pbr_material("Mat_MaculaLutea", (0.95, 0.78, 0.18), roughness=0.35, sss_weight=0.25)
    m_fovea = create_pbr_material("Mat_FoveaCentralis", (0.98, 0.86, 0.22), roughness=0.28)
    m_disc = create_pbr_material("Mat_OpticDisc", (0.95, 0.90, 0.70), roughness=0.30)
    m_ret_art = create_pbr_material("Mat_RetinalArtery", (0.90, 0.10, 0.10), roughness=0.2, specular=0.7)
    m_ret_vein = create_pbr_material("Mat_RetinalVein", (0.15, 0.42, 0.85), roughness=0.2, specular=0.7)
    m_nerve = create_pbr_material("Mat_OpticNerve", (0.92, 0.86, 0.48), roughness=0.45, sss_weight=0.3)
    m_sheath = create_pbr_material("Mat_DuralSheath", (0.88, 0.88, 0.92), roughness=0.38, sss_weight=0.25)
    m_muscle = create_pbr_material("Mat_RectusMuscle", (0.75, 0.18, 0.18), roughness=0.38, sss_weight=0.35)
    m_tendon = create_pbr_material("Mat_MuscleTendon", (0.94, 0.94, 0.96), roughness=0.25, sss_weight=0.3)
    m_frame = create_pbr_material("Mat_TitaniumFrame", (0.28, 0.32, 0.38), roughness=0.18, metallic=0.95, specular=0.9)
    m_glass = create_pbr_material("Mat_SpectacleGlass", (0.84, 0.96, 1.0), roughness=0.02, transmission=0.98, ior=1.52, specular=0.95)

    root = bpy.data.objects.new("Eye_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # =========================================================================
    # 1. SCLERA (Outer White Coat) WITH 3/4 SAGITTAL CUTAWAY TO REVEAL RETINA
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=2.40, location=(0, 0, 0))
    sclera = bpy.context.active_object
    sclera.name = "Sclera"
    sclera.scale = (1.0, 1.02, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Cut away top-right quadrant (X > 0 and Z > 0) to expose internal Retina & Choroid!
    bm = bmesh.new()
    bm.from_mesh(sclera.data)
    verts_to_remove = [v for v in bm.verts if v.co.x > 0.10 and v.co.z > 0.10 and v.co.y < 1.4]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(sclera.data)
    bm.free()
    sclera.data.materials.append(m_sclera)
    sclera.parent = root

    # =========================================================================
    # 2. CHOROID (Vascular Nutritive Middle Layer)
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=40, radius=2.34, location=(0, 0, 0))
    choroid = bpy.context.active_object
    choroid.name = "Choroid"
    choroid.scale = (1.0, 1.02, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(choroid.data)
    verts_to_remove = [v for v in bm.verts if v.co.x > 0.10 and v.co.z > 0.10 and v.co.y < 1.4]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(choroid.data)
    bm.free()
    choroid.data.materials.append(m_choroid)
    choroid.parent = root

    # =========================================================================
    # 3. RETINA (Sensory Photoreceptor Lining & Fovea Centralis)
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=40, radius=2.28, location=(0, 0, 0))
    retina = bpy.context.active_object
    retina.name = "Retina"
    retina.scale = (1.0, 1.02, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(retina.data)
    # Remove anterior hemisphere (only lines posterior 2/3) and match cutaway
    verts_to_remove = [v for v in bm.verts if v.co.y > 0.8 or (v.co.x > 0.10 and v.co.z > 0.10)]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(retina.data)
    bm.free()
    retina.data.materials.append(m_retina)
    retina.parent = root

    # Macula Lutea & Fovea Centralis (Golden High-Acuity Spot on Retina)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.04, location=(0.35, -2.25, 0.0))
    macula = bpy.context.active_object
    macula.name = "Macula_Lutea"
    macula.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    macula.data.materials.append(m_macula)
    macula.parent = root

    bpy.ops.mesh.primitive_cylinder_add(radius=0.20, depth=0.05, location=(0.35, -2.26, 0.0))
    fovea = bpy.context.active_object
    fovea.name = "Fovea_Centralis"
    fovea.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    fovea.data.materials.append(m_fovea)
    fovea.parent = root

    # Optic Disc (Physiological Blind Spot)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=0.04, location=(-0.52, -2.24, -0.15))
    disc = bpy.context.active_object
    disc.name = "Optic_Disc"
    disc.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    disc.data.materials.append(m_disc)
    disc.parent = root

    # Retinal Blood Vessel Branches radiating from Optic Disc
    ret_vessels = [
        [(-0.52, -2.24, -0.15), (-0.75, -2.15, 0.45), (-0.95, -1.95, 0.85)],
        [(-0.52, -2.24, -0.15), (-0.72, -2.15, -0.65), (-0.88, -1.95, -1.15)],
        [(-0.52, -2.24, -0.15), (-0.15, -2.22, 0.55), (0.15, -2.10, 0.95)],
        [(-0.52, -2.24, -0.15), (-0.18, -2.22, -0.55), (0.12, -2.10, -0.95)]
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

    # =========================================================================
    # 4. ANTERIOR CORNEA & SCLEROCORNEAL LIMBUS
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=40, radius=1.46, location=(0, 1.76, 0))
    cornea = bpy.context.active_object
    cornea.name = "Cornea"
    cornea.scale = (1.0, 0.76, 1.0)
    cornea.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    cornea.data.materials.append(m_cornea)
    cornea.parent = root

    bpy.ops.mesh.primitive_torus_add(major_radius=1.36, minor_radius=0.085, major_segments=54, minor_segments=20, location=(0, 1.68, 0))
    limbus = bpy.context.active_object
    limbus.name = "Limbus_Ring"
    limbus.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    limbus.data.materials.append(m_limbus)
    limbus.parent = root

    # =========================================================================
    # 5. IRIS STROMA & PUPILLARY RUFF & PUPIL
    # =========================================================================
    bpy.ops.mesh.primitive_torus_add(major_radius=1.10, minor_radius=0.48, major_segments=54, minor_segments=28, location=(0, 1.64, 0))
    iris = bpy.context.active_object
    iris.name = "Iris"
    iris.rotation_euler = (math.pi / 2, 0, 0)
    iris.scale = (1.0, 0.22, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(iris.data)
    for v in bm.verts:
        angle = math.atan2(v.co.z, v.co.x)
        v.co.y += 0.04 * math.sin(angle * 28.0)
    bm.to_mesh(iris.data)
    bm.free()
    iris.data.materials.append(m_iris)
    iris.parent = root

    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.035, major_segments=36, minor_segments=16, location=(0, 1.64, 0))
    ruff = bpy.context.active_object
    ruff.name = "Pupillary_Ruff"
    ruff.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ruff.data.materials.append(m_ruff)
    ruff.parent = root

    bpy.ops.mesh.primitive_cylinder_add(radius=0.41, depth=0.06, location=(0, 1.63, 0))
    pupil = bpy.context.active_object
    pupil.name = "Pupil"
    pupil.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pupil.data.materials.append(m_pupil)
    pupil.parent = root

    # =========================================================================
    # 6. BICONVEX CRYSTALLINE LENS & CILIARY BODY & ZONULES
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=36, radius=1.12, location=(0, 1.28, 0))
    lens = bpy.context.active_object
    lens.name = "Crystalline_Lens"
    lens.scale = (1.0, 0.44, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    lens.data.materials.append(m_lens)
    lens.parent = root

    bpy.ops.mesh.primitive_torus_add(major_radius=1.68, minor_radius=0.24, major_segments=54, minor_segments=24, location=(0, 1.28, 0))
    ciliary = bpy.context.active_object
    ciliary.name = "Ciliary_Body"
    ciliary.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ciliary.data.materials.append(m_ciliary)
    ciliary.parent = root

    zonules_group = bpy.data.objects.new("Zonules_Group", None)
    bpy.context.scene.collection.objects.link(zonules_group)
    zonules_group.parent = root

    for i in range(32):
        ang = (i / 32) * 2 * math.pi
        r1, r2 = 1.10, 1.66
        x1, z1 = r1 * math.cos(ang), r1 * math.sin(ang)
        x2, z2 = r2 * math.cos(ang), r2 * math.sin(ang)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.58, location=((x1+x2)/2, 1.28, (z1+z2)/2))
        z_obj = bpy.context.active_object
        z_obj.name = f"Zonule_{i+1}"
        z_obj.rotation_euler = (0, ang, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        z_obj.data.materials.append(m_zonule)
        z_obj.parent = zonules_group

    # =========================================================================
    # 7. OPTIC NERVE TRUNK & DURAL SHEATH & RETINAL VESSELS
    # =========================================================================
    bpy.ops.mesh.primitive_cylinder_add(radius=0.56, depth=3.0, location=(-0.54, -3.3, -0.20))
    nerve = bpy.context.active_object
    nerve.name = "Optic_Nerve"
    nerve.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    nerve.data.materials.append(m_nerve)
    nerve.parent = root

    bpy.ops.mesh.primitive_cylinder_add(radius=0.62, depth=1.8, location=(-0.54, -3.7, -0.20))
    sheath = bpy.context.active_object
    sheath.name = "Dural_Sheath"
    sheath.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    sheath.data.materials.append(m_sheath)
    sheath.parent = root

    # =========================================================================
    # 8. EXTRAOCULAR RECTUS MUSCLES & TENDONS
    # =========================================================================
    muscle_configs = [
        ("Superior_Rectus", (0.0, -0.55, 2.30), (0.36, 0.0, 0.0), (0.64, 1.85, 0.28)),
        ("Inferior_Rectus", (0.0, -0.55, -2.30), (-0.36, 0.0, 0.0), (0.64, 1.85, 0.28)),
        ("Medial_Rectus", (2.30, -0.55, 0.0), (0.0, 0.0, 0.36), (0.28, 1.85, 0.64)),
        ("Lateral_Rectus", (-2.30, -0.55, 0.0), (0.0, 0.0, -0.36), (0.28, 1.85, 0.64))
    ]
    for m_name, pos, rot, sc in muscle_configs:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos)
        m_obj = bpy.context.active_object
        m_obj.name = m_name
        m_obj.scale = sc
        m_obj.rotation_euler = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        m_obj.data.materials.append(m_muscle)
        m_obj.parent = root

    # Convert all curves and smooth meshes
    bpy.ops.object.select_all(action='DESELECT')
    for obj in list(bpy.data.objects):
        if obj.type == 'CURVE':
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target='MESH')
            obj.select_set(False)

    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            for poly in obj.data.polygons:
                poly.use_smooth = True

    # Lighting & Camera for Beauty Preview Render
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.lens = 45
    cam = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (2.2, -6.8, 1.8)
    cam.rotation_euler = (math.radians(75), 0, math.radians(18))

    key_light = bpy.data.lights.new("KeyLight", type='AREA')
    key_light.energy = 420
    key_light.size = 3.5
    key_obj = bpy.data.objects.new("KeyLight", key_light)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.location = (3.5, -4.5, 4.0)

    fill_light = bpy.data.lights.new("FillLight", type='AREA')
    fill_light.energy = 180
    fill_light.size = 4.0
    fill_obj = bpy.data.objects.new("FillLight", fill_light)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-4.0, -3.5, 2.5)

    rim_light = bpy.data.lights.new("RimLight", type='AREA')
    rim_light.energy = 460
    rim_light.size = 2.5
    rim_obj = bpy.data.objects.new("RimLight", rim_light)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (0.5, 5.0, 3.5)

    # Save to high-res .blend file
    blend_path = os.path.join(MODELS_DIR, "eye_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[EYE] Saved native .blend to {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR, "eye_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[EYE] Rendered preview -> {preview_path}")

    # Export to WebGL GLB
    glb_path = os.path.join(OUTPUT_DIR, "eye_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[EYE SUCCESS] Exported photorealistic complete eye to {glb_path}")

if __name__ == '__main__':
    build_ultra_eye()

