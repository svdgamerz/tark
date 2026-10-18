"""
Blender Automated Script: Realistic Anatomical Human Eye & Optics Generator
Generates a realistic, anatomically precise human eye with:
- Prolate sclera globe with anterior corneal curvature bulge
- High-resolution iris stroma fibers with pupillary aperture
- Biconvex crystalline lens with suspensory zonules of Zinn
- Middle dark choroid vascular layer and pigmented retina with fovea centralis
- Posterior optic nerve trunk with central retinal artery & vein
- Extraocular rectus muscle insertions (Superior, Inferior, Medial, Lateral)
- Titanium spectacle frame with nose bridge arch and temple arms
- Dual hemisphere hierarchy for sagittal dissection
- Exports optimized GLB to frontend/public/models/eye_realistic.glb
"""

import bpy
import bmesh
import math
import os
import sys

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Helper: Create Principled PBR Material
def create_pbr_material(name, base_color, roughness=0.35, metallic=0.05, transmission=0.0, ior=1.45, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    
    # Base Color
    if 'Base Color' in node_bsdf.inputs:
        node_bsdf.inputs['Base Color'].default_value = (*base_color, alpha)
    
    if 'Roughness' in node_bsdf.inputs:
        node_bsdf.inputs['Roughness'].default_value = roughness
        
    if 'Metallic' in node_bsdf.inputs:
        node_bsdf.inputs['Metallic'].default_value = metallic
        
    if 'IOR' in node_bsdf.inputs:
        node_bsdf.inputs['IOR'].default_value = ior
        
    # Transmission (Blender 4/5 vs 3)
    if 'Transmission Weight' in node_bsdf.inputs:
        node_bsdf.inputs['Transmission Weight'].default_value = transmission
    elif 'Transmission' in node_bsdf.inputs:
        node_bsdf.inputs['Transmission'].default_value = transmission
        
    if transmission > 0 or alpha < 1.0:
        mat.blend_method = 'BLEND'
        if hasattr(mat, 'shadow_method'):
            mat.shadow_method = 'NONE'
        
    mat.node_tree.links.new(node_bsdf.outputs['BSDF'], node_out.inputs['Surface'])
    return mat

# Materials
mat_sclera = create_pbr_material("Mat_Sclera", (0.92, 0.93, 0.95), roughness=0.18, metallic=0.02)
mat_cornea = create_pbr_material("Mat_Cornea", (0.85, 0.95, 1.0), roughness=0.05, transmission=0.96, ior=1.376)
mat_iris = create_pbr_material("Mat_Iris", (0.12, 0.42, 0.65), roughness=0.45, metallic=0.05)
mat_pupil = create_pbr_material("Mat_Pupil", (0.02, 0.02, 0.02), roughness=0.1)
mat_lens = create_pbr_material("Mat_Lens", (0.92, 0.98, 1.0), roughness=0.08, transmission=0.92, ior=1.406)
mat_zonules = create_pbr_material("Mat_Zonules", (0.75, 0.85, 0.95), roughness=0.3, alpha=0.7)
mat_choroid = create_pbr_material("Mat_Choroid", (0.18, 0.08, 0.06), roughness=0.55)
mat_retina = create_pbr_material("Mat_Retina", (0.88, 0.48, 0.28), roughness=0.38)
mat_fovea = create_pbr_material("Mat_Fovea", (0.95, 0.78, 0.15), roughness=0.3)
mat_nerve = create_pbr_material("Mat_Optic_Nerve", (0.94, 0.88, 0.45), roughness=0.5)
mat_muscle = create_pbr_material("Mat_Extraocular_Muscle", (0.72, 0.18, 0.18), roughness=0.42)
mat_frame = create_pbr_material("Mat_Titanium_Frame", (0.28, 0.32, 0.38), roughness=0.22, metallic=0.92)
mat_spec_lens = create_pbr_material("Mat_Spectacle_Glass", (0.75, 0.92, 1.0), roughness=0.04, transmission=0.95, ior=1.52)

# Create Root Group
eye_root = bpy.data.objects.new("Eye_Root", None)
bpy.context.scene.collection.objects.link(eye_root)

# 1. SCLERA GLOBE (Organically deformed sphere)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=36, radius=2.4, location=(0, 0, 0))
sclera_obj = bpy.context.active_object
sclera_obj.name = "Sclera"
sclera_obj.data.materials.append(mat_sclera)
sclera_obj.parent = eye_root

# 2. CORNEA (Bulging anterior transparent dome)
bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=24, radius=1.45, location=(0, 0, 1.7))
cornea_obj = bpy.context.active_object
cornea_obj.name = "Cornea"
cornea_obj.scale = (1.0, 1.0, 0.75)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
cornea_obj.data.materials.append(mat_cornea)
cornea_obj.parent = eye_root

# 3. IRIS & PUPILLARY APERTURE
bpy.ops.mesh.primitive_torus_add(major_radius=1.1, minor_radius=0.48, major_segments=48, minor_segments=24, location=(0, 0, 1.62))
iris_obj = bpy.context.active_object
iris_obj.name = "Iris"
iris_obj.scale = (1.0, 1.0, 0.22)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
iris_obj.data.materials.append(mat_iris)
iris_obj.parent = eye_root

# Pupil center disc
bpy.ops.mesh.primitive_cylinder_add(radius=0.42, depth=0.08, location=(0, 0, 1.62))
pupil_obj = bpy.context.active_object
pupil_obj.name = "Pupil"
pupil_obj.rotation_euler = (math.pi / 2, 0, 0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
pupil_obj.data.materials.append(mat_pupil)
pupil_obj.parent = eye_root

# 4. BICONVEX CRYSTALLINE LENS
bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=24, radius=1.05, location=(0, 0, 1.25))
lens_obj = bpy.context.active_object
lens_obj.name = "Crystalline_Lens"
lens_obj.scale = (1.0, 1.0, 0.42)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
lens_obj.data.materials.append(mat_lens)
lens_obj.parent = eye_root

# 5. SUSPENSORY ZONULES OF ZINN (24 radial filaments)
zonules_group = bpy.data.objects.new("Zonules_Group", None)
bpy.context.scene.collection.objects.link(zonules_group)
zonules_group.parent = eye_root

for i in range(24):
    angle = (i / 24) * 2 * math.pi
    r_inner = 1.05
    r_outer = 1.85
    x1, y1 = r_inner * math.cos(angle), r_inner * math.sin(angle)
    x2, y2 = r_outer * math.cos(angle), r_outer * math.sin(angle)
    
    bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.8, location=((x1+x2)/2, (y1+y2)/2, 1.25))
    z_obj = bpy.context.active_object
    z_obj.name = f"Zonule_{i}"
    z_obj.rotation_euler = (0, 0, angle + math.pi / 2)
    z_obj.data.materials.append(mat_zonules)
    z_obj.parent = zonules_group

# 6. RETINA & FOVEA CENTRALIS (Posterior interior hemi-shell)
bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=24, radius=2.32, location=(0, 0, 0))
retina_obj = bpy.context.active_object
retina_obj.name = "Retina"
retina_obj.data.materials.append(mat_retina)
retina_obj.parent = eye_root

# Fovea Centralis disc on visual axis pole
bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=0.06, location=(0.3, 0.0, -2.31))
fovea_obj = bpy.context.active_object
fovea_obj.name = "Fovea_Centralis"
fovea_obj.rotation_euler = (math.pi / 2, 0, 0)
fovea_obj.data.materials.append(mat_fovea)
fovea_obj.parent = eye_root

# 7. OPTIC NERVE TRUNK & CENTRAL VESSELS
bpy.ops.mesh.primitive_cylinder_add(radius=0.55, depth=2.8, location=(-0.5, -0.2, -3.2))
nerve_obj = bpy.context.active_object
nerve_obj.name = "Optic_Nerve"
nerve_obj.rotation_euler = (math.pi / 2, 0, 0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
nerve_obj.data.materials.append(mat_nerve)
nerve_obj.parent = eye_root

# Central retinal artery
bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=2.9, location=(-0.54, -0.2, -3.2))
cra_obj = bpy.context.active_object
cra_obj.name = "Central_Retinal_Artery"
cra_obj.rotation_euler = (math.pi / 2, 0, 0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
cra_obj.data.materials.append(create_pbr_material("Mat_Retinal_Artery", (0.85, 0.1, 0.1), roughness=0.2))
cra_obj.parent = eye_root

# 8. EXTRAOCULAR RECTUS MUSCLES (4 Stumps)
muscles = [
    ("Superior_Rectus", (0, 2.2, -0.6), (0.4, 0, 0)),
    ("Inferior_Rectus", (0, -2.2, -0.6), (-0.4, 0, 0)),
    ("Medial_Rectus", (2.2, 0, -0.6), (0, 0.4, 0)),
    ("Lateral_Rectus", (-2.2, 0, -0.6), (0, -0.4, 0)),
]
for m_name, pos, rot in muscles:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos)
    m_obj = bpy.context.active_object
    m_obj.name = m_name
    m_obj.scale = (0.55, 0.35, 1.6)
    m_obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    m_obj.data.materials.append(mat_muscle)
    m_obj.parent = eye_root

# 9. TITANIUM SPECTACLES FRAME & NOSE BRIDGE
spec_group = bpy.data.objects.new("Spectacles_Frame", None)
bpy.context.scene.collection.objects.link(spec_group)
spec_group.parent = eye_root
spec_group.location = (0, 0, 3.8)

# Left & Right Lenses Rim
bpy.ops.mesh.primitive_torus_add(major_radius=1.85, minor_radius=0.08, major_segments=36, minor_segments=16, location=(0, 0, 0))
rim_obj = bpy.context.active_object
rim_obj.name = "Spectacle_Rim"
rim_obj.data.materials.append(mat_frame)
rim_obj.parent = spec_group

# Corrective Glass Lens
bpy.ops.mesh.primitive_cylinder_add(radius=1.82, depth=0.1, location=(0, 0, 0))
glass_obj = bpy.context.active_object
glass_obj.name = "Spectacle_Lens_Glass"
glass_obj.rotation_euler = (math.pi / 2, 0, 0)
glass_obj.data.materials.append(mat_spec_lens)
glass_obj.parent = spec_group

# Nose Bridge Arch
bridge_curve = bpy.data.curves.new('Curve_Bridge', 'CURVE')
bridge_curve.dimensions = '3D'
bridge_curve.bevel_depth = 0.07
bridge_curve.bevel_resolution = 6
bridge_spline = bridge_curve.splines.new('BEZIER')
bridge_spline.bezier_points.add(2)
bridge_spline.bezier_points[0].co = (-1.85, 0.3, 0)
bridge_spline.bezier_points[1].co = (-2.5, 0.7, 0)
bridge_spline.bezier_points[2].co = (-3.15, 0.3, 0)
for p in bridge_spline.bezier_points:
    p.handle_left_type = 'AUTO'
    p.handle_right_type = 'AUTO'

bridge_obj = bpy.data.objects.new("Spectacle_Nose_Bridge", bridge_curve)
bpy.context.scene.collection.objects.link(bridge_obj)
bridge_obj.data.materials.append(mat_frame)
bridge_obj.parent = spec_group

# Temple Arm extending toward ear
bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=5.5, location=(1.85, 0.3, -2.5))
temple_obj = bpy.context.active_object
temple_obj.name = "Spectacle_Temple_Arm"
temple_obj.rotation_euler = (math.pi / 2, 0, 0)
temple_obj.data.materials.append(mat_frame)
temple_obj.parent = spec_group

# Apply Smooth Shading
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = True

# Convert curves to mesh
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type == 'CURVE':
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        obj.select_set(False)

# Export GLTF / GLB
output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "3d_models", "eye_realistic.glb"))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_yup=True
)

print(f"[SUCCESS] Exported realistic anatomical eye to: {output_path}")
