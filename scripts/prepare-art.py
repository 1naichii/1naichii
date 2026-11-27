"""Turn official artwork into the small WebP files in assets/art that build.mjs embeds.

Everything comes from the official anime site, frieren-anime.jp,
© 山田鐘人・アベツカサ／小学館／「葬送のフリーレン」製作委員会 (©K.Y.T.A/S/FP).
Download the originals yourself into one folder, named as below. Gallery and art-board
files are at https://frieren-anime.jp/wp-content/uploads/<path>; the pages that list them
are /special/gallery/, /special/map/, /special/magic/ and /story/.

  church.jpg             art board #02c286, 回想 / 廃教会 / 花畑 (Episode 2 flashback: ruined church,
                         flower field), スタジオワイエス (Studio Wyeth), gallery "美術ボード"
                         2023/10/FRN_02_286_回想_廃教会-花畑_昼_晴れ.jpg
  harbor.jpg             art board bo006_04, グランツ海峡 / 村 / 波止場 (Granz Strait village harbour,
                         winter sunrise), Studio Wyeth, 2023/10/bo006_04_グランツ海峡_村_波止場_冬_日の出.jpg
  map.jpg                journey map, /special/map/, wp-content/themes/frieren_2023/assets/img/special/map/map.jpg
  blue-moon-weed.jpg     gallery character visual フリーレン・ヒンメル 蒼月草 (Frieren and Himmel,
                         blue moon weed), 2023/09/g.jpg
  mimic-visual.jpg       gallery character visual フリーレン・ミミック 暗いよー怖いよー, 2023/10/g.jpeg
  chibi.jpg              gallery 公式デフォルメキャラ (official chibi characters), 2023/10/dchara.jpg
  sleeping.jpg           gallery character visual フリーレン寝姿 (Frieren asleep), 2025/10/g3.jpg
  ep02-statue.jpg        Episode 2 still, Himmel's statue, /story/1st/ep02/, 2023/09/02_06-1.jpg
  ep10-mana.jpg          Episode 10 still, Frieren letting her concealed mana show, /story/1st/ep10/,
                         2023/11/01_05-1.jpg
  ep23-mimic.jpg         Episode 23 still, Fern pulling Frieren out of a mimic, /story/1st/ep23/,
                         2024/02/01_01-3.jpg
  spell-zoltraak.jpg     /special/magic/ stills: 一般攻撃魔法 (ゾルトラーク), 2026/02/m1.jpg
  spell-flowers.jpg      花畑を出す魔法 (spell to produce a field of flowers), 2023/10/05.jpg
  spell-accessories.jpg  失くした装飾品を探す魔法 (finding lost accessories), 2023/12/FRN_still_ep014_maho_02.jpg
  spell-silver.jpg       銀鉱石を探す魔法 (finding silver ore), 2026/02/m3-1.jpg
  spell-oil.jpg          しつこい油汚れを取る魔法 (removing stubborn oil stains), 2024/01/1.jpg
  spell-eggshell.jpg     卵を割った時に殻が入らなくなる魔法 (no eggshell in a cracked egg), 2026/03/m1.jpg

Every image is cut to the area it is shown at and saved at twice its display size.

Usage: python scripts/prepare-art.py <folder with the files>   (needs Pillow)
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SOURCE = Path(sys.argv[1])
OUT = Path(__file__).resolve().parent.parent / "assets" / "art"


def save(image, name, quality, lossless=False):
    path = OUT / name
    image.save(path, "WEBP", quality=quality, method=6, lossless=lossless)
    print(f"{path.name}: {image.width}x{image.height}, {path.stat().st_size / 1024:.1f} KB")


def load(name):
    return Image.open(SOURCE / name).convert("RGB")


def fit(image, box, size):
    """Crop `box` (fractions of the image: left, top, right, bottom), then cover `size`
    without stretching: whatever does not fit the aspect ratio is trimmed evenly."""
    w, h = image.size
    crop = image.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))
    return cover(crop, size)


def cover(image, size, focus=(0.5, 0.5)):
    """Crop to the aspect ratio of `size` around `focus`, then resize."""
    w, h = image.size
    ratio = size[0] / size[1]
    cw, ch = (w, round(w / ratio)) if w / h < ratio else (round(h * ratio), h)
    left = min(max(0, round(focus[0] * w - cw / 2)), w - cw)
    top = min(max(0, round(focus[1] * h - ch / 2)), h - ch)
    return image.crop((left, top, left + cw, top + ch)).resize(size, Image.LANCZOS)


def painted_area(image, dark=40):
    """An art board's painted rectangle, inside its black frame and caption strip."""
    grey = image.convert("L")
    px = grey.load()
    w, h = grey.size
    row = lambda y: sum(px[x, y] < dark for x in range(w // 4, 3 * w // 4)) / (w / 2)
    col = lambda x: sum(px[x, y] < dark for y in range(h // 4, 3 * h // 4)) / (h / 2)
    top = next(y for y in range(h) if row(y) < 0.5)
    bottom = next(y for y in range(h // 2, h) if row(y) > 0.5)
    left = next(x for x in range(w) if col(x) < 0.5)
    right = next(x for x in range(w - 1, 0, -1) if col(x) < 0.5)
    # A few pixels in, clear of the frame's soft edge.
    return image.crop((left + 6, top + 6, right - 5, bottom - 6))


def largest_parts(mask, keep=0.04):
    """Drop specks: keep the connected parts of a 0/255 mask that are at least `keep` of the largest."""
    w, h = mask.size
    px = mask.load()
    label = [[0] * w for _ in range(h)]
    sizes = [0]
    for sy in range(h):
        for sx in range(w):
            if px[sx, sy] and not label[sy][sx]:
                sizes.append(0)
                n = len(sizes) - 1
                stack = [(sx, sy)]
                label[sy][sx] = n
                while stack:
                    x, y = stack.pop()
                    sizes[n] += 1
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not label[ny][nx]:
                            label[ny][nx] = n
                            stack.append((nx, ny))
    big = max(sizes)
    out = Image.new("L", (w, h), 0)
    po = out.load()
    for y in range(h):
        for x in range(w):
            if sizes[label[y][x]] >= keep * big and label[y][x]:
                po[x, y] = 255
    return out


def cutout(image, box, height, close=2):
    """Lift a character off the pale studio background. The line art is closed up first
    (its sketchy strokes leave gaps), the background is flooded in from the edges, and
    whatever it cannot reach is the character, pale hair and white cloaks included."""
    part = image.crop(box)
    w, h = part.size
    ink = Image.new("L", (w, h), 0)
    src, dst = part.load(), ink.load()
    for y in range(h):
        for x in range(w):
            r, g, b = src[x, y]
            if min(r, g, b) < 190 or max(r, g, b) - min(r, g, b) > 42:
                dst[x, y] = 255
    barrier = ink.filter(ImageFilter.MaxFilter(2 * close + 1))
    for x, y in [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]:
        if barrier.getpixel((x, y)) == 0:
            ImageDraw.floodfill(barrier, (x, y), 128)
    body = barrier.point(lambda v: 0 if v == 128 else 255)
    # Back from the closed-up outline to the drawn one, then lose the specks.
    body = largest_parts(body.filter(ImageFilter.MinFilter(2 * close + 1)))
    alpha = body.filter(ImageFilter.GaussianBlur(0.6))
    part.putalpha(alpha)
    part = part.crop(body.getbbox())
    return part.resize((round(part.width * height / part.height), height), Image.LANCZOS)


# Banner: the flower-field board at 2:1, twice the 680x340 banner.
board = painted_area(load("church.jpg"))
height = round(board.width / 2)
top = round(board.height * 0.026)
save(board.crop((0, top, board.width, top + height)).resize((1360, 680), Image.LANCZOS), "banner-flower-field.webp", 85)

# Footer: the harbour at sunrise, twice the 680x280 footer, with sky above the sun for the closing line.
save(cover(painted_area(load("harbor.jpg")), (1360, 560), (0.5, 0.45)), "footer-harbor.webp", 82)

# Map: border trimmed and toned almost to sepia, so its coloured route markers stay in the background.
journey = load("map.jpg")
journey = journey.crop((120, 110, journey.width - 110, journey.height - 98))
journey = ImageEnhance.Color(journey).enhance(0.15)
save(journey.resize((790, round(790 * journey.height / journey.width)), Image.LANCZOS), "journey-map.webp", 42)

# Chapter 1: Himmel and Frieren with blue moon weed, as a 124x128 photo (logo and credit line cropped out).
save(fit(load("blue-moon-weed.jpg"), (0.105, 0.0, 0.745, 0.96), (248, 256)), "blue-moon-weed.webp", 82)

# Chapter 3: the mimic, 216x180 (logo and credit line cropped out), and Exhibit A, 108x80.
save(fit(load("mimic-visual.jpg"), (0.02, 0.17, 0.98, 0.97), (432, 360)), "mimic.webp", 80)
save(fit(load("ep23-mimic.jpg"), (0.31, 0.25, 0.76, 0.84), (216, 160)), "exhibit-a.webp", 82)

# Chapter 4: one still per spell, 168x94.5.
spells = {
    "zoltraak": (0.0, 0.0, 1.0, 1.0),
    "flowers": (0.0, 0.0, 1.0, 1.0),
    "accessories": (0.3, 0.22, 0.86, 0.85),
    "silver": (0.1, 0.05, 0.9, 0.95),
    "oil": (0.0, 0.0, 1.0, 1.0),
    "eggshell": (0.15, 0.1, 0.85, 0.89),
}
for name, box in spells.items():
    save(fit(load(f"spell-{name}.jpg"), box, (336, 189)), f"spell-{name}.webp", 74)

# Chapter 5: the mana reveal, 172x97.
save(fit(load("ep10-mana.jpg"), (0.0, 0.0, 1.0, 1.0), (344, 194)), "mana.webp", 80)

# Epilogue: Himmel's statue, 176x198.
save(fit(load("ep02-statue.jpg"), (0.245, 0.0, 0.755, 1.0), (352, 396)), "himmel-statue.webp", 80)

# Interludes: official chibi characters, 52px tall, and Frieren asleep, 50px tall.
chibi = load("chibi.jpg")
for name, box in {
    "frieren": (395, 415, 605, 672),
    "stark": (588, 365, 828, 672),
    "fern": (172, 415, 348, 672),
    "himmel": (502, 42, 658, 342),
}.items():
    save(cutout(chibi, box, 104), f"chibi-{name}.webp", 82)
sleeping = load("sleeping.jpg")
save(cutout(sleeping, (300, 450, 1860, 1215), 100), "chibi-asleep.webp", 82)
