# 나 따라 해 봐 · 0.5

Run the existing Mac server and open `/mirror/index.html`. This is a local
companion motion experiment; it does not replace the conversation/memory screen.
Direct `file://` opening is not supported for the modules, worker and model.

The six selectable companions reuse unchanged animation bytes from the catalog:
H1, D1, A3, A4, Pink Man and Ninja Frog. All 34 characters remain in the catalog.
The first four remain animation drafts with white backgrounds, not finished rigs.

## Current mapping

| Input | Response |
| --- | --- |
| One wrist held above shoulder | Greeting text / note / small bob |
| Both wrists held above shoulders | Cheer text / star / hop |
| Shoulder midpoint moving horizontally | Smoothed horizontal translation and authored walk/run |
| Ear or eye line tilting | Clamped rotation of the whole sprite |
| Pointer movement | Horizontal attention while camera/demo is off |
| Text input / submit | Listening text / authored talk clip where available |

No individual arm/leg retargeting, facial-expression inference, eye gaze, identity,
emotion or activity understanding is performed. Text replies here are canned,
not AI responses. Pose observations are not sent to the Ollama conversation.

## Lifecycle / privacy

- Camera starts only from its button; no microphone requested.
- A classic worker dynamically imports local MediaPipe 0.10.32 and processes
  one ImageBitmap at a time with Pose Landmarker Lite float16 version 1.
- Inference is throttled to at most 12.5 Hz. This is a scheduling cap, not a
  measured device performance claim. GPU is not required; CPU delegate is used.
- No frame, pose, typed text, name, or identity is uploaded or persisted here.
- Runtime/model are vendored, with hashes and sources. No CDN or API key.
- Stop, page hide, hidden tab, camera-track ending, inference timeout and errors
  release the camera and terminate the worker. Late camera permission results
  are discarded and their tracks stopped.
- Front/back is an ideal constraint: a Mac with one camera may use that same
  camera. Two-camera phone operation requires an HTTPS origin and physical test.
- Mirror switch changes both video presentation and pose mapping.
- Simulation is explicit and never labeled actual recognition.
- Reduced-motion defaults to paused character animation; an explicit play button
  opts in. Pausing the character does not silently imply the camera is off.

## Source files

- `motion-engine.mjs`: confidence gates, mirror coordinates, smoothing and dwell.
- `camera-session.mjs`: asynchronous camera/model ownership.
- `tracker-client.mjs`, `pose-worker.js`: worker and frame transfer lifecycle.
- `app.mjs`, `index.html`, `style.css`: visible interactions and simulation.
- `vendor/manifest.json`: exact dependency bytes, SHA-256 and source URLs.

Sources: [MediaPipe Web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js),
[model overview](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker).
See `docs/CAMERA_MIRROR_0.5.md` for verification and remaining physical tests.
