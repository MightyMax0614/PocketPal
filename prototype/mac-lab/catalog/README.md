# PocketPal character comparison — 24 characters

This is an appearance and original-animation comparison surface. It does not
change the selected character in the Mac Lab's two-character companion renderer.

The collection includes 20 character types from **Pixel Adventure 2**, plus the
four main characters from **Pixel Adventure 1**, with 66 non-combat animation
strips/poses. The Rocks type has three sizes inside its detail view; those are
variants of one of the author's 20 character types.

## Attribution and provenance

**Pixel Adventure artwork and original animation by Pixel Frog.**

- https://opengameart.org/users/pixel-frog
- https://opengameart.org/content/pixel-adventure-1
- https://opengameart.org/content/pixel-adventure-2
- Original author-uploaded archive: https://opengameart.org/sites/default/files/Pixel%20Adventure%202.zip
- The OpenGameArt releases used here are licensed **CC BY 4.0**:
  https://creativecommons.org/licenses/by/4.0/
- The current itch.io page also declares CC0, but currently charges $5 for its
  download: https://pixelfrog-assets.itch.io/pixel-adventure-2
- Source and pricing checked 2026-09-08. No purchase was made; the publicly
  downloadable, author-uploaded OpenGameArt release was used.

The PNG bytes are embedded unchanged in `data.js`. `manifest.json` records
original filenames, dimensions, frame counts, alpha bounds, and SHA-256 values.
Rendering crops only unused transparent margins, enlarges at integer scale, and
plays the original frames at 20 FPS. Flipping is a display operation. No
replacement artwork was drawn or AI-generated.

## Run

- `python3 tools/build_character_catalog.py` at the repository root creates
  `Character_Catalog.html`, including every image, style, and script for offline use.
- Open that HTML file in Safari or Chrome.
- For the Mac Lab local server, open `/catalog/index.html`.
- Click a character to enlarge it and switch among its available original poses.

This task checked 24 gallery controls in Chrome and tested Bunny's enlarged
view, original 12-frame run clip, and pause control. All 66 embedded PNG byte
hashes, frame crop bounds, and generated JavaScript syntax were checked.
The HTML uses native dialog support and has not been tested on the user's Mac.

No original sleeping, speaking, or clothing-swap animation is implied. A
single-frame Jump or Fall entry is a pose, explicitly labelled as such in the UI.
