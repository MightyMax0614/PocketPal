import { MotionEngine, demoPose, clamp } from './motion-engine.mjs';
import { CameraSession } from './camera-session.mjs';
import { loadTracker } from './tracker-client.mjs';

const $ = s => document.querySelector(s);
const video = $('#video'), stage = $('#stage'), sprite = $('#sprite');
const canvas = $('#overlay'), ctx = canvas.getContext('2d');
const engine = new MotionEngine();
const records = [...window.POCKETPAL_ORIGINALS.filter(r => r.animated),
  ...window.POCKETPAL_CATALOG.filter(r => ['pink-man', 'ninja-frog'].includes(r.id))];
let record, clip, demo = null, sourceState = null, pendingTracker = null;
let lastVideoTime = -1, lastInference = 0, lastDemo = 0, lastAction = '', lastSpokenAt = -5000;
let interactionUntil = 0, interaction = 'idle', pointerUntil = 0, pointerX = 0;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
const words = { one: '한 손 들기 → 인사 반응', both: '두 손 들기 → 폴짝 반응',
  move: '좌우 움직임 따라가기', tilt: '기울기 따라가기', idle: '편안히 쉬는 중',
  lost: '자세를 기다리는 중', talk: '이야기에 반응하는 중', pet: '쓰다듬어 줘서 좋아' };

function say(text) { $('#speech').textContent = text; }
function setClip(name) {
  const found = record.clips.find(c => c.name.toLowerCase() === name) || record.clips[0];
  if (clip === found) return;
  clip = found;
  const [x, y, right, bottom] = clip.box;
  const w = right - x, h = bottom - y;
  const scale = Math.max(1, Math.floor(Math.min((stage.clientWidth - 125) / w, 190 / h)));
  stage.style.setProperty('--range', Math.max(0, (stage.clientWidth - w * scale) / 2 - 15) + 'px');
  sprite.style.width = w + 'px'; sprite.style.height = h + 'px';
  sprite.style.backgroundImage = `url("${clip.data}")`;
  sprite.style.backgroundSize = `${clip.imageW || clip.w * clip.n}px ${clip.imageH || clip.h}px`;
  for (const [k,v] of Object.entries({scale, frames:clip.n, duration:clip.n / (clip.fps || 20) + 's',
    'start-x':-x+'px', 'start-y':-y+'px', 'end-x':(-clip.w * clip.n - x)+'px'})) sprite.style.setProperty('--'+k,v);
  sprite.style.animation = 'none'; void sprite.offsetWidth;
  sprite.style.animation = clip.n === 1 ? 'none' : '';
  sprite.dataset.clip = clip.name;
}
function selectFriend() {
  record = records.find(r => r.id === $('#friend').value) || records[0]; clip = null;
  setClip('idle'); say(`${record.ko}, 준비됐어! 같이 움직여 볼까?`);
}
for (const r of records) { const o = document.createElement('option'); o.value=r.id; o.textContent=r.ko; $('#friend').append(o); }
$('#friend').value = 'D1'; $('#friend').addEventListener('change',selectFriend); selectFriend();
new ResizeObserver(() => { const name=clip?.name.toLowerCase(); clip=null; setClip(name); }).observe(stage);

function clearPose() {
  engine.reset(); sourceState=null; lastAction='';
  ctx.clearRect(0,0,canvas.width,canvas.height);
  stage.style.setProperty('--x',0); stage.style.setProperty('--tilt','0deg');
}
function endDemo() {
  demo=null; lastDemo=0; clearPose(); $('#endDemo').hidden=true;
  document.querySelectorAll('[data-demo]').forEach(b=>b.setAttribute('aria-pressed','false'));
}
function reflectCamera(state, error) {
  const active=state==='running';
  $('#cameraView').classList.toggle('live',active);
  $('#placeholder').hidden=active;
  $('#cameraBadge').classList.toggle('live',active);
  $('#cameraBadge').textContent={off:'꺼짐',loading:'준비 중',permission:'권한 확인 중',running:'사용 중',error:'연결 안 됨'}[state];
  $('#start').disabled=['loading','permission','running'].includes(state);
  $('#stop').disabled=['off','error'].includes(state);
  $('#facing').disabled=!['off','error'].includes(state);
  let message={off:'직접 켰을 때만 카메라를 사용해요.',loading:'이 기기에서 자세 인식을 준비하고 있어요. 잠시 기다려 주세요.',
    permission:'브라우저에서 카메라 사용을 허용해 주세요. 취소하려면 끄기를 누르세요.',running:'얼굴·어깨·손이 보이게 앉고 손을 들어 보세요. 다른 탭으로 이동하면 카메라가 꺼져요.'}[state];
  if (error) message={NotAllowedError:'카메라 권한이 꺼져 있어요. 주소창의 카메라 권한을 허용한 뒤 다시 켜 주세요.',
    NotFoundError:'사용할 카메라를 찾지 못했어요. 카메라 없이 시연해 볼 수 있어요.',
    NotReadableError:'카메라를 열지 못했어요. 다른 앱에서 사용 중인지 확인해 주세요.'}[error.name] || error.message;
  $('#cameraStatus').textContent=message;
  $('#source').textContent=active?'실제 카메라':'카메라 꺼짐';
  if (!active) { clearPose(); lastVideoTime=-1; lastInference=0; }
}
const session=new CameraSession({video,loadTracker,
  openCamera:constraints=>navigator.mediaDevices.getUserMedia(constraints),
  canRun:()=>!document.hidden,onState:reflectCamera});
$('#start').addEventListener('click',()=>{
  endDemo(); interactionUntil=0; pointerUntil=0;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.createImageBitmap) {
    reflectCamera('error',new Error('Start_PocketPal.command로 실행한 localhost 화면에서 최신 Chrome으로 열어 주세요.')); return;
  }
  session.start($('#facing').value);
});
$('#stop').addEventListener('click',()=>{endDemo();session.stop();say('잠깐 쉬자. 카메라는 껐어.');});
$('#mirror').addEventListener('change',()=>{clearPose();$('#cameraView').classList.toggle('mirrored',$('#mirror').checked);});
$('#cameraView').classList.toggle('mirrored',true);
$('#facing').addEventListener('change',()=>{$('#mirror').checked=$('#facing').value==='user';$('#mirror').dispatchEvent(new Event('change'));});
$('#lines').addEventListener('change',()=>{if (!$('#lines').checked) ctx.clearRect(0,0,canvas.width,canvas.height);});

function drawPose(points, aspect=4/3) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!$('#lines').checked) return;
  const width=Math.min(canvas.width,canvas.height*aspect),height=width/aspect;
  const ox=(canvas.width-width)/2,oy=(canvas.height-height)/2;
  const good=p=>p && (p.visibility??0)>.55 && (p.presence??1)>.55;
  const xy=p=>[ox+($('#mirror').checked?1-p.x:p.x)*width,oy+p.y*height];
  ctx.strokeStyle='#87cf8a';ctx.lineWidth=4;ctx.fillStyle='#fff9b5';
  for(const [a,b] of [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[7,8]]) {
    if(!good(points[a])||!good(points[b]))continue;
    ctx.beginPath();ctx.moveTo(...xy(points[a]));ctx.lineTo(...xy(points[b]));ctx.stroke();
  }
  for(const i of [0,7,8,11,12,13,14,15,16,23,24]) if(good(points[i])) {
    ctx.beginPath();ctx.arc(...xy(points[i]),5,0,Math.PI*2);ctx.fill();
  }
}
function processPose(points,now,aspect=4/3) {
  sourceState=engine.update(points,now,{mirror:$('#mirror').checked,aspect});
  drawPose(points,aspect);
  const a=sourceState.action;
  if(a!==lastAction && now-lastSpokenAt>2200 && now>interactionUntil) {
    const text={one:'손 들었네! 안녕, 안녕!',both:'두 손 번쩍! 나도 폴짝!',move:'이쪽으로, 저쪽으로. 같이 가자!',
      tilt:'이렇게 갸우뚱?',lost:'얼굴과 어깨가 보이면 다시 해 보자.'}[a];
    if(text){say(demo?'시연 중 · '+text:text);lastSpokenAt=now;}
  }
  lastAction=a;
}
document.querySelectorAll('[data-demo]').forEach(button=>button.addEventListener('click',()=>{
  endDemo();session.stop();demo=button.dataset.demo;interactionUntil=0;pointerUntil=0;
  $('#placeholder').hidden=true;$('#cameraBadge').textContent='시연';$('#source').textContent='시연 · 카메라 꺼짐';
  $('#cameraStatus').textContent='가상 자세로 반응을 보여 주고 있어요. 실제 카메라는 사용하지 않아요.';
  button.setAttribute('aria-pressed','true');$('#endDemo').hidden=false;say('시연 중 · '+button.textContent+'!');
}));
$('#endDemo').addEventListener('click',()=>{endDemo();reflectCamera('off');say('같이 해 보려면 카메라를 켜 줘.');});
function interact(action,text,duration=1800){interaction=action;interactionUntil=performance.now()+duration;say(text);}
stage.addEventListener('pointermove',event=>{
  if(session.state==='running'||demo||paused)return;
  const r=stage.getBoundingClientRect();pointerX=clamp((event.clientX-r.left)/r.width*2-1,-.8,.8);pointerUntil=performance.now()+1300;
});
stage.addEventListener('pointerleave',()=>{pointerUntil=0;});
stage.addEventListener('click',()=>interact('pet','쓰담쓰담, 기분 좋아!'));
stage.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();interact('pet','쓰담쓰담, 기분 좋아!');}});
$('#message').addEventListener('input',()=>{
  if($('#message').value.trim())interact('talk','이야기를 적고 있구나. 기다릴게!',1400);
});
$('#messageForm').addEventListener('submit',event=>{
  event.preventDefault();const value=$('#message').value.trim();if(!value)return;
  const response=/안녕|반가/.test(value)?'안녕! 오늘도 같이 놀자.':/잘\s*자|졸려/.test(value)?'잠깐 쉬어 가도 좋아.':/고마|좋아/.test(value)?'함께해서 즐거워!':'이야기를 들려줘서 고마워. 같이 움직여 볼까?';
  interact('talk',response,2500);$('#message').value='';
});
function syncPause(){document.body.classList.toggle('paused',paused);document.body.classList.toggle('motion-opt-in',!paused);
  $('#pause').textContent=paused?'캐릭터 움직임 시작하기':'캐릭터 움직임 멈추기';$('#pause').setAttribute('aria-pressed',String(paused));}
$('#pause').addEventListener('click',()=>{paused=!paused;syncPause();});syncPause();
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{paused=e.matches;syncPause();});

async function capture(tracker,ticket,now) {
  pendingTracker=tracker;
  try {
    const bitmap=await createImageBitmap(video);
    if(ticket!==session.epoch || document.hidden){bitmap.close();return;}
    const points=await tracker.detect(bitmap,now);
    if(ticket===session.epoch && session.state==='running') processPose(points,performance.now(),video.videoWidth/video.videoHeight);
  } catch(error) {
    if(ticket===session.epoch && error.name!=='AbortError'){session.stop();reflectCamera('error',error);}
  } finally { if(pendingTracker===tracker)pendingTracker=null; }
}
function tick(now) {
  if(!document.hidden){
    if(demo && now-lastDemo>66){lastDemo=now;processPose(demoPose(demo,now),now);}
    if(session.state==='running' && pendingTracker!==session.tracker && video.readyState>=2
      && video.currentTime!==lastVideoTime && now-lastInference>=80){
      lastVideoTime=video.currentTime;lastInference=now;capture(session.tracker,session.epoch,now);
    }
    const acting=now<interactionUntil?interaction:sourceState?.action||'idle';
    const x=sourceState?.x ?? (now<pointerUntil?pointerX:0);
    const tilt=sourceState?.tilt ?? (acting==='pet'?Math.sin(now/130)*5:0);
    const lift=acting==='both'?-16*Math.abs(Math.sin(now/170)):acting==='one'?-5*Math.abs(Math.sin(now/180)):0;
    stage.style.setProperty('--x',x);stage.style.setProperty('--tilt',tilt+'deg');stage.style.setProperty('--lift',paused?'0px':lift+'px');
    $('#action').textContent=words[acting];$('#emote').textContent={one:'♪',both:'✦',pet:'♥',talk:'♪'}[acting]||'';
    setClip(acting==='move'?(record.animated?'walk':'run'):acting==='talk'?'talk':'idle');
  }
  requestAnimationFrame(tick);
}
function cleanup(){endDemo();session.stop();interactionUntil=0;pointerUntil=0;}
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('hidden-tab',document.hidden);if(document.hidden)cleanup();});
window.addEventListener('pagehide',cleanup);
requestAnimationFrame(tick);
