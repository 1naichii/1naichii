"""Turn the source GIF into chunky pixel art with one shared palette.

Usage: python scripts/pixelate-gif.py Tumblr.gif pixel-transformation.gif
"""
import sys
from PIL import Image, ImageEnhance, ImageSequence

SOURCE, OUTPUT = sys.argv[1], sys.argv[2]
BLOCK = 3      # one art pixel = 3x3 screen pixels
COLORS = 32    # shared palette size, keeps frames from flickering

source = Image.open(SOURCE)
size = source.size
small = (size[0] // BLOCK, size[1] // BLOCK)
durations, frames = [], []

for frame in ImageSequence.Iterator(source):
    durations.append(frame.info.get("duration", 40))
    image = frame.convert("RGB").resize(small, Image.Resampling.BOX)
    frames.append(ImageEnhance.Color(image).enhance(1.15))

# Build one palette from a contact sheet of every 4th frame.
sample = frames[::4]
sheet = Image.new("RGB", (small[0], small[1] * len(sample)))
for index, image in enumerate(sample):
    sheet.paste(image, (0, index * small[1]))
palette = sheet.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)

output = [
    image.quantize(palette=palette, dither=Image.Dither.NONE).resize((small[0] * BLOCK, small[1] * BLOCK), Image.Resampling.NEAREST)
    for image in frames
]
output[0].save(OUTPUT, save_all=True, append_images=output[1:], duration=durations, loop=0, optimize=True, disposal=1)
print(f"{OUTPUT}: {len(output)} frames, {small[0]}x{small[1]} art pixels")
