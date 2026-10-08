"""Compose actual UI captures. Requires Pillow 10.4.0; no application dependency."""
import json
import argparse
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageSequence

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--captures", default="artifacts/launch")
parser.add_argument("--output", default="demo/seqshow.gif")
parser.add_argument("--width", type=int, default=784)
parser.add_argument("--height", type=int, default=1152)
args = parser.parse_args()
captures = Path(args.captures)
manifest = json.loads((captures / "frames.json").read_text(encoding="utf-8"))
frames = []
font = ImageFont.load_default(size=20)
for item in manifest["frames"]:
    with Image.open(captures / item["file"]) as original:
        screenshot = original.convert("RGB")
    screenshot.thumbnail((args.width - 24, args.height - 72), Image.Resampling.LANCZOS)
    frame = Image.new("RGB", (args.width, args.height), "#f4f6fb")
    ImageDraw.Draw(frame).text((12, 14), item["caption"], font=font, fill="#0f172a")
    frame.paste(screenshot, (12, 56))
    frames.append(frame)

output = Path(args.output)
output.parent.mkdir(exist_ok=True)
frames[0].save(output, save_all=True, append_images=frames[1:],
               duration=[item["duration"] for item in manifest["frames"]], loop=0, optimize=True)
# Review the encoded GIF, including its actual palette and frame composition.
sheet = Image.new("RGB", (args.width * 5, args.height * math.ceil(len(frames) / 5)), "white")
with Image.open(output) as gif:
    assert gif.n_frames == len(frames)
    for index, frame in enumerate(ImageSequence.Iterator(gif)):
        sheet.paste(frame.convert("RGB"), ((index % 5) * args.width, (index // 5) * args.height))
sheet.thumbnail((1960, 1152))
sheet.save(captures / "contact-sheet.png")
print(f"{output}: {len(frames)} frames, {output.stat().st_size:,} bytes")
