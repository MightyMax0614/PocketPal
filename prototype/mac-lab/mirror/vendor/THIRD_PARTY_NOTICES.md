# Local pose runtime and model

The files here are included for offline operation, not downloaded at camera-on
time. These are unmodified upstream bytes; this folder contains no user images.

- MediaPipe Tasks Vision JavaScript and WebAssembly: Google / MediaPipe Authors,
  `@mediapipe/tasks-vision` **0.10.32**, npm package license **Apache-2.0**.
  Upstream license text is included as `LICENSE` (including upstream third-party
  notices). Source: https://github.com/google-ai-edge/mediapipe
- Pose Landmarker Lite model: official Google AI Edge model download,
  `pose_landmarker_lite/float16/1/pose_landmarker_lite.task`.
  The source and model documentation are recorded below; the model is kept
  separately from original PocketPal character artwork.

Package archive:
https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-0.10.32.tgz

Archive integrity supplied by npm and verified before extraction:
`sha512-3tiAZnmKloYnRXYoO3dKltTUGnqeCwzC4lV03uY0vCsE+aveJTyEVQyZHOlQGQNsjK+gRHzkf9q08C99Qm2K0Q==`

Model source:
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

Model overview and model-card links:
https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker#models

`manifest.json` records every distributed runtime/model/license file's size,
SHA-256 and source. Both SIMD and non-SIMD runtimes are included. The package's
source maps and type declarations are not needed at runtime and are omitted.
The upstream source-map comment is preserved; a developer-tool source-map lookup
may therefore return 404 without affecting application execution.
