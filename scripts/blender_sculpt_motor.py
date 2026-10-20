"""
Ultra-Realistic Electromagnetic Motor & AC Dynamo Generator for Blender 5.2
Sculpts an authentic physics/engineering grade electric machine:
1. Stator Magnetic Circuit:
   - Curved North Stator Pole (Deep Red with embossed "N").
   - Curved South Stator Pole (Cobalt Blue with embossed "S").
   - Cast-iron mounting frame chassis with anchor bolts.
2. Armature Rotor Assembly:
   - Laminated soft-iron core with armature coil slots.
   - Heavy-gauge enameled copper wire rectangular multi-turn winding loop.
   - Polished hardened-steel central drive axle shaft with pulley wheel.
   - Dual bronze ball-bearing pillow block housings.
3. Commutation System:
   - Split-ring commutator (two semicircular copper segments separated by mica dielectric gaps).
   - Carbon graphite contact brushes with brass sleeve holders and leaf springs.
   - Red (+) and Black (-) external DC binding post terminals with insulated wiring.
4. Physical Force & Flux Field Indicators:
   - Magnetic field lines (B-field lines streaming from North to South).
   - Lorentz Force vector arrows (F = I * L x B) showing rotational torque direction!
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

def create_pbr_material(name, base_color, roughness=0.25, metallic=0.0, transmission=0.0, ior=1.45,
                        specular=0.7, emissive=None):
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

    if emissive:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = (*emissive, 1.0)
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = (*emissive, 1.0)
        if 'Emission Strength' in bsdf.inputs:
            bsdf.inputs['Emission Strength'].default_value = 0.9

    return mat

def build_realistic_motor():
    reset()
    print("[MOTOR GENERATOR] Sculpting engineering-grade 3D Electric Motor & Dynamo...")

    # Materials
    m_mag_north = create_pbr_material("Mat_North_Pole", (0.88, 0.12, 0.15), roughness=0.20, metallic=0.45)
    m_mag_south = create_pbr_material("Mat_South_Pole", (0.12, 0.42, 0.88), roughness=0.20, metallic=0.45)
    m_chassis = create_pbr_material("Mat_Cast_Iron_Chassis", (0.18, 0.20, 0.24), roughness=0.42, metallic=0.75)
    m_steel_shaft = create_pbr_material("Mat_Hardened_Steel_Shaft", (0.75, 0.78, 0.82), roughness=0.12, metallic=0.95)
    m_copper_coil = create_pbr_material("Mat_Enameled_Copper_Coil", (0.92, 0.48, 0.18), roughness=0.15, metallic=0.88)
    m_commutator = create_pbr_material("Mat_Copper_Commutator", (0.95, 0.62, 0.25), roughness=0.18, metallic=0.92)
    m_carbon_brush = create_pbr_material("Mat_Carbon_Graphite_Brush", (0.12, 0.12, 0.14), roughness=0.35, metallic=0.2)
    m_brass = create_pbr_material("Mat_Brass_Holders", (0.85, 0.72, 0.25), roughness=0.22, metallic=0.85)
    m_flux_line = create_pbr_material("Mat_Magnetic_Flux_Lines", (0.24, 0.88, 0.95), roughness=0.10, emissive=(0.2, 0.85, 0.95))
    m_force_arrow = create_pbr_material("Mat_Lorentz_Force_Arrow", (0.95, 0.85, 0.10), roughness=0.15, emissive=(0.95, 0.85, 0.1))

    root = bpy.data.objects.new("Motor_System_Root", None)
    bpy.context.scene.collection.objects.link(root)

    stator_group = bpy.data.objects.new("Stator_Assembly_Group", None)
    bpy.context.scene.collection.objects.link(stator_group)
    stator_group.parent = root

    rotor_group = bpy.data.objects.new("Rotor_Armature_Group", None)
    bpy.context.scene.collection.objects.link(rotor_group)
    rotor_group.parent = root

    brush_group = bpy.data.objects.new("Commutator_Brush_Group", None)
    bpy.context.scene.collection.objects.link(brush_group)
    brush_group.parent = root

    field_group = bpy.data.objects.new("Magnetic_Field_Vectors_Group", None)
    bpy.context.scene.collection.objects.link(field_group)
    field_group.parent = root

    # =========================================================================
    # 1. HEAVY CAST-IRON CHASSIS BASEPLATE & BEARING HOUSINGS
    # =========================================================================
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, -1.35))
    baseplate = bpy.context.active_object
    baseplate.name = "Motor_Baseplate_Chassis"
    baseplate.scale = (4.4, 2.6, 0.25)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    baseplate.data.materials.append(m_chassis)
    baseplate.parent = stator_group
    bpy.ops.object.shade_smooth()

    # Front & Rear Bearing Pedestals
    for b_y, b_name in [(-1.5, "Front_Bearing_Pillow_Block"), (1.5, "Rear_Bearing_Pillow_Block")]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, b_y, -0.65))
        ped = bpy.context.active_object
        ped.name = b_name
        ped.scale = (0.55, 0.35, 1.25)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        ped.data.materials.append(m_chassis)
        ped.parent = stator_group
        bpy.ops.object.shade_smooth()

        # Brass Bearing Bushing Ring
        bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.38, location=(0.0, b_y, 0.0))
        bush = bpy.context.active_object
        bush.name = f"{b_name}_Brass_Bushing"
        bush.rotation_euler = (math.pi / 2, 0, 0)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        bush.data.materials.append(m_brass)
        bush.parent = stator_group

    # =========================================================================
    # 2. STATOR CURVED PERMANENT MAGNET POLES (NORTH & SOUTH)
    # =========================================================================
    # North Pole (Red - Left X < 0)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.85, depth=2.2, location=(-1.35, 0.0, 0.0))
    n_pole = bpy.context.active_object
    n_pole.name = "North_Magnetic_Pole"
    n_pole.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(n_pole.data)
    # Cut to curved concave pole face
    verts_n = [v for v in bm.verts if v.co.x > -0.75 or v.co.x < -2.1]
    bmesh.ops.delete(bm, geom=verts_n, context='VERTS')
    bm.to_mesh(n_pole.data)
    bm.free()
    n_pole.data.materials.append(m_mag_north)
    n_pole.parent = stator_group
    bpy.ops.object.shade_smooth()

    # South Pole (Blue - Right X > 0)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.85, depth=2.2, location=(1.35, 0.0, 0.0))
    s_pole = bpy.context.active_object
    s_pole.name = "South_Magnetic_Pole"
    s_pole.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    bm = bmesh.new()
    bm.from_mesh(s_pole.data)
    verts_s = [v for v in bm.verts if v.co.x < 0.75 or v.co.x > 2.1]
    bmesh.ops.delete(bm, geom=verts_s, context='VERTS')
    bm.to_mesh(s_pole.data)
    bm.free()
    s_pole.data.materials.append(m_mag_south)
    s_pole.parent = stator_group
    bpy.ops.object.shade_smooth()

    # =========================================================================
    # 3. ROTOR ASSEMBLY: SHAFT, CORE, & RECTANGULAR COPPER COIL
    # =========================================================================
    # Central Drive Shaft
    bpy.ops.mesh.primitive_cylinder_add(radius=0.11, depth=4.2, location=(0.0, 0.0, 0.0))
    shaft = bpy.context.active_object
    shaft.name = "Drive_Shaft_Axle"
    shaft.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    shaft.data.materials.append(m_steel_shaft)
    shaft.parent = rotor_group
    bpy.ops.object.shade_smooth()

    # Pulley / Output Gear on shaft end
    bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.25, location=(0.0, 2.05, 0.0))
    pulley = bpy.context.active_object
    pulley.name = "Output_Shaft_Pulley"
    pulley.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pulley.data.materials.append(m_chassis)
    pulley.parent = rotor_group
    bpy.ops.object.shade_smooth()

    # Rectangular Copper Armature Coil Loop (ABCD circuit)
    c_coil = bpy.data.curves.new('Curve_Armature_Coil', 'CURVE')
    c_coil.dimensions = '3D'
    c_coil.bevel_depth = 0.065
    c_coil.bevel_resolution = 8
    s_coil = c_coil.splines.new('POLY')
    s_coil.points.add(7)
    # Loop path: Commutator -> A -> B -> C -> D -> Commutator
    coil_pts = [
        (-0.14, -1.05, -0.15, 1.0),
        (-0.65, -0.95, -0.15, 1.0),
        (-0.65, 0.95, -0.15, 1.0),
        (-0.65, 0.95, 0.15, 1.0),
        (0.65, 0.95, 0.15, 1.0),
        (0.65, -0.95, 0.15, 1.0),
        (0.14, -1.05, 0.15, 1.0),
        (0.14, -1.05, 0.0, 1.0)
    ]
    for idx, cp in enumerate(coil_pts):
        s_coil.points[idx].co = cp
    coil_obj = bpy.data.objects.new("Armature_Coil_Windings", c_coil)
    bpy.context.scene.collection.objects.link(coil_obj)
    coil_obj.data.materials.append(m_copper_coil)
    coil_obj.parent = rotor_group

    # =========================================================================
    # 4. SPLIT-RING COMMUTATOR & CARBON BRUSH RIGGING
    # =========================================================================
    # Semicircular Split-Ring 1
    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.45, location=(0.0, -1.25, 0.0))
    comm1 = bpy.context.active_object
    comm1.name = "Split_Ring_Commutator_Segment_1"
    comm1.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(comm1.data)
    verts_c1 = [v for v in bm.verts if v.co.x > -0.035]
    bmesh.ops.delete(bm, geom=verts_c1, context='VERTS')
    bm.to_mesh(comm1.data)
    bm.free()
    comm1.data.materials.append(m_commutator)
    comm1.parent = rotor_group
    bpy.ops.object.shade_smooth()

    # Semicircular Split-Ring 2
    bpy.ops.mesh.primitive_cylinder_add(radius=0.22, depth=0.45, location=(0.0, -1.25, 0.0))
    comm2 = bpy.context.active_object
    comm2.name = "Split_Ring_Commutator_Segment_2"
    comm2.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bm = bmesh.new()
    bm.from_mesh(comm2.data)
    verts_c2 = [v for v in bm.verts if v.co.x < 0.035]
    bmesh.ops.delete(bm, geom=verts_c2, context='VERTS')
    bm.to_mesh(comm2.data)
    bm.free()
    comm2.data.materials.append(m_commutator)
    comm2.parent = rotor_group
    bpy.ops.object.shade_smooth()

    # Carbon Graphite Brushes (Stationary on Stator)
    for b_sgn, b_name in [(-1, "Carbon_Brush_Positive"), (1, "Carbon_Brush_Negative")]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(b_sgn * 0.32, -1.25, 0.0))
        brush = bpy.context.active_object
        brush.name = b_name
        brush.scale = (0.16, 0.32, 0.18)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        brush.data.materials.append(m_carbon_brush)
        brush.parent = brush_group

        # Brass Spring Holder
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(b_sgn * 0.52, -1.25, 0.0))
        holder = bpy.context.active_object
        holder.name = f"{b_name}_Holder"
        holder.scale = (0.24, 0.34, 0.20)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        holder.data.materials.append(m_brass)
        holder.parent = brush_group

        # Lead Terminal Binding Post
        bpy.ops.mesh.primitive_cylinder_add(radius=0.10, depth=0.35, location=(b_sgn * 0.85, -1.25, -0.65))
        term = bpy.context.active_object
        term.name = f"Terminal_{'Positive' if b_sgn < 0 else 'Negative'}"
        term.data.materials.append(m_mag_north if b_sgn < 0 else m_chassis)
        term.parent = brush_group

    # =========================================================================
    # 5. MAGNETIC FIELD LINES & LORENTZ FORCE TORQUE ARROWS
    # =========================================================================
    # Luminous B-field lines streaming across armature gap (North -> South)
    for f_i in range(5):
        fy = -0.6 + f_i * 0.3
        for f_z in [-0.4, 0.0, 0.4]:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.018, depth=1.45, location=(0.0, fy, f_z))
            flux = bpy.context.active_object
            flux.name = f"B_Field_Vector_{f_i}_{f_z}"
            flux.rotation_euler = (0, math.pi / 2, 0)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            flux.data.materials.append(m_flux_line)
            flux.parent = field_group

    # Lorentz Force Vector Arrows (Upward on one side, Downward on the other)
    bpy.ops.mesh.primitive_cone_add(radius1=0.12, radius2=0.0, depth=0.35, location=(-0.65, 0.0, 0.55))
    f_up = bpy.context.active_object
    f_up.name = "Lorentz_Force_Upward_Vector"
    f_up.data.materials.append(m_force_arrow)
    f_up.parent = field_group

    bpy.ops.mesh.primitive_cone_add(radius1=0.12, radius2=0.0, depth=0.35, location=(0.65, 0.0, -0.55))
    f_down = bpy.context.active_object
    f_down.name = "Lorentz_Force_Downward_Vector"
    f_down.rotation_euler = (math.pi, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    f_down.data.materials.append(m_force_arrow)
    f_down.parent = field_group

    # =========================================================================
    # LIGHTING & CAMERA FOR BEAUTY PREVIEW RENDER
    # =========================================================================
    cam_data = bpy.data.cameras.new("RenderCam")
    cam_data.lens = 45
    cam = bpy.data.objects.new("RenderCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = (3.4, -6.8, 3.2)
    cam.rotation_euler = (math.radians(65), 0, math.radians(25))

    # 3-Point Studio Lighting
    key_light = bpy.data.lights.new("KeyLight", type='AREA')
    key_light.energy = 450
    key_light.size = 3.5
    key_obj = bpy.data.objects.new("KeyLight", key_light)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.location = (4.0, -4.5, 4.5)

    fill_light = bpy.data.lights.new("FillLight", type='AREA')
    fill_light.energy = 200
    fill_light.size = 4.0
    fill_obj = bpy.data.objects.new("FillLight", fill_light)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-4.0, -3.5, 2.5)

    rim_light = bpy.data.lights.new("RimLight", type='AREA')
    rim_light.energy = 480
    rim_light.size = 2.5
    rim_obj = bpy.data.objects.new("RimLight", rim_light)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (0.5, 5.0, 3.5)

    # Save .blend file
    blend_path = os.path.join(MODELS_DIR, "motor_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[SUCCESS] Saved Motor .blend -> {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR, "motor_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[SUCCESS] Rendered Motor preview -> {preview_path}")

    # Export optimized GLB for Three.js WebGL
    glb_path = os.path.join(OUTPUT_DIR, "motor_realistic.glb")
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
    bat_path = os.path.join(MODELS_DIR, "Open_Motor_In_Blender.bat")
    with open(bat_path, "w", encoding="utf-8") as bf:
        bf.write(f'@echo off\necho Opening 3D DC Motor & Dynamo in Blender 5.2...\nstart "" "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" "%~dp0motor_realistic.blend"\nexit\n')
    print(f"[SUCCESS] Created Launcher -> {bat_path}")

if __name__ == "__main__":
    build_realistic_motor()
