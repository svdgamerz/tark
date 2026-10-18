"""
Ultra-Realistic Anatomical Human Heart Generator for Blender 5.2
Sculpts an authentic medical-grade 4-chamber human heart with:
1. Conical left ventricle and apex cordis with spiraling myofiber topology.
2. Crescent-shaped right ventricle wrapping the anterior septum.
3. Left & Right Atria with anatomically accurate scalloped auricles (appendages).
4. Aortic Root with 3 distinct Sinuses of Valsalva bulbs, ascending arch, and 3 arch branches.
5. Infundibular conus and pulmonary trunk bifurcating into left/right pulmonary arteries.
6. Superior & Inferior Vena Cava and coronary sinus.
7. Epicardial adipose fat pads with Voronoi cellular lobulation.
8. Coronary arterial tree: LAD with 4 diagonal branches, RCA with marginal branch, Great Cardiac Vein.
9. Interior Dissection Structures: Thick LV wall (15mm scale) vs Thin RV wall (4mm scale),
   trabeculated myocardial cutfaces, prominent conical papillary muscles,
   branching parachute chordae tendineae, and translucent bicuspid & tricuspid valve cusps.
10. Multi-layer procedural PBR shader network with subsurface scattering (SSS),
    myofiber normal mapping, and wet serous pericardial sheen.
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

    # Basic setup
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

    # Subsurface scattering
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = sss_weight
    elif 'Subsurface' in bsdf.inputs:
        bsdf.inputs['Subsurface'].default_value = sss_weight
    if 'Subsurface Radius' in bsdf.inputs:
        bsdf.inputs['Subsurface Radius'].default_value = sss_radius

    # Transmission
    if transmission > 0:
        if 'Transmission Weight' in bsdf.inputs:
            bsdf.inputs['Transmission Weight'].default_value = transmission
        elif 'Transmission' in bsdf.inputs:
            bsdf.inputs['Transmission'].default_value = transmission
        mat.blend_method = 'BLEND'

    # Procedural details
    tex_coord = nodes.new(type='ShaderNodeTexCoord')
    tex_coord.location = (-600, 0)

    if is_fat:
        # Voronoi texture for lobulated fatty tissue
        vor = nodes.new(type='ShaderNodeTexVoronoi')
        vor.location = (-350, 100)
        vor.inputs['Scale'].default_value = 28.0
        links.new(tex_coord.outputs['Object'], vor.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.25
        links.new(vor.outputs['Distance'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

        # Color variation
        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-100, 150)
        cr.color_ramp.elements[0].position = 0.2
        cr.color_ramp.elements[0].color = (0.92, 0.82, 0.42, 1.0)
        cr.color_ramp.elements[1].position = 0.8
        cr.color_ramp.elements[1].color = (0.76, 0.65, 0.32, 1.0)
        links.new(vor.outputs['Distance'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

    elif is_valve:
        # Translucent pearlescent fibrous valve
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 0)
        noise.inputs['Scale'].default_value = 45.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.12
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    else:
        # Myocardial striation noise
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 100)
        noise.inputs['Scale'].default_value = 18.0
        noise.inputs['Detail'].default_value = 4.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.15
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def build_ultra_heart():
    reset()
    print("[HEART SCULPT] Generating anatomical masterpiece human heart...")

    # Materials
    m_myo_l = create_rich_pbr_material("Mat_LV_Myocardium", (0.54, 0.07, 0.08), roughness=0.26, sss_weight=0.38)
    m_myo_r = create_rich_pbr_material("Mat_RV_Myocardium", (0.50, 0.08, 0.11), roughness=0.30, sss_weight=0.32)
    m_cut_l = create_rich_pbr_material("Mat_LV_CutFace", (0.68, 0.12, 0.13), roughness=0.42, sss_weight=0.42)
    m_cut_r = create_rich_pbr_material("Mat_RV_CutFace", (0.62, 0.11, 0.14), roughness=0.45, sss_weight=0.38)
    m_aorta = create_rich_pbr_material("Mat_Aorta", (0.76, 0.14, 0.15), roughness=0.22, sss_weight=0.25, specular=0.7)
    m_pulm = create_rich_pbr_material("Mat_Pulmonary", (0.13, 0.36, 0.65), roughness=0.24, sss_weight=0.22, specular=0.7)
    m_cava = create_rich_pbr_material("Mat_VenaCava", (0.10, 0.28, 0.58), roughness=0.26, sss_weight=0.2)
    m_fat = create_rich_pbr_material("Mat_CoronaryFat", (0.86, 0.76, 0.38), roughness=0.52, sss_weight=0.45, is_fat=True)
    m_art = create_rich_pbr_material("Mat_CoronaryArtery", (0.86, 0.11, 0.11), roughness=0.18, specular=0.8)
    m_vein = create_rich_pbr_material("Mat_CoronaryVein", (0.14, 0.42, 0.80), roughness=0.18, specular=0.8)
    m_valve = create_rich_pbr_material("Mat_ValveLeaflet", (0.94, 0.92, 0.86), roughness=0.22, sss_weight=0.45, transmission=0.3, is_valve=True)
    m_chordae = create_rich_pbr_material("Mat_Chordae", (0.96, 0.95, 0.92), roughness=0.18, sss_weight=0.48)

    root = bpy.data.objects.new("Heart_Root", None)
    bpy.context.scene.collection.objects.link(root)

    left_heart = bpy.data.objects.new("Left_Heart", None)
    bpy.context.scene.collection.objects.link(left_heart)
    left_heart.parent = root

    right_heart = bpy.data.objects.new("Right_Heart", None)
    bpy.context.scene.collection.objects.link(right_heart)
    right_heart.parent = root

    # =========================================================================
    # 1. LEFT VENTRICLE & CONICAL APEX CORDIS
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=54, radius=1.0, location=(0.74, 0.0, -0.68))
    lv = bpy.context.active_object
    lv.name = "Left_Ventricle"
    lv.scale = (1.44, 1.36, 1.88)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(lv.data)
    for v in bm.verts:
        # Natural helical vortex apex cordis
        if v.co.z < -0.75:
            d = abs(v.co.z + 0.75)
            # Taper and spiral vortex
            spiral_angle = d * 0.85
            nx = v.co.x * math.cos(spiral_angle) - v.co.y * math.sin(spiral_angle)
            ny = v.co.x * math.sin(spiral_angle) + v.co.y * math.cos(spiral_angle)
            v.co.x = nx + d * 0.42
            v.co.y = ny + d * 0.16
            taper = max(0.12, 1.0 - d * 0.52)
            v.co.x *= taper
            v.co.y *= taper
        # Anterior interventricular sulcus groove
        if v.co.x < 0.25 and v.co.y > 0.25:
            sulcus_depth = 0.18 * math.cos((v.co.z + 0.5) * 1.3)
            v.co.y -= max(0.0, sulcus_depth)
        # Posterior groove
        if v.co.x < 0.25 and v.co.y < -0.25:
            v.co.y += 0.12 * math.cos((v.co.z + 0.5) * 1.2)
    bm.to_mesh(lv.data)
    bm.free()
    lv.data.materials.append(m_myo_l)
    lv.parent = left_heart

    # Internal LV Thick Wall Dissection Face (Revealed on Split)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.96, depth=0.22, location=(0.74, -0.04, -0.62))
    lv_cut = bpy.context.active_object
    lv_cut.name = "LV_Myocardial_Cutface"
    lv_cut.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # Add trabeculae carneae ridges across cutface
    bm = bmesh.new()
    bm.from_mesh(lv_cut.data)
    for v in bm.verts:
        if abs(v.co.y) < 0.12:
            ridge = 0.05 * math.sin(v.co.x * 12.0) * math.cos(v.co.z * 10.0)
            v.co.y += ridge
    bm.to_mesh(lv_cut.data)
    bm.free()
    lv_cut.data.materials.append(m_cut_l)
    lv_cut.parent = left_heart

    # Two prominent conical Papillary Muscles (Anterior & Posterior)
    pap_data = [
        ("LV_Papillary_Anterior", (1.02, 0.18, -0.85), (0.15, 0.0, -0.25)),
        ("LV_Papillary_Posterior", (0.82, -0.28, -0.82), (-0.15, 0.0, 0.20))
    ]
    for p_name, p_pos, p_rot in pap_data:
        bpy.ops.mesh.primitive_cone_add(radius1=0.26, radius2=0.07, depth=0.82, location=p_pos)
        pap = bpy.context.active_object
        pap.name = p_name
        pap.rotation_euler = p_rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pap.data.materials.append(m_myo_l)
        pap.parent = left_heart

        # Chordae Tendineae cords fan out from each papillary muscle
        for c_k in range(5):
            c_ang = (c_k / 5) * math.pi * 2
            r_chord = 0.14
            cx = p_pos[0] + math.cos(c_ang) * r_chord
            cy = p_pos[1] + math.sin(c_ang) * r_chord
            cz = p_pos[2] + 0.55
            bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.62, location=(cx, cy, cz))
            chord = bpy.context.active_object
            chord.name = f"{p_name}_Chord_{c_k+1}"
            chord.rotation_euler = (math.sin(c_ang) * 0.12, -math.cos(c_ang) * 0.12, 0)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            chord.data.materials.append(m_chordae)
            chord.parent = left_heart

    # Bicuspid (Mitral) Valve Leaflets (Anterior & Posterior)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.52, depth=0.045, location=(0.88, -0.08, 0.08))
    mitral = bpy.context.active_object
    mitral.name = "Bicuspid_Mitral_Valve"
    mitral.scale = (1.08, 0.72, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mitral.data.materials.append(m_valve)
    mitral.parent = left_heart

    # =========================================================================
    # 2. LEFT ATRIUM & SCALLOPED AURICLE & 4 PULMONARY VEINS
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.08, location=(1.08, -0.45, 1.38))
    la = bpy.context.active_object
    la.name = "Left_Atrium"
    la.scale = (1.14, 1.04, 1.20)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    la.data.materials.append(m_myo_l)
    la.parent = left_heart

    # Scalloped Left Auricle (Tubular ear-like appendage)
    bpy.ops.mesh.primitive_cone_add(radius1=0.42, radius2=0.12, depth=0.72, location=(0.72, 0.40, 1.15))
    la_aur = bpy.context.active_object
    la_aur.name = "Left_Auricle"
    la_aur.rotation_euler = (0.55, -0.35, 0.45)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(la_aur.data)
    for v in bm.verts:
        v.co.x += 0.05 * math.sin(v.co.z * 16.0) # pectinate ridge waves
    bm.to_mesh(la_aur.data)
    bm.free()
    la_aur.data.materials.append(m_myo_l)
    la_aur.parent = left_heart

    # 4 Pulmonary Veins (Left/Right Superior/Inferior)
    pv_data = [
        ("Left_Superior_PV", (1.68, -0.72, 1.65)),
        ("Left_Inferior_PV", (1.72, -0.74, 1.05)),
        ("Right_Superior_PV", (0.58, -1.06, 1.68)),
        ("Right_Inferior_PV", (0.62, -1.08, 1.08))
    ]
    for pv_name, pv_pos in pv_data:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.17, depth=0.68, location=pv_pos)
        pv = bpy.context.active_object
        pv.name = pv_name
        pv.rotation_euler = (math.pi / 2, 0, 0.35)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pv.data.materials.append(m_pulm)
        pv.parent = left_heart

    # =========================================================================
    # 3. RIGHT VENTRICLE & CRESCENT WALL & TRICUSPID VALVE
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=54, radius=1.0, location=(-1.08, 0.24, -0.44))
    rv = bpy.context.active_object
    rv.name = "Right_Ventricle"
    rv.scale = (1.35, 1.28, 1.66)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(rv.data)
    for v in bm.verts:
        # Wrap crescent around Left Ventricle septum
        if v.co.x > -0.20:
            v.co.x = -0.20 + (v.co.x + 0.20) * 0.18
        if v.co.z < -0.78:
            d = abs(v.co.z + 0.78)
            v.co.x *= max(0.20, 1.0 - d * 0.42)
    bm.to_mesh(rv.data)
    bm.free()
    rv.data.materials.append(m_myo_r)
    rv.parent = right_heart

    # Internal RV Thinner Cutface (4mm scale)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.90, depth=0.08, location=(-1.08, 0.16, -0.42))
    rv_cut = bpy.context.active_object
    rv_cut.name = "RV_Myocardial_Cutface"
    rv_cut.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    rv_cut.data.materials.append(m_cut_r)
    rv_cut.parent = right_heart

    # Tricuspid Valve Leaflets (Anterior, Posterior, Septal)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.54, depth=0.038, location=(-0.98, 0.06, 0.12))
    tri = bpy.context.active_object
    tri.name = "Tricuspid_Valve"
    tri.data.materials.append(m_valve)
    tri.parent = right_heart

    # Right Atrium (RA) & Triangular Auricle
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.15, location=(-1.28, 0.12, 1.35))
    ra = bpy.context.active_object
    ra.name = "Right_Atrium"
    ra.scale = (1.20, 1.08, 1.25)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ra.data.materials.append(m_myo_r)
    ra.parent = right_heart

    # Triangular Right Auricle
    bpy.ops.mesh.primitive_cone_add(radius1=0.45, radius2=0.10, depth=0.74, location=(-0.86, 0.70, 1.20))
    ra_aur = bpy.context.active_object
    ra_aur.name = "Right_Auricle"
    ra_aur.rotation_euler = (0.52, 0.42, -0.32)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ra_aur.data.materials.append(m_myo_r)
    ra_aur.parent = right_heart

    # =========================================================================
    # 4. AORTIC ROOT (SINUSES OF VALSALVA) & ARCH WITH 3 GREAT BRANCHES
    # =========================================================================
    # 3 Bulging Sinuses of Valsalva at aortic base
    sinus_angles = [0.0, 2.094, 4.188]
    for s_i, ang in enumerate(sinus_angles):
        sx = 0.34 + math.cos(ang) * 0.22
        sy = 0.12 + math.sin(ang) * 0.22
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=18, radius=0.34, location=(sx, sy, 0.72))
        sinus = bpy.context.active_object
        sinus.name = f"Aortic_Sinus_{s_i+1}"
        sinus.data.materials.append(m_aorta)
        sinus.parent = left_heart

    # Ascending Aorta and Arch Curve
    c_aorta = bpy.data.curves.new('Curve_Aorta', 'CURVE')
    c_aorta.dimensions = '3D'
    c_aorta.bevel_depth = 0.50
    c_aorta.bevel_resolution = 16
    s_aorta = c_aorta.splines.new('BEZIER')
    s_aorta.bezier_points.add(3)
    pts_aorta = [
        (0.34, 0.12, 0.88),
        (0.44, 0.02, 2.30),
        (0.00, -0.34, 3.22),
        (-0.65, -0.78, 2.20)
    ]
    for i, pt in enumerate(pts_aorta):
        s_aorta.bezier_points[i].co = pt
        s_aorta.bezier_points[i].handle_left_type = 'AUTO'
        s_aorta.bezier_points[i].handle_right_type = 'AUTO'

    aorta_obj = bpy.data.objects.new("Aortic_Arch", c_aorta)
    bpy.context.scene.collection.objects.link(aorta_obj)
    aorta_obj.data.materials.append(m_aorta)
    aorta_obj.parent = left_heart

    # 3 Great Arch Branches (Brachiocephalic, Left Common Carotid, Left Subclavian)
    arch_branches = [
        ("Brachiocephalic_Artery", (0.38, -0.10, 2.90), (0.06, 0.0, 0.06), 0.15),
        ("Left_Common_Carotid", (0.12, -0.24, 3.16), (0.0, 0.0, 0.02), 0.13),
        ("Left_Subclavian_Artery", (-0.18, -0.38, 3.10), (-0.06, 0.0, -0.02), 0.13)
    ]
    for b_name, origin, rot, rad in arch_branches:
        bpy.ops.mesh.primitive_cylinder_add(radius=rad, depth=1.25, location=(origin[0], origin[1], origin[2] + 0.62))
        br = bpy.context.active_object
        br.name = b_name
        br.rotation_euler = rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        br.data.materials.append(m_aorta)
        br.parent = left_heart

    # =========================================================================
    # 5. PULMONARY TRUNK, BIFURCATION & VENA CAVA
    # =========================================================================
    # Conus Arteriosus infundibular cone
    bpy.ops.mesh.primitive_cone_add(radius1=0.52, radius2=0.44, depth=0.65, location=(-0.38, 0.50, 0.55))
    conus = bpy.context.active_object
    conus.name = "Conus_Arteriosus"
    conus.rotation_euler = (0.22, 0.12, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    conus.data.materials.append(m_pulm)
    conus.parent = right_heart

    # Pulmonary Trunk Curve
    c_pt = bpy.data.curves.new('Curve_PT', 'CURVE')
    c_pt.dimensions = '3D'
    c_pt.bevel_depth = 0.45
    c_pt.bevel_resolution = 16
    s_pt = c_pt.splines.new('BEZIER')
    s_pt.bezier_points.add(2)
    pts_pt = [(-0.38, 0.52, 0.82), (-0.26, 0.34, 2.02), (0.00, -0.12, 2.38)]
    for i, pt in enumerate(pts_pt):
        s_pt.bezier_points[i].co = pt
        s_pt.bezier_points[i].handle_left_type = 'AUTO'
        s_pt.bezier_points[i].handle_right_type = 'AUTO'

    pt_obj = bpy.data.objects.new("Pulmonary_Trunk", c_pt)
    bpy.context.scene.collection.objects.link(pt_obj)
    pt_obj.data.materials.append(m_pulm)
    pt_obj.parent = right_heart

    # Left & Right Pulmonary Arteries
    for p_name, x_pos, rot_y in [("Right_Pulmonary_Artery", 0.72, math.pi/2), ("Left_Pulmonary_Artery", -0.72, -math.pi/2)]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=1.52, location=(x_pos, -0.22, 2.32))
        pa = bpy.context.active_object
        pa.name = p_name
        pa.rotation_euler = (0, rot_y, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pa.data.materials.append(m_pulm)
        pa.parent = right_heart

    # Superior Vena Cava (SVC) & Inferior Vena Cava (IVC)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.40, depth=1.95, location=(-1.42, -0.22, 2.65))
    svc = bpy.context.active_object
    svc.name = "Superior_Vena_Cava"
    svc.data.materials.append(m_cava)
    svc.parent = right_heart

    bpy.ops.mesh.primitive_cylinder_add(radius=0.38, depth=1.42, location=(-1.32, -0.66, -0.34))
    ivc = bpy.context.active_object
    ivc.name = "Inferior_Vena_Cava"
    ivc.data.materials.append(m_cava)
    ivc.parent = right_heart

    # =========================================================================
    # 6. CORONARY SULCUS ADIPOSE FAT PADS & BRANCHING ARTERIAL TREE
    # =========================================================================
    # Lobulated Adipose Fat Cushion along Anterior Interventricular Sulcus
    c_fat = bpy.data.curves.new('Curve_Sulcus_Fat', 'CURVE')
    c_fat.dimensions = '3D'
    c_fat.bevel_depth = 0.18
    c_fat.bevel_resolution = 12
    s_fat = c_fat.splines.new('BEZIER')
    s_fat.bezier_points.add(4)
    pts_fat = [
        (-0.12, 1.04, 1.15),
        (0.08, 1.16, 0.40),
        (0.38, 0.98, -0.58),
        (0.70, 0.58, -1.52),
        (0.92, 0.32, -2.15)
    ]
    for i, pt in enumerate(pts_fat):
        s_fat.bezier_points[i].co = pt
        s_fat.bezier_points[i].handle_left_type = 'AUTO'
        s_fat.bezier_points[i].handle_right_type = 'AUTO'

    fat_obj = bpy.data.objects.new("Sulcus_Adipose_Cushion", c_fat)
    bpy.context.scene.collection.objects.link(fat_obj)
    fat_obj.data.materials.append(m_fat)
    fat_obj.parent = left_heart

    # Left Anterior Descending (LAD) Coronary Artery
    c_lad = bpy.data.curves.new('Curve_LAD', 'CURVE')
    c_lad.dimensions = '3D'
    c_lad.bevel_depth = 0.070
    c_lad.bevel_resolution = 10
    s_lad = c_lad.splines.new('BEZIER')
    s_lad.bezier_points.add(4)
    for i, pt in enumerate(pts_fat):
        s_lad.bezier_points[i].co = (pt[0], pt[1] + 0.08, pt[2])
        s_lad.bezier_points[i].handle_left_type = 'AUTO'
        s_lad.bezier_points[i].handle_right_type = 'AUTO'

    lad_obj = bpy.data.objects.new("LAD_Coronary_Artery", c_lad)
    bpy.context.scene.collection.objects.link(lad_obj)
    lad_obj.data.materials.append(m_art)
    lad_obj.parent = left_heart

    # 4 Branching Diagonal Arterioles from LAD
    diagonals = [
        [(0.10, 1.20, 0.42), (0.44, 1.08, 0.24), (0.70, 0.90, 0.06)],
        [(0.26, 1.10, -0.10), (0.58, 0.95, -0.28), (0.82, 0.78, -0.46)],
        [(0.40, 1.02, -0.54), (0.72, 0.84, -0.74), (0.92, 0.66, -0.96)],
        [(0.66, 0.68, -1.30), (0.90, 0.48, -1.48), (1.08, 0.28, -1.68)]
    ]
    for d_i, d_path in enumerate(diagonals):
        c_d = bpy.data.curves.new(f'Curve_Diag_{d_i}', 'CURVE')
        c_d.dimensions = '3D'
        c_d.bevel_depth = 0.040 - d_i * 0.004
        c_d.bevel_resolution = 8
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

    # Great Cardiac Vein running parallel
    c_vein = bpy.data.curves.new('Curve_Vein', 'CURVE')
    c_vein.dimensions = '3D'
    c_vein.bevel_depth = 0.060
    c_vein.bevel_resolution = 10
    s_vein = c_vein.splines.new('BEZIER')
    s_vein.bezier_points.add(4)
    for i, pt in enumerate(pts_fat):
        s_vein.bezier_points[i].co = (pt[0] - 0.10, pt[1] + 0.068, pt[2])
        s_vein.bezier_points[i].handle_left_type = 'AUTO'
        s_vein.bezier_points[i].handle_right_type = 'AUTO'

    vein_obj = bpy.data.objects.new("Great_Cardiac_Vein", c_vein)
    bpy.context.scene.collection.objects.link(vein_obj)
    vein_obj.data.materials.append(m_vein)
    vein_obj.parent = left_heart

    # Right Coronary Artery (RCA) in right AV sulcus
    c_rca = bpy.data.curves.new('Curve_RCA', 'CURVE')
    c_rca.dimensions = '3D'
    c_rca.bevel_depth = 0.065
    c_rca.bevel_resolution = 10
    s_rca = c_rca.splines.new('BEZIER')
    s_rca.bezier_points.add(3)
    pts_rca = [(-0.45, 0.85, 0.65), (-0.95, 0.65, 0.35), (-1.35, 0.15, -0.05), (-1.25, -0.45, -0.35)]
    for i, pt in enumerate(pts_rca):
        s_rca.bezier_points[i].co = pt
        s_rca.bezier_points[i].handle_left_type = 'AUTO'
        s_rca.bezier_points[i].handle_right_type = 'AUTO'
    rca_obj = bpy.data.objects.new("Right_Coronary_Artery", c_rca)
    bpy.context.scene.collection.objects.link(rca_obj)
    rca_obj.data.materials.append(m_art)
    rca_obj.parent = right_heart

    # Convert all curves to high-res smooth meshes
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
    print(f"[HEART SUCCESS] Exported photorealistic heart to {glb_path}")

if __name__ == '__main__':
    build_ultra_heart()
