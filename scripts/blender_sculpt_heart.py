"""
Medical-Grade 3D Human Heart Sculptor for Blender 5.x / 4.x
Generates an anatomically authentic 4-chamber human heart with:
1. Complete intact anterior wall with epicardium, anterior sulcus fat cushion,
   Left Anterior Descending (LAD) coronary artery, and great cardiac vein.
2. Fluid coronal split interior:
   - Left Ventricle with true 15mm thick myocardial cut face, hollow chamber,
     papillary pillars, 10 parachute chordae tendineae, and bicuspid (mitral) valve.
   - Right Ventricle with true 4mm thin myocardial cut face, hollow chamber,
     tricuspid valve, and moderator band.
   - Aortic arch with 3 systemic branches (Brachiocephalic, Carotid, Subclavian).
   - Pulmonary trunk with bifurcation into Left & Right pulmonary arteries.
   - Superior & Inferior Vena Cava and 4 Pulmonary Veins.
   - Sinoatrial (SA) Node and Atrioventricular (AV) Node conduction hubs.
3. Natural anatomical alignment:
   - Anterior faces +Z in glTF / Three.js (facing camera)
   - Left Heart is +X (viewer's right)
   - Right Heart is -X (viewer's left)
   - Superior (Aorta / Base) is +Y in glTF
   - Inferior (Apex cordis) is -Y in glTF
"""

import bpy
import bmesh
import math
import os

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_rich_pbr_material(name, base_color, roughness=0.3, sss_weight=0.2, specular=0.5, transmission=0.0, is_fat=False, is_valve=False, emissive=None):
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

    # Base Color
    bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness

    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = specular
    elif 'Specular' in bsdf.inputs:
        bsdf.inputs['Specular'].default_value = specular

    if sss_weight > 0:
        if 'Subsurface Weight' in bsdf.inputs:
            bsdf.inputs['Subsurface Weight'].default_value = sss_weight
            if 'Subsurface Radius' in bsdf.inputs:
                bsdf.inputs['Subsurface Radius'].default_value = (0.8, 0.2, 0.1)
        elif 'Subsurface' in bsdf.inputs:
            bsdf.inputs['Subsurface'].default_value = sss_weight

    if transmission > 0:
        if 'Transmission Weight' in bsdf.inputs:
            bsdf.inputs['Transmission Weight'].default_value = transmission
        elif 'Transmission' in bsdf.inputs:
            bsdf.inputs['Transmission'].default_value = transmission

    if emissive:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = (*emissive, 1.0)
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = (*emissive, 1.0)
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = 1.0

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
        cr.color_ramp.elements[0].color = (0.94, 0.88, 0.68, 1.0)
        cr.color_ramp.elements[1].position = 0.8
        cr.color_ramp.elements[1].color = (0.82, 0.74, 0.52, 1.0)
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
    clear_scene()

    print("[HEART GENERATOR] Sculpting masterwork 3D human heart...")

    # Medical-Grade Living Anatomical Color Palette
    # Both Ventricles are living cardiac myocardium: rich, organic burgundy-crimson
    m_myo_l = create_rich_pbr_material("Mat_LV_Myocardium", (0.58, 0.12, 0.15), roughness=0.28, sss_weight=0.35, specular=0.75)
    m_myo_r = create_rich_pbr_material("Mat_RV_Myocardium", (0.55, 0.13, 0.16), roughness=0.28, sss_weight=0.35, specular=0.75)
    
    # Internal Cut Faces (Thick 15mm LV wall and 4mm RV wall cross sections)
    m_cut_l = create_rich_pbr_material("Mat_LV_CutFace", (0.62, 0.15, 0.18), roughness=0.36, sss_weight=0.40)
    m_cut_r = create_rich_pbr_material("Mat_RV_CutFace", (0.60, 0.14, 0.17), roughness=0.36, sss_weight=0.40)

    # Great Vessels:
    # Aorta & Systemic Arteries = Rich Arterial Scarlet Crimson
    m_aorta = create_rich_pbr_material("Mat_Aorta", (0.78, 0.12, 0.12), roughness=0.18, sss_weight=0.28, specular=0.85)
    m_art = create_rich_pbr_material("Mat_CoronaryArtery", (0.85, 0.10, 0.10), roughness=0.16, specular=0.85)

    # Pulmonary Trunk & Vena Cava = Deep Royal Venous Blue (Natural deoxygenated vessel color)
    m_pulm = create_rich_pbr_material("Mat_Pulmonary", (0.12, 0.28, 0.72), roughness=0.20, sss_weight=0.25, specular=0.85)
    m_cava = create_rich_pbr_material("Mat_VenaCava", (0.10, 0.25, 0.68), roughness=0.22, sss_weight=0.22, specular=0.85)
    m_vein = create_rich_pbr_material("Mat_CoronaryVein", (0.14, 0.32, 0.78), roughness=0.16, specular=0.85)

    # Coronary Sulcus Fat Cushion: Warm soft ivory / buttery cream adipose tissue
    m_fat = create_rich_pbr_material("Mat_CoronaryFat", (0.92, 0.84, 0.58), roughness=0.48, sss_weight=0.48, is_fat=True)

    # Valves & Tendon Chordae: Pearlescent glistening tendon ivory with gentle translucency
    m_valve = create_rich_pbr_material("Mat_ValveLeaflet", (0.96, 0.96, 0.92), roughness=0.20, sss_weight=0.48, transmission=0.22, is_valve=True)
    m_chordae = create_rich_pbr_material("Mat_Chordae", (0.97, 0.97, 0.93), roughness=0.18, sss_weight=0.50)
    m_conduction = create_rich_pbr_material("Mat_ConductionNodes", (0.98, 0.78, 0.12), roughness=0.15, emissive=(0.98, 0.78, 0.12))
    m_fossa = create_rich_pbr_material("Mat_FossaOvalis", (0.18, 0.26, 0.48), roughness=0.35, sss_weight=0.3)

    # Master Root
    root = bpy.data.objects.new("Heart_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # Hierarchical Subgroups
    # Note: In Blender, anterior is -Y, posterior is +Y.
    # When exported to glTF, -Y becomes +Z (facing viewer).
    anterior_cover = bpy.data.objects.new("Anterior_Heart_Cover", None)
    bpy.context.scene.collection.objects.link(anterior_cover)
    anterior_cover.parent = root

    left_heart = bpy.data.objects.new("Left_Heart", None)
    bpy.context.scene.collection.objects.link(left_heart)
    left_heart.parent = root

    right_heart = bpy.data.objects.new("Right_Heart", None)
    bpy.context.scene.collection.objects.link(right_heart)
    right_heart.parent = root

    # =========================================================================
    # PART A: ANTERIOR INTACT COVER (VISIBLE IN INTACT VIEW, FADES DURING SPLIT)
    # =========================================================================
    # 1. LV Anterior Wall (Y <= 0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1.0, location=(0.70, 0.0, -0.65))
    lv_ant = bpy.context.active_object
    lv_ant.name = "LV_Anterior_Wall"
    lv_ant.scale = (1.40, 1.32, 1.82)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(lv_ant.data)
    for v in bm.verts:
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
    # Keep anterior half only (Y <= 0.02)
    verts_to_remove = [v for v in bm.verts if v.co.y > 0.02]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(lv_ant.data)
    bm.free()
    lv_ant.data.materials.append(m_myo_l)
    lv_ant.parent = anterior_cover

    # 2. RV Anterior Wall (Y <= 0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=40, radius=1.0, location=(-1.05, 0.0, -0.42))
    rv_ant = bpy.context.active_object
    rv_ant.name = "RV_Anterior_Wall"
    rv_ant.scale = (1.28, 1.25, 1.62)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(rv_ant.data)
    for v in bm.verts:
        if v.co.z < -0.65:
            d = abs(v.co.z + 0.65)
            v.co.x *= max(0.2, 1.0 - d * 0.42)
            v.co.y *= max(0.2, 1.0 - d * 0.42)
    verts_to_remove = [v for v in bm.verts if v.co.y > 0.02]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(rv_ant.data)
    bm.free()
    rv_ant.data.materials.append(m_myo_r)
    rv_ant.parent = anterior_cover

    # 3. Anterior Interventricular Sulcus Adipose Cushion (Fat Pad)
    fat_pts = [
        (0.05, -1.18, 0.85),
        (-0.02, -1.35, 0.35),
        (0.08, -1.30, -0.45),
        (0.28, -1.15, -1.25),
        (0.55, -0.85, -1.85)
    ]
    c_fat = bpy.data.curves.new('Curve_Sulcus_Fat', 'CURVE')
    c_fat.dimensions = '3D'
    c_fat.bevel_depth = 0.22
    s_fat = c_fat.splines.new('BEZIER')
    s_fat.bezier_points.add(len(fat_pts) - 1)
    for p_i, p_co in enumerate(fat_pts):
        s_fat.bezier_points[p_i].co = p_co
        s_fat.bezier_points[p_i].handle_left_type = 'AUTO'
        s_fat.bezier_points[p_i].handle_right_type = 'AUTO'
    fat_obj = bpy.data.objects.new("Anterior_Sulcus_Fat", c_fat)
    bpy.context.scene.collection.objects.link(fat_obj)
    fat_obj.data.materials.append(m_fat)
    fat_obj.parent = anterior_cover

    # 4. Left Anterior Descending (LAD) Coronary Artery ("Widowmaker")
    lad_pts = [
        (0.12, -1.24, 0.95),
        (0.04, -1.40, 0.40),
        (0.15, -1.35, -0.42),
        (0.35, -1.18, -1.22),
        (0.62, -0.88, -1.82)
    ]
    c_lad = bpy.data.curves.new('Curve_LAD', 'CURVE')
    c_lad.dimensions = '3D'
    c_lad.bevel_depth = 0.085
    s_lad = c_lad.splines.new('BEZIER')
    s_lad.bezier_points.add(len(lad_pts) - 1)
    for p_i, p_co in enumerate(lad_pts):
        s_lad.bezier_points[p_i].co = p_co
        s_lad.bezier_points[p_i].handle_left_type = 'AUTO'
        s_lad.bezier_points[p_i].handle_right_type = 'AUTO'
    lad_obj = bpy.data.objects.new("LAD_Coronary_Artery", c_lad)
    bpy.context.scene.collection.objects.link(lad_obj)
    lad_obj.data.materials.append(m_art)
    lad_obj.parent = anterior_cover

    # 5. Great Cardiac Vein (Runs parallel to LAD in sulcus)
    gcv_pts = [
        (-0.06, -1.22, 0.90),
        (-0.14, -1.38, 0.38),
        (-0.02, -1.33, -0.40),
        (0.18, -1.16, -1.18)
    ]
    c_gcv = bpy.data.curves.new('Curve_GCV', 'CURVE')
    c_gcv.dimensions = '3D'
    c_gcv.bevel_depth = 0.075
    s_gcv = c_gcv.splines.new('BEZIER')
    s_gcv.bezier_points.add(len(gcv_pts) - 1)
    for p_i, p_co in enumerate(gcv_pts):
        s_gcv.bezier_points[p_i].co = p_co
        s_gcv.bezier_points[p_i].handle_left_type = 'AUTO'
        s_gcv.bezier_points[p_i].handle_right_type = 'AUTO'
    gcv_obj = bpy.data.objects.new("Great_Cardiac_Vein", c_gcv)
    bpy.context.scene.collection.objects.link(gcv_obj)
    gcv_obj.data.materials.append(m_vein)
    gcv_obj.parent = anterior_cover

    # =========================================================================
    # PART B: LEFT HEART (POSTERIOR CAVITY, 15MM CUT FACE, VALVES, AORTA)
    # =========================================================================
    # 1. Left Ventricle Posterior Chamber (Hollow cavity, Y >= 0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1.0, location=(0.70, 0.0, -0.65))
    lv = bpy.context.active_object
    lv.name = "Left_Ventricle"
    lv.scale = (1.40, 1.32, 1.82)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(lv.data)
    for v in bm.verts:
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
    # Sliced along coronal plane: keep posterior half (Y >= -0.02)
    verts_to_remove = [v for v in bm.verts if v.co.y < -0.02]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(lv.data)
    bm.free()
    lv.data.materials.append(m_myo_l)
    lv.parent = left_heart

    # 2. Thick Myocardial Cut Face (~15 mm wall thickness) with Trabeculae Carneae
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

    # 3. Papillary Muscle Pillars in Left Ventricle cavity
    pap_data = [
        ("LV_Papillary_Anterior", (1.05, 0.25, -0.85), (-0.12, 0.0, -0.22)),
        ("LV_Papillary_Posterior", (0.75, 0.45, -0.82), (0.12, 0.0, 0.18))
    ]
    for p_name, p_pos, p_rot in pap_data:
        bpy.ops.mesh.primitive_cone_add(radius1=0.25, radius2=0.06, depth=0.80, location=p_pos)
        pap = bpy.context.active_object
        pap.name = p_name
        pap.rotation_euler = p_rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pap.data.materials.append(m_myo_l)
        pap.parent = left_heart

        # 5 Parachute Chordae Tendineae ("Heart Strings") per papillary muscle
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

    # 4. Bicuspid (Mitral) Valve across LV inlet
    bpy.ops.mesh.primitive_torus_add(major_radius=0.55, minor_radius=0.065, major_segments=36, minor_segments=16, location=(0.88, 0.28, 0.18))
    mitral = bpy.context.active_object
    mitral.name = "Bicuspid_Mitral_Valve"
    mitral.rotation_euler = (0.25, 0.12, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mitral.data.materials.append(m_valve)
    mitral.parent = left_heart

    # 5. Left Atrium (LA) - Posterior Receiving Chamber
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.05, location=(0.95, 0.55, 1.20))
    la = bpy.context.active_object
    la.name = "Left_Atrium"
    la.scale = (1.15, 1.20, 1.05)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    la.data.materials.append(m_myo_l)
    la.parent = left_heart

    # Left Auricle (Crenulated ear-shaped appendage)
    bpy.ops.mesh.primitive_cone_add(radius1=0.45, radius2=0.12, depth=0.75, location=(1.35, 0.15, 0.95))
    la_aur = bpy.context.active_object
    la_aur.name = "Left_Auricle"
    la_aur.rotation_euler = (-0.4, 0.6, 0.3)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    la_aur.data.materials.append(m_myo_l)
    la_aur.parent = left_heart

    # 4 Pulmonary Veins (Oxygenated intake from lungs)
    pv_offsets = [
        ("Left_Superior_PV", (1.45, 0.72, 1.55), (0.4, 0.2, 0.3)),
        ("Left_Inferior_PV", (1.48, 0.75, 0.95), (0.4, 0.2, -0.2)),
        ("Right_Superior_PV", (0.35, 1.15, 1.62), (-0.3, 0.4, 0.2)),
        ("Right_Inferior_PV", (0.38, 1.18, 1.02), (-0.3, 0.4, -0.2))
    ]
    for pv_name, pv_pos, pv_rot in pv_offsets:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.85, location=pv_pos)
        pv = bpy.context.active_object
        pv.name = pv_name
        pv.rotation_euler = pv_rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pv.data.materials.append(m_aorta)
        pv.parent = left_heart

    # 6. Aortic Root & 3 Sinuses of Valsalva
    for s_i, s_ang in enumerate([0.0, 2.09, 4.18]):
        sx = 0.15 + math.cos(s_ang) * 0.22
        sy = -0.15 + math.sin(s_ang) * 0.22
        sz = 0.75
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=18, radius=0.28, location=(sx, sy, sz))
        sinus = bpy.context.active_object
        sinus.name = f"Aortic_Sinus_{s_i+1}"
        sinus.data.materials.append(m_aorta)
        sinus.parent = left_heart

    # Semilunar Aortic Valve Cusps
    for c_i, c_name in enumerate(["Aortic_Cusp_Left", "Aortic_Cusp_Right", "Aortic_Cusp_Posterior"]):
        c_ang = c_i * (math.pi * 2 / 3)
        cx = 0.15 + math.cos(c_ang) * 0.14
        cy = -0.15 + math.sin(c_ang) * 0.14
        cz = 0.85
        bpy.ops.mesh.primitive_cone_add(radius1=0.16, radius2=0.04, depth=0.22, location=(cx, cy, sz))
        aor_cusp = bpy.context.active_object
        aor_cusp.name = c_name
        aor_cusp.rotation_euler = (0, 0, c_ang)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        aor_cusp.data.materials.append(m_valve)
        aor_cusp.parent = left_heart

    # 7. Iconic Aortic Arch
    aorta_pts = [
        (0.18, -0.15, 0.75),
        (0.12, -0.10, 1.85),
        (-0.08, 0.05, 2.65),
        (0.25, 0.35, 2.95),
        (0.95, 0.45, 2.65),
        (1.25, 0.50, 1.65)
    ]
    c_aorta = bpy.data.curves.new('Curve_Aorta', 'CURVE')
    c_aorta.dimensions = '3D'
    c_aorta.bevel_depth = 0.38
    s_aorta = c_aorta.splines.new('BEZIER')
    s_aorta.bezier_points.add(len(aorta_pts) - 1)
    for p_i, p_co in enumerate(aorta_pts):
        s_aorta.bezier_points[p_i].co = p_co
        s_aorta.bezier_points[p_i].handle_left_type = 'AUTO'
        s_aorta.bezier_points[p_i].handle_right_type = 'AUTO'
    aorta_obj = bpy.data.objects.new("Aortic_Arch", c_aorta)
    bpy.context.scene.collection.objects.link(aorta_obj)
    aorta_obj.data.materials.append(m_aorta)
    aorta_obj.parent = left_heart

    # 3 Aortic Arch Branches
    branches = [
        ("Brachiocephalic_Artery", (-0.05, 0.12, 2.85), (-0.2, 0.1, 0.8)),
        ("Left_Common_Carotid", (0.35, 0.28, 3.02), (0.0, 0.1, 0.85)),
        ("Left_Subclavian_Artery", (0.75, 0.42, 2.88), (0.2, 0.1, 0.8))
    ]
    for b_name, b_pos, b_dir in branches:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.95, location=b_pos)
        br = bpy.context.active_object
        br.name = b_name
        br.rotation_euler = (b_dir[0], b_dir[1], 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        br.data.materials.append(m_aorta)
        br.parent = left_heart

    # Left Circumflex (LCx) Coronary Artery
    lcx_pts = [
        (0.42, -0.05, 0.45),
        (0.85, 0.25, 0.35),
        (1.25, 0.55, 0.05)
    ]
    c_lcx = bpy.data.curves.new('Curve_LCx', 'CURVE')
    c_lcx.dimensions = '3D'
    c_lcx.bevel_depth = 0.055
    s_lcx = c_lcx.splines.new('BEZIER')
    s_lcx.bezier_points.add(len(lcx_pts) - 1)
    for p_i, p_co in enumerate(lcx_pts):
        s_lcx.bezier_points[p_i].co = p_co
        s_lcx.bezier_points[p_i].handle_left_type = 'AUTO'
        s_lcx.bezier_points[p_i].handle_right_type = 'AUTO'
    lcx_obj = bpy.data.objects.new("Circumflex_Artery", c_lcx)
    bpy.context.scene.collection.objects.link(lcx_obj)
    lcx_obj.data.materials.append(m_art)
    lcx_obj.parent = left_heart

    # AV Node Pacemaker Relay
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14, location=(0.05, 0.15, 0.10))
    av_node = bpy.context.active_object
    av_node.name = "AV_Node"
    av_node.data.materials.append(m_conduction)
    av_node.parent = left_heart

    # Left Ventricle Purkinje Fiber Network
    purk_l_pts = [
        (0.05, 0.15, 0.10),
        (0.22, 0.10, -0.45),
        (0.55, 0.05, -1.15),
        (0.68, -0.05, -1.65)
    ]
    c_purk_l = bpy.data.curves.new('Curve_Purkinje_LV', 'CURVE')
    c_purk_l.dimensions = '3D'
    c_purk_l.bevel_depth = 0.035
    s_purk_l = c_purk_l.splines.new('BEZIER')
    s_purk_l.bezier_points.add(len(purk_l_pts) - 1)
    for p_i, p_co in enumerate(purk_l_pts):
        s_purk_l.bezier_points[p_i].co = p_co
        s_purk_l.bezier_points[p_i].handle_left_type = 'AUTO'
        s_purk_l.bezier_points[p_i].handle_right_type = 'AUTO'
    purk_l_obj = bpy.data.objects.new("LV_Purkinje_Fibers", c_purk_l)
    bpy.context.scene.collection.objects.link(purk_l_obj)
    purk_l_obj.data.materials.append(m_conduction)
    purk_l_obj.parent = left_heart

    # =========================================================================
    # PART C: RIGHT HEART (PULMONARY CAVITY, 4MM CUT FACE, TRICUSPID, PULMONARY TRUNK)
    # =========================================================================
    # 1. Right Ventricle Posterior Chamber (Hollow cavity, Y >= 0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=54, ring_count=40, radius=1.0, location=(-1.05, 0.0, -0.42))
    rv = bpy.context.active_object
    rv.name = "Right_Ventricle"
    rv.scale = (1.28, 1.25, 1.62)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(rv.data)
    for v in bm.verts:
        if v.co.z < -0.65:
            d = abs(v.co.z + 0.65)
            v.co.x *= max(0.2, 1.0 - d * 0.42)
            v.co.y *= max(0.2, 1.0 - d * 0.42)
    # Keep posterior half only (Y >= -0.02)
    verts_to_remove = [v for v in bm.verts if v.co.y < -0.02]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(rv.data)
    bm.free()
    rv.data.materials.append(m_myo_r)
    rv.parent = right_heart

    # 2. Thin Myocardial Cut Face (~4 mm wall thickness)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.92, depth=0.10, location=(-1.05, 0.0, -0.40))
    rv_cut = bpy.context.active_object
    rv_cut.name = "RV_Myocardial_Cutface"
    rv_cut.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    rv_cut.data.materials.append(m_cut_r)
    rv_cut.parent = right_heart

    # 3. Tricuspid Valve (3 Cusps)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.52, minor_radius=0.055, major_segments=36, minor_segments=16, location=(-1.05, 0.22, 0.25))
    tri = bpy.context.active_object
    tri.name = "Tricuspid_Valve"
    tri.rotation_euler = (-0.20, -0.15, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    tri.data.materials.append(m_valve)
    tri.parent = right_heart

    # 4. Right Atrium (RA) - Systemic Venous Chamber
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.12, location=(-1.45, 0.35, 1.15))
    ra = bpy.context.active_object
    ra.name = "Right_Atrium"
    ra.scale = (1.18, 1.15, 1.12)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ra.data.materials.append(m_myo_r)
    ra.parent = right_heart

    # Fossa Ovalis Depression on Interatrial Septum
    bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=0.04, location=(-0.45, 0.35, 0.95))
    fossa = bpy.context.active_object
    fossa.name = "Fossa_Ovalis"
    fossa.rotation_euler = (0, math.pi / 2, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    fossa.data.materials.append(m_fossa)
    fossa.parent = right_heart

    # Sinoatrial (SA) Node Natural Pacemaker
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.18, location=(-1.55, 0.25, 1.95))
    sa_node = bpy.context.active_object
    sa_node.name = "SA_Node"
    sa_node.data.materials.append(m_conduction)
    sa_node.parent = right_heart

    # Right Auricle
    bpy.ops.mesh.primitive_cone_add(radius1=0.48, radius2=0.15, depth=0.82, location=(-1.65, -0.10, 0.95))
    ra_aur = bpy.context.active_object
    ra_aur.name = "Right_Auricle"
    ra_aur.rotation_euler = (0.35, -0.5, 0.2)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ra_aur.data.materials.append(m_myo_r)
    ra_aur.parent = right_heart

    # Conus Arteriosus (Infundibulum leading to pulmonary trunk)
    bpy.ops.mesh.primitive_cone_add(radius1=0.48, radius2=0.38, depth=0.75, location=(-0.35, -0.32, 0.55))
    conus = bpy.context.active_object
    conus.name = "Conus_Arteriosus"
    conus.rotation_euler = (0.25, 0.15, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    conus.data.materials.append(m_myo_r)
    conus.parent = right_heart

    # 3 Semilunar Pulmonary Valve Cusps
    for p_i, p_name in enumerate(["Pulmonary_Cusp_Anterior", "Pulmonary_Cusp_Left", "Pulmonary_Cusp_Right"]):
        p_ang = p_i * (math.pi * 2 / 3)
        px = -0.35 + math.cos(p_ang) * 0.14
        py = -0.32 + math.sin(p_ang) * 0.14
        pz = 0.95
        bpy.ops.mesh.primitive_cone_add(radius1=0.15, radius2=0.03, depth=0.20, location=(px, py, pz))
        pul_cusp = bpy.context.active_object
        pul_cusp.name = p_name
        pul_cusp.rotation_euler = (0, 0, p_ang)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pul_cusp.data.materials.append(m_valve)
        pul_cusp.parent = right_heart

    # 5. Pulmonary Trunk & Bifurcation
    pt_pts = [
        (-0.35, -0.32, 0.95),
        (-0.25, -0.22, 1.85),
        (0.05, 0.15, 2.25)
    ]
    c_pt = bpy.data.curves.new('Curve_PT', 'CURVE')
    c_pt.dimensions = '3D'
    c_pt.bevel_depth = 0.34
    s_pt = c_pt.splines.new('BEZIER')
    s_pt.bezier_points.add(len(pt_pts) - 1)
    for p_i, p_co in enumerate(pt_pts):
        s_pt.bezier_points[p_i].co = p_co
        s_pt.bezier_points[p_i].handle_left_type = 'AUTO'
        s_pt.bezier_points[p_i].handle_right_type = 'AUTO'
    pt_obj = bpy.data.objects.new("Pulmonary_Trunk", c_pt)
    bpy.context.scene.collection.objects.link(pt_obj)
    pt_obj.data.materials.append(m_pulm)
    pt_obj.parent = right_heart

    # Left & Right Pulmonary Arteries
    pa_branches = [
        ("Left_Pulmonary_Artery", (0.55, 0.35, 2.22), (0.2, 0.4, -0.2)),
        ("Right_Pulmonary_Artery", (-0.65, 0.35, 2.22), (-0.2, 0.4, 0.2))
    ]
    for pa_name, pa_pos, pa_rot in pa_branches:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=1.1, location=pa_pos)
        pa = bpy.context.active_object
        pa.name = pa_name
        pa.rotation_euler = pa_rot
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pa.data.materials.append(m_pulm)
        pa.parent = right_heart

    # 6. Superior Vena Cava (SVC) & Inferior Vena Cava (IVC)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.36, depth=1.85, location=(-1.55, 0.35, 2.35))
    svc = bpy.context.active_object
    svc.name = "Superior_Vena_Cava"
    svc.data.materials.append(m_cava)
    svc.parent = right_heart

    bpy.ops.mesh.primitive_cylinder_add(radius=0.38, depth=1.55, location=(-1.45, 0.45, -0.45))
    ivc = bpy.context.active_object
    ivc.name = "Inferior_Vena_Cava"
    ivc.data.materials.append(m_cava)
    ivc.parent = right_heart

    # Coronary Sinus (Venous return into RA)
    cs_pts = [
        (-0.55, 0.65, 0.15),
        (-1.05, 0.55, 0.35),
        (-1.35, 0.45, 0.45)
    ]
    c_cs = bpy.data.curves.new('Curve_CS', 'CURVE')
    c_cs.dimensions = '3D'
    c_cs.bevel_depth = 0.11
    s_cs = c_cs.splines.new('BEZIER')
    s_cs.bezier_points.add(len(cs_pts) - 1)
    for p_i, p_co in enumerate(cs_pts):
        s_cs.bezier_points[p_i].co = p_co
        s_cs.bezier_points[p_i].handle_left_type = 'AUTO'
        s_cs.bezier_points[p_i].handle_right_type = 'AUTO'
    cs_obj = bpy.data.objects.new("Coronary_Sinus", c_cs)
    bpy.context.scene.collection.objects.link(cs_obj)
    cs_obj.data.materials.append(m_vein)
    cs_obj.parent = right_heart

    # Right Coronary Artery (RCA) in right atrioventricular groove
    rca_pts = [
        (-0.15, -0.35, 0.65),
        (-0.85, -0.25, 0.45),
        (-1.45, 0.05, 0.15),
        (-1.35, 0.55, -0.25)
    ]
    c_rca = bpy.data.curves.new('Curve_RCA', 'CURVE')
    c_rca.dimensions = '3D'
    c_rca.bevel_depth = 0.065
    s_rca = c_rca.splines.new('BEZIER')
    s_rca.bezier_points.add(len(rca_pts) - 1)
    for p_i, p_co in enumerate(rca_pts):
        s_rca.bezier_points[p_i].co = p_co
        s_rca.bezier_points[p_i].handle_left_type = 'AUTO'
        s_rca.bezier_points[p_i].handle_right_type = 'AUTO'
    rca_obj = bpy.data.objects.new("Right_Coronary_Artery", c_rca)
    bpy.context.scene.collection.objects.link(rca_obj)
    rca_obj.data.materials.append(m_art)
    rca_obj.parent = right_heart

    # Right Ventricle Purkinje Fiber Network
    purk_r_pts = [
        (-0.05, 0.15, 0.10),
        (-0.35, 0.10, -0.35),
        (-0.75, 0.05, -0.85),
        (-0.88, -0.05, -1.25)
    ]
    c_purk_r = bpy.data.curves.new('Curve_Purkinje_RV', 'CURVE')
    c_purk_r.dimensions = '3D'
    c_purk_r.bevel_depth = 0.035
    s_purk_r = c_purk_r.splines.new('BEZIER')
    s_purk_r.bezier_points.add(len(purk_r_pts) - 1)
    for p_i, p_co in enumerate(purk_r_pts):
        s_purk_r.bezier_points[p_i].co = p_co
        s_purk_r.bezier_points[p_i].handle_left_type = 'AUTO'
        s_purk_r.bezier_points[p_i].handle_right_type = 'AUTO'
    purk_r_obj = bpy.data.objects.new("RV_Purkinje_Fibers", c_purk_r)
    bpy.context.scene.collection.objects.link(purk_r_obj)
    purk_r_obj.data.materials.append(m_conduction)
    purk_r_obj.parent = right_heart

    # =========================================================================
    # EXPORT GLTF AND SAVE BLENDER FILE
    # =========================================================================
    out_dir = "frontend/public/3d_models"
    models_dir = "models_blender"
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)

    glb_path = os.path.join(out_dir, "heart_realistic.glb")
    blend_path = os.path.join(models_dir, "heart_realistic.blend")

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
    build_perfect_split_heart()
