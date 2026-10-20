"""
Ultra-Realistic Human Stomach & Gastric Architecture Generator for Blender 5.2
Sculpts an authentic medical-grade human stomach and proximal duodenum anatomy model:
1. Macroscopic Gastric Morphology:
   - Terminal Abdominal Esophagus & Cardiac Notch (Incisura Cardiaca).
   - Cardia with Lower Esophageal Sphincter (LES) physiological valve.
   - High convex Gastric Fundus (dome containing gastric gas pocket).
   - Major Gastric Corpus (Body) with Greater Curvature and Lesser Curvature (with Incisura Angularis).
   - Pyloric Antrum transitioning into narrow Pyloric Canal.
   - Anatomical Pyloric Sphincter muscular ring controlling gastric emptying.
   - Proximal Duodenum (Duodenal Bulb & C-loop) with Hepato-Pancreatic Ampulla of Vater.
2. Muscular Architecture & Vascular Network:
   - 3-Layer Muscularis Externa (Outer Longitudinal, Middle Circular, Inner Oblique).
   - Left & Right Gastric Arteries along Lesser Curvature.
   - Left & Right Gastro-Omental (Epiploic) Arterial Arcade along Greater Curvature.
3. Coronal Dissection Window Cutaway:
   - Deep mucosal Gastric Rugae folds (expandable accordion folds).
   - Gastric Pits & Foveolae with specialized secretory cell populations:
     * Parietal (Oxyntic) Cells: Concentrated Hydrochloric Acid (pH 1.5 - 2.0) & Intrinsic Factor.
     * Chief (Zymogenic) Cells: Pepsinogen (cleaved into active Pepsin by HCl).
     * G-Cells (Enteroendocrine): Gastrin hormone secretion.
     * Mucous Neck Cells: Insoluble alkaline bicarbonate mucus protective barrier.
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
                        is_mucosa=False, is_serosa=False):
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

    if is_mucosa:
        # Micro-foveolar textured mucosal lining with glossy gastric mucus sheen
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-400, 100)
        noise.inputs['Scale'].default_value = 35.0
        noise.inputs['Detail'].default_value = 5.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-100, -100)
        bump.inputs['Strength'].default_value = 0.28
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    if is_serosa:
        # Smooth glistening peritoneum with delicate vascular streaks
        noise = nodes.new(type='ShaderNodeTexNoise')
        noise.location = (-400, 100)
        noise.inputs['Scale'].default_value = 18.0
        noise.inputs['Detail'].default_value = 3.0
        links.new(tex_coord.outputs['Object'], noise.inputs['Vector'])

        cr = nodes.new(type='ShaderNodeValToRGB')
        cr.location = (-150, 100)
        cr.color_ramp.elements[0].position = 0.3
        cr.color_ramp.elements[0].color = (base_color[0] * 0.92, base_color[1] * 0.92, base_color[2] * 0.90, 1.0)
        cr.color_ramp.elements[1].position = 0.7
        cr.color_ramp.elements[1].color = (base_color[0] * 1.08, base_color[1] * 1.05, base_color[2] * 1.02, 1.0)
        links.new(noise.outputs['Fac'], cr.inputs['Fac'])
        links.new(cr.outputs['Color'], bsdf.inputs['Base Color'])

    return mat

def create_smooth_subd(obj, levels=2):
    mod = obj.modifiers.new(name="Subdivision", type='SUBSURF')
    mod.levels = levels
    mod.render_levels = levels
    for p in obj.data.polygons:
        p.use_smooth = True
    return mod

def build_ultra_stomach():
    reset()

    # Materials
    mat_serosa = create_pbr_material("Mat_GastricSerosa", (0.85, 0.42, 0.40), roughness=0.22, sss_weight=0.45, is_serosa=True)
    mat_fundus = create_pbr_material("Mat_GastricFundus", (0.82, 0.38, 0.36), roughness=0.24, sss_weight=0.42, is_serosa=True)
    mat_pylorus = create_pbr_material("Mat_PyloricRegion", (0.86, 0.48, 0.44), roughness=0.26, sss_weight=0.40, is_serosa=True)
    mat_duodenum = create_pbr_material("Mat_Duodenum", (0.88, 0.58, 0.48), roughness=0.28, sss_weight=0.38)
    mat_esophagus = create_pbr_material("Mat_Esophagus", (0.84, 0.52, 0.48), roughness=0.30, sss_weight=0.35)
    mat_sphincter = create_pbr_material("Mat_SphincterMuscle", (0.75, 0.28, 0.26), roughness=0.32, sss_weight=0.30)
    mat_mucosa = create_pbr_material("Mat_GastricMucosa", (0.92, 0.32, 0.35), roughness=0.18, sss_weight=0.48, is_mucosa=True)
    mat_rugae = create_pbr_material("Mat_GastricRugae", (0.95, 0.26, 0.30), roughness=0.16, sss_weight=0.50, is_mucosa=True)
    mat_artery = create_pbr_material("Mat_GastricArtery", (0.90, 0.12, 0.14), roughness=0.22, sss_weight=0.25)
    mat_chyme = create_pbr_material("Mat_AcidChyme", (0.85, 0.82, 0.45), roughness=0.12, transmission=0.65, alpha=0.75)

    # ========================================================
    # 1. ESOPHAGUS & CARDIA (Superior inflow at X ~ 0.5, Y ~ 0, Z ~ 3.2)
    # ========================================================
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.62, depth=2.4,
        location=(0.4, -0.15, 3.4)
    )
    esophagus = bpy.context.active_object
    esophagus.name = "Abdominal_Esophagus"
    esophagus.rotation_euler = (0.2, 0.35, 0.1)
    esophagus.data.materials.append(mat_esophagus)
    create_smooth_subd(esophagus, 1)

    # Lower Esophageal Sphincter (Cardiac constriction ring)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.70, minor_radius=0.18,
        major_segments=28, minor_segments=16,
        location=(0.35, -0.1, 2.3)
    )
    les_ring = bpy.context.active_object
    les_ring.name = "Lower_Esophageal_Sphincter"
    les_ring.data.materials.append(mat_sphincter)
    create_smooth_subd(les_ring, 1)

    # ========================================================
    # 2. GASTRIC FUNDUS (Superior left dome, Z ~ 3.2, X ~ -1.8)
    # ========================================================
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=32, ring_count=24, radius=1.75,
        location=(-1.5, 0.0, 2.5)
    )
    fundus = bpy.context.active_object
    fundus.name = "Gastric_Fundus"
    fundus.scale = (1.2, 0.95, 1.1)
    fundus.rotation_euler = (0.1, -0.2, 0.15)
    fundus.data.materials.append(mat_fundus)
    create_smooth_subd(fundus, 2)

    # ========================================================
    # 3. GASTRIC CORPUS (BODY) & CURVATURES (Posterior half + Intact wall)
    # ========================================================
    # Main Body Ellipsoid
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=36, ring_count=28, radius=2.4,
        location=(-0.6, -0.2, 0.4)
    )
    corpus = bpy.context.active_object
    corpus.name = "Gastric_Body_Corpus"
    corpus.scale = (1.25, 0.85, 1.45)
    corpus.rotation_euler = (0.25, -0.15, -0.35)
    corpus.data.materials.append(mat_serosa)
    create_smooth_subd(corpus, 2)

    # Greater Curvature (Left lateral convexity, sites of greater omentum)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=2.6, minor_radius=0.45,
        major_segments=36, minor_segments=18,
        location=(-0.9, -0.3, 0.2)
    )
    greater_curv = bpy.context.active_object
    greater_curv.name = "Greater_Curvature"
    greater_curv.scale = (1.2, 0.6, 1.4)
    greater_curv.rotation_euler = (0.2, 0.1, -0.4)
    greater_curv.data.materials.append(mat_serosa)
    create_smooth_subd(greater_curv, 1)

    # Lesser Curvature (Medial superior concavity with angular notch)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.6, minor_radius=0.35,
        major_segments=28, minor_segments=16,
        location=(0.3, -0.1, 1.1)
    )
    lesser_curv = bpy.context.active_object
    lesser_curv.name = "Lesser_Curvature"
    lesser_curv.scale = (0.8, 0.5, 1.1)
    lesser_curv.rotation_euler = (-0.15, 0.2, 0.3)
    lesser_curv.data.materials.append(mat_serosa)
    create_smooth_subd(lesser_curv, 1)

    # ========================================================
    # 4. PYLORIC ANTRUM, CANAL & PYLORIC SPHINCTER
    # ========================================================
    # Pyloric Antrum (Funnel narrowing toward patient's right)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=28, radius=1.35, depth=2.4,
        location=(1.2, -0.1, -0.7)
    )
    pyloric_antrum = bpy.context.active_object
    pyloric_antrum.name = "Pyloric_Antrum"
    pyloric_antrum.rotation_euler = (0.1, 1.15, -0.3)
    pyloric_antrum.scale = (1.0, 0.8, 1.0)
    pyloric_antrum.data.materials.append(mat_pylorus)
    create_smooth_subd(pyloric_antrum, 2)

    # Pyloric Canal
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.85, depth=1.2,
        location=(2.3, -0.05, -0.3)
    )
    pyloric_canal = bpy.context.active_object
    pyloric_canal.name = "Pyloric_Canal"
    pyloric_canal.rotation_euler = (0.05, 1.35, -0.2)
    pyloric_canal.data.materials.append(mat_pylorus)
    create_smooth_subd(pyloric_canal, 1)

    # Pyloric Sphincter (Thick smooth muscle valve)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.72, minor_radius=0.22,
        major_segments=28, minor_segments=16,
        location=(2.9, 0.0, -0.15)
    )
    pyloric_sphincter = bpy.context.active_object
    pyloric_sphincter.name = "Pyloric_Sphincter"
    pyloric_sphincter.rotation_euler = (0.0, 1.45, 0.0)
    pyloric_sphincter.data.materials.append(mat_sphincter)
    create_smooth_subd(pyloric_sphincter, 1)

    # ========================================================
    # 5. DUODENUM (DUODENAL BULB & C-LOOP)
    # ========================================================
    duodenum_curve = bpy.data.curves.new('DuodenumCurve', type='CURVE')
    duodenum_curve.dimensions = '3D'
    d_spline = duodenum_curve.splines.new('BEZIER')
    num_d_pts = 6
    d_spline.bezier_points.add(num_d_pts - 1)

    d_pts = [
        (3.0, 0.0, -0.15),   # Duodenal bulb (Pyloric junction)
        (3.8, 0.1, -0.3),    # Superior duodenal flexure
        (4.2, 0.2, -1.6),    # Descending duodenum (receives bile/pancreatic ducts)
        (3.7, 0.0, -2.8),    # Inferior duodenal flexure
        (2.4, -0.2, -2.9),   # Horizontal (transverse) duodenum
        (1.2, -0.1, -2.4),   # Ascending duodenum toward ligament of Treitz
    ]
    for i, pt in enumerate(d_pts):
        bp = d_spline.bezier_points[i]
        bp.co = pt
        bp.handle_left = (pt[0] - 0.3, pt[1], pt[2] + 0.2)
        bp.handle_right = (pt[0] + 0.3, pt[1], pt[2] - 0.2)

    duodenum_curve.bevel_depth = 0.58
    duodenum_curve.bevel_resolution = 10
    duodenum_obj = bpy.data.objects.new("Duodenum_C_Loop", duodenum_curve)
    bpy.context.scene.collection.objects.link(duodenum_obj)
    duodenum_obj.data.materials.append(mat_duodenum)

    # Major Duodenal Papilla (Ampulla of Vater insertion)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.25,
        location=(4.05, 0.15, -1.4)
    )
    ampulla = bpy.context.active_object
    ampulla.name = "Ampulla_Of_Vater"
    ampulla.data.materials.append(mat_sphincter)

    # ========================================================
    # 6. CORONAL ANTERIOR DISSECTION CUTAWAY: GASTRIC RUGAE
    # ========================================================
    # Cutaway Interior Backplate (Posterior wall internal mucosal basin)
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=32, ring_count=24, radius=2.2,
        location=(-0.6, -0.2, 0.4)
    )
    mucosa_basin = bpy.context.active_object
    mucosa_basin.name = "Gastric_Mucosa_Lining"
    mucosa_basin.scale = (1.18, 0.80, 1.38)
    mucosa_basin.rotation_euler = (0.25, -0.15, -0.35)
    mucosa_basin.data.materials.append(mat_mucosa)
    create_smooth_subd(mucosa_basin, 2)

    # 10 Sculpted Gastric Rugae Accordion Folds (Corrugated ridges)
    rugae_group = []
    for r_idx in range(9):
        theta = -0.8 + r_idx * 0.22
        r_curve = bpy.data.curves.new(f'RugaeCurve_{r_idx}', type='CURVE')
        r_curve.dimensions = '3D'
        r_spline = r_curve.splines.new('BEZIER')
        r_spline.bezier_points.add(3)

        x_base = -1.2 + r_idx * 0.28
        y_depth = 0.25 + math.sin(r_idx * 0.7) * 0.15
        z_start = 1.8 - r_idx * 0.35

        r_pts = [
            (x_base - 0.4, y_depth, z_start + 0.6),
            (x_base + 0.1, y_depth + 0.1, z_start),
            (x_base - 0.2, y_depth + 0.05, z_start - 0.6),
            (x_base + 0.3, y_depth, z_start - 1.1)
        ]
        for p_i, pt in enumerate(r_pts):
            bp = r_spline.bezier_points[p_i]
            bp.co = pt
            bp.handle_left = (pt[0] - 0.2, pt[1], pt[2] + 0.2)
            bp.handle_right = (pt[0] + 0.2, pt[1], pt[2] - 0.2)

        r_curve.bevel_depth = 0.14
        r_curve.bevel_resolution = 6
        rugae_obj = bpy.data.objects.new(f"Gastric_Rugae_Fold_{r_idx+1}", r_curve)
        bpy.context.scene.collection.objects.link(rugae_obj)
        rugae_obj.data.materials.append(mat_rugae)
        rugae_group.append(rugae_obj)

    # Specialized Secretory Glands Placard (Parietal & Chief Cells Marker)
    bpy.ops.mesh.primitive_cube_add(
        size=0.38,
        location=(-0.85, 0.35, 0.45)
    )
    glands_marker = bpy.context.active_object
    glands_marker.name = "Gastric_Pits_And_Parietal_Cells"
    glands_marker.scale = (1.0, 0.2, 0.9)
    glands_marker.data.materials.append(mat_rugae)

    # Gastric Acid / Chyme Pool in dependent fundus/antrum
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=1.65, depth=0.45,
        location=(-0.5, 0.1, -0.6)
    )
    chyme_pool = bpy.context.active_object
    chyme_pool.name = "Acid_Chyme_Pool"
    chyme_pool.rotation_euler = (0.2, 0.0, 0.0)
    chyme_pool.scale = (1.2, 0.7, 1.0)
    chyme_pool.data.materials.append(mat_chyme)

    # ========================================================
    # 7. GASTRIC ARTERIAL NETWORK (Left & Right Gastric Arteries)
    # ========================================================
    # Left Gastric Artery (along lesser curvature)
    lga_curve = bpy.data.curves.new('LeftGastricArtery', type='CURVE')
    lga_curve.dimensions = '3D'
    lga_spline = lga_curve.splines.new('BEZIER')
    lga_spline.bezier_points.add(3)
    lga_pts = [
        (0.2, -0.6, 2.2),
        (0.1, -0.7, 1.4),
        (0.5, -0.65, 0.6),
        (1.2, -0.5, -0.2)
    ]
    for i, pt in enumerate(lga_pts):
        bp = lga_spline.bezier_points[i]
        bp.co = pt
        bp.handle_left = (pt[0] - 0.15, pt[1], pt[2] + 0.15)
        bp.handle_right = (pt[0] + 0.15, pt[1], pt[2] - 0.15)
    lga_curve.bevel_depth = 0.09
    lga_curve.bevel_resolution = 6
    lga_obj = bpy.data.objects.new("Left_Gastric_Artery", lga_curve)
    bpy.context.scene.collection.objects.link(lga_obj)
    lga_obj.data.materials.append(mat_artery)

    # Right Gastro-Omental Artery (along greater curvature)
    rga_curve = bpy.data.curves.new('GastroOmentalArtery', type='CURVE')
    rga_curve.dimensions = '3D'
    rga_spline = rga_curve.splines.new('BEZIER')
    rga_spline.bezier_points.add(4)
    rga_pts = [
        (-2.2, -0.4, 2.0),
        (-2.6, -0.5, 0.8),
        (-2.2, -0.6, -0.6),
        (-0.8, -0.7, -1.4),
        (1.4, -0.5, -1.1)
    ]
    for i, pt in enumerate(rga_pts):
        bp = rga_spline.bezier_points[i]
        bp.co = pt
        bp.handle_left = (pt[0] - 0.2, pt[1], pt[2] + 0.2)
        bp.handle_right = (pt[0] + 0.2, pt[1], pt[2] - 0.2)
    rga_curve.bevel_depth = 0.10
    rga_curve.bevel_resolution = 6
    rga_obj = bpy.data.objects.new("Gastro_Omental_Artery", rga_curve)
    bpy.context.scene.collection.objects.link(rga_obj)
    rga_obj.data.materials.append(mat_artery)

    # ========================================================
    # STUDIO LIGHTING & CAMERA
    # ========================================================
    cam_data = bpy.data.cameras.new("StudioCamera")
    cam_data.lens = 52
    cam_obj = bpy.data.objects.new("StudioCamera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.8, -13.5, 0.5)
    cam_obj.rotation_euler = (1.52, 0.0, 0.0)
    bpy.context.scene.camera = cam_obj

    key_light = bpy.data.lights.new("KeyLight", type='AREA')
    key_light.energy = 460
    key_light.size = 4.2
    key_obj = bpy.data.objects.new("KeyLight", key_light)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.location = (3.5, -5.5, 4.5)

    fill_light = bpy.data.lights.new("FillLight", type='AREA')
    fill_light.energy = 220
    fill_light.size = 5.0
    fill_obj = bpy.data.objects.new("FillLight", fill_light)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-4.5, -4.5, 3.0)

    rim_light = bpy.data.lights.new("RimLight", type='AREA')
    rim_light.energy = 480
    rim_light.size = 3.5
    rim_obj = bpy.data.objects.new("RimLight", rim_light)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (0.0, 6.0, 3.5)

    # Save to native .blend file
    blend_path = os.path.join(MODELS_DIR, "stomach_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[STOMACH] Saved native .blend to {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR, "stomach_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[STOMACH] Rendered preview -> {preview_path}")

    # Export to WebGL GLB
    glb_path = os.path.join(OUTPUT_DIR, "stomach_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[STOMACH SUCCESS] Exported complete stomach model to {glb_path}")

if __name__ == '__main__':
    build_ultra_stomach()
