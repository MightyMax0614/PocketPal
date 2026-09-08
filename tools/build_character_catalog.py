#!/usr/bin/env python3
"""Embed the authored catalog and original sprite data into a single offline file."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "prototype/mac-lab/catalog"

def build():
    html = (SOURCE / "index.html").read_text()
    html = html.replace('<link rel="stylesheet" href="style.css">', '<style>'+(SOURCE/'style.css').read_text()+'</style>')
    # Inline data/scripts must run after the body has been parsed.
    html = html.replace('<script defer src="data.js"></script><script defer src="app.js"></script>', '')
    scripts = '<script>'+(SOURCE/'data.js').read_text()+'</script><script>'+(SOURCE/'app.js').read_text()+'</script>'
    html = html.replace('</body>',scripts+'</body>')
    output=ROOT/'Character_Catalog.html'
    output.write_text(html)
    return output

if __name__=='__main__':
    print(build())
