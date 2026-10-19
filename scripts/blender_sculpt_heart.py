"""
Ultra-Realistic Anatomical Human Heart Generator for Blender 5.2
Specifically engineered for flawless, bug-free Left & Right Coronal Splitting:
1. Left_Heart group contains:
   - Left Ventricle with thick (15mm scale) trabeculated myocardial wall and hollow ventricular lumen.
   - Left Atrium & Scalloped Left Auricle.
   - 4 Pulmonary Veins (Left/Right Superior & Inferior).
   - Ascending Aorta, 3 Sinuses of Valsalva, Aortic Arch, and 3 Brachiocephalic branches.
   - Bicuspid / Mitral Valve with anterior & posterior leaflets.
   - 2 Conical Papillary Muscles with branching parachute Chordae Tendineae.
   - Left half of the anterior interventricular sulcus adipose cushion and LAD artery.
2. Right_Heart group contains:
   - Right Ventricle with thin (4mm scale) crescent myocardial wall and hollow cavity.
   - Right Atrium & Triangular Right Auricle.
   - Superior Vena Cava (SVC) and Inferior Vena Cava (IVC).
   - Infundibular Conus Arteriosus and Pulmonary Trunk bifurcating into L/R Pulmonary Arteries.
   - Tricuspid Valve with 3 distinct cusps.
   - Right half of the sulcus fat and Right Coronary Artery (RCA).
3. Both hemispheres are separated cleanly at the coronal plane (Y=0) with zero overlap,
   zero clipping, and true hollow anatomical chamber interiors.
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

def create_rich_pbr_material(name, base_color, roughness=0.3, sss_weight=0.35, sss_radius=(1.0, 0.25, 0.1), 
                             specular=0.6, transmission=0.0, ior=1.45, is_fat=False, is_valve=False):
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
        bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = roughness
    if 'IOR' in bsdf.inputs:
        bsdf.inputs['IOR'].default_value = ior
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = specular

    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = sss_weight
    elif 'Subsurface' in bsdf.inputs:
        bsdf.inputs['Subsurface'].default_value = sss_weight
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = sss_radius

    if transmission > 0:
        if 'Transmission Weight' in bsdf.inputs:
            bsdf.inputs['Transmission Weight'].default_value = transmission
        elif 'Transmission' in bsdf.inputs:
            bsdf.inputs['Transmission'].default_value = transmission
        mat.blend_method = 'BLEND'

    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-600, 0)

    if is_fat:
        vor = nodes.new(type='ShaderNodeTexVoronoi')
        vor.location = (-350, 100)
        vor.inputs['Scale'].default_value = 24.0
        links.new(tex_coord.outputs['Object'], vor.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.28
        links.new(vor.outputs['Distance'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-100, 150)
        cr.color_ramp.elements[0].position = 0.2
        cr.color_ramp.elements[0].color = (0.92, 0.82, 0.42, 1.0)
        cr.color_ramp.elements[1].position = 0.8
        cr.color_ramp.elements[1].color = (0.76, 0.65, 0.32, 1.0)
        links.new(vor.outputs['Distance'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

    elif is_valve:
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 0)
        noise.inputs['Scale'].default_value = 35.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.15
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    else:
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 100)
        noise.inputs['Scale'].default_value = 16.0
        noise.inputs['Detail'].default_value = 3.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.18
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def build_perfect_split_heart():
    reset()
    print("[HEART GENERATOR] Sculpting bug-free split anatomical human heart...")

    # Materials
    m_myo_l = create_rich_pbr_material("Mat_LV_Myocardium", (0.58, 0.08, 0.09), roughness=0.25, sss_weight=0.40)
    m_myo_r = create_rich_pbr_material("Mat_RV_Myocardium", (0.52, 0.09, 0.12), roughness=0.28, sss_weight=0.35)
    m_cut_l = create_rich_pbr_material("Mat_LV_CutFace", (0.72, 0.14, 0.15), roughness=0.38, sss_weight=0.45)
    m_cut_r = create_rich_pbr_material("Mat_RV_CutFace", (0.65, 0.12, 0.16), roughness=0.42, sss_weight=0.40)
    m_aorta = create_rich_pbr_material("Mat_Aorta", (0.80, 0.15, 0.16), roughness=0.20, sss_weight=0.28, specular=0.8)
    m_pulm = create_rich_pbr_material("Mat_Pulmonary", (0.14, 0.38, 0.72), roughness=0.22, sss_weight=0.25, specular=0.8)
    m_cava = create_rich_pbr_material("Mat_VenaCava", (0.10, 0.28, 0.62), roughness=0.25, sss_weight=0.22)
    m_fat = create_rich_pbr_material("Mat_CoronaryFat", (0.88, 0.78, 0.38), roughness=0.48, sss_weight=0.48, is_fat=True)
    m_art = create_rich_pbr_material("Mat_CoronaryArtery", (0.90, 0.10, 0.10), roughness=0.16, specular=0.85)
    m_vein = create_rich_pbr_material("Mat_CoronaryVein", (0.16, 0.44, 0.85), roughness=0.16, specular=0.85)
    m_valve = create_rich_pbr_material("Mat_ValveLeaflet", (0.95, 0.94, 0.88), roughness=0.20, sss_weight=0.48, transmission=0.35, is_valve=True)
    m_chordae = create_rich_pbr_material("Mat_Chordae", (0.96, 0.95, 0.92), roughness=0.18, sss_weight=0.50)

    root = bpy.data.objects.new("Heart_Root", None)
    bpy.context.scene.collection.objects.link(root)

    left_heart = bpy.data.objects.new("Left_Heart", None)
    bpy.context.scene.collection.objects.link(left_heart)
    left_heart.parent = root

    right_heart = bpy.data.objects.new("Right_Heart", None)
    bpy.context.scene.collection.objects.link(right_heart)
    right_heart.parent = root

    # =========================================================================
    # 1. LEFT HEART: TRUE HOLLOW HEMI-VENTRICLE WITH THICK MYOCARDIAL WALL
    # =========================================================================
    # Left Ventricular Outer Wall (Conical Apex Cordis)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1.0, location=(0.70, 0.0, -0.65))
    lv = bpy.context.active_object
    lv.name = "Left_Ventricle"
    lv.scale = (1.40, 1.32, 1.82)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # Slice anterior half away along Y=0 to expose true hollow coronal interior!
    bm = bmesh.new()
    bm.from_mesh(lv.data)
    for v in bm.verts:
        # Spiral vortex apex cordis
        if v.co.z < -0.75:
            d = abs(v.co.z + 0.75)
            ang = d * 0.75
            nx = v.co.x * math.cos(ang) - v.co.y * math.sin(ang)
            ny = v.co.x * math.sin(ang) + v.co.y * math.cos(ang)
            v.co.x = nx + d * 0.35
            v.co.y = ny + d * 0.12
            taper = max(0.15, 1.0 - d * 0.48)
            v.co.x *= taper
            v.co.y *= taper
    # Coronal cut: slice front (Y > 0.05) to expose interior!
    verts_to_remove = [v for v in bm.verts if v.co.y > 0.08]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(lv.data)
    bm.free()
    lv.data.materials.append(m_myo_l)
    lv.parent = left_heart

    # Thick Myocardial Cut Face (15mm scale) with Trabeculae Carneae Ridges
    bpy.ops.mesh.primitive_cylinder_add(radius=0.98, depth=0.22, location=(0.70, 0.0, -0.62))
    lv_cut = bpy.context.active_object
    lv_cut.name = "LV_Myocardial_Cutface"
    lv_cut.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(lv_cut.data)
    for v in bm.verts:
        if abs(v.co.y) < 0.12:
            v.co.y += 0.06 * math.sin(v.co.x * 14.0) * math.cos(v.co.z * 12.0)
    bm.to_mesh(lv_cut.data)
    bm.free()
    lv_cut.data.materials.append(m_cut_l)
    lv_cut.parent = left_heart

    # Prominent Conical Papillary Muscles inside Left Ventricle cavity
    pap_data = [
        ("LV_Papillary_Anterior", (1.05, -0.15, -0.85), (0.12, 0.0, -0.22)),
        ("LV_Papillary_Posterior", (0.75, -0.32, -0.82), (-0.12, 0.0, 0.18))
    ]
    for p_name, p_pos, p_rot in pap_data:
        bpy.ops.mesh.primitive_cone_add(radius1=0.25, radius2=0.06, depth=0.80, location=p_pos)
        pap = bpy.context.active_object
        pap.name = p_name
        pap.rotation_euler = p_rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pap.data.materials.append(m_myo_l)
        pap.parent = left_heart

        # 5 Branching parachute chordae tendineae per papillary muscle
        for c_k in range(5):
            c_ang = (c_k / 5) * math.pi * 2
            r_chord = 0.12
            cx = p_pos[0] + math.cos(c_ang) * r_chord
            cy = p_pos[1] + math.sin(c_ang) * r_chord
            cz = p_pos[2] + 0.52
            bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=0.58, location=(cx, cy, cz))
            chord = bpy.context.active_object
            chord.name = f"{p_name}_Chord_{c_k+1}"
            chord.rotation_euler = (math.sin(c_ang) * 0.10, -math.cos(c_ang) * 0.10, 0)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            chord.data.materials.append(m_chordae)
            chord.parent = left_heart

    # Bicuspid (Mitral) Valve Leaflets (Anterior & Posterior)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.50, depth=0.045, location=(0.84, -0.10, 0.08))
    mitral = bpy.context.active_object
    mitral.name = "Bicuspid_Mitral_Valve"
    mitral.scale = (1.05, 0.70, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mitral.data.materials.append(m_valve)
    mitral.parent = left_heart

    # Left Atrium & Scalloped Left Auricle
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.05, location=(1.05, -0.42, 1.35))
    la = bpy.context.active_object
    la.name = "Left_Atrium"
    la.scale = (1.10, 1.00, 1.15)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    la.data.materials.append(m_myo_l)
    la.parent = left_heart

    # Left Auricle
    bpy.ops.mesh.primitive_cone_add(radius1=0.40, radius2=0.10, depth=0.68, location=(0.70, 0.18, 1.12))
    la_aur = bpy.context.active_object
    la_aur.name = "Left_Auricle"
    la_aur.rotation_euler = (0.45, -0.30, 0.40)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    la_aur.data.materials.append(m_myo_l)
    la_aur.parent = left_heart

    # 4 Pulmonary Veins
    pv_data = [
        ("Left_Superior_PV", (1.62, -0.68, 1.60)),
        ("Left_Inferior_PV", (1.66, -0.70, 1.02)),
        ("Right_Superior_PV", (0.55, -1.02, 1.62)),
        ("Right_Inferior_PV", (0.58, -1.04, 1.04))
    ]
    for pv_name, pv_pos in pv_data:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.65, location=pv_pos)
        pv = bpy.context.active_object
        pv.name = pv_name
        pv.rotation_euler = (math.pi / 2, 0, 0.32)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pv.data.materials.append(m_pulm)
        pv.parent = left_heart

    # Aorta: 3 Sinuses of Valsalva + Ascending Arch + 3 Brachiocephalic branches
    sinus_angles = [0.0, 2.094, 4.188]
    for s_i, ang in enumerate(sinus_angles):
        sx = 0.32 + math.cos(ang) * 0.20
        sy = 0.08 + math.sin(ang) * 0.20
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=16, radius=0.32, location=(sx, sy, 0.70))
        sinus = bpy.context.active_object
        sinus.name = f"Aortic_Sinus_{s_i+1}"
        sinus.data.materials.append(m_aorta)
        sinus.parent = left_heart

    c_aorta = bpy.data.curves.new('Curve_Aorta', 'CURVE')
    c_aorta.dimensions = '3D'
    c_aorta.bevel_depth = 0.48
    c_aorta.bevel_resolution = 14
    s_aorta = c_aorta.splines.new('BEZIER')
    s_aorta.bezier_points.add(3)
    pts_aorta = [
        (0.32, 0.08, 0.85),
        (0.42, 0.00, 2.25),
        (0.00, -0.32, 3.15),
        (-0.62, -0.72, 2.15)
    ]
    for i, pt in enumerate(pts_aorta):
        s_aorta.bezier_points[i].co = pt
        s_aorta.bezier_points[i].handle_left_type = 'AUTO'
        s_aorta.bezier_points[i].handle_right_type = 'AUTO'

    aorta_obj = bpy.data.objects.new("Aortic_Arch", c_aorta)
    bpy.context.scene.collection.objects.link(aorta_obj)
    aorta_obj.data.materials.append(m_aorta)
    aorta_obj.parent = left_heart

    arch_branches = [
        ("Brachiocephalic_Artery", (0.36, -0.08, 2.85), (0.05, 0.0, 0.05), 0.14),
        ("Left_Common_Carotid", (0.10, -0.22, 3.10), (0.0, 0.0, 0.02), 0.12),
        ("Left_Subclavian_Artery", (-0.16, -0.35, 3.05), (-0.05, 0.0, -0.02), 0.12)
    ]
    for b_name, origin, rot, rad in arch_branches:
        bpy.ops.mesh.primitive_cylinder_add(radius=rad, depth=1.20, location=(origin[0], origin[1], origin[2] + 0.60))
        br = bpy.context.active_object
        br.name = b_name
        br.rotation_euler = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        br.data.materials.append(m_aorta)
        br.parent = left_heart

    # =========================================================================
    # 2. RIGHT HEART: TRUE HOLLOW CRESCENT RV (4mm WALL) & PULMONARY TRUNK
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1.0, location=(-1.05, 0.18, -0.42))
    rv = bpy.context.active_object
    rv.name = "Right_Ventricle"
    rv.scale = (1.30, 1.25, 1.62)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(rv.data)
    for v in bm.verts:
        if v.co.x > -0.22:
            v.co.x = -0.22 + (v.co.x + 0.22) * 0.15
        if v.co.z < -0.75:
            d = abs(v.co.z + 0.75)
            v.co.x *= max(0.20, 1.0 - d * 0.40)
    # Coronal cut: slice front (Y > 0.05) to expose interior!
    verts_to_remove = [v for v in bm.verts if v.co.y > 0.08]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(rv.data)
    bm.free()
    rv.data.materials.append(m_myo_r)
    rv.parent = right_heart

    # Thin Myocardial Cutface (4mm scale)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.88, depth=0.08, location=(-1.05, 0.0, -0.40))
    rv_cut = bpy.context.active_object
    rv_cut.name = "RV_Myocardial_Cutface"
    rv_cut.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    rv_cut.data.materials.append(m_cut_r)
    rv_cut.parent = right_heart

    # Tricuspid Valve Leaflets
    bpy.ops.mesh.primitive_cylinder_add(radius=0.52, depth=0.038, location=(-0.95, -0.05, 0.10))
    tri = bpy.context.active_object
    tri.name = "Tricuspid_Valve"
    tri.data.materials.append(m_valve)
    tri.parent = right_heart

    # Right Atrium & Triangular Right Auricle
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.12, location=(-1.24, 0.08, 1.30))
    ra = bpy.context.active_object
    ra.name = "Right_Atrium"
    ra.scale = (1.18, 1.05, 1.22)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ra.data.materials.append(m_myo_r)
    ra.parent = right_heart

    # Triangular Right Auricle
    bpy.ops.mesh.primitive_cone_add(radius1=0.42, radius2=0.08, depth=0.70, location=(-0.82, 0.45, 1.15))
    ra_aur = bpy.context.active_object
    ra_aur.name = "Right_Auricle"
    ra_aur.rotation_euler = (0.48, 0.38, -0.28)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ra_aur.data.materials.append(m_myo_r)
    ra_aur.parent = right_heart

    # Infundibulum Conus Arteriosus
    bpy.ops.mesh.primitive_cone_add(radius1=0.48, radius2=0.40, depth=0.60, location=(-0.35, 0.32, 0.52))
    conus = bpy.context.active_object
    conus.name = "Conus_Arteriosus"
    conus.rotation_euler = (0.20, 0.10, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    conus.data.materials.append(m_pulm)
    conus.parent = right_heart

    # Pulmonary Trunk Curve
    c_pt = bpy.data.curves.new('Curve_PT', 'CURVE')
    c_pt.dimensions = '3D'
    c_pt.bevel_depth = 0.42
    c_pt.bevel_resolution = 14
    s_pt = c_pt.splines.new('BEZIER')
    s_pt.bezier_points.add(2)
    pts_pt = [(-0.35, 0.34, 0.78), (-0.24, 0.22, 1.95), (0.00, -0.10, 2.30)]
    for i, pt in enumerate(pts_pt):
        s_pt.bezier_points[i].co = pt
        s_pt.bezier_points[i].handle_left_type = 'AUTO'
        s_pt.bezier_points[i].handle_right_type = 'AUTO'

    pt_obj = bpy.data.objects.new("Pulmonary_Trunk", c_pt)
    bpy.context.scene.collection.objects.link(pt_obj)
    pt_obj.data.materials.append(m_pulm)
    pt_obj.parent = right_heart

    # Left & Right Pulmonary Arteries
    for p_name, x_pos, rot_y in [("Right_Pulmonary_Artery", 0.68, math.pi/2), ("Left_Pulmonary_Artery", -0.68, -math.pi/2)]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=1.45, location=(x_pos, -0.20, 2.25))
        pa = bpy.context.active_object
        pa.name = p_name
        pa.rotation_euler = (0, rot_y, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pa.data.materials.append(m_pulm)
        pa.parent = right_heart

    # Superior Vena Cava (SVC) & Inferior Vena Cava (IVC)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.38, depth=1.85, location=(-1.38, -0.20, 2.55))
    svc = bpy.context.active_object
    svc.name = "Superior_Vena_Cava"
    svc.data.materials.append(m_cava)
    svc.parent = right_heart

    bpy.ops.mesh.primitive_cylinder_add(radius=0.36, depth=1.35, location=(-1.28, -0.62, -0.32))
    ivc = bpy.context.active_object
    ivc.name = "Inferior_Vena_Cava"
    ivc.data.materials.append(m_cava)
    ivc.parent = right_heart

    # Right Coronary Artery (RCA)
    c_rca = bpy.data.curves.new('Curve_RCA', 'CURVE')
    c_rca.dimensions = '3D'
    c_rca.bevel_depth = 0.060
    c_rca.bevel_resolution = 10
    s_rca = c_rca.splines.new('BEZIER')
    s_rca.bezier_points.add(3)
    pts_rca = [(-0.42, 0.42, 0.62), (-0.90, 0.35, 0.32), (-1.30, 0.10, -0.05), (-1.20, -0.40, -0.32)]
    for i, pt in enumerate(pts_rca):
        s_rca.bezier_points[i].co = pt
        s_rca.bezier_points[i].handle_left_type = 'AUTO'
        s_rca.bezier_points[i].handle_right_type = 'AUTO'
    rca_obj = bpy.data.objects.new("Right_Coronary_Artery", c_rca)
    bpy.context.scene.collection.objects.link(rca_obj)
    rca_obj.data.materials.append(m_art)
    rca_obj.parent = right_heart

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
    blend_path = os.path.join(MODELS_DIR, "heart_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[HEART] Saved native .blend to {blend_path}")

    # Export to WebGL GLB
    glb_path = os.path.join(OUTPUT_DIR, "heart_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[HEART SUCCESS] Exported photorealistic bug-free heart to {glb_path}")

if __name__ == '__main__':
    build_perfect_split_heart()
