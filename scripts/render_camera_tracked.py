"""
Blender Masterpiece Beauty Studio Setup:
1. Optimizes camera angles to display full anatomical structures.
2. High-intensity 3-point key/fill/rim studio lighting.
3. Configures Material Preview in all 3D Viewports for instant interactive viewing in Blender GUI.
4. Renders pristine beauty shots.
"""

import bpy
import math
import os

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models_blender"))

def setup_and_render(blend_file, preview_name, cam_loc, target_loc=(0, 0, 0), lens=35):
    bpy.ops.wm.open_mainfile(filepath=blend_file)
    
    # World background
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("StudioWorld")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.05, 0.07, 0.12, 1.0)
        bg_node.inputs['Strength'].default_value = 1.0

    # Look target
    target = bpy.data.objects.get("LookTarget")
    if not target:
        target = bpy.data.objects.new("LookTarget", None)
        bpy.context.scene.collection.objects.link(target)
    target.location = target_loc

    # Camera
    cam = bpy.context.scene.camera
    if not cam:
        cam_data = bpy.data.cameras.new("Camera")
        cam = bpy.data.objects.new("Camera", cam_data)
        bpy.context.scene.collection.objects.link(cam)
        bpy.context.scene.camera = cam

    cam.data.lens = lens
    cam.location = cam_loc
    cam.constraints.clear()
    con = cam.constraints.new(type='TRACK_TO')
    con.target = target
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'

    # High-End Studio 3-Point Lighting
    # 1. Key Sun
    sun = bpy.data.objects.get("Sun_Key")
    if not sun:
        sun_data = bpy.data.lights.new(name="Sun_Key", type='SUN')
        sun = bpy.data.objects.new("Sun_Key", sun_data)
        bpy.context.scene.collection.objects.link(sun)
    sun.data.energy = 8.0
    sun.data.color = (1.0, 0.98, 0.95)
    sun.rotation_euler = (math.radians(50), math.radians(25), math.radians(-35))

    # 2. Fill Sun
    fill = bpy.data.objects.get("Sun_Fill")
    if not fill:
        fill_data = bpy.data.lights.new(name="Sun_Fill", type='SUN')
        fill = bpy.data.objects.new("Sun_Fill", fill_data)
        bpy.context.scene.collection.objects.link(fill)
    fill.data.energy = 4.0
    fill.data.color = (0.75, 0.85, 1.0)
    fill.rotation_euler = (math.radians(-25), math.radians(-40), math.radians(130))

    # 3. Direct Front Studio Area Light
    front_light = bpy.data.objects.get("Front_Studio_Light")
    if not front_light:
        fl_data = bpy.data.lights.new(name="Front_Studio_Light", type='POINT')
        front_light = bpy.data.objects.new("Front_Studio_Light", fl_data)
        bpy.context.scene.collection.objects.link(front_light)
    front_light.data.energy = 2500
    front_light.data.color = (1.0, 0.96, 0.92)
    front_light.location = (cam_loc[0] * 0.8, cam_loc[1] * 0.8, cam_loc[2] * 0.8 + 1.0)

    # 4. Rim Backlight
    rim = bpy.data.objects.get("Sun_Rim")
    if not rim:
        rim_data = bpy.data.lights.new(name="Sun_Rim", type='SUN')
        rim = bpy.data.objects.new("Sun_Rim", rim_data)
        bpy.context.scene.collection.objects.link(rim)
    rim.data.energy = 5.0
    rim.data.color = (0.85, 0.92, 1.0)
    rim.rotation_euler = (math.radians(-65), math.radians(65), math.radians(-140))

    # Configure 3D Viewport in all screens for instant Material Preview when opened in GUI
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        space.shading.type = 'MATERIAL'
                        space.shading.use_scene_lights = True
                        space.shading.use_scene_world = False
                        r3d = space.region_3d
                        if r3d:
                            r3d.view_perspective = 'PERSP'
                            r3d.view_distance = 8.5
                            r3d.view_location = target_loc

    # Save GUI blend file
    bpy.ops.wm.save_as_mainfile(filepath=blend_file)

    # Render Preview
    render_out = os.path.join(MODELS_DIR, preview_name)
    bpy.context.scene.render.filepath = render_out
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.ops.render.render(write_still=True)
    print(f"[RENDERED BEAUTY SHOT] {render_out}")

# 1. EYE: Side-front angle looking directly at cornea, iris, pupil, rectus muscles without spectacle obstruction
setup_and_render(os.path.join(MODELS_DIR, "eye_realistic.blend"), "eye_blender_preview.png", 
                 cam_loc=(6.0, 2.4, 1.6), target_loc=(0, 1.0, 0), lens=36)

# 2. HEART: Full frontal view with ample headroom for aortic arch and branches
setup_and_render(os.path.join(MODELS_DIR, "heart_realistic.blend"), "heart_blender_preview.png", 
                 cam_loc=(0.2, 11.5, 0.9), target_loc=(0, 0, 0.5), lens=35)

# 3. CELL: 3/4 Cutaway showing nucleus, chromatin, ER folds, Golgi, and cristae mitochondria
setup_and_render(os.path.join(MODELS_DIR, "cell_realistic.blend"), "cell_blender_preview.png", 
                 cam_loc=(8.2, 8.2, 4.8), target_loc=(0, 0, 0), lens=35)
