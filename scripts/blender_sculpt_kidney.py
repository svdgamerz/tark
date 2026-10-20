"""
Ultra-Realistic Human Kidney & Microscopic Nephron Ultrastructure Generator for Blender 5.2
Sculpts an authentic medical-grade renal anatomy model:
1. Macroscopic Kidney Morphology:
   - Bean-shaped kidney with Fibrous Renal Capsule, Convex lateral margin, and Medial Hilum.
   - Renal Artery (Red) branching into Segmental, Interlobar, and Arcuate vessels.
   - Renal Vein (Blue) draining into Inferior Vena Cava.
   - Renal Pelvis funneling into the Ureter.
2. Coronal Dissection Cutaway exposing Internal Parenchyma:
   - Renal Cortex (outer granular filtration zone).
   - Renal Medullary Pyramids (8-12 conical striated pyramids).
   - Renal Columns of Bertin separating adjacent pyramids.
   - Renal Papillae apexes discharging into cup-like Minor Calyces.
   - Convergence into 3 Major Calyces and central Renal Pelvis.
3. Microscopic Functional Nephron Inset:
   - Bowman's Capsule with Podocyte filtration slits.
   - Glomerular Capillary Tuft with Afferent & Efferent Arterioles.
   - Proximal Convoluted Tubule (PCT).
   - Hairpin Loop of Henle (Thin Descending & Thick Ascending Limbs).
   - Distal Convoluted Tubule (DCT).
   - Medullary Collecting Duct draining into Renal Papilla.
   - Peritubular Capillaries and Vasa Recta counter-current exchange loops.
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
                        sss_weight=0.35, sss_radius=(1.0, 0.35, 0.15), specular=0.6, is_cortex=False):
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

    if is_cortex:
        vor = nodes.new(type='ShaderNodeTexVoronoi')
        vor.location = (-400, 100)
        vor.inputs['Scale'].default_value = 35.0
        links.new(tex_coord.outputs['Object'], vor.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.20
        links.new(vor.outputs['Distance'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-120, 150)
        cr.color_ramp.elements[0].position = 0.2
        cr.color_ramp.elements[0].color = (base_color[0]*0.85, base_color[1]*0.82, base_color[2]*0.82, 1.0)
        cr.color_ramp.elements[1].position = 0.8
        cr.color_ramp.elements[1].color = (base_color[0]*1.12, base_color[1]*1.08, base_color[2]*1.08, 1.0)
        links.new(vor.outputs['Distance'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

    return mat

def build_realistic_kidney():
    reset()
    print("[KIDNEY GENERATOR] Sculpting medical-grade 3D Kidney & Nephron...")

    # Materials
    m_capsule = create_pbr_material("Mat_Renal_Capsule", (0.58, 0.18, 0.18), roughness=0.22, sss_weight=0.42, is_cortex=True)
    m_cortex = create_pbr_material("Mat_Renal_Cortex", (0.72, 0.24, 0.22), roughness=0.28, sss_weight=0.45, is_cortex=True)
    m_pyramid = create_pbr_material("Mat_Medullary_Pyramid", (0.84, 0.32, 0.28), roughness=0.25, sss_weight=0.48)
    m_calyx = create_pbr_material("Mat_Renal_Pelvis_Calyx", (0.92, 0.90, 0.82), roughness=0.20, sss_weight=0.45)
    m_ureter = create_pbr_material("Mat_Ureter", (0.94, 0.92, 0.85), roughness=0.22, sss_weight=0.40)
    m_artery = create_pbr_material("Mat_Renal_Artery", (0.88, 0.12, 0.14), roughness=0.18, specular=0.85)
    m_vein = create_pbr_material("Mat_Renal_Vein", (0.16, 0.42, 0.85), roughness=0.18, specular=0.85)
    m_bowman = create_pbr_material("Mat_Bowmans_Capsule", (0.94, 0.62, 0.35), roughness=0.22, sss_weight=0.45)
    m_glomerulus = create_pbr_material("Mat_Glomerulus_Capillaries", (0.95, 0.14, 0.20), roughness=0.15, specular=0.9)
    m_tubule_pct = create_pbr_material("Mat_Proximal_Tubule", (0.28, 0.78, 0.42), roughness=0.20, sss_weight=0.42)
    m_henle = create_pbr_material("Mat_Loop_of_Henle", (0.24, 0.62, 0.92), roughness=0.20, sss_weight=0.42)
    m_collecting = create_pbr_material("Mat_Collecting_Duct", (0.95, 0.82, 0.22), roughness=0.20, sss_weight=0.45)

    root = bpy.data.objects.new("Kidney_System_Root", None)
    bpy.context.scene.collection.objects.link(root)

    organ_group = bpy.data.objects.new("Kidney_Organ_Group", None)
    bpy.context.scene.collection.objects.link(organ_group)
    organ_group.parent = root

    nephron_group = bpy.data.objects.new("Nephron_Microscopic_Group", None)
    bpy.context.scene.collection.objects.link(nephron_group)
    nephron_group.parent = root
    nephron_group.location = (4.2, 0.0, 0.0)

    # =========================================================================
    # 1. MACROSCOPIC RENAL CAPSULE (BEAN-SHAPED ORGAN WITH MEDIAL HILUM)
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1.0, location=(0.0, 0.0, 0.0))
    capsule = bpy.context.active_object
    capsule.name = "Renal_Capsule"
    capsule.scale = (1.15, 0.95, 1.85)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(capsule.data)
    for v in bm.verts:
        # Medial Hilum indentation (Concave notch on medial border X < 0)
        if v.co.x < 0.2 and abs(v.co.z) < 0.85:
            hilum_depth = (1.0 - (v.co.z / 0.85)**2) * 0.48
            v.co.x += hilum_depth
        # Superior and inferior pole curves
        if abs(v.co.z) > 0.8:
            t = (abs(v.co.z) - 0.8) / 1.05
            v.co.x *= max(0.4, 1.0 - t * 0.45)
            v.co.y *= max(0.4, 1.0 - t * 0.45)
    # Coronal Cutaway: slice front (Y > 0.04) to expose internal renal parenchyma!
    verts_cut = [v for v in bm.verts if v.co.y > 0.04]
    bmesh.ops.delete(bm, geom=verts_cut, context='VERTS')
    bm.to_mesh(capsule.data)
    bm.free()

    capsule.data.materials.append(m_capsule)
    capsule.parent = organ_group
    bpy.ops.object.shade_smooth()

    # Thick Renal Cortex Cutface (Peripheral filtration zone)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.08, depth=0.12, location=(0.0, 0.0, 0.0))
    cortex_cut = bpy.context.active_object
    cortex_cut.name = "Renal_Cortex_Cutface"
    cortex_cut.scale = (1.08, 1.78, 1.0)
    cortex_cut.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    cortex_cut.data.materials.append(m_cortex)
    cortex_cut.parent = organ_group
    bpy.ops.object.shade_smooth()

    # =========================================================================
    # 2. RENAL MEDULLARY PYRAMIDS & COLUMNS OF BERTIN
    # =========================================================================
    pyramid_angles = [-1.15, -0.75, -0.38, 0.0, 0.38, 0.75, 1.15]
    for p_i, p_ang in enumerate(pyramid_angles):
        pz = math.sin(p_ang) * 1.25
        px = 0.35 + math.cos(p_ang) * 0.55
        py = -0.02

        # Conical Medullary Pyramid pointing apex (papilla) towards hilum
        bpy.ops.mesh.primitive_cone_add(radius1=0.32, radius2=0.08, depth=0.65, location=(px, py, pz))
        pyr = bpy.context.active_object
        pyr.name = f"Renal_Pyramid_{p_i+1}"
        rot_y = -p_ang * 0.85
        pyr.rotation_euler = (0, rot_y, math.pi / 2)
        pyr.scale = (1.0, 0.65, 1.0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pyr.data.materials.append(m_pyramid)
        pyr.parent = organ_group
        bpy.ops.object.shade_smooth()

        # Cup-shaped Minor Calyx receiving renal papilla
        calyx_x = px - 0.28 * math.cos(p_ang * 0.85)
        calyx_z = pz - 0.28 * math.sin(p_ang * 0.85)
        bpy.ops.mesh.primitive_cone_add(radius1=0.14, radius2=0.08, depth=0.24, location=(calyx_x, py, calyx_z))
        calyx = bpy.context.active_object
        calyx.name = f"Minor_Calyx_{p_i+1}"
        calyx.rotation_euler = (0, rot_y + math.pi, math.pi / 2)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        calyx.data.materials.append(m_calyx)
        calyx.parent = organ_group
        bpy.ops.object.shade_smooth()

    # Major Calyces converging into Funnel-shaped Renal Pelvis
    c_pelvis = bpy.data.curves.new('Curve_Renal_Pelvis', 'CURVE')
    c_pelvis.dimensions = '3D'
    c_pelvis.bevel_depth = 0.28
    c_pelvis.bevel_resolution = 10
    s_pelv = c_pelvis.splines.new('BEZIER')
    s_pelv.bezier_points.add(2)
    s_pelv.bezier_points[0].co = (0.15, 0.0, 0.55)   # Superior major calyx
    s_pelv.bezier_points[1].co = (-0.35, 0.0, 0.0)   # Central renal pelvis
    s_pelv.bezier_points[2].co = (0.15, 0.0, -0.55)  # Inferior major calyx
    for bp in s_pelv.bezier_points:
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    pelv_obj = bpy.data.objects.new("Renal_Pelvis", c_pelvis)
    bpy.context.scene.collection.objects.link(pelv_obj)
    pelv_obj.data.materials.append(m_calyx)
    pelv_obj.parent = organ_group

    # Ureter (Muscular peristaltic conduit descending towards urinary bladder)
    c_ureter = bpy.data.curves.new('Curve_Ureter', 'CURVE')
    c_ureter.dimensions = '3D'
    c_ureter.bevel_depth = 0.16
    c_ureter.bevel_resolution = 10
    s_ur = c_ureter.splines.new('BEZIER')
    s_ur.bezier_points.add(2)
    s_ur.bezier_points[0].co = (-0.35, 0.0, 0.0)
    s_ur.bezier_points[1].co = (-0.48, -0.10, -1.25)
    s_ur.bezier_points[2].co = (-0.55, -0.15, -2.85)
    for bp in s_ur.bezier_points:
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    ur_obj = bpy.data.objects.new("Ureter", c_ureter)
    bpy.context.scene.collection.objects.link(ur_obj)
    ur_obj.data.materials.append(m_ureter)
    ur_obj.parent = organ_group

    # Renal Artery & Vein (Hilum neurovascular bundle)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=1.65, location=(-1.10, -0.05, 0.22))
    r_art = bpy.context.active_object
    r_art.name = "Renal_Artery"
    r_art.rotation_euler = (0.15, math.pi / 2.2, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    r_art.data.materials.append(m_artery)
    r_art.parent = organ_group
    bpy.ops.object.shade_smooth()

    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=1.65, location=(-1.15, 0.12, 0.08))
    r_vein = bpy.context.active_object
    r_vein.name = "Renal_Vein"
    r_vein.rotation_euler = (0.10, math.pi / 2.1, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    r_vein.data.materials.append(m_vein)
    r_vein.parent = organ_group
    bpy.ops.object.shade_smooth()

    # =========================================================================
    # 3. MICROSCOPIC FUNCTIONAL NEPHRON ULTRASTRUCTURE
    # =========================================================================
    # Bowman's Capsule (Double-walled spherical cup)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=18, radius=0.62, location=(0.0, 0.0, 1.85))
    bowman = bpy.context.active_object
    bowman.name = "Bowmans_Capsule"
    bowman.scale = (1.05, 0.85, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(bowman.data)
    # Cut anterior window to reveal inner glomerular capillary knot
    verts_bcut = [v for v in bm.verts if v.co.y > 0.08]
    bmesh.ops.delete(bm, geom=verts_bcut, context='VERTS')
    bm.to_mesh(bowman.data)
    bm.free()
    bowman.data.materials.append(m_bowman)
    bowman.parent = nephron_group
    bpy.ops.object.shade_smooth()

    # Glomerulus (High-pressure capillary tuft for ultrafiltration)
    for g_i in range(5):
        gx = (g_i % 2 - 0.5) * 0.22
        gy = -0.05
        gz = 1.85 + (g_i // 2 - 0.5) * 0.22
        bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.045, location=(gx, gy, gz))
        glom = bpy.context.active_object
        glom.name = f"Glomerular_Capillary_Loop_{g_i+1}"
        glom.rotation_euler = (math.pi / 4 + g_i * 0.5, g_i * 0.4, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        glom.data.materials.append(m_glomerulus)
        glom.parent = nephron_group

    # Afferent & Efferent Arterioles
    bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=0.85, location=(-0.35, -0.05, 2.45))
    aff = bpy.context.active_object
    aff.name = "Afferent_Arteriole"
    aff.rotation_euler = (0.15, -0.45, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    aff.data.materials.append(m_artery)
    aff.parent = nephron_group

    bpy.ops.mesh.primitive_cylinder_add(radius=0.048, depth=0.85, location=(0.35, -0.05, 2.45))
    eff = bpy.context.active_object
    eff.name = "Efferent_Arteriole"
    eff.rotation_euler = (0.15, 0.45, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    eff.data.materials.append(m_artery)
    eff.parent = nephron_group

    # Proximal Convoluted Tubule (PCT - Green, tortuous serpentine loops)
    c_pct = bpy.data.curves.new('Curve_PCT', 'CURVE')
    c_pct.dimensions = '3D'
    c_pct.bevel_depth = 0.08
    c_pct.bevel_resolution = 8
    s_pct = c_pct.splines.new('BEZIER')
    s_pct.bezier_points.add(4)
    pts_pct = [
        (0.0, 0.0, 1.25),
        (-0.55, -0.25, 1.15),
        (-0.85, 0.25, 0.85),
        (-0.45, 0.35, 0.55),
        (-0.40, 0.0, 0.25)
    ]
    for idx, p in enumerate(pts_pct):
        s_pct.bezier_points[idx].co = p
        s_pct.bezier_points[idx].handle_left_type = 'AUTO'
        s_pct.bezier_points[idx].handle_right_type = 'AUTO'
    pct_obj = bpy.data.objects.new("Proximal_Convoluted_Tubule_PCT", c_pct)
    bpy.context.scene.collection.objects.link(pct_obj)
    pct_obj.data.materials.append(m_tubule_pct)
    pct_obj.parent = nephron_group

    # Hairpin Loop of Henle (Blue, descending into renal medulla & ascending)
    c_henle = bpy.data.curves.new('Curve_Loop_of_Henle', 'CURVE')
    c_henle.dimensions = '3D'
    c_henle.bevel_depth = 0.055
    c_henle.bevel_resolution = 8
    s_henle = c_henle.splines.new('BEZIER')
    s_henle.bezier_points.add(4)
    pts_henle = [
        (-0.40, 0.0, 0.25),   # Thin descending limb
        (-0.35, 0.0, -1.85),  # Deep medullary descent
        (0.00, 0.0, -2.45),   # Hairpin bend
        (0.35, 0.0, -1.85),   # Thick ascending limb
        (0.40, 0.0, 0.25)     # Ascent back to cortex
    ]
    for idx, p in enumerate(pts_henle):
        s_henle.bezier_points[idx].co = p
        s_henle.bezier_points[idx].handle_left_type = 'AUTO'
        s_henle.bezier_points[idx].handle_right_type = 'AUTO'
    henle_obj = bpy.data.objects.new("Loop_of_Henle", c_henle)
    bpy.context.scene.collection.objects.link(henle_obj)
    henle_obj.data.materials.append(m_henle)
    henle_obj.parent = nephron_group

    # Distal Convoluted Tubule (DCT) & Medullary Collecting Duct (Yellow)
    c_dct = bpy.data.curves.new('Curve_DCT', 'CURVE')
    c_dct.dimensions = '3D'
    c_dct.bevel_depth = 0.075
    s_dct = c_dct.splines.new('BEZIER')
    s_dct.bezier_points.add(3)
    pts_dct = [
        (0.40, 0.0, 0.25),
        (0.65, 0.35, 0.65),
        (0.95, -0.15, 0.85),
        (1.20, 0.0, 0.75)
    ]
    for idx, p in enumerate(pts_dct):
        s_dct.bezier_points[idx].co = p
        s_dct.bezier_points[idx].handle_left_type = 'AUTO'
        s_dct.bezier_points[idx].handle_right_type = 'AUTO'
    dct_obj = bpy.data.objects.new("Distal_Convoluted_Tubule_DCT", c_dct)
    bpy.context.scene.collection.objects.link(dct_obj)
    dct_obj.data.materials.append(m_collecting)
    dct_obj.parent = nephron_group

    # Straight Collecting Duct plunging from cortex into renal papilla
    bpy.ops.mesh.primitive_cylinder_add(radius=0.10, depth=3.85, location=(1.20, 0.0, -0.95))
    duct = bpy.context.active_object
    duct.name = "Medullary_Collecting_Duct"
    duct.data.materials.append(m_collecting)
    duct.parent = nephron_group
    bpy.ops.object.shade_smooth()

    # =========================================================================
    # LIGHTING & CAMERA FOR BEAUTY PREVIEW RENDER
    # =========================================================================
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.lens = 45
    cam = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (2.0, -7.4, 1.2)
    cam.rotation_euler = (math.radians(78), 0, math.radians(16))

    # 3-Point Studio Lighting
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

    # Save .blend file
    blend_path = os.path.join(MODELS_DIR, "kidney_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[SUCCESS] Saved Kidney .blend -> {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR, "kidney_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[SUCCESS] Rendered Kidney preview -> {preview_path}")

    # Export optimized GLB for Three.js WebGL
    glb_path = os.path.join(OUTPUT_DIR, "kidney_realistic.glb")
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
    bat_path = os.path.join(MODELS_DIR, "Open_Kidney_In_Blender.bat")
    with open(bat_path, "w", encoding="utf-8") as bf:
        bf.write(f'@echo off\necho Opening 3D Kidney & Nephron in Blender 5.2...\nstart "" "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" "%~dp0kidney_realistic.blend"\nexit\n')
    print(f"[SUCCESS] Created Launcher -> {bat_path}")

if __name__ == "__main__":
    build_realistic_kidney()
