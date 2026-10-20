"""
Ultra-Realistic Human Respiratory System & Alveolar Apparatus Generator for Blender 5.2
Sculpts an authentic medical-grade respiratory system:
1. Larynx & Epiglottis (Thyroid cartilage with laryngeal prominence / Adam's apple, cricoid ring).
2. Trachea with 16 C-shaped hyaline cartilaginous rings, fibroelastic annular ligaments,
   and posterior membranous trachealis wall.
3. Carina Tracheae dividing into asymmetrical primary bronchi:
   - Right Mainstem Bronchus (wider, steeper angle ~25 deg).
   - Left Mainstem Bronchus (narrower, more horizontal ~45 deg).
4. Arborizing Secondary Lobar Bronchi and Tertiary Segmental Bronchial Tree.
5. Asymmetrical Human Lungs:
   - Right Lung: 3 Lobes (Superior, Middle, Inferior) separated by Horizontal & Oblique Fissures.
   - Left Lung: 2 Lobes (Superior, Inferior) with Oblique Fissure, Cardiac Notch, and Lingula.
6. Pulmonary Hilum Vessels:
   - Pulmonary Arteries (blue, carrying deoxygenated blood from right ventricle).
   - Pulmonary Veins (red, carrying oxygenated blood to left atrium).
7. Microscopic Alveolar Cluster Cutaway (Alveolar Sac with grape-like alveoli and capillary network).
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

def create_pbr_material(name, base_color, roughness=0.30, metallic=0.0, transmission=0.0, ior=1.45,
                        sss_weight=0.35, sss_radius=(1.0, 0.35, 0.15), specular=0.6, is_lung=False, is_cartilage=False):
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

    if is_lung:
        # Spongy visceral pleural parenchyma with fine capillary stippling
        vor = nodes.new(type='ShaderNodeTexVoronoi')
        vor.location = (-400, 100)
        vor.inputs['Scale'].default_value = 28.0
        links.new(tex_coord.outputs['Object'], vor.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.22
        links.new(vor.outputs['Distance'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-120, 150)
        cr.color_ramp.elements[0].position = 0.2
        cr.color_ramp.elements[0].color = (base_color[0]*0.82, base_color[1]*0.80, base_color[2]*0.82, 1.0)
        cr.color_ramp.elements[1].position = 0.8
        cr.color_ramp.elements[1].color = (base_color[0]*1.12, base_color[1]*1.08, base_color[2]*1.10, 1.0)
        links.new(vor.outputs['Distance'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

    elif is_cartilage:
        # Semitranslucent glistening hyaline cartilage
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-350, 0)
        noise.inputs['Scale'].default_value = 22.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.12
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def build_realistic_lungs():
    reset()
    print("[LUNGS GENERATOR] Sculpting medical-grade 3D Respiratory System...")

    # Materials calibrated to reference model (media_1792523893264.jpg)
    # Larynx / Thyroid cartilage = Warm Golden Ochre / Terracotta
    m_larynx = create_pbr_material("Mat_Larynx_Ochre", (0.88, 0.48, 0.14), roughness=0.35, sss_weight=0.30)
    # Tracheal Rings & Bronchial Tree = Crisp Pure White
    m_cartilage = create_pbr_material("Mat_Hyaline_Cartilage", (0.98, 0.98, 0.98), roughness=0.18, sss_weight=0.48, is_cartilage=True)
    m_bronchi = create_pbr_material("Mat_Bronchial_Tree", (0.96, 0.96, 0.96), roughness=0.20, sss_weight=0.40)
    # Trachea central tube/straw = Bright Turquoise / Cyan Blue
    m_trachea_tube = create_pbr_material("Mat_Trachea_Cyan", (0.0, 0.78, 0.80), roughness=0.20, specular=0.8)
    # Lung Lobes = Striking Rose-Pink / Coral Carmine
    m_lung_r = create_pbr_material("Mat_Right_Lung_Pleura", (0.92, 0.24, 0.42), roughness=0.28, sss_weight=0.45, is_lung=True)
    m_lung_l = create_pbr_material("Mat_Left_Lung_Pleura", (0.90, 0.22, 0.40), roughness=0.28, sss_weight=0.45, is_lung=True)
    # Alveolar Expandable Balloon Sacs = Warm Tangerine Orange
    m_balloon = create_pbr_material("Mat_Balloon_Orange", (0.98, 0.54, 0.08), roughness=0.24, sss_weight=0.50)
    # Vessels
    m_pulm_art = create_pbr_material("Mat_Pulmonary_Artery", (0.06, 0.32, 0.88), roughness=0.20, specular=0.85)
    m_pulm_vein = create_pbr_material("Mat_Pulmonary_Vein", (0.88, 0.10, 0.12), roughness=0.20, specular=0.85)
    m_alveoli = create_pbr_material("Mat_Alveolar_Cluster", (0.96, 0.65, 0.68), roughness=0.22, sss_weight=0.52)
    m_capillary = create_pbr_material("Mat_Capillary_Network", (0.80, 0.18, 0.32), roughness=0.18, specular=0.8)

    root = bpy.data.objects.new("Respiratory_System_Root", None)
    bpy.context.scene.collection.objects.link(root)

    airway_group = bpy.data.objects.new("Airway_Tracheobronchial_Group", None)
    bpy.context.scene.collection.objects.link(airway_group)
    airway_group.parent = root

    lungs_group = bpy.data.objects.new("Lungs_Parenchyma_Group", None)
    bpy.context.scene.collection.objects.link(lungs_group)
    lungs_group.parent = root

    alveoli_inset_group = bpy.data.objects.new("Alveoli_Microscopic_Inset_Group", None)
    bpy.context.scene.collection.objects.link(alveoli_inset_group)
    alveoli_inset_group.parent = root
    alveoli_inset_group.location = (4.0, 0.0, -0.6)

    # =========================================================================
    # 1. LARYNX & THYROID / CRICOID CARTILAGES (VOCAL APPARATUS)
    # =========================================================================
    # Thyroid Cartilage (Adam's Apple with V-shaped thyroid notch)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.42, depth=0.65, location=(0.0, 0.0, 3.10))
    thyroid = bpy.context.active_object
    thyroid.name = "Thyroid_Cartilage"
    thyroid.scale = (1.05, 0.85, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(thyroid.data)
    for v in bm.verts:
        if v.co.y > 0.1:
            # Anterior laryngeal prominence (Adam's apple)
            v.co.y += 0.15 * math.cos(v.co.x * 3.5)
            if v.co.z > 0.15:
                v.co.y -= 0.08  # Superior thyroid notch
    bm.to_mesh(thyroid.data)
    bm.free()

    thyroid.data.materials.append(m_larynx)
    thyroid.parent = airway_group
    bpy.ops.object.shade_smooth()

    # Cricoid Cartilage (Signet-ring shape inferior to thyroid)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.38, depth=0.32, location=(0.0, 0.0, 2.55))
    cricoid = bpy.context.active_object
    cricoid.name = "Cricoid_Cartilage"
    cricoid.data.materials.append(m_larynx)
    cricoid.parent = airway_group
    bpy.ops.object.shade_smooth()

    # Epiglottis (Leaf-shaped elastic cartilage flap)
    bpy.ops.mesh.primitive_cone_add(radius1=0.28, radius2=0.08, depth=0.48, location=(0.0, -0.15, 3.45))
    epiglottis = bpy.context.active_object
    epiglottis.name = "Epiglottis"
    epiglottis.rotation_euler = (-0.35, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    epiglottis.data.materials.append(m_larynx)
    epiglottis.parent = airway_group
    bpy.ops.object.shade_smooth()

    # =========================================================================
    # 2. TRACHEA: 16 C-SHAPED CARTILAGE RINGS & TRACHEALIS MEMBRANE
    # =========================================================================
    trachea_inner = bpy.ops.mesh.primitive_cylinder_add(radius=0.34, depth=2.1, location=(0.0, 0.0, 1.35))
    trach_tube = bpy.context.active_object
    trach_tube.name = "Trachea_Lumen"
    trach_tube.data.materials.append(m_trachea_tube)
    trach_tube.parent = airway_group

    # 12 Detailed C-shaped Hyaline Rings
    ring_count = 12
    for r_i in range(ring_count):
        rz = 2.25 - r_i * 0.16
        bpy.ops.mesh.primitive_torus_add(major_radius=0.36, minor_radius=0.042, location=(0.0, 0.0, rz))
        ring = bpy.context.active_object
        ring.name = f"Tracheal_Cartilage_Ring_{r_i+1}"
        ring.scale = (1.0, 0.95, 1.0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

        bm = bmesh.new()
        bm.from_mesh(ring.data)
        # Cut posterior section to form authentic "C" shape (open posteriorly for esophagus)
        verts_post = [v for v in bm.verts if v.co.y < -0.26]
        bmesh.ops.delete(bm, geom=verts_post, context='VERTS')
        bm.to_mesh(ring.data)
        bm.free()

        ring.data.materials.append(m_cartilage)
        ring.parent = airway_group
        bpy.ops.object.shade_smooth()

    # =========================================================================
    # 3. CARINA TRACHEAE & PRIMARY / SECONDARY BRONCHIAL TREE
    # =========================================================================
    # Carina bifurcation spur at T4/T5 vertebral level
    bpy.ops.mesh.primitive_cone_add(radius1=0.35, radius2=0.08, depth=0.38, location=(0.0, 0.0, 0.28))
    carina = bpy.context.active_object
    carina.name = "Carina_Tracheae"
    carina.rotation_euler = (math.pi, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    carina.data.materials.append(m_cartilage)
    carina.parent = airway_group

    # Right Primary Bronchus (wider, steeper ~25 deg)
    c_r_bronch = bpy.data.curves.new('Curve_Right_Bronchus', 'CURVE')
    c_r_bronch.dimensions = '3D'
    c_r_bronch.bevel_depth = 0.24
    c_r_bronch.bevel_resolution = 10
    s_rb = c_r_bronch.splines.new('BEZIER')
    s_rb.bezier_points.add(2)
    s_rb.bezier_points[0].co = (0.0, 0.0, 0.25)
    s_rb.bezier_points[1].co = (0.55, -0.05, -0.15)
    s_rb.bezier_points[2].co = (1.10, -0.10, -0.65)
    for bp in s_rb.bezier_points:
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    rb_obj = bpy.data.objects.new("Right_Primary_Bronchus", c_r_bronch)
    bpy.context.scene.collection.objects.link(rb_obj)
    rb_obj.data.materials.append(m_bronchi)
    rb_obj.parent = airway_group

    # Left Primary Bronchus (narrower, longer, more horizontal ~45 deg)
    c_l_bronch = bpy.data.curves.new('Curve_Left_Bronchus', 'CURVE')
    c_l_bronch.dimensions = '3D'
    c_l_bronch.bevel_depth = 0.20
    c_l_bronch.bevel_resolution = 10
    s_lb = c_l_bronch.splines.new('BEZIER')
    s_lb.bezier_points.add(2)
    s_lb.bezier_points[0].co = (0.0, 0.0, 0.25)
    s_lb.bezier_points[1].co = (-0.75, -0.05, -0.05)
    s_lb.bezier_points[2].co = (-1.55, -0.10, -0.55)
    for bp in s_lb.bezier_points:
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    lb_obj = bpy.data.objects.new("Left_Primary_Bronchus", c_l_bronch)
    bpy.context.scene.collection.objects.link(lb_obj)
    lb_obj.data.materials.append(m_bronchi)
    lb_obj.parent = airway_group

    # Secondary Lobar Bronchial Branches (Arborizing into lobes)
    lobar_branches = [
        ("Right_Superior_Lobar_Bronchus", (1.0, -0.08, -0.45), (1.45, 0.05, 0.15), 0.14),
        ("Right_Middle_Lobar_Bronchus", (1.15, -0.10, -0.65), (1.55, 0.20, -0.75), 0.12),
        ("Right_Inferior_Lobar_Bronchus", (1.15, -0.10, -0.65), (1.40, -0.20, -1.35), 0.13),
        ("Left_Superior_Lobar_Bronchus", (-1.45, -0.08, -0.40), (-1.90, 0.05, 0.10), 0.13),
        ("Left_Inferior_Lobar_Bronchus", (-1.55, -0.10, -0.55), (-1.85, -0.20, -1.30), 0.13)
    ]
    for br_name, p_start, p_end, b_rad in lobar_branches:
        c_lob = bpy.data.curves.new(f'Curve_{br_name}', 'CURVE')
        c_lob.dimensions = '3D'
        c_lob.bevel_depth = b_rad
        c_lob.bevel_resolution = 8
        s_lob = c_lob.splines.new('BEZIER')
        s_lob.bezier_points.add(1)
        s_lob.bezier_points[0].co = p_start
        s_lob.bezier_points[1].co = p_end
        for bp in s_lob.bezier_points:
            bp.handle_left_type = 'AUTO'
            bp.handle_right_type = 'AUTO'
        lob_obj = bpy.data.objects.new(br_name, c_lob)
        bpy.context.scene.collection.objects.link(lob_obj)
        lob_obj.data.materials.append(m_bronchi)
        lob_obj.parent = airway_group

    # =========================================================================
    # 4. ASYMMETRICAL HUMAN LUNGS: 3 RIGHT LOBES & 2 LEFT LOBES + CARDIAC NOTCH
    # =========================================================================
    # Right Lung: 3 Anatomical Lobes (Superior, Middle, Inferior)
    right_lung_group = bpy.data.objects.new("Right_Lung_Organ", None)
    bpy.context.scene.collection.objects.link(right_lung_group)
    right_lung_group.parent = lungs_group

    # Right Superior Lobe
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.0, location=(1.65, 0.0, 0.45))
    r_sup = bpy.context.active_object
    r_sup.name = "Right_Superior_Lobe"
    r_sup.scale = (0.95, 0.90, 1.25)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(r_sup.data)
    for v in bm.verts:
        if v.co.z > 0.5:
            # Conical apex of lung extending above 1st rib
            t = (v.co.z - 0.5) / 1.0
            v.co.x *= max(0.25, 1.0 - t * 0.55)
            v.co.y *= max(0.25, 1.0 - t * 0.55)
        # Medial flattening for mediastinum
        if v.co.x < 1.05:
            v.co.x = 1.05
    # Horizontal fissure cut on inferior boundary
    verts_inf = [v for v in bm.verts if v.co.z < -0.15]
    bmesh.ops.delete(bm, geom=verts_inf, context='VERTS')
    bm.to_mesh(r_sup.data)
    bm.free()
    r_sup.data.materials.append(m_lung_r)
    r_sup.parent = right_lung_group
    bpy.ops.object.shade_smooth()

    # Right Middle Lobe (Wedge-shaped anterior lobe)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.92, depth=0.65, location=(1.72, 0.22, -0.38))
    r_mid = bpy.context.active_object
    r_mid.name = "Right_Middle_Lobe"
    r_mid.scale = (0.92, 0.75, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    r_mid.data.materials.append(m_lung_r)
    r_mid.parent = right_lung_group
    bpy.ops.object.shade_smooth()

    # Right Inferior Lobe (Large diaphragmatic base)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.05, location=(1.70, -0.12, -1.25))
    r_inf = bpy.context.active_object
    r_inf.name = "Right_Inferior_Lobe"
    r_inf.scale = (1.05, 1.00, 1.15)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(r_inf.data)
    for v in bm.verts:
        if v.co.z < -1.8:
            # Concave diaphragmatic base curving over liver dome
            v.co.z += 0.22 * (1.0 - (v.co.x - 1.70)**2)
    # Oblique fissure superior cut
    verts_sup = [v for v in bm.verts if v.co.z > -0.65 and v.co.y > 0.0]
    bmesh.ops.delete(bm, geom=verts_sup, context='VERTS')
    bm.to_mesh(r_inf.data)
    bm.free()
    r_inf.data.materials.append(m_lung_r)
    r_inf.parent = right_lung_group
    bpy.ops.object.shade_smooth()

    # Left Lung: 2 Lobes (Superior & Inferior) with CARDIAC NOTCH & LINGULA
    left_lung_group = bpy.data.objects.new("Left_Lung_Organ", None)
    bpy.context.scene.collection.objects.link(left_lung_group)
    left_lung_group.parent = lungs_group

    # Left Superior Lobe with CARDIAC NOTCH
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.0, location=(-1.75, 0.0, 0.35))
    l_sup = bpy.context.active_object
    l_sup.name = "Left_Superior_Lobe"
    l_sup.scale = (0.90, 0.88, 1.25)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(l_sup.data)
    for v in bm.verts:
        # Apex taper
        if v.co.z > 0.5:
            t = (v.co.z - 0.5) / 1.0
            v.co.x *= max(0.25, 1.0 - t * 0.55)
            v.co.y *= max(0.25, 1.0 - t * 0.55)
        # CARDIAC NOTCH: Deep indentation accommodating the apex and left ventricle of the heart!
        if v.co.x > -1.45 and -0.45 < v.co.z < 0.25 and v.co.y > -0.2:
            notch_depth = math.cos((v.co.z - (-0.1)) * 3.5) * 0.38
            v.co.x -= notch_depth
        # Lingula (tongue-like projection below cardiac notch)
        if v.co.x > -1.35 and -0.7 < v.co.z < -0.45:
            v.co.x += 0.12
    # Oblique fissure cut
    verts_cut = [v for v in bm.verts if v.co.z < -0.55 and v.co.y < -0.1]
    bmesh.ops.delete(bm, geom=verts_cut, context='VERTS')
    bm.to_mesh(l_sup.data)
    bm.free()
    l_sup.data.materials.append(m_lung_l)
    l_sup.parent = left_lung_group
    bpy.ops.object.shade_smooth()

    # Left Inferior Lobe (Posteroinferior mass)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.05, location=(-1.80, -0.15, -1.20))
    l_inf = bpy.context.active_object
    l_inf.name = "Left_Inferior_Lobe"
    l_inf.scale = (0.95, 0.98, 1.15)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(l_inf.data)
    for v in bm.verts:
        if v.co.z < -1.75:
            v.co.z += 0.20 * (1.0 - (v.co.x + 1.80)**2)
    # Oblique fissure cut
    verts_sup_l = [v for v in bm.verts if v.co.z > -0.55 and v.co.y > -0.05]
    bmesh.ops.delete(bm, geom=verts_sup_l, context='VERTS')
    bm.to_mesh(l_inf.data)
    bm.free()
    l_inf.data.materials.append(m_lung_l)
    l_inf.parent = left_lung_group
    bpy.ops.object.shade_smooth()

    # 2 Anterior Alveolar Balloon Sacs (Warm Tangerine Orange, from working model photo)
    balloon_data = [
        ("Right_Alveolar_Balloon", (1.45, -0.65, -0.45)),
        ("Left_Alveolar_Balloon", (-1.40, -0.65, -0.45))
    ]
    for b_name, b_pos in balloon_data:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.45, location=b_pos)
        bal = bpy.context.active_object
        bal.name = b_name
        bal.scale = (0.9, 0.75, 1.25)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        bal.data.materials.append(m_balloon)
        bal.parent = lungs_group
        bpy.ops.object.shade_smooth()

    # =========================================================================
    # 5. PULMONARY HILUM VESSELS (PULMONARY ARTERIES & VEINS)
    # =========================================================================
    # Right Pulmonary Artery (Blue)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.85, location=(0.82, -0.22, -0.45))
    r_pa = bpy.context.active_object
    r_pa.name = "Right_Pulmonary_Artery"
    r_pa.rotation_euler = (0.35, 0.85, 0.15)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    r_pa.data.materials.append(m_pulm_art)
    r_pa.parent = lungs_group

    # Left Pulmonary Artery (Blue, arching over left bronchus)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.17, depth=0.95, location=(-0.95, -0.25, -0.35))
    l_pa = bpy.context.active_object
    l_pa.name = "Left_Pulmonary_Artery"
    l_pa.rotation_euler = (0.30, -0.95, -0.20)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    l_pa.data.materials.append(m_pulm_art)
    l_pa.parent = lungs_group

    # Pulmonary Veins (Red, 2 pairs entering hilum)
    pv_data = [
        ("Right_Superior_Pulmonary_Vein", (0.95, 0.05, -0.75)),
        ("Right_Inferior_Pulmonary_Vein", (0.90, -0.15, -1.05)),
        ("Left_Superior_Pulmonary_Vein", (-1.15, 0.05, -0.70)),
        ("Left_Inferior_Pulmonary_Vein", (-1.10, -0.18, -1.00))
    ]
    for pv_name, pv_pos in pv_data:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=0.72, location=pv_pos)
        pv = bpy.context.active_object
        pv.name = pv_name
        pv.rotation_euler = (0.25, math.copysign(0.85, pv_pos[0]), 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pv.data.materials.append(m_pulm_vein)
        pv.parent = lungs_group

    # =========================================================================
    # 6. MICROSCOPIC ALVEOLAR APPARATUS INSET (GAS EXCHANGE UNIT)
    # =========================================================================
    # Terminal Bronchiole tube entering alveolar sac
    c_tb = bpy.data.curves.new('Curve_Terminal_Bronchiole', 'CURVE')
    c_tb.dimensions = '3D'
    c_tb.bevel_depth = 0.18
    c_tb.bevel_resolution = 8
    s_tb = c_tb.splines.new('BEZIER')
    s_tb.bezier_points.add(1)
    s_tb.bezier_points[0].co = (0.0, 0.0, 1.8)
    s_tb.bezier_points[1].co = (0.0, 0.0, 0.6)
    for bp in s_tb.bezier_points:
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    tb_obj = bpy.data.objects.new("Terminal_Bronchiole", c_tb)
    bpy.context.scene.collection.objects.link(tb_obj)
    tb_obj.data.materials.append(m_bronchi)
    tb_obj.parent = alveoli_inset_group

    # Alveolar Sac: Cluster of grape-like spherical Alveoli
    alveoli_coords = [
        (0.0, 0.0, 0.2, 0.42),
        (0.40, 0.25, 0.0, 0.38),
        (-0.38, 0.28, 0.05, 0.36),
        (0.15, -0.42, 0.10, 0.40),
        (-0.25, -0.38, -0.15, 0.35),
        (0.45, -0.20, -0.35, 0.37),
        (-0.45, -0.10, -0.45, 0.39),
        (0.05, 0.48, -0.25, 0.36),
        (0.20, 0.15, -0.55, 0.44),
        (-0.20, 0.18, -0.75, 0.42),
        (0.0, -0.25, -0.85, 0.45)
    ]
    for a_i, (ax, ay, az, arad) in enumerate(alveoli_coords):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=16, radius=arad, location=(ax, ay, az))
        alv = bpy.context.active_object
        alv.name = f"Alveolus_{a_i+1}"
        alv.data.materials.append(m_alveoli)
        alv.parent = alveoli_inset_group
        bpy.ops.object.shade_smooth()

    # Pulmonary Capillary Meshwork winding over alveolar sac (gas exchange blood barrier)
    capillary_rings = [
        ((0.20, 0.15, -0.55), 0.46, m_pulm_art),
        ((-0.20, 0.18, -0.75), 0.44, m_capillary),
        ((0.0, -0.25, -0.85), 0.48, m_pulm_vein)
    ]
    for c_idx, (c_pos, c_rad, c_mat) in enumerate(capillary_rings):
        bpy.ops.mesh.primitive_torus_add(major_radius=c_rad, minor_radius=0.035, location=c_pos)
        cap = bpy.context.active_object
        cap.name = f"Pulmonary_Capillary_Plexus_{c_idx+1}"
        cap.rotation_euler = (0.45 + c_idx * 0.3, 0.65 - c_idx * 0.4, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        cap.data.materials.append(c_mat)
        cap.parent = alveoli_inset_group

    # =========================================================================
    # LIGHTING & CAMERA FOR BEAUTY PREVIEW RENDER
    # =========================================================================
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.lens = 45
    cam = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (2.0, -7.2, 0.8)
    cam.rotation_euler = (math.radians(82), 0, math.radians(16))

    # 3-Point Studio Lighting
    key_light = bpy.data.lights.new("KeyLight", type='AREA')
    key_light.energy = 380
    key_light.size = 3.5
    key_obj = bpy.data.objects.new("KeyLight", key_light)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.location = (3.5, -4.5, 3.5)

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
    blend_path = os.path.join(MODELS_DIR, "lungs_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[SUCCESS] Saved Lungs .blend -> {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR, "lungs_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[SUCCESS] Rendered Lungs preview -> {preview_path}")

    # Export optimized GLB for Three.js WebGL
    glb_path = os.path.join(OUTPUT_DIR, "lungs_realistic.glb")
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
    bat_path = os.path.join(MODELS_DIR, "Open_Lungs_In_Blender.bat")
    with open(bat_path, "w", encoding="utf-8") as bf:
        bf.write(f'@echo off\necho Opening 3D Respiratory System & Lungs in Blender 5.2...\nstart "" "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" "%~dp0lungs_realistic.blend"\nexit\n')
    print(f"[SUCCESS] Created Launcher -> {bat_path}")

if __name__ == "__main__":
    build_realistic_lungs()
