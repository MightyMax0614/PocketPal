import test from 'node:test';
import assert from 'node:assert/strict';
import { readPose, MotionEngine, demoPose } from '../prototype/mac-lab/mirror/motion-engine.mjs';
import { CameraSession } from '../prototype/mac-lab/mirror/camera-session.mjs';

test('a confident raised hand is recognized; missing/occluded wrists are not',()=>{
  const p=demoPose('both'); assert.equal(readPose(p).hands,'both');
  p[15].visibility=.2; assert.equal(readPose(p).hands,'one');
  p[16].presence=.1; assert.equal(readPose(p).hands,'down');
  p[11].visibility=.1; assert.equal(readPose(p),null);
  assert.equal(readPose([]),null);
});
test('mirror mode consistently reverses horizontal position and tilt',()=>{
  const p=demoPose('tilt'); for(const point of p)point.x+=.1;
  const normal=readPose(p,{mirror:false}),mirror=readPose(p,{mirror:true});
  assert.ok(normal.x>0);assert.equal(mirror.x,-normal.x);
  assert.equal(mirror.tilt,-normal.tilt);assert.ok(Math.abs(mirror.tilt)<=18);
});
test('one flickering frame does not trigger; sustained pose does; lost pose clears',()=>{
  const e=new MotionEngine();e.update(demoPose('idle'),0);
  assert.equal(e.update(demoPose('both'),80).action,'idle');
  assert.equal(e.update(demoPose('idle'),160).action,'idle');
  e.update(demoPose('both'),240);e.update(demoPose('both'),320);
  assert.equal(e.update(demoPose('both'),400).action,'both');
  assert.deepEqual(e.update([],480),{tracking:false,x:0,tilt:0,hands:'down',action:'lost'});
});
test('horizontal motion is smoothed and malformed points cannot propagate NaN',()=>{
  const e=new MotionEngine();e.update(demoPose('idle'),0);
  const p=demoPose('idle');for(const point of p)point.x+=.2;
  const state=e.update(p,80);assert.ok(state.x>-.4 && state.x<0);
  p[11].x=NaN;assert.equal(e.update(p,160).tracking,false);
});

const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
function fixture(){
  const calls={trackStops:0,closes:0,states:[],opens:0};
  const track={stop(){calls.trackStops++;},addEventListener(){}};
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  const tracker={close(){calls.closes++;}};
  const video={srcObject:null,pause(){},async play(){}};
  const camera=deferred();
  const session=new CameraSession({video,loadTracker:()=>({ready:Promise.resolve(tracker),cancel(){}}),
    openCamera:()=>{calls.opens++;return camera.promise;},onState:s=>calls.states.push(s)});
  return {session,calls,stream,tracker,video,camera};
}
test('permission granted after Stop closes the late camera without attaching it',async()=>{
  const f=fixture(),start=f.session.start();await Promise.resolve();
  assert.equal(f.calls.opens,1);f.session.stop();f.camera.resolve(f.stream);await start;
  assert.equal(f.calls.trackStops,1);assert.equal(f.video.srcObject,null);assert.equal(f.session.state,'off');
});
test('late model completion after Stop closes model and never asks for camera',async()=>{
  const f=fixture(),model=deferred();f.session.loadTracker=()=>({ready:model.promise,cancel(){}});
  const start=f.session.start();f.session.stop();model.resolve(f.tracker);await start;
  assert.equal(f.calls.opens,0);assert.equal(f.calls.closes,1);
});
test('successful camera session stops its tracks and tracker exactly once',async()=>{
  const f=fixture();f.camera.resolve(f.stream);await f.session.start();
  assert.equal(f.session.state,'running');assert.equal(f.video.srcObject,f.stream);
  f.session.stop();f.session.stop();assert.equal(f.calls.trackStops,1);assert.equal(f.calls.closes,1);
});
test('denied camera permission releases model and reports an actual error',async()=>{
  const f=fixture();const start=f.session.start();await Promise.resolve();
  f.camera.reject(new DOMException('denied','NotAllowedError'));await start;
  assert.equal(f.session.state,'error');assert.equal(f.calls.closes,1);assert.equal(f.video.srcObject,null);
});
test('video play failure does not leave camera capturing',async()=>{
  const f=fixture();f.video.play=async()=>{throw new Error('play failed');};
  f.camera.resolve(f.stream);await f.session.start();
  assert.equal(f.calls.trackStops,1);assert.equal(f.calls.closes,1);assert.equal(f.session.state,'error');
});
