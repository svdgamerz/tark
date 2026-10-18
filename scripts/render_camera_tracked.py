"""
Blender Beauty Render: Setup Track To constraint and bright studio HDRI world,
then render beauty shots for Eye, Heart, and Cell.
"""

import bpy
import math
import os

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models_blender"))

def render_model(blend_file, preview_name, cam_loc):
    bpy.ops.wm.open_mainfile(filepath=blend_file)
    
    # World background
    world = bpy.context.scene.world
    if not world:
        world = bpy.data.worlds.new("StudioWorld")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg_node = world.node_tree.nodes.get("Background")
    if bg_node:
        bg_node.inputs['Color'].default_value = (0.05, 0.07, 0.11, 1.0) # Sleek dark studio backdrop
        bg_node.inputs['Strength'].default_value = 1.0
        
    # Target empty at center
    target = bpy.data.objects.new("LookTarget", None)
    bpy.context.scene.collection.objects.link(target)
    target.location = (0, 0, 0)
    
    # Camera
    cam = bpy.context.scene.camera
    if not cam:
        cam_data = bpy.data.cameras.new("Camera")
        cam = bpy.data.objects.new("Camera", cam_data)
        bpy.context.scene.collection.objects.link(cam)
        bpy.context.scene.camera = cam
        
    cam.location = cam_loc
    
    # Track To Constraint
    con = cam.constraints.new(type='TRACK_TO')
    con.target = target
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'
    
    # Big Key Sun Light
    sun_data = bpy.data.lights.new(name="Sun", type='SUN')
    sun_data.energy = 4.5
    sun_data.color = (1.0, 0.98, 0.95)
    sun = bpy.data.objects.new("Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(45), math.radians(30), math.radians(-30))
    
    # Secondary Fill Sun
    sun2_data = bpy.data.lights.new(name="FillSun", type='SUN')
    sun2_data.energy = 2.0
    sun2_data.color = (0.75, 0.85, 1.0)
    sun2 = bpy.data.objects.new("FillSun", sun2_data)
    bpy.context.scene.collection.objects.link(sun2)
    sun2.rotation_euler = (math.radians(-30), math.radians(-45), math.radians(120))
    
    # Save the updated .blend file with proper camera & lighting setup!
    bpy.ops.wm.save_as_mainfile(filepath=blend_file)
    
    # Render preview
    render_out = os.path.join(MODELS_DIR, preview_name)
    bpy.context.scene.render.filepath = render_out
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.ops.render.render(write_still=True)
    print(f"[RENDERED] {render_out}")

# Render Eye (Full Framing)
render_model(os.path.join(MODELS_DIR, "eye_realistic.blend"), "eye_blender_preview.png", (6.0, 9.5, 4.5))

# Render Heart (Full Framing)
render_model(os.path.join(MODELS_DIR, "heart_realistic.blend"), "heart_blender_preview.png", (0.5, 9.5, 1.2))

# Render Cell (Full Framing)
render_model(os.path.join(MODELS_DIR, "cell_realistic.blend"), "cell_blender_preview.png", (8.5, -8.5, 6.0))
