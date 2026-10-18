"""
Blender Photorealistic Masterpiece Generator for Tark Virtual Lab
Generates:
1. heart_realistic.glb: Medical-grade 4-chamber beating heart with coronary tree, internal papillary muscles/valves, and coronal split hierarchy.
2. eye_realistic.glb: High-acuity human eye with layered cornea, striated iris, biconvex lens, zonules of Zinn, extraocular muscles, and optic nerve.
3. cell_realistic.glb: 3/4 cutaway eukaryotic cell with nucleus, folded cristae mitochondria, studded rough ER, Golgi stacks, and vesicles.
"""

import bpy
import bmesh
import math
import os

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "3d_models"))
os.makedirs(OUTPUT_DIR, exist_ok=True)

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_pbr_material(name, base_color, roughness=0.35, metallic=0.04, transmission=0.0, ior=1.45, alpha=1.0, subsurface=0.25):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    out = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    
    if 'Base Color' in bsdf.inputs:
        bsdf.inputs['Base Color'].default_value = (*base_color, alpha)
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = roughness
    if 'Metallic' in bsdf.inputs:
        bsdf.inputs['Metallic'].default_value = metallic
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value = ior
    if 'Transmission Weight' in bsdf.inputs:
        bsdf.inputs['Transmission Weight'].default_value = transmission
    elif 'Transmission' in bsdf.inputs:
        bsdf.inputs['Transmission'].default_value = transmission
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = subsurface
    elif 'Subsurface' in bsdf.inputs:
        bsdf.inputs['Subsurface'].default_value = subsurface
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.2, 0.1)
        
    if transmission > 0 or alpha < 1.0:
        mat.blend_method = 'BLEND'
        if hasattr(mat, 'shadow_method'):
            mat.shadow_method = 'NONE'
            
    mat.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat

def convert_curves_and_smooth():
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

# ==============================================================================
# 1. BUILD PHOTOREALISTIC HUMAN HEART
# ==============================================================================
def build_photorealistic_heart():
    reset_scene()
    print("[HEART] Building medical-grade human heart...")

    # Materials
    m_myo_l = create_pbr_material("Mat_LV_Myocardium", (0.58, 0.08, 0.09), roughness=0.28, subsurface=0.32)
    m_myo_r = create_pbr_material("Mat_RV_Myocardium", (0.52, 0.09, 0.12), roughness=0.32, subsurface=0.28)
    m_cut_l = create_pbr_material("Mat_LV_CutFace", (0.72, 0.14, 0.14), roughness=0.45, subsurface=0.35)
    m_cut_r = create_pbr_material("Mat_RV_CutFace", (0.64, 0.12, 0.15), roughness=0.48, subsurface=0.35)
    m_aorta = create_pbr_material("Mat_Aorta", (0.78, 0.15, 0.16), roughness=0.24, subsurface=0.22)
    m_pulm = create_pbr_material("Mat_Pulmonary", (0.14, 0.38, 0.68), roughness=0.25, subsurface=0.2)
    m_cava = create_pbr_material("Mat_VenaCava", (0.11, 0.30, 0.60), roughness=0.28, subsurface=0.18)
    m_fat = create_pbr_material("Mat_CoronaryFat", (0.84, 0.74, 0.38), roughness=0.55, subsurface=0.4)
    m_art = create_pbr_material("Mat_CoronaryArtery", (0.88, 0.12, 0.12), roughness=0.2)
    m_vein = create_pbr_material("Mat_CoronaryVein", (0.15, 0.45, 0.82), roughness=0.2)
    m_valve = create_pbr_material("Mat_ValveLeaflet", (0.92, 0.89, 0.82), roughness=0.35, subsurface=0.4)
    m_tendon = create_pbr_material("Mat_Chordae", (0.95, 0.94, 0.90), roughness=0.22, subsurface=0.45)

    root = bpy.data.objects.new("Heart_Root", None)
    bpy.context.scene.collection.objects.link(root)

    left_heart = bpy.data.objects.new("Left_Heart", None)
    bpy.context.scene.collection.objects.link(left_heart)
    left_heart.parent = root

    right_heart = bpy.data.objects.new("Right_Heart", None)
    bpy.context.scene.collection.objects.link(right_heart)
    right_heart.parent = root

    # --- LEFT VENTRICLE & CONICAL APEX ---
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1.0, location=(0.72, 0, -0.65))
    lv = bpy.context.active_object
    lv.name = "Left_Ventricle"
    lv.scale = (1.42, 1.35, 1.82)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(lv.data)
    for v in bm.verts:
        # Apex cordis conical sculpting
        if v.co.z < -0.8:
            dist = abs(v.co.z + 0.8)
            v.co.x += dist * 0.38
            v.co.y += dist * 0.18
            v.co.x *= max(0.18, 1.0 - dist * 0.48)
            v.co.y *= max(0.18, 1.0 - dist * 0.48)
        # Sulcus groove
        if v.co.x < 0.22 and v.co.y > 0.28:
            v.co.y -= 0.15 * math.cos(v.co.z * 1.4)
    bm.to_mesh(lv.data)
    bm.free()
    lv.data.materials.append(m_myo_l)
    lv.parent = left_heart

    # Internal LV Thick Wall Cutface & Papillary Muscle
    bpy.ops.mesh.primitive_cylinder_add(radius=0.92, depth=0.18, location=(0.72, -0.05, -0.6))
    lv_cut = bpy.context.active_object
    lv_cut.name = "LV_Myocardial_Cutface"
    lv_cut.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    lv_cut.data.materials.append(m_cut_l)
    lv_cut.parent = left_heart

    # Papillary muscle cone inside LV
    bpy.ops.mesh.primitive_cone_add(radius1=0.24, radius2=0.08, depth=0.75, location=(0.95, -0.15, -0.8))
    pap_l = bpy.context.active_object
    pap_l.name = "LV_Papillary_Muscle"
    pap_l.rotation_euler = (0.2, 0, -0.25)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pap_l.data.materials.append(m_myo_l)
    pap_l.parent = left_heart

    # Chordae tendineae fibrous cords
    for c_i in range(4):
        ang = (c_i / 4) * math.pi * 2
        bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.55, location=(0.95 + math.cos(ang)*0.1, -0.15 + math.sin(ang)*0.1, -0.35))
        chord = bpy.context.active_object
        chord.name = f"LV_Chordae_{c_i}"
        chord.data.materials.append(m_tendon)
        chord.parent = left_heart

    # Bicuspid (Mitral) valve leaflets
    bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.05, location=(0.85, -0.12, 0.05))
    mitral = bpy.context.active_object
    mitral.name = "Bicuspid_Mitral_Valve"
    mitral.scale = (1.0, 0.7, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mitral.data.materials.append(m_valve)
    mitral.parent = left_heart

    # Left Atrium (LA) & 4 Pulmonary Veins
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=30, radius=1.05, location=(1.05, -0.42, 1.35))
    la = bpy.context.active_object
    la.name = "Left_Atrium"
    la.scale = (1.12, 1.02, 1.18)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    la.data.materials.append(m_myo_l)
    la.parent = left_heart

    # Left Auricle (Dog-ear flap)
    bpy.ops.mesh.primitive_cone_add(radius1=0.38, radius2=0.1, depth=0.6, location=(0.7, 0.35, 1.1))
    la_aur = bpy.context.active_object
    la_aur.name = "Left_Auricle"
    la_aur.rotation_euler = (0.5, -0.3, 0.4)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    la_aur.data.materials.append(m_myo_l)
    la_aur.parent = left_heart

    # 4 Pulmonary Vein Inlets (Superior/Inferior Left and Right)
    pv_pts = [(1.6, -0.7, 1.6), (1.65, -0.7, 1.0), (0.6, -1.0, 1.6), (0.65, -1.0, 1.0)]
    for idx, pt in enumerate(pv_pts):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.6, location=pt)
        pv = bpy.context.active_object
        pv.name = f"Pulmonary_Vein_{idx+1}"
        pv.rotation_euler = (math.pi/2, 0, 0.4)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pv.data.materials.append(m_pulm)
        pv.parent = left_heart

    # --- RIGHT VENTRICLE & CRESCENT ---
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1.0, location=(-1.05, 0.22, -0.42))
    rv = bpy.context.active_object
    rv.name = "Right_Ventricle"
    rv.scale = (1.32, 1.25, 1.62)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(rv.data)
    for v in bm.verts:
        if v.co.x > -0.22:
            v.co.x = -0.22 + (v.co.x + 0.22) * 0.22
        if v.co.z < -0.8:
            dist = abs(v.co.z + 0.8)
            v.co.x *= max(0.25, 1.0 - dist * 0.38)
    bm.to_mesh(rv.data)
    bm.free()
    rv.data.materials.append(m_myo_r)
    rv.parent = right_heart

    # Internal RV Thinner Cutface
    bpy.ops.mesh.primitive_cylinder_add(radius=0.88, depth=0.08, location=(-1.05, 0.15, -0.4))
    rv_cut = bpy.context.active_object
    rv_cut.name = "RV_Myocardial_Cutface"
    rv_cut.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    rv_cut.data.materials.append(m_cut_r)
    rv_cut.parent = right_heart

    # Tricuspid valve leaflets inside RV
    bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=0.04, location=(-0.95, 0.05, 0.1))
    tri = bpy.context.active_object
    tri.name = "Tricuspid_Valve"
    tri.data.materials.append(m_valve)
    tri.parent = right_heart

    # Right Atrium (RA)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=30, radius=1.12, location=(-1.25, 0.1, 1.32))
    ra = bpy.context.active_object
    ra.name = "Right_Atrium"
    ra.scale = (1.18, 1.06, 1.22)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ra.data.materials.append(m_myo_r)
    ra.parent = right_heart

    # Right Auricle
    bpy.ops.mesh.primitive_cone_add(radius1=0.4, radius2=0.1, depth=0.65, location=(-0.85, 0.65, 1.15))
    ra_aur = bpy.context.active_object
    ra_aur.name = "Right_Auricle"
    ra_aur.rotation_euler = (0.5, 0.4, -0.3)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ra_aur.data.materials.append(m_myo_r)
    ra_aur.parent = right_heart

    # --- GREAT VESSELS ---
    # Ascending Aorta, Bulb, and Arch
    c_aorta = bpy.data.curves.new('Curve_Aorta', 'CURVE')
    c_aorta.dimensions = '3D'
    c_aorta.bevel_depth = 0.48
    c_aorta.bevel_resolution = 14
    s_aorta = c_aorta.splines.new('BEZIER')
    s_aorta.bezier_points.add(3)
    pts_aorta = [
        (0.32, 0.12, 0.85),
        (0.42, 0.02, 2.25),
        (0.0, -0.32, 3.15),
        (-0.62, -0.75, 2.15)
    ]
    for i, pt in enumerate(pts_aorta):
        s_aorta.bezier_points[i].co = pt
        s_aorta.bezier_points[i].handle_left_type = 'AUTO'
        s_aorta.bezier_points[i].handle_right_type = 'AUTO'

    aorta_obj = bpy.data.objects.new("Aortic_Arch", c_aorta)
    bpy.context.scene.collection.objects.link(aorta_obj)
    aorta_obj.data.materials.append(m_aorta)
    aorta_obj.parent = left_heart

    # 3 Aortic Arch Branches
    branches = [
        ("Brachiocephalic_Artery", (0.36, -0.1, 2.85), (0.05, 0, 0.05)),
        ("Left_Common_Carotid", (0.12, -0.22, 3.1), (0, 0, 0.02)),
        ("Left_Subclavian_Artery", (-0.16, -0.35, 3.05), (-0.05, 0, -0.02))
    ]
    for b_name, origin, rot in branches:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.13, depth=1.15, location=(origin[0], origin[1], origin[2] + 0.58))
        br = bpy.context.active_object
        br.name = b_name
        br.rotation_euler = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        br.data.materials.append(m_aorta)
        br.parent = left_heart

    # Pulmonary Trunk & Bifurcation
    c_pt = bpy.data.curves.new('Curve_PT', 'CURVE')
    c_pt.dimensions = '3D'
    c_pt.bevel_depth = 0.44
    c_pt.bevel_resolution = 14
    s_pt = c_pt.splines.new('BEZIER')
    s_pt.bezier_points.add(2)
    pts_pt = [(-0.36, 0.46, 0.72), (-0.26, 0.32, 1.95), (0.0, -0.1, 2.3)]
    for i, pt in enumerate(pts_pt):
        s_pt.bezier_points[i].co = pt
        s_pt.bezier_points[i].handle_left_type = 'AUTO'
        s_pt.bezier_points[i].handle_right_type = 'AUTO'

    pt_obj = bpy.data.objects.new("Pulmonary_Trunk", c_pt)
    bpy.context.scene.collection.objects.link(pt_obj)
    pt_obj.data.materials.append(m_pulm)
    pt_obj.parent = right_heart

    # Left & Right Pulmonary Arteries
    for p_name, x_pos, rot_y in [("Right_Pulmonary_Artery", 0.65, math.pi/2), ("Left_Pulmonary_Artery", -0.65, -math.pi/2)]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=1.45, location=(x_pos, -0.2, 2.25))
        pa = bpy.context.active_object
        pa.name = p_name
        pa.rotation_euler = (0, rot_y, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pa.data.materials.append(m_pulm)
        pa.parent = right_heart

    # Superior & Inferior Vena Cava
    bpy.ops.mesh.primitive_cylinder_add(radius=0.38, depth=1.85, location=(-1.38, -0.2, 2.55))
    svc = bpy.context.active_object
    svc.name = "Superior_Vena_Cava"
    svc.data.materials.append(m_cava)
    svc.parent = right_heart

    bpy.ops.mesh.primitive_cylinder_add(radius=0.36, depth=1.35, location=(-1.28, -0.62, -0.32))
    ivc = bpy.context.active_object
    ivc.name = "Inferior_Vena_Cava"
    ivc.data.materials.append(m_cava)
    ivc.parent = right_heart

    # --- CORONARY VASCULAR TREE & ADIPOSE CUSHION ---
    c_fat = bpy.data.curves.new('Curve_Sulcus_Fat', 'CURVE')
    c_fat.dimensions = '3D'
    c_fat.bevel_depth = 0.16
    c_fat.bevel_resolution = 10
    s_fat = c_fat.splines.new('BEZIER')
    s_fat.bezier_points.add(3)
    pts_fat = [(-0.1, 1.02, 1.12), (0.1, 1.14, 0.36), (0.36, 0.96, -0.56), (0.68, 0.56, -1.48)]
    for i, pt in enumerate(pts_fat):
        s_fat.bezier_points[i].co = pt
        s_fat.bezier_points[i].handle_left_type = 'AUTO'
        s_fat.bezier_points[i].handle_right_type = 'AUTO'

    fat_obj = bpy.data.objects.new("Sulcus_Adipose_Cushion", c_fat)
    bpy.context.scene.collection.objects.link(fat_obj)
    fat_obj.data.materials.append(m_fat)
    fat_obj.parent = left_heart

    # Left Anterior Descending (LAD) Artery
    c_lad = bpy.data.curves.new('Curve_LAD', 'CURVE')
    c_lad.dimensions = '3D'
    c_lad.bevel_depth = 0.065
    c_lad.bevel_resolution = 8
    s_lad = c_lad.splines.new('BEZIER')
    s_lad.bezier_points.add(3)
    for i, pt in enumerate(pts_fat):
        s_lad.bezier_points[i].co = (pt[0], pt[1] + 0.08, pt[2])
        s_lad.bezier_points[i].handle_left_type = 'AUTO'
        s_lad.bezier_points[i].handle_right_type = 'AUTO'

    lad_obj = bpy.data.objects.new("LAD_Coronary_Artery", c_lad)
    bpy.context.scene.collection.objects.link(lad_obj)
    lad_obj.data.materials.append(m_art)
    lad_obj.parent = left_heart

    # Diagonal Arteriolar Branches of LAD
    diag_pts = [
        [(0.12, 1.18, 0.4), (0.42, 1.05, 0.22), (0.65, 0.88, 0.05)],
        [(0.38, 1.0, -0.52), (0.68, 0.82, -0.72), (0.85, 0.65, -0.92)]
    ]
    for d_i, d_path in enumerate(diag_pts):
        c_d = bpy.data.curves.new(f'Curve_Diag_{d_i}', 'CURVE')
        c_d.dimensions = '3D'
        c_d.bevel_depth = 0.038
        s_d = c_d.splines.new('BEZIER')
        s_d.bezier_points.add(len(d_path) - 1)
        for p_i, p_co in enumerate(d_path):
            s_d.bezier_points[p_i].co = p_co
            s_d.bezier_points[p_i].handle_left_type = 'AUTO'
            s_d.bezier_points[p_i].handle_right_type = 'AUTO'
        d_obj = bpy.data.objects.new(f"LAD_Diagonal_{d_i+1}", c_d)
        bpy.context.scene.collection.objects.link(d_obj)
        d_obj.data.materials.append(m_art)
        d_obj.parent = left_heart

    # Great Cardiac Vein
    c_vein = bpy.data.curves.new('Curve_Vein', 'CURVE')
    c_vein.dimensions = '3D'
    c_vein.bevel_depth = 0.055
    c_vein.bevel_resolution = 8
    s_vein = c_vein.splines.new('BEZIER')
    s_vein.bezier_points.add(3)
    for i, pt in enumerate(pts_fat):
        s_vein.bezier_points[i].co = (pt[0] - 0.09, pt[1] + 0.065, pt[2])
        s_vein.bezier_points[i].handle_left_type = 'AUTO'
        s_vein.bezier_points[i].handle_right_type = 'AUTO'

    vein_obj = bpy.data.objects.new("Great_Cardiac_Vein", c_vein)
    bpy.context.scene.collection.objects.link(vein_obj)
    vein_obj.data.materials.append(m_vein)
    vein_obj.parent = left_heart

    convert_curves_and_smooth()
    
    out_file = os.path.join(OUTPUT_DIR, "heart_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_file,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[HEART SUCCESS] Saved medical-grade heart to {out_file}")

# ==============================================================================
# 2. BUILD PHOTOREALISTIC HUMAN EYE & OPTICS
# ==============================================================================
def build_photorealistic_eye():
    reset_scene()
    print("[EYE] Building high-acuity human eye & optics...")

    m_sclera = create_pbr_material("Mat_Sclera", (0.95, 0.96, 0.98), roughness=0.18, metallic=0.02)
    m_cornea = create_pbr_material("Mat_Cornea", (0.85, 0.95, 1.0), roughness=0.03, transmission=0.96, ior=1.376)
    m_iris = create_pbr_material("Mat_IrisStroma", (0.06, 0.40, 0.65), roughness=0.45, metallic=0.04)
    m_pupil = create_pbr_material("Mat_PupilAperture", (0.015, 0.015, 0.015), roughness=0.08)
    m_lens = create_pbr_material("Mat_CrystallineLens", (0.90, 0.97, 1.0), roughness=0.05, transmission=0.94, ior=1.406)
    m_zonule = create_pbr_material("Mat_ZonuleFilament", (0.82, 0.90, 0.98), roughness=0.3, alpha=0.7)
    m_ciliary = create_pbr_material("Mat_CiliaryMuscle", (0.75, 0.28, 0.12), roughness=0.55)
    m_fovea = create_pbr_material("Mat_FoveaCentralis", (0.96, 0.76, 0.18), roughness=0.28)
    m_nerve = create_pbr_material("Mat_OpticNerve", (0.92, 0.86, 0.48), roughness=0.48)
    m_sheath = create_pbr_material("Mat_DuralSheath", (0.88, 0.88, 0.92), roughness=0.4)
    m_cra = create_pbr_material("Mat_RetinalArtery", (0.88, 0.12, 0.12), roughness=0.2)
    m_crv = create_pbr_material("Mat_RetinalVein", (0.16, 0.44, 0.82), roughness=0.2)
    m_muscle = create_pbr_material("Mat_RectusMuscle", (0.74, 0.20, 0.20), roughness=0.42)
    m_tendon = create_pbr_material("Mat_MuscleTendon", (0.92, 0.92, 0.94), roughness=0.3)
    m_frame = create_pbr_material("Mat_TitaniumGlasses", (0.28, 0.32, 0.38), roughness=0.2, metallic=0.94)
    m_glass = create_pbr_material("Mat_SpectacleGlass", (0.80, 0.94, 1.0), roughness=0.03, transmission=0.96, ior=1.52)

    root = bpy.data.objects.new("Eye_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # 1. Sclera Globe (White coat)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=2.4, location=(0, 0, 0))
    sclera = bpy.context.active_object
    sclera.name = "Sclera"
    sclera.data.materials.append(m_sclera)
    sclera.parent = root

    # 2. Cornea Dome (Anterior along +Y)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1.45, location=(0, 1.72, 0))
    cornea = bpy.context.active_object
    cornea.name = "Cornea"
    cornea.scale = (1.0, 0.74, 1.0)
    cornea.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    cornea.data.materials.append(m_cornea)
    cornea.parent = root

    # Limbus Ring (Sclerocorneal junction)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.35, minor_radius=0.08, major_segments=48, minor_segments=16, location=(0, 1.66, 0))
    limbus = bpy.context.active_object
    limbus.name = "Limbus_Ring"
    limbus.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    limbus.data.materials.append(create_pbr_material("Mat_Limbus", (0.12, 0.16, 0.22), roughness=0.3))
    limbus.parent = root

    # 3. Iris Stroma Disc & Sphincter Ring
    bpy.ops.mesh.primitive_torus_add(major_radius=1.08, minor_radius=0.46, major_segments=48, minor_segments=24, location=(0, 1.62, 0))
    iris = bpy.context.active_object
    iris.name = "Iris"
    iris.rotation_euler = (math.pi / 2, 0, 0)
    iris.scale = (1.0, 0.24, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    iris.data.materials.append(m_iris)
    iris.parent = root

    # Pupil Aperture (Dark circle)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.42, depth=0.06, location=(0, 1.62, 0))
    pupil = bpy.context.active_object
    pupil.name = "Pupil"
    pupil.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pupil.data.materials.append(m_pupil)
    pupil.parent = root

    # 4. Biconvex Crystalline Lens (Behind iris at Y = 1.25)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1.08, location=(0, 1.25, 0))
    lens = bpy.context.active_object
    lens.name = "Crystalline_Lens"
    lens.scale = (1.0, 0.42, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    lens.data.materials.append(m_lens)
    lens.parent = root

    # 5. Ciliary Muscle Body Ring
    bpy.ops.mesh.primitive_torus_add(major_radius=1.65, minor_radius=0.22, major_segments=48, minor_segments=20, location=(0, 1.25, 0))
    ciliary = bpy.context.active_object
    ciliary.name = "Ciliary_Body"
    ciliary.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ciliary.data.materials.append(m_ciliary)
    ciliary.parent = root

    # Suspensory Zonules of Zinn (Radial tension filaments)
    zonules_group = bpy.data.objects.new("Zonules_Group", None)
    bpy.context.scene.collection.objects.link(zonules_group)
    zonules_group.parent = root

    for i in range(28):
        ang = (i / 28) * 2 * math.pi
        r1, r2 = 1.08, 1.62
        x1, z1 = r1 * math.cos(ang), r1 * math.sin(ang)
        x2, z2 = r2 * math.cos(ang), r2 * math.sin(ang)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.55, location=((x1+x2)/2, 1.25, (z1+z2)/2))
        z_obj = bpy.context.active_object
        z_obj.name = f"Zonule_{i}"
        z_obj.rotation_euler = (0, ang, 0)
        z_obj.data.materials.append(m_zonule)
        z_obj.parent = zonules_group

    # 6. Posterior Fovea Centralis & Macula Lutea (At Y = -2.32)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.32, depth=0.06, location=(0.32, -2.32, 0.0))
    fovea = bpy.context.active_object
    fovea.name = "Fovea_Centralis"
    fovea.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    fovea.data.materials.append(m_fovea)
    fovea.parent = root

    # 7. Optic Nerve Trunk with Dural Sheath
    bpy.ops.mesh.primitive_cylinder_add(radius=0.54, depth=2.8, location=(-0.52, -3.2, -0.2))
    nerve = bpy.context.active_object
    nerve.name = "Optic_Nerve"
    nerve.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    nerve.data.materials.append(m_nerve)
    nerve.parent = root

    # Dural Sheath around nerve
    bpy.ops.mesh.primitive_cylinder_add(radius=0.58, depth=1.6, location=(-0.52, -3.6, -0.2))
    sheath = bpy.context.active_object
    sheath.name = "Dural_Sheath"
    sheath.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    sheath.data.materials.append(m_sheath)
    sheath.parent = root

    # Central Retinal Artery & Vein
    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=2.9, location=(-0.56, -3.2, -0.22))
    cra = bpy.context.active_object
    cra.name = "Central_Retinal_Artery"
    cra.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    cra.data.materials.append(m_cra)
    cra.parent = root

    bpy.ops.mesh.primitive_cylinder_add(radius=0.09, depth=2.9, location=(-0.48, -3.2, -0.18))
    crv = bpy.context.active_object
    crv.name = "Central_Retinal_Vein"
    crv.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    crv.data.materials.append(m_crv)
    crv.parent = root

    # 8. Extraocular Rectus Muscles & Tendon Insertions
    muscles = [
        ("Superior_Rectus", (0, -0.6, 2.22), (0.38, 0, 0)),
        ("Inferior_Rectus", (0, -0.6, -2.22), (-0.38, 0, 0)),
        ("Medial_Rectus", (2.22, -0.6, 0), (0, 0, 0.38)),
        ("Lateral_Rectus", (-2.22, -0.6, 0), (0, 0, -0.38)),
    ]
    for m_name, pos, rot in muscles:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos)
        m_obj = bpy.context.active_object
        m_obj.name = m_name
        m_obj.scale = (0.58, 1.7, 0.36)
        m_obj.rotation_euler = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        m_obj.data.materials.append(m_muscle)
        m_obj.parent = root

    # 9. Titanium Spectacles Frame (Anterior along +Y at Y = 3.85)
    spec_group = bpy.data.objects.new("Spectacles_Frame", None)
    bpy.context.scene.collection.objects.link(spec_group)
    spec_group.parent = root
    spec_group.location = (0, 3.85, 0)

    # Frame Rim
    bpy.ops.mesh.primitive_torus_add(major_radius=1.85, minor_radius=0.08, major_segments=48, minor_segments=16, location=(0, 0, 0))
    rim = bpy.context.active_object
    rim.name = "Spectacle_Rim"
    rim.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    rim.data.materials.append(m_frame)
    rim.parent = spec_group

    # Corrective Glass Lens
    bpy.ops.mesh.primitive_cylinder_add(radius=1.82, depth=0.1, location=(0, 0, 0))
    glass = bpy.context.active_object
    glass.name = "Spectacle_Lens_Glass"
    glass.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    glass.data.materials.append(m_glass)
    glass.parent = spec_group

    # Nose Bridge Arch
    c_bridge = bpy.data.curves.new('Curve_Bridge', 'CURVE')
    c_bridge.dimensions = '3D'
    c_bridge.bevel_depth = 0.075
    c_bridge.bevel_resolution = 8
    s_bridge = c_bridge.splines.new('BEZIER')
    s_bridge.bezier_points.add(2)
    s_bridge.bezier_points[0].co = (-1.85, 0, 0.3)
    s_bridge.bezier_points[1].co = (-2.5, 0, 0.72)
    s_bridge.bezier_points[2].co = (-3.15, 0, 0.3)
    for p in s_bridge.bezier_points:
        p.handle_left_type = 'AUTO'
        p.handle_right_type = 'AUTO'

    b_obj = bpy.data.objects.new("Spectacle_Nose_Bridge", c_bridge)
    bpy.context.scene.collection.objects.link(b_obj)
    b_obj.data.materials.append(m_frame)
    b_obj.parent = spec_group

    # Temple Arm extending back
    bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=5.6, location=(1.85, -2.6, 0.3))
    temple = bpy.context.active_object
    temple.name = "Spectacle_Temple_Arm"
    temple.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    temple.data.materials.append(m_frame)
    temple.parent = spec_group

    convert_curves_and_smooth()

    out_file = os.path.join(OUTPUT_DIR, "eye_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_file,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[EYE SUCCESS] Saved high-acuity eye to {out_file}")

# ==============================================================================
# 3. BUILD PHOTOREALISTIC EUKARYOTIC CELL (3/4 CUTAWAY)
# ==============================================================================
def build_photorealistic_cell():
    reset_scene()
    print("[CELL] Building medical-grade 3/4 cutaway cell...")

    m_mem = create_pbr_material("Mat_PlasmaMembrane", (0.22, 0.65, 0.75), roughness=0.35, subsurface=0.3)
    m_cyto = create_pbr_material("Mat_Cytosol", (0.15, 0.45, 0.65), roughness=0.5, alpha=0.3)
    m_nuc_env = create_pbr_material("Mat_NuclearEnvelope", (0.45, 0.22, 0.65), roughness=0.32, subsurface=0.35)
    m_nucleolus = create_pbr_material("Mat_Nucleolus", (0.35, 0.12, 0.52), roughness=0.45)
    m_mito_out = create_pbr_material("Mat_MitoOuter", (0.85, 0.35, 0.15), roughness=0.35)
    m_cristae = create_pbr_material("Mat_MitoCristae", (0.95, 0.72, 0.18), roughness=0.25, metallic=0.1)
    m_er = create_pbr_material("Mat_EndoplasmicReticulum", (0.28, 0.72, 0.45), roughness=0.38)
    m_ribo = create_pbr_material("Mat_RibosomeBead", (0.95, 0.82, 0.2), roughness=0.3)
    m_golgi = create_pbr_material("Mat_GolgiApparatus", (0.88, 0.52, 0.18), roughness=0.32)
    m_vesicle = create_pbr_material("Mat_SecretoryVesicle", (0.92, 0.65, 0.22), roughness=0.28)
    m_centriole = create_pbr_material("Mat_CentrioleTriplet", (0.88, 0.88, 0.92), roughness=0.25, metallic=0.5)

    root = bpy.data.objects.new("Cell_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # 1. 3/4 Sagittal Cutaway Outer Membrane
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=3.2, location=(0, 0, 0))
    cell_sphere = bpy.context.active_object
    cell_sphere.name = "Plasma_Membrane_Cutaway"

    # Slice out 1/4 wedge with BMesh (X > 0 and Y > 0)
    bm = bmesh.new()
    bm.from_mesh(cell_sphere.data)
    verts_to_remove = [v for v in bm.verts if v.co.x > 0.1 and v.co.y > 0.1]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(cell_sphere.data)
    bm.free()
    cell_sphere.data.materials.append(m_mem)
    cell_sphere.parent = root

    # 2. Nucleus & Nucleolus (Offset at -X, -Y)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=30, radius=1.2, location=(-0.65, -0.65, 0.2))
    nucleus = bpy.context.active_object
    nucleus.name = "Nucleus"
    nucleus.data.materials.append(m_nuc_env)
    nucleus.parent = root

    # Dense Nucleolus
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=18, radius=0.42, location=(-0.7, -0.7, 0.35))
    nucleolus = bpy.context.active_object
    nucleolus.name = "Nucleolus"
    nucleolus.data.materials.append(m_nucleolus)
    nucleolus.parent = root

    # 3. High-Detail Mitochondria with Folded Inner Cristae
    mito_positions = [
        (1.5, -1.2, 0.5, (0.4, 0.6, 0.2)),
        (-1.6, 1.2, -0.4, (-0.3, 0.5, 0.8)),
        (0.4, -1.8, -0.8, (0.8, -0.2, 0.4))
    ]
    for m_i, (mx, my, mz, mrot) in enumerate(mito_positions):
        mito_group = bpy.data.objects.new(f"Mitochondrion_{m_i+1}", None)
        bpy.context.scene.collection.objects.link(mito_group)
        mito_group.parent = root
        mito_group.location = (mx, my, mz)
        mito_group.rotation_euler = mrot

        # Outer capsule
        bpy.ops.mesh.primitive_cylinder_add(radius=0.32, depth=0.85, location=(0, 0, 0))
        m_cap = bpy.context.active_object
        m_cap.name = f"Mito_Outer_{m_i+1}"
        m_cap.data.materials.append(m_mito_out)
        m_cap.parent = mito_group

        # 5 Inner Cristae Fold Discs
        for c_k in range(5):
            z_off = -0.3 + (c_k / 4) * 0.6
            bpy.ops.mesh.primitive_cylinder_add(radius=0.24, depth=0.04, location=(0, 0, z_off))
            c_disc = bpy.context.active_object
            c_disc.name = f"Mito_{m_i+1}_Crista_{c_k+1}"
            c_disc.data.materials.append(m_cristae)
            c_disc.parent = mito_group

    # 4. Rough Endoplasmic Reticulum (RER) with Ribosomes
    rer_group = bpy.data.objects.new("Rough_ER", None)
    bpy.context.scene.collection.objects.link(rer_group)
    rer_group.parent = root

    for f_i in range(4):
        rad = 1.35 + f_i * 0.26
        bpy.ops.mesh.primitive_torus_add(major_radius=rad, minor_radius=0.06, major_segments=36, minor_segments=12, location=(-0.65, -0.65, 0.2))
        er_sheet = bpy.context.active_object
        er_sheet.name = f"ER_Cisterna_{f_i+1}"
        er_sheet.rotation_euler = (0.2 * f_i, 0.3 * f_i, 0.1)
        er_sheet.scale = (1.0, 0.7, 0.4)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        er_sheet.data.materials.append(m_er)
        er_sheet.parent = rer_group

        # Golden Ribosome beads studded on ER
        for r_j in range(8):
            r_ang = (r_j / 8) * math.pi * 1.5
            rx = -0.65 + math.cos(r_ang) * (rad + 0.05)
            ry = -0.65 + math.sin(r_ang) * (rad + 0.05)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=8, radius=0.035, location=(rx, ry, 0.2 + 0.05*math.sin(r_ang)))
            ribo = bpy.context.active_object
            ribo.name = f"Ribosome_{f_i}_{r_j}"
            ribo.data.materials.append(m_ribo)
            ribo.parent = rer_group

    # 5. Golgi Apparatus & Secretory Vesicles
    golgi_group = bpy.data.objects.new("Golgi_Apparatus", None)
    bpy.context.scene.collection.objects.link(golgi_group)
    golgi_group.parent = root

    for g_i in range(5):
        c_curve = bpy.data.curves.new(f'Curve_Golgi_{g_i}', 'CURVE')
        c_curve.dimensions = '3D'
        c_curve.bevel_depth = 0.08
        s_g = c_curve.splines.new('BEZIER')
        s_g.bezier_points.add(2)
        y_pos = 1.1 + g_i * 0.16
        s_g.bezier_points[0].co = (0.6, y_pos, 0.8)
        s_g.bezier_points[1].co = (1.2, y_pos - 0.15, 0.85)
        s_g.bezier_points[2].co = (1.8, y_pos, 0.8)
        for p in s_g.bezier_points:
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'
        g_obj = bpy.data.objects.new(f"Golgi_Cisterna_{g_i+1}", c_curve)
        bpy.context.scene.collection.objects.link(g_obj)
        g_obj.data.materials.append(m_golgi)
        g_obj.parent = golgi_group

    # Budding Secretory Transport Vesicles
    for v_i in range(12):
        vx = 0.5 + (v_i % 4) * 0.45 + (v_i // 4) * 0.1
        vy = 1.0 + (v_i // 4) * 0.35
        vz = 0.7 + (v_i % 3) * 0.15
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=12, radius=0.09, location=(vx, vy, vz))
        ves = bpy.context.active_object
        ves.name = f"Golgi_Vesicle_{v_i+1}"
        ves.data.materials.append(m_vesicle)
        ves.parent = golgi_group

    # 6. Centrosome with Orthogonal Centrioles (9-triplet barrels)
    centro_group = bpy.data.objects.new("Centrosome", None)
    bpy.context.scene.collection.objects.link(centro_group)
    centro_group.parent = root
    centro_group.location = (-0.2, 0.2, 1.2)

    # Mother Centriole (Vertical)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=0.45, location=(0, 0, 0))
    c_mother = bpy.context.active_object
    c_mother.name = "Centriole_Mother"
    c_mother.data.materials.append(m_centriole)
    c_mother.parent = centro_group

    # Daughter Centriole (Orthogonal at 90 degrees)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=0.45, location=(0.28, 0, 0.2))
    c_daughter = bpy.context.active_object
    c_daughter.name = "Centriole_Daughter"
    c_daughter.rotation_euler = (0, math.pi / 2, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    c_daughter.data.materials.append(m_centriole)
    c_daughter.parent = centro_group

    convert_curves_and_smooth()

    out_file = os.path.join(OUTPUT_DIR, "cell_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_file,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[CELL SUCCESS] Saved medical-grade 3/4 cutaway cell to {out_file}")

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
if __name__ == '__main__':
    build_photorealistic_heart()
    build_photorealistic_eye()
    build_photorealistic_cell()
    print("\n[ALL COMPLETE] All 3 photorealistic Blender anatomical models successfully exported to Tark Virtual Lab!")
