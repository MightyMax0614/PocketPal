#!/usr/bin/env python3
"""Package the same character renderer and unchanged sprites for offline file:// use."""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "prototype/mac-lab"


def build():
    html = (WEB / "character-preview.html").read_text()
    css = (WEB / "pixel-character.css").read_text()
    assets = {}
    for path in sorted((WEB / "assets/pixel-adventure").rglob("*.png")):
        key = path.relative_to(WEB / "assets/pixel-adventure").as_posix()
        assets[key] = "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()
        css = css.replace("assets/pixel-adventure/" + key, assets[key])
    renderer = (WEB / "pixel-character.js").read_text()
    # The standalone document uses the same renderer with embedded asset lookups.
    renderer = renderer.replace('new URL("assets/pixel-adventure/", document.currentScript.src).href', '""')
    html = html.replace('<link rel="stylesheet" href="pixel-character.css">', "<style>" + css + "</style>")
    html = html.replace('<script src="pixel-character.js"></script>',
        "<script>window.POCKETPAL_ASSETS=" + json.dumps(assets) + ";\n" + renderer + "</script>")
    html = html.replace('<script src="character-preview.js"></script>',
        "<script>" + (WEB / "character-preview.js").read_text() + "</script>")
    assert not re.search(r'<(?:script|link)[^>]*(?:src|href)="(?!data:)', html)
    output = ROOT / "Character_Preview.html"
    output.write_text(html)
    return output


if __name__ == "__main__":
    print(build())
