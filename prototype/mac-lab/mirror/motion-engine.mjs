// Camera-independent interpretation of MediaPipe's normalized landmarks.
// Only the current pose is retained; there is no identity or emotion inference.
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const visible = p => p && Number.isFinite(p.x) && Number.isFinite(p.y)
  && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1
  && (p.visibility ?? 0) >= .55 && (p.presence ?? 1) >= .55;

export function readPose(points, { mirror = true, aspect = 4 / 3 } = {}) {
  if (!Array.isArray(points) || !visible(points[11]) || !visible(points[12])) return null;
  const left = points[11], right = points[12];
  const span = Math.hypot((left.x - right.x) * aspect, left.y - right.y);
  if (span < .07) return null;
  const raised = (wrist, shoulder) => visible(wrist) && wrist.y < shoulder.y - span * .18;
  const leftUp = raised(points[15], left), rightUp = raised(points[16], right);
  let a = points[7], b = points[8];
  if (!visible(a) || !visible(b)) { a = points[2]; b = points[5]; }
  let tilt = 0;
  if (visible(a) && visible(b) && Math.abs(a.x - b.x) > .025) {
    const dx = a.x - b.x;
    tilt = Math.atan2((a.y - b.y) * Math.sign(dx), Math.abs(dx) * aspect) * 180 / Math.PI;
    tilt = clamp(tilt * (mirror ? -1 : 1), -18, 18);
  }
  return {
    x: clamp(((left.x + right.x) / 2 - .5) * 2 * (mirror ? -1 : 1), -.8, .8),
    tilt, hands: leftUp && rightUp ? 'both' : leftUp || rightUp ? 'one' : 'down',
  };
}

export class MotionEngine {
  constructor() { this.reset(); }
  reset() { this.pose = null; this.last = null; this.candidate = 'idle'; this.since = 0; this.action = 'idle'; }
  update(points, now, options) {
    const next = readPose(points, options);
    if (!next) {
      this.reset();
      return { tracking: false, x: 0, tilt: 0, hands: 'down', action: 'lost' };
    }
    const dt = this.last === null ? 80 : clamp(now - this.last, 1, 200);
    const alpha = 1 - Math.exp(-dt / 100);
    const previous = this.pose;
    const x = previous ? previous.x + (next.x - previous.x) * alpha : next.x;
    const tilt = previous ? previous.tilt + (next.tilt - previous.tilt) * alpha : next.tilt;
    const speed = previous ? Math.abs(x - previous.x) / dt * 1000 : 0;
    const candidate = next.hands === 'both' ? 'both' : next.hands === 'one' ? 'one'
      : speed > .12 ? 'move' : Math.abs(tilt) > 9 ? 'tilt' : 'idle';
    if (candidate !== this.candidate) { this.candidate = candidate; this.since = now; }
    // A brief confidence flicker must not trigger a new character reaction.
    if (now - this.since >= 160) this.action = candidate;
    this.pose = { x, tilt }; this.last = now;
    return { tracking: true, x, tilt, hands: next.hands, action: this.action };
  }
}

// Explicitly simulated poses for the no-camera demo and deterministic tests.
export function demoPose(kind, time = 0) {
  const p = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 0, presence: 0 }));
  const set = (i, x, y) => { p[i] = { x, y, visibility: 1, presence: 1 }; };
  set(0, .5, .24); set(7, .57, .25); set(8, .43, .25);
  set(11, .62, .42); set(12, .38, .42);
  set(13, .67, .56); set(14, .33, .56);
  set(15, .69, .7); set(16, .31, .7);
  set(23, .57, .75); set(24, .43, .75);
  if (kind === 'one' || kind === 'both') { set(13, .72, .31); set(15, .72, .15); }
  if (kind === 'both') { set(14, .28, .31); set(16, .28, .15); }
  if (kind === 'tilt') { set(7, .57, .21); set(8, .43, .29); }
  if (kind === 'move') for (const point of p) point.x += Math.sin(time / 650) * .16;
  return p;
}
