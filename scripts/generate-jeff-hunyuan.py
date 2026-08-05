import argparse
from pathlib import Path

import torch
from PIL import Image
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline


parser = argparse.ArgumentParser()
parser.add_argument("--image", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()

device = "mps" if torch.backends.mps.is_available() else "cpu"
dtype = torch.float16 if device == "mps" else torch.float32
pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
    "tencent/Hunyuan3D-2mini",
    subfolder="hunyuan3d-dit-v2-mini",
    variant="fp16",
    device=device,
    dtype=dtype,
)

image = Image.open(args.image).convert("RGBA")
mesh = pipeline(
    image=image,
    num_inference_steps=40,
    octree_resolution=384,
    num_chunks=12000,
    generator=torch.manual_seed(2026),
    output_type="trimesh",
)[0]

output = Path(args.output).resolve()
output.parent.mkdir(parents=True, exist_ok=True)
mesh.export(output)
print(f"Generated {output}")
