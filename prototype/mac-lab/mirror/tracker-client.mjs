export function loadTracker() {
  const worker = new Worker(new URL('./pose-worker.js', import.meta.url));
  let closed = false, rejectReady, pending = null;
  const ready = new Promise((resolve, reject) => {
    rejectReady = reject;
    worker.onmessage = ({ data }) => {
      if (data.type === 'ready') { clearTimeout(timeout); resolve(client); }
      if (data.type === 'result' && pending) {
        clearTimeout(pending.timer); pending.resolve(data.points); pending = null;
      }
      if (data.type === 'error') fail(new Error(data.message));
    };
    worker.onerror = () => fail(new Error('자세 인식 파일을 읽지 못했어요. 최신 폴더 전체로 다시 실행해 주세요.'));
  });
  const timeout = setTimeout(() => fail(new Error('자세 인식 준비 시간이 초과됐어요. 다시 시도해 주세요.')), 45000);
  function close() {
    if (closed) return;
    closed = true; clearTimeout(timeout); worker.terminate();
    const error = new DOMException('추적 종료', 'AbortError');
    rejectReady(error);
    if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; }
  }
  function fail(error) {
    rejectReady(error);
    if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; }
    close();
  }
  const client = {
    close,
    detect(bitmap, timestamp) {
      if (closed || pending) { bitmap.close(); return Promise.reject(new Error('추적을 다시 켜 주세요.')); }
      return new Promise((resolve, reject) => {
        pending = { resolve, reject, timer: setTimeout(() => fail(new Error('카메라 처리가 멈췄어요. 다시 켜 주세요.')), 10000) };
        try { worker.postMessage({ type: 'frame', bitmap, timestamp }, [bitmap]); }
        catch (error) { bitmap.close(); fail(error); }
      });
    },
  };
  worker.postMessage({ type: 'init' });
  return { ready, cancel: close };
}
