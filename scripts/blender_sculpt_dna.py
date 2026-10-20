"""
Ultra-Realistic B-DNA Double Helix & Molecular Transcription Complex for Blender 5.2
Sculpts an authentic molecular-grade B-DNA structure:
1. Antiparallel Sugar-Phosphate Backbones:
   - 5' to 3' Strand (Smooth spiraling phospho-diester ribbon with pentose sugar rings).
   - 3' to 5' Strand (Opposite antiparallel helical symmetry).
2. 10 Base Pairs per complete 360-degree helical pitch (3.4 nm scale, 36 deg rotation per step).
3. Authentic Major Groove (2.2 nm) and Minor Groove (1.2 nm) geometry.
4. Complementary Watson-Crick Nitrogenous Base Pairs:
   - Adenine (Purine, Crimson) <== 2 Hydrogen Bonds ==> Thymine (Pyrimidine, Cyan).
   - Guanine (Purine, Emerald) <== 3 Hydrogen Bonds ==> Cytosine (Pyrimidine, Gold).
5. Molecular Hydrogen Bonds modeled as distinct inter-molecular binding bridges.
6. Open Replication / Transcription Fork:
   - Helicase unzipping ring opening the double helix into single strands.
   - Nascent mRNA transcript emerging from template strand.
7. Histone Octamer Core (Nucleosome Beading):
   - Cylindrical histone protein octamer (H2A, H2B, H3, H4 pairs) showing 1.65 superhelical turns of DNA wrapping.
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

def create_pbr_material(name, base_color, roughness=0.22, metallic=0.08, transmission=0.0, ior=1.45,
                        sss_weight=0.25, sss_radius=(1.0, 0.35, 0.15), specular=0.7, emissive=None):
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

    if emissive:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = (*emissive, 1.0)
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = (*emissive, 1.0)
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = 0.85

    return mat

def build_realistic_dna():
    reset()
    print("[DNA GENERATOR] Sculpting molecular-grade 3D B-DNA & Transcription Fork...")

    # Materials
    m_backbone_1 = create_pbr_material("Mat_Backbone_5to3", (0.58, 0.42, 0.92), roughness=0.18, specular=0.85)
    m_backbone_2 = create_pbr_material("Mat_Backbone_3to5", (0.42, 0.58, 0.95), roughness=0.18, specular=0.85)
    m_adenine = create_pbr_material("Mat_Adenine_Red", (0.92, 0.16, 0.22), roughness=0.20, emissive=(0.8, 0.1, 0.1))
    m_thymine = create_pbr_material("Mat_Thymine_Blue", (0.12, 0.62, 0.94), roughness=0.20, emissive=(0.1, 0.4, 0.8))
    m_guanine = create_pbr_material("Mat_Guanine_Green", (0.16, 0.82, 0.38), roughness=0.20, emissive=(0.1, 0.7, 0.2))
    m_cytosine = create_pbr_material("Mat_Cytosine_Yellow", (0.95, 0.80, 0.15), roughness=0.20, emissive=(0.8, 0.6, 0.1))
    m_h_bond = create_pbr_material("Mat_Hydrogen_Bond", (0.95, 0.95, 0.95), roughness=0.10, sss_weight=0.5, emissive=(0.9, 0.9, 0.9))
    m_helicase = create_pbr_material("Mat_Helicase_Enzyme", (0.96, 0.52, 0.18), roughness=0.30, sss_weight=0.45)
    m_histone = create_pbr_material("Mat_Histone_Octamer", (0.28, 0.78, 0.85), roughness=0.32, sss_weight=0.40)
    m_mrna = create_pbr_material("Mat_mRNA_Transcript", (0.94, 0.25, 0.75), roughness=0.20, emissive=(0.8, 0.1, 0.6))

    root = bpy.data.objects.new("DNA_System_Root", None)
    bpy.context.scene.collection.objects.link(root)

    helix_group = bpy.data.objects.new("B_DNA_Double_Helix_Group", None)
    bpy.context.scene.collection.objects.link(helix_group)
    helix_group.parent = root

    fork_group = bpy.data.objects.new("Replication_Fork_Group", None)
    bpy.context.scene.collection.objects.link(fork_group)
    fork_group.parent = root

    nucleosome_group = bpy.data.objects.new("Nucleosome_Histone_Group", None)
    bpy.context.scene.collection.objects.link(nucleosome_group)
    nucleosome_group.parent = root
    nucleosome_group.location = (4.2, 0.0, 0.0)

    # =========================================================================
    # 1. B-DNA DOUBLE HELIX: ANTIPARALLEL STRANDS & COMPLEMENTARY BASES
    # =========================================================================
    steps = 30
    helix_radius = 1.05
    pitch_z = 0.28  # 10 steps = 2.8 units per turn
    base_pairs_seq = ['AT', 'GC', 'TA', 'CG', 'AT', 'AT', 'GC', 'CG', 'TA', 'GC'] * 3

    pts_s1 = []
    pts_s2 = []

    for i in range(steps):
        angle = (i / 10.0) * math.pi * 2
        z = (i - steps / 2.0) * pitch_z

        x1 = math.cos(angle) * helix_radius
        y1 = math.sin(angle) * helix_radius
        pts_s1.append((x1, y1, z))

        # Antiparallel Strand 2 with minor groove offset (~144 degrees / 2.51 rad)
        ang_offset = 2.51
        x2 = math.cos(angle + ang_offset) * helix_radius
        y2 = math.sin(angle + ang_offset) * helix_radius
        pts_s2.append((x2, y2, z))

        # Base pair sequence
        bp_type = base_pairs_seq[i % len(base_pairs_seq)]

        # Base 1 (Originating from strand 1 towards strand 2 center)
        mid_x = (x1 + x2) * 0.5
        mid_y = (y1 + y2) * 0.5
        dir_x = (mid_x - x1)
        dir_y = (mid_y - y1)
        dist = math.sqrt(dir_x**2 + dir_y**2)
        dir_x /= dist
        dir_y /= dist

        b1_mat = m_adenine if bp_type[0] == 'A' else m_guanine if bp_type[0] == 'G' else m_thymine if bp_type[0] == 'T' else m_cytosine
        b2_mat = m_thymine if bp_type[1] == 'T' else m_cytosine if bp_type[1] == 'C' else m_adenine if bp_type[1] == 'A' else m_guanine
        b1_name = f"Base_{bp_type[0]}_{i+1}"
        b2_name = f"Base_{bp_type[1]}_{i+1}"

        # Purine/Pyrimidine Ring Cylinders
        b1_pos = (x1 + dir_x * (dist * 0.40), y1 + dir_y * (dist * 0.40), z)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.09, depth=dist * 0.65, location=b1_pos)
        base1 = bpy.context.active_object
        base1.name = b1_name
        rot_ang = math.atan2(dir_y, dir_x)
        base1.rotation_euler = (0, math.pi / 2, rot_ang)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        base1.data.materials.append(b1_mat)
        base1.parent = helix_group
        bpy.ops.object.shade_smooth()

        b2_pos = (x2 - dir_x * (dist * 0.40), y2 - dir_y * (dist * 0.40), z)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.09, depth=dist * 0.65, location=b2_pos)
        base2 = bpy.context.active_object
        base2.name = b2_name
        base2.rotation_euler = (0, math.pi / 2, rot_ang)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        base2.data.materials.append(b2_mat)
        base2.parent = helix_group
        bpy.ops.object.shade_smooth()

        # Hydrogen Bonds bridging bases (2 bonds for AT, 3 bonds for GC)
        h_bonds_count = 2 if ('A' in bp_type or 'T' in bp_type) else 3
        for h_k in range(h_bonds_count):
            h_offset_z = (h_k - (h_bonds_count - 1) / 2.0) * 0.05
            h_pos = (mid_x, mid_y, z + h_offset_z)
            bpy.ops.mesh.primitive_cylinder_add(radius=0.022, depth=dist * 0.28, location=h_pos)
            hb = bpy.context.active_object
            hb.name = f"H_Bond_{i+1}_{h_k+1}"
            hb.rotation_euler = (0, math.pi / 2, rot_ang)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            hb.data.materials.append(m_h_bond)
            hb.parent = helix_group

        # Deoxyribose Pentose Sugar & Phosphate spheres along backbone
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.12, location=(x1, y1, z))
        sugar1 = bpy.context.active_object
        sugar1.name = f"Deoxyribose_5to3_{i+1}"
        sugar1.data.materials.append(m_backbone_1)
        sugar1.parent = helix_group

        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.12, location=(x2, y2, z))
        sugar2 = bpy.context.active_object
        sugar2.name = f"Deoxyribose_3to5_{i+1}"
        sugar2.data.materials.append(m_backbone_2)
        sugar2.parent = helix_group

    # Continuous Smooth Backbones
    def build_backbone_curve(name, pts, mat):
        c = bpy.data.curves.new(f'Curve_{name}', 'CURVE')
        c.dimensions = '3D'
        c.bevel_depth = 0.075
        c.bevel_resolution = 10
        s = c.splines.new('BEZIER')
        s.bezier_points.add(len(pts) - 1)
        for idx, pt in enumerate(pts):
            s.bezier_points[idx].co = pt
            s.bezier_points[idx].handle_left_type = 'AUTO'
            s.bezier_points[idx].handle_right_type = 'AUTO'
        obj = bpy.data.objects.new(name, c)
        bpy.context.scene.collection.objects.link(obj)
        obj.data.materials.append(mat)
        obj.parent = helix_group
        return obj

    build_backbone_curve("Phosphodiester_Backbone_5to3", pts_s1, m_backbone_1)
    build_backbone_curve("Phosphodiester_Backbone_3to5", pts_s2, m_backbone_2)

    # =========================================================================
    # 2. OPEN REPLICATION & TRANSCRIPTION FORK (ENZYMATIC COMPLEX)
    # =========================================================================
    # Helicase Unzipping Donut Ring (Hexameric motor unwinding DNA)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.65, minor_radius=0.22, location=(0.0, 0.0, 4.4))
    helicase = bpy.context.active_object
    helicase.name = "DNA_Helicase_Enzyme"
    helicase.data.materials.append(m_helicase)
    helicase.parent = fork_group
    bpy.ops.object.shade_smooth()

    # Unzipped Single Strands (Template & Coding strands flaring outward)
    fork_pts_1 = [
        (math.cos(0) * helix_radius, math.sin(0) * helix_radius, 4.2),
        (1.4, 0.4, 5.2),
        (2.0, 0.8, 6.4)
    ]
    fork_pts_2 = [
        (math.cos(2.51) * helix_radius, math.sin(2.51) * helix_radius, 4.2),
        (-1.4, 0.4, 5.2),
        (-2.0, 0.8, 6.4)
    ]

    c_fk1 = bpy.data.curves.new('Curve_Leading_Template_Strand', 'CURVE')
    c_fk1.dimensions = '3D'
    c_fk1.bevel_depth = 0.075
    s_fk1 = c_fk1.splines.new('BEZIER')
    s_fk1.bezier_points.add(2)
    for idx, p in enumerate(fork_pts_1):
        s_fk1.bezier_points[idx].co = p
        s_fk1.bezier_points[idx].handle_left_type = 'AUTO'
        s_fk1.bezier_points[idx].handle_right_type = 'AUTO'
    fk1_obj = bpy.data.objects.new("Leading_Template_Strand", c_fk1)
    bpy.context.scene.collection.objects.link(fk1_obj)
    fk1_obj.data.materials.append(m_backbone_1)
    fk1_obj.parent = fork_group

    c_fk2 = bpy.data.curves.new('Curve_Lagging_Template_Strand', 'CURVE')
    c_fk2.dimensions = '3D'
    c_fk2.bevel_depth = 0.075
    s_fk2 = c_fk2.splines.new('BEZIER')
    s_fk2.bezier_points.add(2)
    for idx, p in enumerate(fork_pts_2):
        s_fk2.bezier_points[idx].co = p
        s_fk2.bezier_points[idx].handle_left_type = 'AUTO'
        s_fk2.bezier_points[idx].handle_right_type = 'AUTO'
    fk2_obj = bpy.data.objects.new("Lagging_Template_Strand", c_fk2)
    bpy.context.scene.collection.objects.link(fk2_obj)
    fk2_obj.data.materials.append(m_backbone_2)
    fk2_obj.parent = fork_group

    # RNA Polymerase II / Transcription Complex & Emerging mRNA
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=18, radius=0.55, location=(1.1, 0.2, 5.0))
    rna_poly = bpy.context.active_object
    rna_poly.name = "RNA_Polymerase_II"
    rna_poly.scale = (1.2, 0.9, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    rna_poly.data.materials.append(m_helicase)
    rna_poly.parent = fork_group
    bpy.ops.object.shade_smooth()

    # Nascent mRNA Transcript Strand (Pink/Magenta ribbon)
    c_mrna = bpy.data.curves.new('Curve_Nascent_mRNA', 'CURVE')
    c_mrna.dimensions = '3D'
    c_mrna.bevel_depth = 0.06
    s_mrna = c_mrna.splines.new('BEZIER')
    s_mrna.bezier_points.add(2)
    s_mrna.bezier_points[0].co = (1.1, 0.2, 4.9)
    s_mrna.bezier_points[1].co = (1.6, -0.6, 5.2)
    s_mrna.bezier_points[2].co = (2.2, -1.2, 5.5)
    for bp in s_mrna.bezier_points:
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    mrna_obj = bpy.data.objects.new("Nascent_mRNA_Transcript", c_mrna)
    bpy.context.scene.collection.objects.link(mrna_obj)
    mrna_obj.data.materials.append(m_mrna)
    mrna_obj.parent = fork_group

    # =========================================================================
    # 3. HISTONE OCTAMER CORE & NUCLEOSOME CHROMATIN PACKAGING
    # =========================================================================
    # Cylindrical Histone Octamer (2x H2A, H2B, H3, H4 protein dimers)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.20, depth=1.35, location=(0.0, 0.0, 0.0))
    histone = bpy.context.active_object
    histone.name = "Histone_Octamer_Core"
    histone.data.materials.append(m_histone)
    histone.parent = nucleosome_group
    bpy.ops.object.shade_smooth()

    # 1.65 Turns of DNA Wrapping tightly around Histone Octamer spool (147 base pairs)
    hist_pts = []
    wrap_turns = 1.65
    wrap_steps = 28
    for w_i in range(wrap_steps):
        w_ang = (w_i / wrap_steps) * wrap_turns * math.pi * 2
        w_z = (w_i / wrap_steps - 0.5) * 1.15
        w_r = 1.38
        hist_pts.append((math.cos(w_ang) * w_r, math.sin(w_ang) * w_r, w_z))

    c_wrap = bpy.data.curves.new('Curve_Nucleosomal_DNA_Wrap', 'CURVE')
    c_wrap.dimensions = '3D'
    c_wrap.bevel_depth = 0.08
    c_wrap.bevel_resolution = 8
    s_wrap = c_wrap.splines.new('BEZIER')
    s_wrap.bezier_points.add(len(hist_pts) - 1)
    for idx, p in enumerate(hist_pts):
        s_wrap.bezier_points[idx].co = p
        s_wrap.bezier_points[idx].handle_left_type = 'AUTO'
        s_wrap.bezier_points[idx].handle_right_type = 'AUTO'
    wrap_obj = bpy.data.objects.new("Nucleosomal_DNA_Wrap", c_wrap)
    bpy.context.scene.collection.objects.link(wrap_obj)
    wrap_obj.data.materials.append(m_backbone_1)
    wrap_obj.parent = nucleosome_group

    # Histone H1 Clamp (Linker histone locking DNA wrap)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.28, location=(1.35, 0.35, 0.0))
    h1 = bpy.context.active_object
    h1.name = "Histone_H1_Linker"
    h1.data.materials.append(m_adenine)
    h1.parent = nucleosome_group
    bpy.ops.object.shade_smooth()

    # =========================================================================
    # LIGHTING & CAMERA FOR BEAUTY PREVIEW RENDER
    # =========================================================================
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.lens = 45
    cam = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (2.2, -7.5, 1.8)
    cam.rotation_euler = (math.radians(76), 0, math.radians(16))

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
    blend_path = os.path.join(MODELS_DIR, "dna_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[SUCCESS] Saved DNA .blend -> {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR, "dna_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[SUCCESS] Rendered DNA preview -> {preview_path}")

    # Export optimized GLB for Three.js WebGL
    glb_path = os.path.join(OUTPUT_DIR, "dna_realistic.glb")
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
    bat_path = os.path.join(MODELS_DIR, "Open_DNA_In_Blender.bat")
    with open(bat_path, "w", encoding="utf-8") as bf:
        bf.write(f'@echo off\necho Opening 3D DNA Double Helix & Nucleosome in Blender 5.2...\nstart "" "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" "%~dp0dna_realistic.blend"\nexit\n')
    print(f"[SUCCESS] Created Launcher -> {bat_path}")

if __name__ == "__main__":
    build_realistic_dna()
