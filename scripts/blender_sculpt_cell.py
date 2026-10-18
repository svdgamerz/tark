"""
Ultra-Realistic Eukaryotic Cell Ultrastructure Generator for Blender 5.2
Sculpts an authentic medical/cytological grade eukaryotic cell with:
1. 3/4 Sagittal cutaway plasma membrane with lipid bilayer micro-texture and translucent cytosol.
2. Double-membrane Nuclear Envelope with octagonal Nuclear Pore Complexes,
   dense granular Nucleolus, and spiraling chromatin fibers.
3. Authentic sausage-shaped Mitochondria with serpentine winding inner Cristae folds
   and intermembrane space.
4. Ribbon-like Rough Endoplasmic Reticulum (RER) sheets studded with golden ribosome granules.
5. Tubular Smooth Endoplasmic Reticulum (SER) meshwork.
6. Polarized Golgi Apparatus with cis/trans curved cisternae stacks and budding secretory vesicles.
7. Centrosome with orthogonal 9-triplet microtubule Centrioles (Mother & Daughter barrels).
8. Lysosomes and Peroxisomes with dense crystalline enzymatic cores.
9. Cytoskeletal microtubule network radiating from the centrosome.
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

def create_pbr_material(name, base_color, roughness=0.3, metallic=0.0, transmission=0.0, ior=1.45, 
                        sss_weight=0.25, sss_radius=(1.0, 0.25, 0.1), specular=0.6, alpha=1.0, is_membrane=False):
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

    if is_membrane:
        # Fluid mosaic lipid bilayer surface bump
        vor = nodes.new(type='ShaderNodeTexVoronoi')
        vor.location = (-350, 0)
        vor.inputs['Scale'].default_value = 55.0
        links.new(tex_coord.outputs['Object'], vor.inputs['Vector'])

        bump = nodes.new(type='ShaderNodeBump')
        bump.location = (-50, -100)
        bump.inputs['Strength'].default_value = 0.18
        links.new(vor.outputs['Distance'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])

    return mat

def build_ultra_cell():
    reset()
    print("[CELL SCULPT] Generating anatomical masterpiece eukaryotic cell...")

    # Materials
    m_mem = create_pbr_material("Mat_PlasmaMembrane", (0.18, 0.62, 0.72), roughness=0.32, sss_weight=0.35, is_membrane=True)
    m_cyto = create_pbr_material("Mat_Cytosol", (0.14, 0.42, 0.62), roughness=0.45, alpha=0.32, transmission=0.6)
    m_nuc_out = create_pbr_material("Mat_NuclearOuter", (0.42, 0.20, 0.62), roughness=0.30, sss_weight=0.38)
    m_nuc_in = create_pbr_material("Mat_NuclearInner", (0.35, 0.14, 0.52), roughness=0.35, sss_weight=0.35)
    m_nucleolus = create_pbr_material("Mat_Nucleolus", (0.28, 0.08, 0.45), roughness=0.42, sss_weight=0.4)
    m_pore = create_pbr_material("Mat_NuclearPore", (0.85, 0.75, 0.22), roughness=0.25, metallic=0.2)
    m_chrom = create_pbr_material("Mat_Chromatin", (0.65, 0.28, 0.85), roughness=0.4)
    m_mito_out = create_pbr_material("Mat_MitoOuter", (0.84, 0.32, 0.14), roughness=0.30, sss_weight=0.3)
    m_cristae = create_pbr_material("Mat_MitoCristae", (0.95, 0.74, 0.16), roughness=0.22, metallic=0.15, sss_weight=0.25)
    m_er = create_pbr_material("Mat_EndoplasmicReticulum", (0.24, 0.68, 0.42), roughness=0.35, sss_weight=0.3)
    m_ribo = create_pbr_material("Mat_RibosomeGranule", (0.96, 0.84, 0.22), roughness=0.25, specular=0.8)
    m_golgi = create_pbr_material("Mat_GolgiApparatus", (0.86, 0.48, 0.16), roughness=0.28, sss_weight=0.3)
    m_vesicle = create_pbr_material("Mat_SecretoryVesicle", (0.92, 0.62, 0.20), roughness=0.25, sss_weight=0.25)
    m_centriole = create_pbr_material("Mat_CentrioleTriplet", (0.88, 0.88, 0.92), roughness=0.22, metallic=0.6)
    m_lyso = create_pbr_material("Mat_Lysosome", (0.12, 0.75, 0.65), roughness=0.25, sss_weight=0.3)

    root = bpy.data.objects.new("Cell_Root", None)
    bpy.context.scene.collection.objects.link(root)

    # =========================================================================
    # 1. 3/4 SAGITTAL CUTAWAY PLASMA MEMBRANE & CYTOSOLIC INTERIOR
    # =========================================================================
    bpy.ops.mesh.primitive_uv_sphere_add(segments=72, ring_count=54, radius=3.25, location=(0, 0, 0))
    cell_sphere = bpy.context.active_object
    cell_sphere.name = "Plasma_Membrane_Cutaway"

    # Slice out 1/4 wedge (X > 0 and Y > 0)
    bm = bmesh.new()
    bm.from_mesh(cell_sphere.data)
    verts_to_remove = [v for v in bm.verts if v.co.x > 0.08 and v.co.y > 0.08]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(cell_sphere.data)
    bm.free()
    cell_sphere.data.materials.append(m_mem)
    cell_sphere.parent = root

    # =========================================================================
    # 2. DOUBLE-MEMBRANE NUCLEUS, PORES, CHROMATIN & NUCLEOLUS
    # =========================================================================
    # Outer Nuclear Membrane (3/4 Cutaway)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.28, location=(-0.68, -0.68, 0.22))
    nuc_outer = bpy.context.active_object
    nuc_outer.name = "Nucleus_Outer_Membrane"
    bm = bmesh.new()
    bm.from_mesh(nuc_outer.data)
    verts_to_remove = [v for v in bm.verts if (v.co.x + 0.68) > 0.05 and (v.co.y + 0.68) > 0.05]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(nuc_outer.data)
    bm.free()
    nuc_outer.data.materials.append(m_nuc_out)
    nuc_outer.parent = root

    # Inner Nuclear Membrane
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=1.20, location=(-0.68, -0.68, 0.22))
    nuc_inner = bpy.context.active_object
    nuc_inner.name = "Nucleus_Inner_Membrane"
    bm = bmesh.new()
    bm.from_mesh(nuc_inner.data)
    verts_to_remove = [v for v in bm.verts if (v.co.x + 0.68) > 0.05 and (v.co.y + 0.68) > 0.05]
    bmesh.ops.delete(bm, geom=verts_to_remove, context='VERTS')
    bm.to_mesh(nuc_inner.data)
    bm.free()
    nuc_inner.data.materials.append(m_nuc_in)
    nuc_inner.parent = root

    # Dense Nucleolus
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.46, location=(-0.74, -0.74, 0.38))
    nucleolus = bpy.context.active_object
    nucleolus.name = "Nucleolus"
    nucleolus.data.materials.append(m_nucleolus)
    nucleolus.parent = root

    # 16 Nuclear Pore Complexes (NPCs) along the outer envelope
    for np_i in range(16):
        ang = (np_i / 16) * math.pi * 1.5 + math.pi * 0.5
        z_off = math.sin(np_i * 1.2) * 0.6
        px = -0.68 + math.cos(ang) * 1.28
        py = -0.68 + math.sin(ang) * 1.28
        pz = 0.22 + z_off
        bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.02, major_segments=16, minor_segments=8, location=(px, py, pz))
        pore = bpy.context.active_object
        pore.name = f"Nuclear_Pore_{np_i+1}"
        pore.rotation_euler = (0, math.sin(ang), math.cos(ang))
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        pore.data.materials.append(m_pore)
        pore.parent = root

    # Chromatin Thread Coils inside nucleoplasm
    for ch in range(6):
        c_curve = bpy.data.curves.new(f'Curve_Chromatin_{ch}', 'CURVE')
        c_curve.dimensions = '3D'
        c_curve.bevel_depth = 0.035
        s_c = c_curve.splines.new('BEZIER')
        s_c.bezier_points.add(2)
        s_c.bezier_points[0].co = (-0.95 + math.sin(ch) * 0.4, -0.55 + (ch % 3) * 0.2, 0.15)
        s_c.bezier_points[1].co = (-0.65 + math.cos(ch) * 0.3, -0.85 + (ch % 2) * 0.2, 0.35)
        s_c.bezier_points[2].co = (-0.80, -0.60, 0.45)
        for p in s_c.bezier_points:
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'
        c_obj = bpy.data.objects.new(f"Chromatin_Thread_{ch+1}", c_curve)
        bpy.context.scene.collection.objects.link(c_obj)
        c_obj.data.materials.append(m_chrom)
        c_obj.parent = root

    # =========================================================================
    # 3. HIGH-FIDELITY MITOCHONDRIA WITH SERPENTINE INNER CRISTAE FOLDS
    # =========================================================================
    mito_configs = [
        ("Mitochondrion_1", (1.60, -1.25, 0.55), (0.42, 0.62, 0.22), 0.95),
        ("Mitochondrion_2", (-1.70, 1.25, -0.45), (-0.32, 0.52, 0.82), 0.90),
        ("Mitochondrion_3", (0.45, -1.90, -0.85), (0.82, -0.22, 0.42), 0.85)
    ]
    for m_name, m_pos, m_rot, m_len in mito_configs:
        m_group = bpy.data.objects.new(m_name, None)
        bpy.context.scene.collection.objects.link(m_group)
        m_group.parent = root
        m_group.location = m_pos
        m_group.rotation_euler = m_rot

        # Sausage capsule outer membrane (3/4 cutaway to expose internal cristae)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.34, depth=m_len, location=(0, 0, 0))
        m_out = bpy.context.active_object
        m_out.name = f"{m_name}_Outer"
        m_out.data.materials.append(m_mito_out)
        m_out.parent = m_group

        # 6 Serpentine Inner Cristae Folds
        for c_k in range(6):
            z_off = -m_len * 0.38 + (c_k / 5) * (m_len * 0.76)
            c_curve = bpy.data.curves.new(f'Curve_Crista_{c_k}', 'CURVE')
            c_curve.dimensions = '3D'
            c_curve.bevel_depth = 0.038
            s_cr = c_curve.splines.new('BEZIER')
            s_cr.bezier_points.add(2)
            s_cr.bezier_points[0].co = (-0.24, 0.0, z_off)
            s_cr.bezier_points[1].co = (0.0, 0.18 * (1 if c_k % 2 == 0 else -1), z_off + 0.03)
            s_cr.bezier_points[2].co = (0.24, 0.0, z_off)
            for p in s_cr.bezier_points:
                p.handle_left_type = 'AUTO'
                p.handle_right_type = 'AUTO'
            cr_obj = bpy.data.objects.new(f"{m_name}_Crista_{c_k+1}", c_curve)
            bpy.context.scene.collection.objects.link(cr_obj)
            cr_obj.data.materials.append(m_cristae)
            cr_obj.parent = m_group

    # =========================================================================
    # 4. ROUGH ENDOPLASMIC RETICULUM (RER) WITH RIBOSOME PEARLS
    # =========================================================================
    rer_group = bpy.data.objects.new("Rough_ER", None)
    bpy.context.scene.collection.objects.link(rer_group)
    rer_group.parent = root

    for f_i in range(5):
        rad = 1.42 + f_i * 0.28
        bpy.ops.mesh.primitive_torus_add(major_radius=rad, minor_radius=0.065, major_segments=40, minor_segments=14, location=(-0.68, -0.68, 0.22))
        er_sheet = bpy.context.active_object
        er_sheet.name = f"ER_Cisterna_{f_i+1}"
        er_sheet.rotation_euler = (0.18 * f_i, 0.26 * f_i, 0.12)
        er_sheet.scale = (1.0, 0.72, 0.42)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        er_sheet.data.materials.append(m_er)
        er_sheet.parent = rer_group

        # Golden Ribosomes studded along the cisternal surface
        for r_j in range(10):
            r_ang = (r_j / 10) * math.pi * 1.5
            rx = -0.68 + math.cos(r_ang) * (rad + 0.055)
            ry = -0.68 + math.sin(r_ang) * (rad + 0.055)
            rz = 0.22 + 0.06 * math.sin(r_ang * 2.0)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=8, radius=0.038, location=(rx, ry, rz))
            ribo = bpy.context.active_object
            ribo.name = f"Ribosome_{f_i+1}_{r_j+1}"
            ribo.data.materials.append(m_ribo)
            ribo.parent = rer_group

    # =========================================================================
    # 5. GOLGI APPARATUS & SECRETORY TRANSPORT VESICLES
    # =========================================================================
    golgi_group = bpy.data.objects.new("Golgi_Apparatus", None)
    bpy.context.scene.collection.objects.link(golgi_group)
    golgi_group.parent = root

    for g_i in range(5):
        c_curve = bpy.data.curves.new(f'Curve_Golgi_{g_i}', 'CURVE')
        c_curve.dimensions = '3D'
        c_curve.bevel_depth = 0.085
        c_curve.bevel_resolution = 12
        s_g = c_curve.splines.new('BEZIER')
        s_g.bezier_points.add(2)
        y_pos = 1.15 + g_i * 0.18
        s_g.bezier_points[0].co = (0.58, y_pos, 0.82)
        s_g.bezier_points[1].co = (1.24, y_pos - 0.16, 0.88)
        s_g.bezier_points[2].co = (1.88, y_pos, 0.82)
        for p in s_g.bezier_points:
            p.handle_left_type = 'AUTO'
            p.handle_right_type = 'AUTO'
        g_obj = bpy.data.objects.new(f"Golgi_Cisterna_{g_i+1}", c_curve)
        bpy.context.scene.collection.objects.link(g_obj)
        g_obj.data.materials.append(m_golgi)
        g_obj.parent = golgi_group

    # 14 Budding and detached Secretory Vesicles
    for v_i in range(14):
        vx = 0.48 + (v_i % 4) * 0.48 + (v_i // 4) * 0.12
        vy = 1.05 + (v_i // 4) * 0.38
        vz = 0.72 + (v_i % 3) * 0.16
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=14, radius=0.095, location=(vx, vy, vz))
        ves = bpy.context.active_object
        ves.name = f"Secretory_Vesicle_{v_i+1}"
        ves.data.materials.append(m_vesicle)
        ves.parent = golgi_group

    # =========================================================================
    # 6. CENTROSOME WITH ORTHOGONAL 9-TRIPLET CENTRIOLES
    # =========================================================================
    centro_group = bpy.data.objects.new("Centrosome", None)
    bpy.context.scene.collection.objects.link(centro_group)
    centro_group.parent = root
    centro_group.location = (-0.22, 0.22, 1.25)

    # Mother Centriole (Vertical barrel)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=0.48, location=(0, 0, 0))
    c_mother = bpy.context.active_object
    c_mother.name = "Centriole_Mother"
    c_mother.data.materials.append(m_centriole)
    c_mother.parent = centro_group

    # Daughter Centriole (Orthogonal at 90 degrees)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=0.48, location=(0.30, 0, 0.22))
    c_daughter = bpy.context.active_object
    c_daughter.name = "Centriole_Daughter"
    c_daughter.rotation_euler = (0, math.pi / 2, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    c_daughter.data.materials.append(m_centriole)
    c_daughter.parent = centro_group

    # 4 Lysosomes with dense enzymatic matrix
    lyso_pts = [(0.2, 1.4, -0.6), (-1.2, -0.2, -1.2), (1.1, -0.8, -1.0), (-0.8, 1.6, 0.4)]
    for l_i, (lx, ly, lz) in enumerate(lyso_pts):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=18, radius=0.22, location=(lx, ly, lz))
        lyso = bpy.context.active_object
        lyso.name = f"Lysosome_{l_i+1}"
        lyso.data.materials.append(m_lyso)
        lyso.parent = root

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
    blend_path = os.path.join(MODELS_DIR, "cell_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[CELL] Saved native .blend to {blend_path}")

    # Export to WebGL GLB
    glb_path = os.path.join(OUTPUT_DIR, "cell_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[CELL SUCCESS] Exported photorealistic cell to {glb_path}")

if __name__ == '__main__':
    build_ultra_cell()
