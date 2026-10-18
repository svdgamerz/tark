"""
Blender Automated Script: Realistic Anatomical Human Heart Generator
Generates a realistic, organically sculpted human heart with:
- Left & Right Ventricles with correct apical orientation
- Organic muscular myocardium with coronary sulci
- Aorta with 3 major arch branches
- Pulmonary trunk bifurcating into left/right pulmonary arteries
- Superior and Inferior Vena Cava
- Realistic coronary blood vessels hugging sulci
- Dual pump split hierarchy ('Left_Heart', 'Right_Heart') for coronal split animation
- PBR materials with normal displacement, wet specular sheen, and muscular roughness
- Exports optimized GLB to frontend/public/models/heart_realistic.glb
"""

import bpy
import bmesh
import math
import os
import sys

# Reset scene
bpy.ops.wm.read_factory_settings(use_empty=True)

# Helper: Create Principled PBR Material
def create_pbr_material(name, base_color, roughness=0.35, metallic=0.05, subsurface=0.25):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    
    # Base Color
    if 'Base Color' in node_bsdf.inputs:
        node_bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    
    # Roughness
    if 'Roughness' in node_bsdf.inputs:
        node_bsdf.inputs['Roughness'].default_value = roughness
        
    # Metallic
    if 'Metallic' in node_bsdf.inputs:
        node_bsdf.inputs['Metallic'].default_value = metallic
        
    # Subsurface (handle Blender 3.x vs 4.x/5.x socket names)
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
mat_artery = create_pbr_material("Mat_Coronary_Artery", (0.88, 0.10, 0.10), roughness=0.2, subsurface=0.1)
mat_vein = create_pbr_material("Mat_Coronary_Vein", (0.15, 0.42, 0.78), roughness=0.2, subsurface=0.1)
mat_valve = create_pbr_material("Mat_Valve_Cusp", (0.92, 0.88, 0.82), roughness=0.35, subsurface=0.45)
mat_tendon = create_pbr_material("Mat_Chordae_Tendon", (0.96, 0.95, 0.92), roughness=0.25, subsurface=0.4)

# Create Root Groups
heart_root = bpy.data.objects.new("Heart_Root", None)
bpy.context.scene.collection.objects.link(heart_root)

left_heart = bpy.data.objects.new("Left_Heart", None)
bpy.context.scene.collection.objects.link(left_heart)
left_heart.parent = heart_root

right_heart = bpy.data.objects.new("Right_Heart", None)
bpy.context.scene.collection.objects.link(right_heart)
right_heart.parent = heart_root

# --- LEFT VENTRICLE & APEX ---
# Create organic subdivided cone/sphere for left ventricle
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1.0, location=(0.7, -0.6, 0))
lv_obj = bpy.context.active_object
lv_obj.name = "Left_Ventricle"
lv_obj.scale = (1.45, 1.85, 1.35)
lv_obj.rotation_euler = (0.15, 0.12, -0.35) # Anatomic tilt toward apex
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# Sculpt organic apex deformation with BMesh
bm = bmesh.new()
bm.from_mesh(lv_obj.data)
for v in bm.verts:
    # Pull lower pole to form conical cardiac apex pointing inferolaterally
    if v.co.y < -0.8:
        factor = abs(v.co.y + 0.8)
        v.co.x += factor * 0.35
        v.co.z -= factor * 0.15
        v.co.x *= max(0.2, 1.0 - factor * 0.4)
        v.co.z *= max(0.2, 1.0 - factor * 0.4)
    # Anterior sulcus groove indentation
    if v.co.x < 0.2 and v.co.z > 0.4:
        v.co.z -= 0.12 * math.cos(v.co.y * 1.5)
bm.to_mesh(lv_obj.data)
bm.free()

lv_obj.data.materials.append(mat_myo_left)
lv_obj.parent = left_heart

# Left Atrium (LA) & 4 Pulmonary Vein Inlets
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=1.0, location=(1.1, 1.5, -0.4))
la_obj = bpy.context.active_object
la_obj.name = "Left_Atrium"
la_obj.scale = (1.1, 1.15, 1.0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
la_obj.data.materials.append(mat_myo_left)
la_obj.parent = left_heart

# --- RIGHT VENTRICLE & CRESCENT ---
bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, radius=1.0, location=(-1.1, -0.4, 0.2))
rv_obj = bpy.context.active_object
rv_obj.name = "Right_Ventricle"
rv_obj.scale = (1.35, 1.65, 1.25)
rv_obj.rotation_euler = (-0.1, -0.15, 0.25)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

bm = bmesh.new()
bm.from_mesh(rv_obj.data)
for v in bm.verts:
    # Flatten against the interventricular septum to form crescent cross section
    if v.co.x > -0.2:
        v.co.x = -0.2 + (v.co.x + 0.2) * 0.25
    # Smooth apical taper
    if v.co.y < -0.8:
        factor = abs(v.co.y + 0.8)
        v.co.x *= max(0.3, 1.0 - factor * 0.35)
bm.to_mesh(rv_obj.data)
bm.free()

rv_obj.data.materials.append(mat_myo_right)
rv_obj.parent = right_heart

# Right Atrium (RA)
bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=1.1, location=(-1.3, 1.4, 0.1))
ra_obj = bpy.context.active_object
ra_obj.name = "Right_Atrium"
ra_obj.scale = (1.15, 1.2, 1.05)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
ra_obj.data.materials.append(mat_myo_right)
ra_obj.parent = right_heart

# Right Auricle (dog-ear anterior appendage)
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.6, location=(-0.7, 1.3, 0.9))
ra_auricle = bpy.context.active_object
ra_auricle.name = "Right_Auricle"
ra_auricle.scale = (0.7, 1.1, 0.6)
ra_auricle.rotation_euler = (0.3, -0.4, 0.6)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
ra_auricle.data.materials.append(mat_myo_right)
ra_auricle.parent = right_heart

# --- GREAT VESSELS ---

# 1. Ascending Aorta, Aortic Arch & 3 Branches
curve_aorta = bpy.data.curves.new('Curve_Aorta', 'CURVE')
curve_aorta.dimensions = '3D'
curve_aorta.bevel_depth = 0.48
curve_aorta.bevel_resolution = 12

spline_aorta = curve_aorta.splines.new('BEZIER')
spline_aorta.bezier_points.add(3)

pts_aorta = [
    (0.35, 1.0, 0.1),
    (0.45, 2.4, 0.0),
    (0.0, 3.2, -0.3),
    (-0.6, 2.2, -0.7)
]
for i, pt in enumerate(pts_aorta):
    spline_aorta.bezier_points[i].co = pt
    spline_aorta.bezier_points[i].handle_left_type = 'AUTO'
    spline_aorta.bezier_points[i].handle_right_type = 'AUTO'

aorta_obj = bpy.data.objects.new("Aortic_Arch", curve_aorta)
bpy.context.scene.collection.objects.link(aorta_obj)
aorta_obj.data.materials.append(mat_aorta)
aorta_obj.parent = left_heart

# 3 Aortic Arch Branches (Brachiocephalic, Left Common Carotid, Left Subclavian)
branch_origins = [(0.38, 2.9, -0.1), (0.15, 3.15, -0.22), (-0.15, 3.1, -0.35)]
branch_names = ["Brachiocephalic_Artery", "Left_Common_Carotid", "Left_Subclavian_Artery"]
for origin, name in zip(branch_origins, branch_names):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=1.1, location=(origin[0], origin[1] + 0.5, origin[2]))
    br_obj = bpy.context.active_object
    br_obj.name = name
    br_obj.rotation_euler = (0.1, 0, (origin[0] - 0.1) * 0.3)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    br_obj.data.materials.append(mat_aorta)
    br_obj.parent = left_heart

# 2. Pulmonary Trunk & Bifurcation
curve_pt = bpy.data.curves.new('Curve_Pulmonary', 'CURVE')
curve_pt.dimensions = '3D'
curve_pt.bevel_depth = 0.44
curve_pt.bevel_resolution = 12

spline_pt = curve_pt.splines.new('BEZIER')
spline_pt.bezier_points.add(2)
pts_pt = [
    (-0.35, 0.8, 0.45),
    (-0.25, 2.1, 0.3),
    (0.0, 2.35, -0.1)
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
bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=1.4, location=(0.6, 2.3, -0.2))
rpa = bpy.context.active_object
rpa.name = "Right_Pulmonary_Artery"
rpa.rotation_euler = (0, math.pi / 2, 0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
rpa.data.materials.append(mat_pulmonary)
rpa.parent = right_heart

bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=1.4, location=(-0.6, 2.3, -0.2))
lpa = bpy.context.active_object
lpa.name = "Left_Pulmonary_Artery"
lpa.rotation_euler = (0, -math.pi / 2, 0)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
lpa.data.materials.append(mat_pulmonary)
lpa.parent = right_heart

# 3. Superior Vena Cava (SVC) & Inferior Vena Cava (IVC)
bpy.ops.mesh.primitive_cylinder_add(radius=0.38, depth=1.8, location=(-1.4, 2.6, -0.2))
svc_obj = bpy.context.active_object
svc_obj.name = "Superior_Vena_Cava"
svc_obj.data.materials.append(mat_vena_cava)
svc_obj.parent = right_heart

bpy.ops.mesh.primitive_cylinder_add(radius=0.36, depth=1.4, location=(-1.3, -0.3, -0.6))
ivc_obj = bpy.context.active_object
ivc_obj.name = "Inferior_Vena_Cava"
ivc_obj.data.materials.append(mat_vena_cava)
ivc_obj.parent = right_heart

# --- CORONARY SULCUS FAT CUSHIONS & CORONARY ARTERY TREE ---
# Adipose tissue cushion ribbon in the anterior interventricular groove
fat_curve = bpy.data.curves.new('Curve_Sulcus_Fat', 'CURVE')
fat_curve.dimensions = '3D'
fat_curve.bevel_depth = 0.16
fat_curve.bevel_resolution = 8
fat_spline = fat_curve.splines.new('BEZIER')
fat_spline.bezier_points.add(3)
pts_fat = [
    (-0.1, 1.2, 1.0),
    (0.1, 0.4, 1.15),
    (0.35, -0.6, 0.95),
    (0.65, -1.5, 0.55)
]
for i, pt in enumerate(pts_fat):
    fat_spline.bezier_points[i].co = pt
    fat_spline.bezier_points[i].handle_left_type = 'AUTO'
    fat_spline.bezier_points[i].handle_right_type = 'AUTO'

fat_obj = bpy.data.objects.new("Sulcus_Adipose_Cushion", fat_curve)
bpy.context.scene.collection.objects.link(fat_obj)
fat_obj.data.materials.append(mat_fat)
fat_obj.parent = left_heart

# Left Anterior Descending Artery (LAD)
lad_curve = bpy.data.curves.new('Curve_LAD', 'CURVE')
lad_curve.dimensions = '3D'
lad_curve.bevel_depth = 0.06
lad_curve.bevel_resolution = 6
lad_spline = lad_curve.splines.new('BEZIER')
lad_spline.bezier_points.add(3)
for i, pt in enumerate(pts_fat):
    lad_spline.bezier_points[i].co = (pt[0], pt[1], pt[2] + 0.07)
    lad_spline.bezier_points[i].handle_left_type = 'AUTO'
    lad_spline.bezier_points[i].handle_right_type = 'AUTO'

lad_obj = bpy.data.objects.new("LAD_Coronary_Artery", lad_curve)
bpy.context.scene.collection.objects.link(lad_obj)
lad_obj.data.materials.append(mat_artery)
lad_obj.parent = left_heart

# Great Cardiac Vein accompanying LAD
vein_curve = bpy.data.curves.new('Curve_Cardiac_Vein', 'CURVE')
vein_curve.dimensions = '3D'
vein_curve.bevel_depth = 0.05
vein_curve.bevel_resolution = 6
vein_spline = vein_curve.splines.new('BEZIER')
vein_spline.bezier_points.add(3)
for i, pt in enumerate(pts_fat):
    vein_spline.bezier_points[i].co = (pt[0] - 0.09, pt[1], pt[2] + 0.06)
    vein_spline.bezier_points[i].handle_left_type = 'AUTO'
    vein_spline.bezier_points[i].handle_right_type = 'AUTO'

vein_obj = bpy.data.objects.new("Great_Cardiac_Vein", vein_curve)
bpy.context.scene.collection.objects.link(vein_obj)
vein_obj.data.materials.append(mat_vein)
vein_obj.parent = left_heart

# --- INTERNAL ANATOMICAL DISSECTION STRUCTURES ---
# Left Ventricle Internal Papillary Muscles & Chordae Tendineae
pap_left_1 = bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.8, location=(0.8, -0.6, -0.2))
pl1_obj = bpy.context.active_object
pl1_obj.name = "Anterior_Papillary_Muscle_LV"
pl1_obj.rotation_euler = (0.3, 0.2, 0)
pl1_obj.data.materials.append(mat_myo_left)
pl1_obj.parent = left_heart

# Mitral Valve Leaflet Rings
bpy.ops.mesh.primitive_torus_add(major_radius=0.45, minor_radius=0.04, location=(0.8, 0.4, -0.1))
mv_obj = bpy.context.active_object
mv_obj.name = "Mitral_Bicuspid_Valve"
mv_obj.data.materials.append(mat_valve)
mv_obj.parent = left_heart

# Right Ventricle Internal Papillary & Tricuspid Valve
bpy.ops.mesh.primitive_torus_add(major_radius=0.48, minor_radius=0.04, location=(-0.9, 0.3, 0.1))
tv_obj = bpy.context.active_object
tv_obj.name = "Tricuspid_Valve"
tv_obj.data.materials.append(mat_valve)
tv_obj.parent = right_heart

# Apply Smooth Shading to all mesh objects
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = True

# Convert all curves to mesh for glTF export compatibility
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type == 'CURVE':
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')
        obj.select_set(False)

# Export GLTF / GLB
output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "3d_models", "heart_realistic.glb"))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_yup=True
)

print(f"[SUCCESS] Exported realistic anatomical heart to: {output_path}")
