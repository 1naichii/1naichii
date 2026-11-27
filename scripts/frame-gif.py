"""Mount the Frieren GIF in a sage paper mat with a thin gold frame, 680px wide
so it lines up with banner.svg and profile.svg in the README.

- The first frame (mat plus picture) is encoded here, with transparent rounded
  corners matching the 18px corners of the two SVGs, so nothing pokes out on
  GitHub's dark background.
- The middle frames are copied byte for byte from the source and shifted into
  the mat, keeping the source's own palettes.
- The last few frames are cross-faded into the first, because the source loop
  jumps where it wraps around. They only redraw the pixels that change.

Every pixel keeps its exact colour, except where a full frame has more than 255
colours: there the rarest few snap to their nearest neighbour.

Usage: python scripts/frame-gif.py assets/frieren-source.gif frieren.gif   (needs Pillow)
"""
import io
import struct
import sys
from PIL import Image, ImageChops, ImageDraw, ImageSequence

SOURCE, OUTPUT = sys.argv[1], sys.argv[2]
WIDTH = 680
RADIUS = 18
MAT = "#eef2e8"
GOLD = "#a98236"
GOLD_DIM = "#d8bd7d"
PAD_Y = 14
FADE = 3  # frames cross-faded into the first at the end of the loop
TRANSPARENT = 255
STILL = 4  # a cross-fade pixel this close to what is already shown is left alone


def read_gif(data):
    """Split a GIF into its colour table, loop extension and a list of (GCE, image block) frames."""
    flags = data[10]
    table = 3 * (2 << (flags & 7)) if flags & 0x80 else 0
    i = 13 + table
    frames, gce, loop = [], b"", b""
    while data[i] != 0x3B:
        start = i
        if data[i] == 0x21:
            label = data[i + 1]
            i += 2
            while data[i]:
                i += data[i] + 1
            i += 1
            if label == 0xFF and data[start + 3:start + 14] == b"NETSCAPE2.0":
                loop = data[start:i]
            elif label == 0xF9:
                gce = data[start:i]
        elif data[i] == 0x2C:
            local = data[i + 9]
            i += 10 + (3 * (2 << (local & 7)) if local & 0x80 else 0) + 1
            while data[i]:
                i += data[i] + 1
            i += 1
            frames.append((gce, data[start:i]))
            gce = b""
        else:
            raise ValueError(f"unexpected GIF block 0x{data[i]:02x} at {i}")
    return data[13:13 + table], loop, frames


def placed(block, dx, dy, table=b""):
    """An image block moved by dx, dy, carrying `table` as its own colour table if it has none."""
    x, y = struct.unpack("<HH", block[1:5])
    flags = block[9]
    if not flags & 0x80:
        if not table:
            raise SystemExit("a source frame relies on the global colour table, which the output replaces")
        flags |= 0x80 | ((len(table) // 3).bit_length() - 2)
        return block[:1] + struct.pack("<HH", x + dx, y + dy) + block[5:9] + bytes([flags]) + table + block[10:]
    return block[:1] + struct.pack("<HH", x + dx, y + dy) + block[5:]


def gce(delay, transparent=None):
    """Graphic control extension: keep the frame in place (disposal 1), optional transparent index."""
    packed = (1 << 2) | (1 if transparent is not None else 0)
    return b"\x21\xf9\x04" + bytes([packed]) + struct.pack("<H", delay) + bytes([transparent or 0]) + b"\x00"


def encode(image, x, y, mask=None):
    """Encode an RGB image as one image block at x, y with its own colour table.
    Pixels under `mask` (white) become transparent index 255."""
    counts = sorted(image.getcolors(maxcolors=1 << 24), reverse=True)
    if len(counts) <= 255 + 64:
        # Close to a real palette already: keep the 255 commonest colours exactly.
        palette = [rgb for _, rgb in counts[:255]]
        index = {rgb: i for i, rgb in enumerate(palette)}
        for _, rgb in counts[255:]:
            index[rgb] = min(range(len(palette)), key=lambda i: sum((a - b) ** 2 for a, b in zip(palette[i], rgb)))
        indexed = Image.new("P", image.size)
        indexed.putdata([index[rgb] for rgb in image.get_flattened_data()])
        flat = [channel for rgb in palette for channel in rgb]
    else:
        # A cross-fade mixes two frames into thousands of colours: build a fresh 255-colour palette.
        indexed = image.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        flat = indexed.getpalette()[:765]
    if mask is not None:
        indexed.paste(TRANSPARENT, mask=mask)
    indexed.putpalette(flat + [0] * (768 - len(flat)))
    encoded = io.BytesIO()
    indexed.save(encoded, "GIF", optimize=False, interlace=False)
    table, _, frames = read_gif(encoded.getvalue())
    return placed(frames[0][1], x, y, table)


source_bytes = open(SOURCE, "rb").read()
source_table, loop, frames = read_gif(source_bytes)
with Image.open(SOURCE) as source:
    w, h = source.size
    pictures = [frame.convert("RGB") for frame in ImageSequence.Iterator(source)]
    delays = [frame.info.get("duration", 120) for frame in ImageSequence.Iterator(source)]
if any(struct.unpack("<HH", block[1:5]) != (0, 0) for _, block in frames):
    raise SystemExit("expected every source frame at 0 0")
if any(g and (g[3] >> 2) & 7 not in (0, 1) for g, _ in frames):
    raise SystemExit("expected every source frame to keep the previous one (disposal 0 or 1)")

pad_x = (WIDTH - w) // 2
size = (WIDTH, h + PAD_Y * 2)
left, top = pad_x, PAD_Y


def mat():
    canvas = Image.new("RGB", size, MAT)
    draw = ImageDraw.Draw(canvas)
    # Outer hairline, then a fainter inner one hugging the picture.
    draw.rectangle([left - 7, top - 7, left + w + 6, top + h + 6], outline=GOLD_DIM)
    draw.rectangle([left - 3, top - 3, left + w + 2, top + h + 2], outline=GOLD)
    # Small diamonds pinned on each corner of the outer line.
    for cx, cy in [(left - 7, top - 7), (left + w + 6, top - 7), (left - 7, top + h + 6), (left + w + 6, top + h + 6)]:
        draw.polygon([(cx, cy - 4), (cx + 4, cy), (cx, cy + 4), (cx - 4, cy)], fill=GOLD)
    # A diamond at the middle of the top and bottom edges.
    for cy in (top - 7, top + h + 6):
        cx = WIDTH // 2
        draw.polygon([(cx, cy - 3), (cx + 3, cy), (cx, cy + 3), (cx - 3, cy)], fill=GOLD)
    return canvas


corners = Image.new("L", size, 255)
ImageDraw.Draw(corners).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], RADIUS, fill=0)

first = mat()
first.paste(pictures[0], (left, top))
centis = [round(d / 10) for d in delays]

out = bytearray(b"GIF89a")
out += struct.pack("<HHBBB", size[0], size[1], 0x70, 0, 0)  # no global table: every frame carries its own
out += loop
out += gce(centis[0], TRANSPARENT) + encode(first, 0, 0, corners)
last = len(frames) - FADE
for i in range(1, last):
    # The source's own control block: these frames are partial updates with a transparent index.
    out += (frames[i][0] or gce(centis[i])) + placed(frames[i][1], left, top, source_table)
shown = pictures[last - 1]
for step, i in enumerate(range(last, len(frames)), 1):
    blended = Image.blend(pictures[i], pictures[0], step / (FADE + 1))
    # Only the pixels that visibly change are drawn; the rest stay transparent over the previous frame.
    same = ImageChops.difference(blended, shown).convert("L").point(lambda d: 255 if d < STILL else 0)
    delta = blended.copy()
    delta.paste(blended.getpixel((0, 0)), mask=same)
    out += gce(centis[i], TRANSPARENT) + encode(delta, left, top, same)
    shown = Image.composite(shown, blended, same)
out += b"\x3b"
open(OUTPUT, "wb").write(out)
print(f"{OUTPUT}: {len(frames)} frames, {size[0]}x{size[1]}, {len(out) / 1024:.0f} KB")
