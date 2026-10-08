"""Compose actual UI captures. Requires Pillow 10.4.0; no application dependency."""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageSequence

captures = Path("artifacts/launch")
manifest = json.loads((captures / "frames.json").read_text(encoding="utf-8"))
frames = []
font = ImageFont.load_default(size=20)
for item in manifest["frames"]:
    with Image.open(captures / item["file"]) as original:
        screenshot = original.convert("RGB")
    screenshot.thumbnail((760, 1080), Image.Resampling.LANCZOS)
    frame = Image.new("RGB", (784, 1152), "#f4f6fb")
    ImageDraw.Draw(frame).text((12, 14), item["caption"], font=font, fill="#0f172a")
    frame.paste(screenshot, (12, 56))
    frames.append(frame)

output = Path("demo/seqshow.gif")
output.parent.mkdir(exist_ok=True)
frames[0].save(output, save_all=True, append_images=frames[1:],
               duration=[item["duration"] for item in manifest["frames"]], loop=0, optimize=True)
# Review the encoded GIF, including its actual palette and frame composition.
sheet = Image.new("RGB", (784 * 5, 1152 * 2), "white")
with Image.open(output) as gif:
    assert gif.n_frames == len(frames)
    for index, frame in enumerate(ImageSequence.Iterator(gif)):
        sheet.paste(frame.convert("RGB"), ((index % 5) * 784, (index // 5) * 1152))
sheet.thumbnail((1960, 1152))
sheet.save(captures / "contact-sheet.png")
print(f"{output}: {len(frames)} frames, {output.stat().st_size:,} bytes")
