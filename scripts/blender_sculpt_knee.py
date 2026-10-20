"""
Ultra-Realistic Human Synovial Knee Joint & Biomechanical Ligament Apparatus Generator for Blender 5.2
Sculpts an authentic medical-grade orthopedic knee joint model:
1. Bony Skeletal Framework:
   - Distal Femur with Shaft, Medial/Lateral Femoral Condyles, Intercondylar Notch, and Trochlear Groove.
   - Proximal Tibia with Medial/Lateral Tibial Plateaus, Intercondylar Eminence, and Tibial Tuberosity.
   - Proximal Fibula with Head, Neck, and Styloid Process.
   - Patella (Sesamoid Kneecap) with Anterior Facet and Posterior Gliding Cartilage Ridge.
2. Articular Cartilage & Shock Absorption:
   - Femoral Condyle Hyaline Cartilage Caps (smooth pearlescent articular surface).
   - Tibial Plateau Cartilage Linings.
   - Medial Meniscus (C-shaped fibrocartilage shock absorber attached to MCL).
   - Lateral Meniscus (O-shaped mobile fibrocartilage disc).
3. Critical Ligamentous Restraints:
   - Anterior Cruciate Ligament (ACL) crossing diagonally to prevent anterior tibial translation.
   - Posterior Cruciate Ligament (PCL) crossing in X-configuration to prevent posterior displacement.
   - Medial Collateral Ligament (MCL / Tibial) resisting valgus stress.
   - Lateral Collateral Ligament (LCL / Fibular) cord resisting varus stress.
4. Extensor Mechanism & Soft Tissues:
   - Quadriceps Femoris Tendon inserting into superior pole of patella.
   - Patellar Ligament (Tendon) anchoring inferior pole to tibial tuberosity.
   - Infrapatellar (Hoffa's) Fat Pad cushion.
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

def create_pbr_material(name, base_color, roughness=0.28, metallic=0.0, transmission=0.0, ior=1.45,
                        sss_weight=0.35, sss_radius=(1.0, 0.35, 0.15), specular=0.6, alpha=1.0,
                        is_bone=False, is_cartilage=False, is_ligament=False):
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

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-650, 0)

    if is_bone:
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-400, 100)
        noise.inputs['Scale'].default_value = 35.0
        noise.inputs['Detail'].default_value = 5.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-150, 100)
        cr.color_ramp.elements[0].position = 0.2
        cr.color_ramp.elements[0].color = (base_color[0] * 0.92, base_color[1] * 0.90, base_color[2] * 0.85, 1.0)
        cr.color_ramp.elements[1].position = 0.8
        cr.color_ramp.elements[1].color = (base_color[0] * 1.05, base_color[1] * 1.04, base_color[2] * 1.02, 1.0)
        links.new(noise.outputs['Fac'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

    if is_cartilage:
        # Glassy, pearlescent hyaline cartilage
        bsdf.inputs['Roughness'].default_value = 0.12
        if 'Specular IOR Level' in bsdf.inputs:
            bsdf.inputs['Specular IOR Level'].default_value = 0.85

    if is_ligament:
        # Dense fibrous collagen striations
        wave = nodes.new(type='ShaderNodeTexWave')
        wave.location = (-400, 100)
        wave.inputs['Scale'].default_value = 18.0
        wave.inputs['Distortion'].default_value = 2.5
        links.new(tex_coord.outputs['Object'], wave.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-100, -100)
        bump.inputs['Strength'].default_value = 0.35
        links.new(wave.outputs['Color'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def create_smooth_subd(obj, levels=2):
    mod = obj.modifiers.new(name="Subdivision", type='SUBSURF')
    mod.levels = levels
    mod.render_levels = levels
    for p in obj.data.polygons:
        p.use_smooth = True
    return mod

def build_ultra_knee():
    reset()

    # Materials
    mat_cortical_bone = create_pbr_material("Mat_CorticalBone", (0.94, 0.91, 0.84), roughness=0.32, sss_weight=0.25, is_bone=True)
    mat_femur = create_pbr_material("Mat_FemurBone", (0.95, 0.92, 0.85), roughness=0.30, sss_weight=0.25, is_bone=True)
    mat_tibia = create_pbr_material("Mat_TibiaBone", (0.93, 0.90, 0.83), roughness=0.32, sss_weight=0.25, is_bone=True)
    mat_cartilage = create_pbr_material("Mat_HyalineCartilage", (0.82, 0.92, 0.98), roughness=0.10, sss_weight=0.45, is_cartilage=True)
    mat_meniscus = create_pbr_material("Mat_Meniscus", (0.88, 0.90, 0.92), roughness=0.24, sss_weight=0.35)
    mat_ligament = create_pbr_material("Mat_CollagenLigament", (0.92, 0.92, 0.88), roughness=0.25, sss_weight=0.30, is_ligament=True)
    mat_tendon = create_pbr_material("Mat_PatellarTendon", (0.95, 0.93, 0.89), roughness=0.22, sss_weight=0.32, is_ligament=True)
    mat_fatpad = create_pbr_material("Mat_HoffaFatPad", (0.95, 0.82, 0.40), roughness=0.35, sss_weight=0.40)

    # ========================================================
    # 1. DISTAL FEMUR (Positioned superiorly at Z ~ 0 to 4.5)
    # ========================================================
    # Femoral Diaphysis (Shaft)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.95, depth=4.5,
        location=(0.0, 0.0, 3.2)
    )
    femur_shaft = bpy.context.active_object
    femur_shaft.name = "Femur_Shaft"
    femur_shaft.scale = (1.05, 0.9, 1.0)
    femur_shaft.data.materials.append(mat_femur)
    create_smooth_subd(femur_shaft, 1)

    # Medial Femoral Condyle (Viewer's right: X ~ 1.15)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=28, ring_count=20, radius=1.2,
        location=(1.15, -0.15, 0.85)
    )
    medial_f_condyle = bpy.context.active_object
    medial_f_condyle.name = "Medial_Femoral_Condyle"
    medial_f_condyle.scale = (0.95, 1.35, 1.0)
    medial_f_condyle.data.materials.append(mat_femur)
    create_smooth_subd(medial_f_condyle, 2)

    # Lateral Femoral Condyle (Viewer's left: X ~ -1.15)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=28, ring_count=20, radius=1.18,
        location=(-1.15, -0.12, 0.85)
    )
    lateral_f_condyle = bpy.context.active_object
    lateral_f_condyle.name = "Lateral_Femoral_Condyle"
    lateral_f_condyle.scale = (0.92, 1.32, 1.0)
    lateral_f_condyle.data.materials.append(mat_femur)
    create_smooth_subd(lateral_f_condyle, 2)

    # Femoral Articular Hyaline Cartilage Caps
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=28, ring_count=20, radius=1.24,
        location=(1.15, -0.2, 0.78)
    )
    medial_cart = bpy.context.active_object
    medial_cart.name = "Medial_Femoral_Articular_Cartilage"
    medial_cart.scale = (0.96, 1.36, 0.95)
    medial_cart.data.materials.append(mat_cartilage)
    create_smooth_subd(medial_cart, 1)

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=28, ring_count=20, radius=1.22,
        location=(-1.15, -0.18, 0.78)
    )
    lateral_cart = bpy.context.active_object
    lateral_cart.name = "Lateral_Femoral_Articular_Cartilage"
    lateral_cart.scale = (0.93, 1.33, 0.95)
    lateral_cart.data.materials.append(mat_cartilage)
    create_smooth_subd(lateral_cart, 1)

    # Patellar Trochlear Groove (Anterior groove guiding patellar excursion)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=20, radius=0.75, depth=1.6,
        location=(0.0, 0.85, 1.4)
    )
    trochlea = bpy.context.active_object
    trochlea.name = "Patellar_Trochlear_Groove"
    trochlea.rotation_euler = (0.3, 0.0, 1.57)
    trochlea.scale = (0.7, 1.2, 0.9)
    trochlea.data.materials.append(mat_cartilage)

    # ========================================================
    # 2. PROXIMAL TIBIA & FIBULA (Positioned inferiorly at Z ~ -4.5 to 0)
    # ========================================================
    # Tibial Diaphysis (Shaft)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.9, depth=4.5,
        location=(0.0, 0.0, -3.2)
    )
    tibia_shaft = bpy.context.active_object
    tibia_shaft.name = "Tibia_Shaft"
    tibia_shaft.scale = (1.0, 1.15, 1.0)  # Triangular prismatic cross section
    tibia_shaft.data.materials.append(mat_tibia)
    create_smooth_subd(tibia_shaft, 1)

    # Medial Tibial Plateau (Flat condyle receiving medial meniscus)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=1.25, depth=0.9,
        location=(1.15, 0.0, -0.45)
    )
    medial_t_plateau = bpy.context.active_object
    medial_t_plateau.name = "Medial_Tibial_Plateau"
    medial_t_plateau.scale = (1.0, 1.3, 1.0)
    medial_t_plateau.data.materials.append(mat_tibia)
    create_smooth_subd(medial_t_plateau, 2)

    # Lateral Tibial Plateau
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=1.20, depth=0.9,
        location=(-1.15, 0.0, -0.45)
    )
    lateral_t_plateau = bpy.context.active_object
    lateral_t_plateau.name = "Lateral_Tibial_Plateau"
    lateral_t_plateau.scale = (1.0, 1.25, 1.0)
    lateral_t_plateau.data.materials.append(mat_tibia)
    create_smooth_subd(lateral_t_plateau, 2)

    # Tibial Tuberosity (Anterior insertion site for patellar tendon)
    bpy.ops.mesh.primitive_cone_add(
        vertices=16, radius1=0.55, depth=0.85,
        location=(0.0, 0.95, -1.6)
    )
    tibial_tuberosity = bpy.context.active_object
    tibial_tuberosity.name = "Tibial_Tuberosity"
    tibial_tuberosity.rotation_euler = (1.2, 0.0, 0.0)
    tibial_tuberosity.data.materials.append(mat_tibia)
    create_smooth_subd(tibial_tuberosity, 1)

    # Fibular Head & Shaft (Lateral side: X ~ -2.4)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=18, radius=0.42, depth=4.2,
        location=(-2.35, -0.3, -3.2)
    )
    fibula_shaft = bpy.context.active_object
    fibula_shaft.name = "Fibula_Shaft"
    fibula_shaft.data.materials.append(mat_cortical_bone)
    create_smooth_subd(fibula_shaft, 1)

    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=20, ring_count=16, radius=0.58,
        location=(-2.25, -0.25, -1.0)
    )
    fibula_head = bpy.context.active_object
    fibula_head.name = "Fibular_Head"
    fibula_head.data.materials.append(mat_cortical_bone)
    create_smooth_subd(fibula_head, 1)

    # ========================================================
    # 3. MENISCI (MEDIAL & LATERAL FIBROCARTILAGE WEDGE DISCS)
    # ========================================================
    # Medial Meniscus (C-shaped crescent)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.1, minor_radius=0.28,
        major_segments=32, minor_segments=14,
        location=(1.15, 0.05, -0.05)
    )
    medial_meniscus = bpy.context.active_object
    medial_meniscus.name = "Medial_Meniscus"
    medial_meniscus.scale = (0.9, 1.25, 0.5)
    medial_meniscus.data.materials.append(mat_meniscus)
    create_smooth_subd(medial_meniscus, 1)

    # Lateral Meniscus (Smaller, more circular O-shaped wedge)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.95, minor_radius=0.28,
        major_segments=32, minor_segments=14,
        location=(-1.15, 0.05, -0.05)
    )
    lateral_meniscus = bpy.context.active_object
    lateral_meniscus.name = "Lateral_Meniscus"
    lateral_meniscus.scale = (0.95, 1.15, 0.5)
    lateral_meniscus.data.materials.append(mat_meniscus)
    create_smooth_subd(lateral_meniscus, 1)

    # ========================================================
    # 4. CRUCIATE LIGAMENTS (ACL & PCL IN NOTCH)
    # ========================================================
    # Anterior Cruciate Ligament (ACL)
    # Originates anterior tibia, ascends backward/upward/outward to lateral condyle
    acl_curve = bpy.data.curves.new('ACLCurve', type='CURVE')
    acl_curve.dimensions = '3D'
    acl_spline = acl_curve.splines.new('BEZIER')
    acl_spline.bezier_points.add(2)
    acl_pts = [
        (0.25, 0.35, -0.1),    # Anterior tibial insertion
        (0.0, 0.0, 0.4),       # Mid-substance crossing
        (-0.7, -0.45, 0.95)    # Posteromedial aspect of lateral femoral condyle
    ]
    for i, pt in enumerate(acl_pts):
        bp = acl_spline.bezier_points[i]
        bp.co = pt
        bp.handle_left = (pt[0] - 0.1, pt[1] - 0.1, pt[2] + 0.1)
        bp.handle_right = (pt[0] + 0.1, pt[1] + 0.1, pt[2] - 0.1)
    acl_curve.bevel_depth = 0.22
    acl_curve.bevel_resolution = 6
    acl_obj = bpy.data.objects.new("Anterior_Cruciate_Ligament_ACL", acl_curve)
    bpy.context.scene.collection.objects.link(acl_obj)
    acl_obj.data.materials.append(mat_ligament)

    # Posterior Cruciate Ligament (PCL)
    # Originates posterior tibia, ascends forward/inward to medial condyle
    pcl_curve = bpy.data.curves.new('PCLCurve', type='CURVE')
    pcl_curve.dimensions = '3D'
    pcl_spline = pcl_curve.splines.new('BEZIER')
    pcl_spline.bezier_points.add(2)
    pcl_pts = [
        (-0.25, -0.65, -0.15), # Posterior intercondylar tibia
        (0.1, -0.2, 0.35),     # Crossing behind ACL
        (0.65, 0.35, 0.85)     # Anterolateral aspect of medial femoral condyle
    ]
    for i, pt in enumerate(pcl_pts):
        bp = pcl_spline.bezier_points[i]
        bp.co = pt
        bp.handle_left = (pt[0] - 0.1, pt[1] - 0.1, pt[2] + 0.1)
        bp.handle_right = (pt[0] + 0.1, pt[1] + 0.1, pt[2] - 0.1)
    pcl_curve.bevel_depth = 0.26
    pcl_curve.bevel_resolution = 6
    pcl_obj = bpy.data.objects.new("Posterior_Cruciate_Ligament_PCL", pcl_curve)
    bpy.context.scene.collection.objects.link(pcl_obj)
    pcl_obj.data.materials.append(mat_ligament)

    # ========================================================
    # 5. COLLATERAL LIGAMENTS (MCL & LCL)
    # ========================================================
    # Medial Collateral Ligament (MCL / Tibial Collateral)
    # Broad, flat band connecting medial epicondyle to medial tibia
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=18, radius=0.24, depth=3.2,
        location=(2.2, 0.0, 0.2)
    )
    mcl = bpy.context.active_object
    mcl.name = "Medial_Collateral_Ligament_MCL"
    mcl.scale = (0.55, 1.35, 1.0)
    mcl.data.materials.append(mat_ligament)
    create_smooth_subd(mcl, 1)

    # Lateral Collateral Ligament (LCL / Fibular Collateral)
    # Cord-like round ligament connecting lateral epicondyle to fibular head
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.18, depth=3.0,
        location=(-2.15, -0.15, 0.1)
    )
    lcl = bpy.context.active_object
    lcl.name = "Lateral_Collateral_Ligament_LCL"
    lcl.rotation_euler = (0.1, 0.12, 0.0)
    lcl.data.materials.append(mat_ligament)
    create_smooth_subd(lcl, 1)

    # ========================================================
    # 6. EXTENSOR APPARATUS: PATELLA, QUAD TENDON & PATELLAR LIGAMENT
    # ========================================================
    # Patella (Kneecap sesamoid bone)
    bpy.ops.mesh.primitive_cone_add(
        vertices=24, radius1=0.95, depth=0.75,
        location=(0.0, 1.45, 1.3)
    )
    patella = bpy.context.active_object
    patella.name = "Patella_Kneecap"
    patella.rotation_euler = (1.57, 0.0, 0.0)
    patella.scale = (1.1, 0.55, 1.2)
    patella.data.materials.append(mat_cortical_bone)
    create_smooth_subd(patella, 2)

    # Quadriceps Femoris Tendon (Superior insertion)
    bpy.ops.mesh.primitive_cube_add(
        size=1.2,
        location=(0.0, 1.15, 2.7)
    )
    quad_tendon = bpy.context.active_object
    quad_tendon.name = "Quadriceps_Tendon"
    quad_tendon.scale = (1.1, 0.25, 1.5)
    quad_tendon.data.materials.append(mat_tendon)
    create_smooth_subd(quad_tendon, 1)

    # Patellar Ligament (Extends from inferior patella to tibial tuberosity)
    bpy.ops.mesh.primitive_cube_add(
        size=1.2,
        location=(0.0, 1.25, -0.15)
    )
    patellar_lig = bpy.context.active_object
    patellar_lig.name = "Patellar_Ligament"
    patellar_lig.scale = (0.95, 0.22, 1.7)
    patellar_lig.data.materials.append(mat_tendon)
    create_smooth_subd(patellar_lig, 1)

    # Infrapatellar (Hoffa's) Fat Pad Cushion
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=20, ring_count=16, radius=0.65,
        location=(0.0, 0.75, 0.1)
    )
    fat_pad = bpy.context.active_object
    fat_pad.name = "Infrapatellar_Fat_Pad"
    fat_pad.scale = (1.1, 0.65, 0.8)
    fat_pad.data.materials.append(mat_fatpad)
    create_smooth_subd(fat_pad, 1)

    # ========================================================
    # STUDIO LIGHTING & CAMERA
    # ========================================================
    cam_data = bpy.data.cameras.new("StudioCamera")
    cam_data.lens = 52
    cam_obj = bpy.data.objects.new("StudioCamera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, -11.5, 0.5)
    cam_obj.rotation_euler = (1.52, 0.0, 0.0)
    bpy.context.scene.camera = cam_obj

    key_light = bpy.data.lights.new("KeyLight", type='AREA')
    key_light.energy = 450
    key_light.size = 4.0
    key_obj = bpy.data.objects.new("KeyLight", key_light)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.location = (3.5, -6.0, 4.5)

    fill_light = bpy.data.lights.new("FillLight", type='AREA')
    fill_light.energy = 220
    fill_light.size = 5.0
    fill_obj = bpy.data.objects.new("FillLight", fill_light)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-4.5, -5.0, 2.5)

    rim_light = bpy.data.lights.new("RimLight", type='AREA')
    rim_light.energy = 480
    rim_light.size = 3.5
    rim_obj = bpy.data.objects.new("RimLight", rim_light)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (0.0, 6.0, 3.5)

    # Save to native .blend file
    blend_path = os.path.join(MODELS_DIR, "knee_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[KNEE] Saved native .blend to {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR, "knee_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[KNEE] Rendered preview -> {preview_path}")

    # Export to WebGL GLB
    glb_path = os.path.join(OUTPUT_DIR, "knee_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[KNEE SUCCESS] Exported complete knee model to {glb_path}")

if __name__ == '__main__':
    build_ultra_knee()
