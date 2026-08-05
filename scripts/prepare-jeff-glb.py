import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


parser = argparse.ArgumentParser()
parser.add_argument("--mesh", required=True)
parser.add_argument("--texture", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--preview-dir")
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.wm.obj_import(filepath=str(Path(args.mesh).resolve()))

material = bpy.data.materials.new("Jeff baked gold")
material.use_nodes = True
principled = material.node_tree.nodes.get("Principled BSDF")
texture = material.node_tree.nodes.new("ShaderNodeTexImage")
texture.image = bpy.data.images.load(str(Path(args.texture).resolve()))
material.node_tree.links.new(texture.outputs["Color"], principled.inputs["Base Color"])
material.node_tree.links.new(texture.outputs["Alpha"], principled.inputs["Alpha"])
principled.inputs["Roughness"].default_value = 0.48
principled.inputs["Metallic"].default_value = 0.18

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for mesh in meshes:
    mesh.rotation_euler.x = math.pi / 2
    bpy.context.view_layer.objects.active = mesh
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    mesh.data.materials.clear()
    mesh.data.materials.append(material)
    for polygon in mesh.data.polygons:
        polygon.use_smooth = True

vertices = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
minimum = Vector(tuple(min(vertex[axis] for vertex in vertices) for axis in range(3)))
maximum = Vector(tuple(max(vertex[axis] for vertex in vertices) for axis in range(3)))
center = (minimum + maximum) / 2
size = maximum - minimum

output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    export_apply=True,
    export_materials="EXPORT",
)

if args.preview_dir:
    preview_dir = Path(args.preview_dir).resolve()
    preview_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True

    camera_data = bpy.data.cameras.new("Preview camera")
    camera = bpy.data.objects.new("Preview camera", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera_data.lens = 58

    def add_area(name, location, energy, size_value, color):
        light_data = bpy.data.lights.new(name=name, type="AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size_value
        light_data.color = color
        light = bpy.data.objects.new(name, light_data)
        scene.collection.objects.link(light)
        light.location = location
        direction = center - light.location
        light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    add_area("Warm key", center + Vector((3.5, -4.5, 4.0)), 950, 4.0, (1.0, 0.78, 0.48))
    add_area("Cool fill", center + Vector((-4.0, 1.5, 2.5)), 700, 5.0, (0.42, 0.62, 0.55))

    radius = max(size.x, size.y, size.z) * 2.35
    for index, degrees in enumerate((0, 60, 120, 180, 240, 300)):
        angle = math.radians(degrees)
        camera.location = center + Vector((math.sin(angle) * radius, -math.cos(angle) * radius, size.z * 0.08))
        direction = center - camera.location
        camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(preview_dir / f"jeff-{index:02d}.png")
        bpy.ops.render.render(write_still=True)
