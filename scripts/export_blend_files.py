"""
Blender Script: Save .blend files for Eye, Heart, and Cell with studio camera & lighting,
plus render high-resolution viewport preview images.
"""

import bpy
import bmesh
import math
import os

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models_blender"))
os.makedirs(MODELS_DIR, exist_ok=True)
PUBLIC_3D = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "3d_models"))

def setup_studio_scene(model_name, glb_path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    
    # Import GLB
    bpy.ops.import_scene.gltf(filepath=glb_path)
    
    # Add Studio Camera
    cam_data = bpy.data.cameras.new("Studio_Camera")
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new("Studio_Camera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    
    if model_name == "eye":
        cam_obj.location = (3.5, 4.2, 2.5)
        cam_obj.rotation_euler = (math.radians(-25), math.radians(0), math.radians(140))
    elif model_name == "heart":
        cam_obj.location = (0, -6.5, 0.5)
        cam_obj.rotation_euler = (math.radians(85), 0, 0)
    else: # cell
        cam_obj.location = (5.5, -5.5, 4.2)
        cam_obj.rotation_euler = (math.radians(60), 0, math.radians(45))
        
    # Key Light (Warm Key)
    light_data = bpy.data.lights.new(name="Key_Light", type='POINT')
    light_data.energy = 1500
    light_data.color = (1.0, 0.95, 0.9)
    light_obj = bpy.data.objects.new("Key_Light", light_data)
    bpy.context.scene.collection.objects.link(light_obj)
    light_obj.location = (4, 3, 5)
    
    # Fill Light (Cool Fill)
    fill_data = bpy.data.lights.new(name="Fill_Light", type='POINT')
    fill_data.energy = 600
    fill_data.color = (0.8, 0.9, 1.0)
    fill_obj = bpy.data.objects.new("Fill_Light", fill_data)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = (-4, -3, 3)
    
    # Rim Light (Backlight for edge highlights)
    rim_data = bpy.data.lights.new(name="Rim_Light", type='POINT')
    rim_data.energy = 2000
    rim_data.color = (1.0, 1.0, 1.0)
    rim_obj = bpy.data.objects.new("Rim_Light", rim_data)
    bpy.context.scene.collection.objects.link(rim_obj)
    rim_obj.location = (0, -5, 4)
    
    # Render Settings
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    
    # Save .blend file
    blend_path = os.path.join(MODELS_DIR, f"{model_name}_realistic.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[SAVED BLEND] {blend_path}")
    
    # Render preview image
    render_path = os.path.join(MODELS_DIR, f"{model_name}_blender_preview.png")
    bpy.context.scene.render.filepath = render_path
    bpy.ops.render.render(write_still=True)
    print(f"[RENDERED IMAGE] {render_path}")

setup_studio_scene("eye", os.path.join(PUBLIC_3D, "eye_realistic.glb"))
setup_studio_scene("heart", os.path.join(PUBLIC_3D, "heart_realistic.glb"))
setup_studio_scene("cell", os.path.join(PUBLIC_3D, "cell_realistic.glb"))
