// Explicit ownership of async camera/model resources. A late permission result
// is stopped even after cancel, navigation, or another start.
export class CameraSession {
  constructor({ openCamera, loadTracker, video, onState, canRun = () => true }) {
    Object.assign(this, { openCamera, loadTracker, video, onState, canRun });
    this.epoch = 0; this.stream = null; this.tracker = null; this.state = 'off';
  }
  setState(state, error = null) { this.state = state; this.onState(state, error); }
  stop() {
    this.epoch++;
    this.cancelLoad?.(); this.cancelLoad = null;
    this.tracker?.close(); this.tracker = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    this.video.pause(); this.video.srcObject = null;
    this.setState('off');
  }
  async start(facingMode = 'user') {
    this.stop();
    const ticket = this.epoch;
    const current = () => ticket === this.epoch && this.canRun();
    try {
      this.setState('loading');
      const loading = this.loadTracker();
      this.cancelLoad = loading.cancel;
      const tracker = await loading.ready;
      if (!current()) { tracker.close(); return; }
      this.cancelLoad = null; this.tracker = tracker;
      this.setState('permission');
      const stream = await this.openCamera({ audio: false, video: {
        facingMode: { ideal: facingMode }, width: { ideal: 640 }, height: { ideal: 480 },
        frameRate: { ideal: 15, max: 20 },
      } });
      if (!current()) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream; this.video.srcObject = stream;
      for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => {
        if (current()) this.stop();
      }, { once: true });
      await this.video.play();
      if (!current()) return;
      this.setState('running');
    } catch (error) {
      if (ticket !== this.epoch) return;
      this.stop(); this.setState('error', error);
    }
  }
}
