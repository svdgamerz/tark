"""
Blender Automated Script: Realistic Anatomical Human Heart Generator (Aligned Coordinates)
Coordinates:
- Blender +Z is Superior (Aorta, SVC, IVC), -Z is Inferior (Cardiac Apex Cordis)
- Blender +Y is Anterior (Sternocostal surface, LAD artery, sulcus fat), -Y is Posterior (Diaphragmatic surface)
- Blender +X is Anatomical Left (Left Ventricle, Apex), -X is Anatomical Right (Right Ventricle, RA)
When exported with glTF export_yup=True:
- Blender Z -> Three.js Y (Vertical)
- Blender Y -> Three.js Z (Front/Back)
- Blender X -> Three.js X (Left/Right)
"""

import bpy
import bmesh
import math
import os

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

def create_pbr_material(name, base_color, roughness=0.35, metallic=0.05, subsurface=0.25):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    
    if 'Base Color' in node_bsdf.inputs:
        node_bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    if 'Roughness' in node_bsdf.inputs:
        node_bsdf.inputs['Roughness'].default_value = roughness
    if 'Metallic' in node_bsdf.inputs:
        node_bsdf.inputs['Metallic'].default_value = metallic
    if 'Subsurface Weight' in node_bsdf.inputs:
        node_bsdf.inputs['Subsurface Weight'].default_value = subsurface
    elif 'Subsurface' in node_bsdf.inputs:
        node_bsdf.inputs['Subsurface'].default_value = subsurface
    if 'Subsurface Radius' in node_bsdf.inputs:
        node_bsdf.inputs['Subsurface Radius'].default_value = (1.0, 0.2, 0.1)
        
    mat.node_tree.links.new(node_bsdf.outputs['BSDF'], node_out.inputs['Surface'])
    return mat

# Materials
mat_myo_left = create_pbr_material("Mat_Myo_Left", (0.58, 0.08, 0.09), roughness=0.28, subsurface=0.3)
mat_myo_right = create_pbr_material("Mat_Myo_Right", (0.52, 0.09, 0.12), roughness=0.32, subsurface=0.28)
mat_cut_left = create_pbr_material("Mat_Cut_Left", (0.72, 0.14, 0.14), roughness=0.45, subsurface=0.35)
mat_cut_right = create_pbr_material("Mat_Cut_Right", (0.64, 0.12, 0.15), roughness=0.48, subsurface=0.35)
mat_aorta = create_pbr_material("Mat_Aorta", (0.78, 0.15, 0.16), roughness=0.25, subsurface=0.2)
mat_pulmonary = create_pbr_material("Mat_Pulmonary", (0.12, 0.35, 0.65), roughness=0.25, subsurface=0.2)
mat_vena_cava = create_pbr_material("Mat_Vena_Cava", (0.10, 0.28, 0.58), roughness=0.3, subsurface=0.18)
mat_fat = create_pbr_material("Mat_Adipose_Fat", (0.82, 0.72, 0.35), roughness=0.55, subsurface=0.4)
mat_artery = create_pbr_material("Mat_Coronary_Artery", (0.88, 0.10, 0.10), roughness=0.2)
mat_vein = create_pbr_material("Mat_Coronary_Vein", (0.15, 0.42, 0.78), roughness=0.2)
mat_valve = create_pbr_material("Mat_Valve_Cusp", (0.92, 0.88, 0.82), roughness=0.35, subsurface=0.45)

# Root Groups
heart_root = bpy.data.objects.new("Heart_Root", None)
bpy.context.scene.collection.objects.link(heart_root)

left_heart = bpy.data.objects.new("Left_Heart", None)
bpy.context.scene.collection.objects.link(left_heart)
left_heart.parent = heart_root

right_heart = bpy.data.objects.new("Right_Heart", None)
bpy.context.scene.collection.objects.link(right_heart)
right_heart.parent = heart_root

# 1. LEFT VENTRICLE & CONICAL APEX (Pointing down -Z and left +X)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1.0, location=(0.7, 0, -0.6))
lv_obj = bpy.context.active_object
lv_obj.name = "Left_Ventricle"
lv_obj.scale = (1.4, 1.35, 1.8)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

bm = bmesh.new()
bm.from_mesh(lv_obj.data)
for v in bm.verts:
    # Apex cordis taper
    if v.co.z < -0.8:
        factor = abs(v.co.z + 0.8)
        v.co.x += factor * 0.35
        v.co.y += factor * 0.15
        v.co.x *= max(0.2, 1.0 - factor * 0.45)
        v.co.y *= max(0.2, 1.0 - factor * 0.45)
    # Sulcus indentation
    if v.co.x < 0.2 and v.co.y > 0.3:
        v.co.y -= 0.12 * math.cos(v.co.z * 1.5)
bm.to_mesh(lv_obj.data)
bm.free()
lv_obj.data.materials.append(mat_myo_left)
lv_obj.parent = left_heart

# Left Atrium (LA)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=1.0, location=(1.0, -0.4, 1.3))
la_obj = bpy.context.active_object
la_obj.name = "Left_Atrium"
la_obj.scale = (1.1, 1.0, 1.15)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
la_obj.data.materials.append(mat_myo_left)
la_obj.parent = left_heart

# 2. RIGHT VENTRICLE & CRESCENT
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1.0, location=(-1.0, 0.2, -0.4))
rv_obj = bpy.context.active_object
rv_obj.name = "Right_Ventricle"
rv_obj.scale = (1.3, 1.25, 1.6)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

bm = bmesh.new()
bm.from_mesh(rv_obj.data)
for v in bm.verts:
    if v.co.x > -0.2:
        v.co.x = -0.2 + (v.co.x + 0.2) * 0.25
    if v.co.z < -0.8:
        factor = abs(v.co.z + 0.8)
        v.co.x *= max(0.3, 1.0 - factor * 0.35)
bm.to_mesh(rv_obj.data)
bm.free()
rv_obj.data.materials.append(mat_myo_right)
rv_obj.parent = right_heart

# Right Atrium (RA)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=1.1, location=(-1.2, 0.1, 1.3))
ra_obj = bpy.context.active_object
ra_obj.name = "Right_Atrium"
ra_obj.scale = (1.15, 1.05, 1.2)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
ra_obj.data.materials.append(mat_myo_right)
ra_obj.parent = right_heart

# 3. ASCENDING AORTA & ARCH (Extending Upward along +Z)
curve_aorta = bpy.data.curves.new('Curve_Aorta', 'CURVE')
curve_aorta.dimensions = '3D'
curve_aorta.bevel_depth = 0.46
curve_aorta.bevel_resolution = 12

spline_aorta = curve_aorta.splines.new('BEZIER')
spline_aorta.bezier_points.add(3)
pts_aorta = [
    (0.3, 0.1, 0.9),
    (0.4, 0.0, 2.2),
    (0.0, -0.3, 3.1),
    (-0.6, -0.7, 2.1)
]
for i, pt in enumerate(pts_aorta):
    spline_aorta.bezier_points[i].co = pt
    spline_aorta.bezier_points[i].handle_left_type = 'AUTO'
    spline_aorta.bezier_points[i].handle_right_type = 'AUTO'

aorta_obj = bpy.data.objects.new("Aortic_Arch", curve_aorta)
bpy.context.scene.collection.objects.link(aorta_obj)
aorta_obj.data.materials.append(mat_aorta)
aorta_obj.parent = left_heart

# 3 Aortic Arch Branches (Pointing upward +Z)
branch_origins = [(0.35, -0.1, 2.8), (0.12, -0.22, 3.05), (-0.15, -0.35, 3.0)]
branch_names = ["Brachiocephalic_Artery", "Left_Common_Carotid", "Left_Subclavian_Artery"]
for origin, name in zip(branch_origins, branch_names):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.13, depth=1.1, location=(origin[0], origin[1], origin[2] + 0.55))
    br_obj = bpy.context.active_object
    br_obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    br_obj.data.materials.append(mat_aorta)
    br_obj.parent = left_heart

# 4. PULMONARY TRUNK & BIFURCATION
curve_pt = bpy.data.curves.new('Curve_Pulmonary', 'CURVE')
curve_pt.dimensions = '3D'
curve_pt.bevel_depth = 0.42
curve_pt.bevel_resolution = 12
spline_pt = curve_pt.splines.new('BEZIER')
spline_pt.bezier_points.add(2)
pts_pt = [
    (-0.35, 0.45, 0.7),
    (-0.25, 0.3, 1.9),
    (0.0, -0.1, 2.25)
]
for i, pt in enumerate(pts_pt):
    spline_pt.bezier_points[i].co = pt
    spline_pt.bezier_points[i].handle_left_type = 'AUTO'
    spline_pt.bezier_points[i].handle_right_type = 'AUTO'

pt_obj = bpy.data.objects.new("Pulmonary_Trunk", curve_pt)
bpy.context.scene.collection.objects.link(pt_obj)
pt_obj.data.materials.append(mat_pulmonary)
pt_obj.parent = right_heart

# Left & Right Pulmonary Arteries
bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=1.4, location=(0.6, -0.2, 2.2))
rpa = bpy.context.active_object
rpa.name = "Right_Pulmonary_Artery"
rpa.rotation_euler = (0, math.pi / 2, 0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
rpa.data.materials.append(mat_pulmonary)
rpa.parent = right_heart

bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=1.4, location=(-0.6, -0.2, 2.2))
lpa = bpy.context.active_object
lpa.name = "Left_Pulmonary_Artery"
lpa.rotation_euler = (0, -math.pi / 2, 0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
lpa.data.materials.append(mat_pulmonary)
lpa.parent = right_heart

# Superior & Inferior Vena Cava
bpy.ops.mesh.primitive_cylinder_add(radius=0.36, depth=1.8, location=(-1.35, -0.2, 2.5))
svc = bpy.context.active_object
svc.name = "Superior_Vena_Cava"
svc.data.materials.append(mat_vena_cava)
svc.parent = right_heart

bpy.ops.mesh.primitive_cylinder_add(radius=0.34, depth=1.3, location=(-1.25, -0.6, -0.3))
ivc = bpy.context.active_object
ivc.name = "Inferior_Vena_Cava"
ivc.data.materials.append(mat_vena_cava)
ivc.parent = right_heart

# 5. CORONARY SULCUS FAT CUSHION & LAD ARTERY
fat_curve = bpy.data.curves.new('Curve_Sulcus_Fat', 'CURVE')
fat_curve.dimensions = '3D'
fat_curve.bevel_depth = 0.15
fat_curve.bevel_resolution = 8
fat_spline = fat_curve.splines.new('BEZIER')
fat_spline.bezier_points.add(3)
pts_fat = [
    (-0.1, 1.0, 1.1),
    (0.1, 1.12, 0.35),
    (0.35, 0.95, -0.55),
    (0.65, 0.55, -1.45)
]
for i, pt in enumerate(pts_fat):
    fat_spline.bezier_points[i].co = pt
    fat_spline.bezier_points[i].handle_left_type = 'AUTO'
    fat_spline.bezier_points[i].handle_right_type = 'AUTO'

fat_obj = bpy.data.objects.new("Sulcus_Adipose_Cushion", fat_curve)
bpy.context.scene.collection.objects.link(fat_obj)
fat_obj.data.materials.append(mat_fat)
fat_obj.parent = left_heart

# Left Anterior Descending (LAD) Artery
lad_curve = bpy.data.curves.new('Curve_LAD', 'CURVE')
lad_curve.dimensions = '3D'
lad_curve.bevel_depth = 0.06
lad_curve.bevel_resolution = 6
lad_spline = lad_curve.splines.new('BEZIER')
lad_spline.bezier_points.add(3)
for i, pt in enumerate(pts_fat):
    lad_spline.bezier_points[i].co = (pt[0], pt[1] + 0.07, pt[2])
    lad_spline.bezier_points[i].handle_left_type = 'AUTO'
    lad_spline.bezier_points[i].handle_right_type = 'AUTO'

lad_obj = bpy.data.objects.new("LAD_Coronary_Artery", lad_curve)
bpy.context.scene.collection.objects.link(lad_obj)
lad_obj.data.materials.append(mat_artery)
lad_obj.parent = left_heart

# Great Cardiac Vein
vein_curve = bpy.data.curves.new('Curve_Cardiac_Vein', 'CURVE')
vein_curve.dimensions = '3D'
vein_curve.bevel_depth = 0.05
vein_curve.bevel_resolution = 6
vein_spline = vein_curve.splines.new('BEZIER')
vein_spline.bezier_points.add(3)
for i, pt in enumerate(pts_fat):
    vein_spline.bezier_points[i].co = (pt[0] - 0.09, pt[1] + 0.06, pt[2])
    vein_spline.bezier_points[i].handle_left_type = 'AUTO'
    vein_spline.bezier_points[i].handle_right_type = 'AUTO'

vein_obj = bpy.data.objects.new("Great_Cardiac_Vein", vein_curve)
bpy.context.scene.collection.objects.link(vein_obj)
vein_obj.data.materials.append(mat_vein)
vein_obj.parent = left_heart

# Smooth Shading & Convert Curves
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = True

bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type == 'CURVE':
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        obj.select_set(False)

# Export
output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "3d_models", "heart_realistic.glb"))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_yup=True
)

print(f"[SUCCESS] Exported aligned realistic heart to: {output_path}")
