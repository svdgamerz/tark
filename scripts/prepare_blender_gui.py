"""
Blender Script: Prepare eye_realistic.blend with:
1. Standard clean workspace (Layout tab with 3D Viewport, Outliner, Properties).
2. 3D Viewport set to 'MATERIAL' shading (Material Preview with full colors, textures, reflections).
3. Viewport camera centered and zoomed directly onto the eye at distance ~7.5m.
4. Sun and Fill lighting.
5. All objects unhidden and visible.
"""

import bpy
import math
import os

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models_blender"))
PUBLIC_3D = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "3d_models"))
GLB_PATH = os.path.join(PUBLIC_3D, "eye_realistic.glb")
BLEND_PATH = os.path.join(MODELS_DIR, "eye_realistic.blend")

# Start from factory standard layout (so all 3D Viewport windows are standard)
bpy.ops.wm.read_factory_settings(use_empty=False)

# Delete default cube and light
for name in ["Cube", "Light"]:
    obj = bpy.data.objects.get(name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

# Import the Eye GLTF model
bpy.ops.import_scene.gltf(filepath=GLB_PATH)

# Setup Sunlight
sun_data = bpy.data.lights.new(name="Sun_Key", type='SUN')
sun_data.energy = 5.0
sun_data.color = (1.0, 0.98, 0.95)
sun_obj = bpy.data.objects.new("Sun_Key", sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(45), math.radians(30), math.radians(-30))

# Setup Fill Light
fill_data = bpy.data.lights.new(name="Sun_Fill", type='SUN')
fill_data.energy = 2.5
fill_data.color = (0.8, 0.9, 1.0)
fill_obj = bpy.data.objects.new("Sun_Fill", fill_data)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(-30), math.radians(-45), math.radians(120))

# Camera setup
cam = bpy.context.scene.camera
if not cam:
    cam_data = bpy.data.cameras.new("Camera")
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam

cam.location = (2.5, 7.0, 2.0)
cam.rotation_euler = (math.radians(75), 0, math.radians(160))

# Configure all 3D Viewport spaces in all screens/workspaces:
# 1. Shading: MATERIAL preview (so it's fully colored and lit instantly without needing to render)
# 2. View distance: 7.5 (perfect framing)
# 3. View location: centered at (0, 0, 0)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    space.shading.use_scene_lights = True
                    space.shading.use_scene_world = False
                    
                    # Point viewport directly at front-three-quarter view of the eye
                    r3d = space.region_3d
                    if r3d:
                        r3d.view_perspective = 'PERSP'
                        r3d.view_distance = 7.5
                        r3d.view_location = (0.0, 0.0, 0.0)
                        # Set standard front-angle rotation quaternion:
                        # Looking at anterior cornea + spectacles + extraocular muscles
                        r3d.view_rotation = (0.85, 0.35, 0.15, 0.35)

# Save the blend file
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
print(f"[SUCCESS] Prepared perfect GUI blend file: {BLEND_PATH}")
