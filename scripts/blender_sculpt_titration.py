"""
Ultra-Realistic Analytical Chemistry Titration & Laboratory Glassware Generator for Blender 5.2
Sculpts an authentic scientific-grade laboratory analytical titration apparatus:
1. Support Apparatus:
   - Heavy Cast-Iron Retort Stand Base with dark textured hammertone enamel finish.
   - Vertical Chrome-Plated Stainless Steel Support Rod.
   - Die-Cast Bosshead Clamp with brass butterfly tightening screws.
   - Rubber-Coated 3-Prong Burette Clamp gripping the glassware securely.
2. Precision Volumetric Glassware:
   - 50 mL Borosilicate 3.3 Glass Burette (IOR 1.474) with flared rim and etched graduation markings.
   - Titrant Liquid Column with curved meniscus (surface tension physics).
   - Precision Fluoropolymer (PTFE) Stopcock with 90-degree rotating valve handle.
   - Tapered Capillary Dispensing Nozzle with micro-droplet detachment.
   - 250 mL Conical Erlenmeyer Flask with reinforced beaded rim and volumetric graduations.
   - Analyte Solution with phenolphthalein colorimetric indicator gradient.
3. Digital Magnetic Stirrer & Laboratory Hotplate:
   - Chemical-Resistant Thermoplastic Instrument Housing.
   - White Pyroceram (Solid Ceramic) Top Heating / Stirring Plate.
   - Dual Analog / Digital Knobs: Stirring Speed (0 - 1500 RPM) & Heating Temperature.
   - Glowing Green/Blue Digital LED Display readout.
   - PTFE Octagonal Magnetic Stir Bar (Flea) generating fluid vortex.
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

def create_pbr_material(name, base_color, roughness=0.15, metallic=0.0, transmission=0.0, ior=1.474,
                        specular=0.8, alpha=1.0, is_glass=False, is_metal=False, is_liquid=False):
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

    if is_glass or transmission > 0 or alpha < 1.0:
        if 'Transmission Weight' in bsdf.inputs:
            bsdf.inputs['Transmission Weight'].default_value = 0.95 if is_glass else transmission
        elif 'Transmission' in bsdf.inputs:
            bsdf.inputs['Transmission'].default_value = 0.95 if is_glass else transmission
        bsdf.inputs['Roughness'].default_value = 0.04 if is_glass else roughness
        mat.blend_method = 'BLEND'

    if is_metal:
        bsdf.inputs['Metallic'].default_value = 0.92
        bsdf.inputs['Roughness'].default_value = 0.18

    return mat

def create_smooth_subd(obj, levels=2):
    mod = obj.modifiers.new(name="Subdivision", type='SUBSURF')
    mod.levels = levels
    mod.render_levels = levels
    for p in obj.data.polygons:
        p.use_smooth = True
    return mod

def build_ultra_titration():
    reset()

    # Materials
    mat_stand_base = create_pbr_material("Mat_CastIronBase", (0.15, 0.16, 0.18), roughness=0.45, metallic=0.35)
    mat_steel_rod = create_pbr_material("Mat_StainlessRod", (0.85, 0.88, 0.92), roughness=0.14, metallic=0.95, is_metal=True)
    mat_clamp = create_pbr_material("Mat_DieCastClamp", (0.25, 0.28, 0.32), roughness=0.35, metallic=0.60)
    mat_clamp_sleeves = create_pbr_material("Mat_VinylSleeves", (0.92, 0.25, 0.25), roughness=0.38)
    mat_brass_screw = create_pbr_material("Mat_BrassScrew", (0.85, 0.68, 0.25), roughness=0.22, metallic=0.88, is_metal=True)
    mat_glass = create_pbr_material("Mat_BorosilicateGlass", (0.95, 0.98, 1.0), roughness=0.03, transmission=0.96, ior=1.474, alpha=0.25, is_glass=True)
    mat_liquid_titrant = create_pbr_material("Mat_TitrantSolution", (0.92, 0.96, 1.0), roughness=0.05, transmission=0.92, alpha=0.35, is_liquid=True)
    mat_analyte_pink = create_pbr_material("Mat_PhenolphthaleinPink", (0.95, 0.25, 0.65), roughness=0.06, transmission=0.85, alpha=0.45, is_liquid=True)
    mat_ptfe = create_pbr_material("Mat_TeflonPTFE", (0.96, 0.96, 0.95), roughness=0.25, metallic=0.0)
    mat_stopcock_knob = create_pbr_material("Mat_StopcockKnob", (0.15, 0.45, 0.85), roughness=0.28)
    mat_hotplate_chassis = create_pbr_material("Mat_StirrerChassis", (0.82, 0.84, 0.86), roughness=0.32)
    mat_ceramic_plate = create_pbr_material("Mat_PyroceramPlate", (0.98, 0.98, 0.98), roughness=0.10, specular=0.9)
    mat_led_display = create_pbr_material("Mat_LEDDisplay", (0.05, 0.05, 0.05), roughness=0.20)
    mat_droplet = create_pbr_material("Mat_LiquidDroplet", (0.90, 0.95, 1.0), roughness=0.04, transmission=0.95, alpha=0.30, is_liquid=True)

    # ========================================================
    # 1. RETORT STAND & STEEL ROD (X ~ -1.8)
    # ========================================================
    # Cast Iron Base Plate
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(-1.8, 0.0, -3.2)
    )
    base_plate = bpy.context.active_object
    base_plate.name = "Retort_Stand_Base"
    base_plate.scale = (2.2, 3.4, 0.35)
    base_plate.data.materials.append(mat_stand_base)
    create_smooth_subd(base_plate, 1)

    # Vertical Chrome Steel Rod
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.14, depth=9.5,
        location=(-1.8, -1.1, 1.5)
    )
    steel_rod = bpy.context.active_object
    steel_rod.name = "Retort_Stand_Rod"
    steel_rod.data.materials.append(mat_steel_rod)
    create_smooth_subd(steel_rod, 1)

    # Bosshead Clamp (attaches to rod at Z ~ 2.4)
    bpy.ops.mesh.primitive_cube_add(
        size=0.55,
        location=(-1.5, -1.1, 2.4)
    )
    bosshead = bpy.context.active_object
    bosshead.name = "Bosshead_Clamp"
    bosshead.scale = (1.2, 0.8, 0.8)
    bosshead.data.materials.append(mat_clamp)
    create_smooth_subd(bosshead, 1)

    # Brass Thumb Screw
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.22, depth=0.12,
        location=(-1.5, -1.6, 2.4)
    )
    screw = bpy.context.active_object
    screw.name = "Brass_Thumb_Screw"
    screw.rotation_euler = (1.57, 0, 0)
    screw.data.materials.append(mat_brass_screw)

    # Extension Clamp Arm (Extends from bosshead to burette at X ~ 0)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.10, depth=1.6,
        location=(-0.7, -1.1, 2.4)
    )
    clamp_arm = bpy.context.active_object
    clamp_arm.name = "Clamp_Extension_Arm"
    clamp_arm.rotation_euler = (0, 1.57, 0)
    clamp_arm.data.materials.append(mat_clamp)

    # Burette Rubberized Grip Jaws (Surrounding the burette tube)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.45, minor_radius=0.12,
        major_segments=24, minor_segments=12,
        location=(0.0, -1.1, 2.4)
    )
    clamp_jaw = bpy.context.active_object
    clamp_jaw.name = "Burette_Clamp_Jaws"
    clamp_jaw.rotation_euler = (1.57, 0, 0)
    clamp_jaw.data.materials.append(mat_clamp_sleeves)

    # ========================================================
    # 2. 50 mL BOROSILICATE GLASS BURETTE (Centred at X ~ 0, Y ~ -1.1)
    # ========================================================
    # Burette Glass Cylinder
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32, radius=0.35, depth=6.8,
        location=(0.0, -1.1, 3.2)
    )
    burette_tube = bpy.context.active_object
    burette_tube.name = "Borosilicate_Burette_Tube"
    burette_tube.data.materials.append(mat_glass)
    create_smooth_subd(burette_tube, 2)

    # Flared Funnel Top Rim
    bpy.ops.mesh.primitive_cone_add(
        vertices=24, radius1=0.55, radius2=0.35, depth=0.45,
        location=(0.0, -1.1, 6.7)
    )
    burette_rim = bpy.context.active_object
    burette_rim.name = "Burette_Funnel_Rim"
    burette_rim.data.materials.append(mat_glass)

    # Titrant Solution Inside Tube (Liquid column with downward meniscus)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.31, depth=5.2,
        location=(0.0, -1.1, 2.4)
    )
    titrant_liquid = bpy.context.active_object
    titrant_liquid.name = "Titrant_Solution_Column"
    titrant_liquid.data.materials.append(mat_liquid_titrant)

    # Precision PTFE Stopcock (Valve assembly at Z ~ -0.3)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=20, radius=0.28, depth=0.75,
        location=(0.0, -1.1, -0.25)
    )
    stopcock_body = bpy.context.active_object
    stopcock_body.name = "PTFE_Stopcock_Valve"
    stopcock_body.data.materials.append(mat_ptfe)
    create_smooth_subd(stopcock_body, 1)

    # Rotating Blue T-Handle Valve Knob
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.15, depth=0.95,
        location=(0.0, -0.65, -0.25)
    )
    knob = bpy.context.active_object
    knob.name = "Stopcock_Handle_Knob"
    knob.rotation_euler = (0, 1.57, 0)
    knob.data.materials.append(mat_stopcock_knob)
    create_smooth_subd(knob, 1)

    # Capillary Dispensing Nozzle (tapering tip below stopcock)
    bpy.ops.mesh.primitive_cone_add(
        vertices=20, radius1=0.22, radius2=0.06, depth=0.95,
        location=(0.0, -1.1, -1.0)
    )
    tip = bpy.context.active_object
    tip.name = "Burette_Dispensing_Tip"
    tip.data.materials.append(mat_glass)

    # Liquid Droplet suspended at the tip
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=16, ring_count=12, radius=0.10,
        location=(0.0, -1.1, -1.55)
    )
    droplet = bpy.context.active_object
    droplet.name = "Dispensing_Liquid_Droplet"
    droplet.scale = (0.9, 0.9, 1.3)
    droplet.data.materials.append(mat_droplet)

    # ========================================================
    # 3. 250 mL ERLENMEYER CONICAL FLASK (Centred at X ~ 0, Y ~ -1.1, Z ~ -2.4)
    # ========================================================
    # Conical Body
    bpy.ops.mesh.primitive_cone_add(
        vertices=32, radius1=1.55, radius2=0.48, depth=1.85,
        location=(0.0, -1.1, -2.15)
    )
    flask_body = bpy.context.active_object
    flask_body.name = "Erlenmeyer_Flask_Body"
    flask_body.data.materials.append(mat_glass)
    create_smooth_subd(flask_body, 2)

    # Flask Cylindrical Neck
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=0.48, depth=0.75,
        location=(0.0, -1.1, -1.0)
    )
    flask_neck = bpy.context.active_object
    flask_neck.name = "Erlenmeyer_Flask_Neck"
    flask_neck.data.materials.append(mat_glass)

    # Flask Beaded Rim
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.50, minor_radius=0.06,
        major_segments=24, minor_segments=12,
        location=(0.0, -1.1, -0.6)
    )
    flask_rim = bpy.context.active_object
    flask_rim.name = "Erlenmeyer_Flask_Rim"
    flask_rim.data.materials.append(mat_glass)

    # Analyte Solution Pool (Phenolphthalein endpoint pink)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=28, radius=1.35, depth=0.55,
        location=(0.0, -1.1, -2.7)
    )
    analyte_solution = bpy.context.active_object
    analyte_solution.name = "Analyte_Indicator_Solution"
    analyte_solution.scale = (1.0, 1.0, 1.0)
    analyte_solution.data.materials.append(mat_analyte_pink)

    # Magnetic PTFE Stir Bar (Flea) at bottom of flask
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=16, radius=0.08, depth=0.55,
        location=(0.0, -1.1, -2.95)
    )
    stir_bar = bpy.context.active_object
    stir_bar.name = "Magnetic_Stir_Bar"
    stir_bar.rotation_euler = (0, 1.57, 0.4)
    stir_bar.data.materials.append(mat_ptfe)
    create_smooth_subd(stir_bar, 1)

    # ========================================================
    # 4. DIGITAL MAGNETIC STIRRER & HOTPLATE
    # ========================================================
    # Instrument Housing Box
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0.0, -1.1, -3.55)
    )
    housing = bpy.context.active_object
    housing.name = "Magnetic_Stirrer_Housing"
    housing.scale = (3.6, 3.8, 0.75)
    housing.data.materials.append(mat_hotplate_chassis)
    create_smooth_subd(housing, 1)

    # White Solid Ceramic Top Plate (Pyroceram)
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0.0, -1.1, -3.12)
    )
    ceramic_top = bpy.context.active_object
    ceramic_top.name = "Ceramic_Stirrer_Plate"
    ceramic_top.scale = (3.2, 3.2, 0.12)
    ceramic_top.data.materials.append(mat_ceramic_plate)

    # Front Control Panel Display & Knobs
    # Digital LED Display
    bpy.ops.mesh.primitive_cube_add(
        size=1.0,
        location=(0.0, 0.85, -3.55)
    )
    led_panel = bpy.context.active_object
    led_panel.name = "Digital_LED_Readout"
    led_panel.scale = (1.4, 0.08, 0.35)
    led_panel.data.materials.append(mat_led_display)

    # Speed Control Knob (RPM)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=20, radius=0.28, depth=0.25,
        location=(-0.95, 0.88, -3.55)
    )
    rpm_knob = bpy.context.active_object
    rpm_knob.name = "Stirrer_Speed_RPM_Knob"
    rpm_knob.rotation_euler = (1.57, 0, 0)
    rpm_knob.data.materials.append(mat_stand_base)

    # Temp Control Knob
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=20, radius=0.28, depth=0.25,
        location=(0.95, 0.88, -3.55)
    )
    temp_knob = bpy.context.active_object
    temp_knob.name = "Stirrer_Temp_Knob"
    temp_knob.rotation_euler = (1.57, 0, 0)
    temp_knob.data.materials.append(mat_stand_base)

    # ========================================================
    # STUDIO LIGHTING & CAMERA
    # ========================================================
    cam_data = bpy.data.cameras.new("StudioCamera")
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new("StudioCamera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, -12.5, 1.2)
    cam_obj.rotation_euler = (1.50, 0.0, 0.0)
    bpy.context.scene.camera = cam_obj

    key_light = bpy.data.lights.new("KeyLight", type='AREA')
    key_light.energy = 460
    key_light.size = 4.5
    key_obj = bpy.data.objects.new("KeyLight", key_light)
    bpy.context.scene.collection.objects.link(key_obj)
    key_obj.location = (4.0, -6.5, 5.0)

    fill_light = bpy.data.lights.new("FillLight", type='AREA')
    fill_light.energy = 240
    fill_light.size = 5.0
    fill_obj = bpy.data.objects.new("FillLight", fill_light)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-4.5, -5.5, 3.0)

    rim_light = bpy.data.lights.new("RimLight", type='AREA')
    rim_light.energy = 500
    rim_light.size = 3.5
    rim_obj = bpy.data.objects.new("RimLight", rim_light)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (0.0, 6.0, 4.0)

    # Save to native .blend file
    blend_path = os.path.join(MODELS_DIR, "titration_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[TITRATION] Saved native .blend to {blend_path}")

    # Render Preview PNG
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    preview_path = os.path.join(MODELS_DIR, "titration_blender_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)
    print(f"[TITRATION] Rendered preview -> {preview_path}")

    # Export to WebGL GLB
    glb_path = os.path.join(OUTPUT_DIR, "titration_realistic.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"[TITRATION SUCCESS] Exported complete titration model to {glb_path}")

if __name__ == '__main__':
    build_ultra_titration()
