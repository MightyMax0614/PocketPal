#!/usr/bin/env python3
"""Build the 34-character collection, including its offline HTML distribution.

Concept boards and animation atlases are embedded once; existing Pixel Frog
sprite bytes and data.js remain unchanged. No network requests are required.
"""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "prototype/mac-lab/catalog"


def original_data():
    catalog = json.loads((ROOT / "characters/catalog.json").read_text())
    boards = {board["path"]: board for board in catalog["pixel_concept_boards"]}
    assets = {}
    records = []

    def embed(path):
        if path not in assets:
            assets[path] = "data:image/png;base64," + base64.b64encode((ROOT / path).read_bytes()).decode()
        return path

    for original in catalog["originals"]:
        animation = original.get("animation_preview")
        record = {
            "id": original["id"], "ko": original["name_ko"],
            "name": original["id"], "source": "pocketpal-original",
            "animated": bool(animation), "background": "#ffffff" if animation else "#fcf8ed",
            "note": original["personality"], "clips": [],
        }
        if animation:
            meta = json.loads((ROOT / animation["manifest"]).read_text())
            for clip in meta["clips"]:
                record["clips"].append({
                    "name": clip["name"], "label": clip["label"],
                    "w": meta["frame_width"], "h": meta["frame_height"],
                    "n": clip["frames"], "fps": clip["fps"],
                    "box": [0, clip["row"] * meta["frame_height"], meta["frame_width"], (clip["row"] + 1) * meta["frame_height"]],
                    "imageW": meta["atlas_width"], "imageH": meta["atlas_height"],
                    "asset": embed(meta["atlas"]),
                })
            record["note"] += "。 대기·걷기·대화·수면을 차례로 볼 수 있어요.".replace("。", ".")
        else:
            pixel = original["pixel_design"]
            board = boards[pixel["board"]]
            width = board["width"] // board["columns"]
            height = board["height"] // board["rows"]
            x, y = pixel["column"] * width, pixel["row"] * height
            # Leave the printed concept ID below the portrait out of the viewing crop.
            height_visible = round(height * 0.92)
            record["clips"].append({
                "name": "concept", "label": "정지 도트 시안", "concept": True,
                "w": width, "h": height, "n": 1,
                "box": [x, y, x + width, y + height_visible],
                "imageW": board["width"], "imageH": board["height"],
                "asset": embed(pixel["board"]),
            })
        records.append(record)
    # Show the four animated prototypes first; do not rename or double-count IDs.
    records.sort(key=lambda record: (not record["animated"], next(i for i, c in enumerate(catalog["originals"]) if c["id"] == record["id"])))
    js = '"use strict";\n(() => {\nconst assets=' + json.dumps(assets, separators=(",", ":")) + ";\n"
    js += "window.POCKETPAL_ORIGINALS=" + json.dumps(records, ensure_ascii=False, separators=(",", ":")) + ";\n"
    js += "for(const record of window.POCKETPAL_ORIGINALS) for(const clip of record.clips) clip.data=assets[clip.asset];\n})();\n"
    (SOURCE / "originals-data.js").write_text(js)
    return js


def build():
    originals = original_data()
    html = (SOURCE / "index.html").read_text()
    html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + (SOURCE / 'style.css').read_text() + '</style>')
    for filename in ("data.js", "originals-data.js", "app.js"):
        html = html.replace(f'<script defer src="{filename}"></script>', '')
    scripts = '<script>' + (SOURCE / 'data.js').read_text() + '</script>'
    scripts += '<script>' + originals + '</script><script>' + (SOURCE / 'app.js').read_text() + '</script>'
    html = html.replace('</body>', scripts + '</body>')
    assert not re.search(r'<(?:script|link)[^>]*(?:src|href)="(?!data:)', html)
    output = ROOT / 'Character_Catalog.html'
    output.write_text(html)
    return output


if __name__ == '__main__':
    print(build())
