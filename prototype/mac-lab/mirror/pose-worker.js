/* Classic worker permits MediaPipe's WASM loader to use importScripts. */
let detector = null;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const { FilesetResolver, PoseLandmarker } = await import('./vendor/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks(new URL('./vendor/wasm/', self.location.href).href);
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL('./vendor/pose_landmarker_lite.task', self.location.href).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: .6, minPosePresenceConfidence: .6, minTrackingConfidence: .6,
        outputSegmentationMasks: false,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        const result = detector.detectForVideo(data.bitmap, data.timestamp);
        self.postMessage({ type: 'result', points: result.landmarks[0] || [] });
      } finally { data.bitmap.close(); }
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: '자세 인식을 실행하지 못했어요. 최신 Chrome에서 다시 켜 보세요. (' + (error.name || 'Error') + ')' });
  }
};
