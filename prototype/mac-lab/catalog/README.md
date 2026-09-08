# PocketPal 34-character comparison · 0.4

The collection now contains all **10 PocketPal originals + 24 Pixel Frog
characters** in one offline-capable appearance and animation viewer.

- H1, D1, A3, A4: four animation drafts each (idle/blink, walk, talk, sleep).
- H2, H3, D2, D3, A1, A2: existing static pixel concept portraits, clearly labelled.
- Pixel Frog: the same 66 unchanged non-combat animation strips and poses.

The four original animation atlases use 96×96 cells, six columns and four rows,
on a **white matte**, not a transparent background. They are early generated
animation drafts; walking cycles and pose consistency still need refinement.
Their sources, exact prompts, crop coordinates and metadata are in
`characters/originals/animations/` at the repository root.

This comparison surface does not change character selection in the Mac Lab
companion, which still supports Pink Man and Ninja Frog. Mouth animation here
is a visual preview, not audio-driven lip sync or an AI conversation.

## Run and rebuild

- Download `Character_Catalog.html` from the repository root, then open it in
  Safari or Chrome. It contains every image, style and script and requires no
  server, Python, Node or internet connection.
- With the existing Mac Lab server, visit `/catalog/index.html`.
- Click any character to enlarge it and choose a motion. Pause and horizontal
  mirror controls are provided; mirroring is not a newly authored opposite view.
- `python3 tools/build_character_catalog.py` rebuilds `originals-data.js` from
  `characters/catalog.json` plus saved assets, then creates the standalone HTML.

`data.js` and `manifest.json` remain the original Pixel Frog data. The new
`originals-data.js` contains separate original-character data and shared image
bytes. Each clip provides explicit full-image dimensions, crop offsets, frame
count and playback speed, including row offsets for 2D atlases. Concept images
use a fractional display fit; playback sprites prefer integer scaling.

Reduced motion starts animation paused. Explicit play buttons opt in. Cards
pause while the detail dialog is open; hidden tabs pause all clips. Narrow
screen resizing recalculates the detail fit.

## Attribution and provenance

**Pixel Adventure artwork and original animation by Pixel Frog.**

- https://opengameart.org/users/pixel-frog
- https://opengameart.org/content/pixel-adventure-1
- https://opengameart.org/content/pixel-adventure-2
- Original author-uploaded archive: https://opengameart.org/sites/default/files/Pixel%20Adventure%202.zip
- The OpenGameArt releases used here are licensed **CC BY 4.0**:
  https://creativecommons.org/licenses/by/4.0/

Provenance was recorded in the preceding 2026-09-08 collection task. No assets
were re-downloaded or purchased in this continuation. Pixel Frog PNG bytes,
source attribution and existing action names are preserved. No sleeping,
speaking or clothing-swap action absent from the author's assets is implied.
A single-frame Jump or Fall remains explicitly labelled as a pose.

See `docs/CHARACTER_ANIMATION_0.4.md` for the checks run for this revision.
