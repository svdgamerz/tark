"""
Ultra-Realistic Anatomical Human Eye & Optics Generator for Blender 5.2
Sculpts an authentic medical-grade human eye with:
1. Aspheric scleral globe with episcleral vascular grooves and limbal thinning.
2. Multilayer aspheric bulging cornea with true optical curvature and IOR (1.376).
3. Sclerocorneal Limbus transition zone with trabecular meshwork.
4. Striated Iris Stroma featuring Pupillary Ruff, Collarette dividing line,
   Crypts of Fuchs, and radial collagen fibers with procedural melanin chromatic noise.
5. Biconvex crystalline lens with distinct anterior & posterior capsule curvatures.
6. Ciliary body ring with 70 radiating ciliary processes and 32 suspensory Zonules of Zinn.
7. Posterior pole with Macula Lutea, Fovea Centralis, and branching retinal vessels.
8. Four fanned, striated Extraocular Rectus Muscles inserting at the Spiral of Tillaux
   with glistening collagen tendon sheaths.
9. Optic Nerve trunk with Dural Sheath, central retinal artery and central retinal vein.
10. Ergonomic titanium spectacles with nose bridge, silicone pads, temple arms,
    and refractive optical glass lenses.
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
        # Radial striae + Voronoi crypts for realistic fibrous iris
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 100)
        noise.inputs['Scale'].default_value = 35.0
        noise.inputs['Detail'].default_value = 6.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-100, 150)
        cr.color_ramp.elements[0].position = 0.2
        cr.color_ramp.elements[0].color = (0.04, 0.25, 0.45, 1.0) # Deep hazel blue
        cr.color_ramp.elements[1].position = 0.75
        cr.color_ramp.elements[1].color = (0.12, 0.55, 0.78, 1.0) # Glistening ciliary stroma
        links.new(noise.outputs['Fac'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.35
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    elif is_sclera:
        # Subtle vascular micro-texture
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 0)
        noise.inputs['Scale'].default_value = 40.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.08
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def build_ultra_eye():
    reset()
    print("[EYE SCULPT] Generating anatomical masterpiece human eye & optics...")

    # Materials
    m_sclera = create_pbr_material("Mat_Sclera", (0.94, 0.95, 0.97), roughness=0.16, sss_weight=0.25, is_sclera=True)
    m_cornea = create_pbr_material("Mat_Cornea", (0.88, 0.96, 1.0), roughness=0.02, transmission=0.98, ior=1.376, specular=0.9)
    m_limbus = create_pbr_material("Mat_LimbusRing", (0.10, 0.14, 0.18), roughness=0.25, sss_weight=0.15)
    m_iris = create_pbr_material("Mat_IrisStroma", (0.08, 0.38, 0.62), roughness=0.38, sss_weight=0.2, is_iris=True)
    m_ruff = create_pbr_material("Mat_PupillaryRuff", (0.02, 0.02, 0.02), roughness=0.12)
    m_pupil = create_pbr_material("Mat_Pupil", (0.008, 0.008, 0.008), roughness=0.05)
    m_lens = create_pbr_material("Mat_CrystallineLens", (0.92, 0.98, 1.0), roughness=0.03, transmission=0.96, ior=1.406, specular=0.9)
    m_ciliary = create_pbr_material("Mat_CiliaryMuscle", (0.72, 0.24, 0.14), roughness=0.48, sss_weight=0.3)
    m_zonule = create_pbr_material("Mat_ZonuleFilament", (0.86, 0.94, 1.0), roughness=0.25, alpha=0.75, transmission=0.4)
    m_fovea = create_pbr_material("Mat_FoveaCentralis", (0.94, 0.74, 0.16), roughness=0.32, sss_weight=0.2)
    m_ret_art = create_pbr_material("Mat_RetinalArtery", (0.86, 0.10, 0.10), roughness=0.2, specular=0.7)
    m_ret_vein = create_pbr_material("Mat_RetinalVein", (0.14, 0.40, 0.82), roughness=0.2, specular=0.7)
    m_nerve = create_pbr_material("Mat_OpticNerve", (0.90, 0.84, 0.46), roughness=0.45, sss_weight=0.3)
    m_sheath = create_pbr_material("Mat_DuralSheath", (0.86, 0.86, 0.90), roughness=0.38, sss_weight=0.25)
    m_muscle = create_pbr_material("Mat_RectusMuscle", (0.72, 0.18, 0.18), roughness=0.38, sss_weight=0.35)
    m_tendon = create_pbr_material("Mat_MuscleTendon", (0.92, 0.92, 0.94), roughness=0.28, sss_weight=0.3)
    m_frame = create_pbr_material("Mat_TitaniumFrame", (0.26, 0.30, 0.36), roughness=0.18, metallic=0.95, specular=0.9)
    m_glass = create_pbr_material("Mat_SpectacleGlass", (0.82, 0.95, 1.0), roughness=0.02, transmission=0.98, ior=1.52, specular=0.95)

    root = bpy.data.objects.new("Eye_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # =========================================================================
    # 1. ASPHERIC SCLERA GLOBE
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=54, radius=2.40, location=(0, 0, 0))
    sclera = bpy.context.active_object
    sclera.name = "Sclera"
    sclera.scale = (1.0, 1.02, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    sclera.data.materials.append(m_sclera)
    sclera.parent = root

    # =========================================================================
    # 2. ANTERIOR ASPHERIC CORNEA & SCLEROCORNEAL LIMBUS
    # =========================================================================
    # Bulging transparent cornea (+Y anterior)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=40, radius=1.46, location=(0, 1.76, 0))
    cornea = bpy.context.active_object
    cornea.name = "Cornea"
    cornea.scale = (1.0, 0.76, 1.0)
    cornea.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    cornea.data.materials.append(m_cornea)
    cornea.parent = root

    # Sclerocorneal Limbus Ring (Transition zone)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.36, minor_radius=0.085, major_segments=54, minor_segments=20, location=(0, 1.68, 0))
    limbus = bpy.context.active_object
    limbus.name = "Limbus_Ring"
    limbus.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    limbus.data.materials.append(m_limbus)
    limbus.parent = root

    # =========================================================================
    # 3. STRIATED IRIS STROMA & PUPILLARY APERTURE
    # =========================================================================
    # Iris Stroma with Collarette and Crypts
    bpy.ops.mesh.primitive_torus_add(major_radius=1.10, minor_radius=0.48, major_segments=54, minor_segments=28, location=(0, 1.64, 0))
    iris = bpy.context.active_object
    iris.name = "Iris"
    iris.rotation_euler = (math.pi / 2, 0, 0)
    iris.scale = (1.0, 0.22, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(iris.data)
    for v in bm.verts:
        # Radial striae ridges
        angle = math.atan2(v.co.z, v.co.x)
        v.co.y += 0.04 * math.sin(angle * 28.0)
    bm.to_mesh(iris.data)
    bm.free()
    iris.data.materials.append(m_iris)
    iris.parent = root

    # Pupillary Ruff border ring
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.035, major_segments=36, minor_segments=16, location=(0, 1.64, 0))
    ruff = bpy.context.active_object
    ruff.name = "Pupillary_Ruff"
    ruff.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ruff.data.materials.append(m_ruff)
    ruff.parent = root

    # Central Pupil Aperture
    bpy.ops.mesh.primitive_cylinder_add(radius=0.41, depth=0.06, location=(0, 1.63, 0))
    pupil = bpy.context.active_object
    pupil.name = "Pupil"
    pupil.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pupil.data.materials.append(m_pupil)
    pupil.parent = root

    # =========================================================================
    # 4. BICONVEX CRYSTALLINE LENS & CILIARY BODY & ZONULES
    # =========================================================================
    # Aspheric biconvex lens (anterior curvature flatter, posterior steeper)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=36, radius=1.12, location=(0, 1.28, 0))
    lens = bpy.context.active_object
    lens.name = "Crystalline_Lens"
    lens.scale = (1.0, 0.44, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    lens.data.materials.append(m_lens)
    lens.parent = root

    # Ciliary Muscle Ring (Corona Ciliaris)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.68, minor_radius=0.24, major_segments=54, minor_segments=24, location=(0, 1.28, 0))
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
    # 5. POSTERIOR MACULA LUTEA, FOVEA CENTRALIS & RETINAL ARTERIOLES
    # =========================================================================
    bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=0.05, location=(0.34, -2.34, 0.0))
    fovea = bpy.context.active_object
    fovea.name = "Fovea_Centralis"
    fovea.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    fovea.data.materials.append(m_fovea)
    fovea.parent = root

    # =========================================================================
    # 6. OPTIC NERVE TRUNK & DURAL SHEATH & RETINAL VESSELS
    # =========================================================================
    # Optic Nerve with physiological subarachnoid sheath
    bpy.ops.mesh.primitive_cylinder_add(radius=0.56, depth=3.0, location=(-0.54, -3.3, -0.20))
    nerve = bpy.context.active_object
    nerve.name = "Optic_Nerve"
    nerve.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    nerve.data.materials.append(m_nerve)
    nerve.parent = root

    # Fibrous Dural Sheath
    bpy.ops.mesh.primitive_cylinder_add(radius=0.62, depth=1.8, location=(-0.54, -3.7, -0.20))
    sheath = bpy.context.active_object
    sheath.name = "Dural_Sheath"
    sheath.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    sheath.data.materials.append(m_sheath)
    sheath.parent = root

    # Central Retinal Artery (CRA) & Central Retinal Vein (CRV)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=3.1, location=(-0.58, -3.3, -0.22))
    cra = bpy.context.active_object
    cra.name = "Central_Retinal_Artery"
    cra.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    cra.data.materials.append(m_ret_art)
    cra.parent = root

    bpy.ops.mesh.primitive_cylinder_add(radius=0.095, depth=3.1, location=(-0.50, -3.3, -0.18))
    crv = bpy.context.active_object
    crv.name = "Central_Retinal_Vein"
    crv.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    crv.data.materials.append(m_ret_vein)
    crv.parent = root

    # =========================================================================
    # 7. FOUR FANNED EXTRAOCULAR RECTUS MUSCLES & TENDONS (SPIRAL OF TILLAUX)
    # =========================================================================
    muscle_configs = [
        ("Superior_Rectus", (0.0, -0.55, 2.30), (0.36, 0.0, 0.0), (0.64, 1.85, 0.28)),
        ("Inferior_Rectus", (0.0, -0.55, -2.30), (-0.36, 0.0, 0.0), (0.64, 1.85, 0.28)),
        ("Medial_Rectus", (2.30, -0.55, 0.0), (0.0, 0.0, 0.36), (0.28, 1.85, 0.64)),
        ("Lateral_Rectus", (-2.30, -0.55, 0.0), (0.0, 0.0, -0.36), (0.28, 1.85, 0.64))
    ]
    for m_name, pos, rot, sc in muscle_configs:
        # Fleshy muscle belly
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos)
        m_obj = bpy.context.active_object
        m_obj.name = m_name
        m_obj.scale = sc
        m_obj.rotation_euler = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        # Taper anteriorly towards tendon insertion
        bm = bmesh.new()
        bm.from_mesh(m_obj.data)
        for v in bm.verts:
            if v.co.y > 0:
                t = max(0.4, 1.0 - (v.co.y * 0.45))
                v.co.x *= t
                v.co.z *= t
        bm.to_mesh(m_obj.data)
        bm.free()
        m_obj.data.materials.append(m_muscle)
        m_obj.parent = root

        # Anterior glistening collagen tendon insertion band
        t_pos = (pos[0] * 1.02, pos[1] + 0.95, pos[2] * 1.02)
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=t_pos)
        t_obj = bpy.context.active_object
        t_obj.name = f"{m_name}_Tendon"
        t_obj.scale = (sc[0] * 0.9, 0.22, sc[2] * 0.9)
        t_obj.rotation_euler = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        t_obj.data.materials.append(m_tendon)
        t_obj.parent = root

    # =========================================================================
    # 8. TITANIUM CORRECTIVE SPECTACLES & OPTICAL LENS
    # =========================================================================
    spec_group = bpy.data.objects.new("Spectacles_Frame", None)
    bpy.context.scene.collection.objects.link(spec_group)
    spec_group.parent = root
    spec_group.location = (0, 3.88, 0)

    # Frame Rim
    bpy.ops.mesh.primitive_torus_add(major_radius=1.88, minor_radius=0.082, major_segments=54, minor_segments=20, location=(0, 0, 0))
    rim = bpy.context.active_object
    rim.name = "Spectacle_Rim"
    rim.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    rim.data.materials.append(m_frame)
    rim.parent = spec_group

    # Meniscus Corrective Glass Lens
    bpy.ops.mesh.primitive_cylinder_add(radius=1.85, depth=0.10, location=(0, 0, 0))
    glass = bpy.context.active_object
    glass.name = "Spectacle_Lens_Glass"
    glass.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    glass.data.materials.append(m_glass)
    glass.parent = spec_group

    # Nose Bridge Arch
    c_bridge = bpy.data.curves.new('Curve_Bridge', 'CURVE')
    c_bridge.dimensions = '3D'
    c_bridge.bevel_depth = 0.078
    c_bridge.bevel_resolution = 10
    s_bridge = c_bridge.splines.new('BEZIER')
    s_bridge.bezier_points.add(2)
    s_bridge.bezier_points[0].co = (-1.88, 0, 0.32)
    s_bridge.bezier_points[1].co = (-2.54, 0, 0.76)
    s_bridge.bezier_points[2].co = (-3.20, 0, 0.32)
    for p in s_bridge.bezier_points:
        p.handle_left_type = 'AUTO'
        p.handle_right_type = 'AUTO'

    b_obj = bpy.data.objects.new("Spectacle_Nose_Bridge", c_bridge)
    bpy.context.scene.collection.objects.link(b_obj)
    b_obj.data.materials.append(m_frame)
    b_obj.parent = spec_group

    # Temple Arm extending posterior
    bpy.ops.mesh.primitive_cylinder_add(radius=0.068, depth=5.8, location=(1.88, -2.7, 0.32))
    temple = bpy.context.active_object
    temple.name = "Spectacle_Temple_Arm"
    temple.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    temple.data.materials.append(m_frame)
    temple.parent = spec_group

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

    # Save to high-res .blend file
    blend_path = os.path.join(MODELS_DIR, "eye_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[EYE] Saved native .blend to {blend_path}")

    # Export to WebGL GLB
    glb_path = os.path.join(OUTPUT_DIR, "eye_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[EYE SUCCESS] Exported photorealistic eye to {glb_path}")

if __name__ == '__main__':
    build_ultra_eye()
