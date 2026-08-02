"use strict";
(() => {
  const V="2.38.5";
  const R=[
    `https://unpkg.com/@rive-app/canvas-single@${V}/rive.js`,
    `https://cdn.jsdelivr.net/npm/@rive-app/canvas-single@${V}/rive.js`
  ];
  const A={
    github:{label:"공식 GitHub rewards.riv",url:"https://raw.githubusercontent.com/rive-app/rive-flutter/master/example/assets/rewards.riv",machine:""},
    vehicles:{label:"공식 Rive CDN vehicles.riv",url:"https://cdn.rive.app/animations/vehicles.riv",machine:"bumpy"}
  };
  const $=s=>document.querySelector(s), canvas=$("#riveCanvas"), stage=$("#stageMessage"), health=$("#healthText"), dot=$("#healthDot"), fps=$("#fpsValue"), summary=$("#diagnosticSummary"), inspector=$("#inputInspector"), badge=$("#bindingBadge"), logList=$("#eventLog"), pause=$("#pauseButton"), soul=$("#soulMessage"), fileInput=$("#localRiveFile"), build=$("#deviceBuild");
  const steps={runtime:$("#stepRuntime"),asset:$("#stepAsset"),parse:$("#stepParse"),render:$("#stepRender"),machine:$("#stepMachine")};
  let rive=null,machine="",runtimeSrc="",assetName="",assetBytes=0,paused=false,token=0,renderOK=false,observer=null;

  function time(){return new Date().toLocaleTimeString("ko-KR",{hour12:false});}
  function log(t){const li=document.createElement("li"),tm=document.createElement("time");tm.textContent=time();li.append(tm,document.createTextNode(t));logList.prepend(li);while(logList.children.length>40)logList.lastElementChild.remove();}
  function step(k,state,text){const el=steps[k];if(!el)return;el.dataset.state=state;el.querySelector(".diagnostic-icon").textContent=state==="ok"?"✓":state==="error"?"!":"…";el.querySelector("span").textContent=text;}
  function reset(){step("runtime","pending","런타임 스크립트를 확인합니다.");step("asset","pending",".riv 파일을 내려받습니다.");step("parse","pending","파일 구조를 해석합니다.");step("render","pending","첫 화면 표시를 확인합니다.");step("machine","pending","상태 머신을 확인합니다.");}
  function status(state,text){dot.className=`health-dot ${state}`;health.textContent=text;}
  function show(title,text,visible=true){stage.querySelector("strong").textContent=title;stage.querySelector("span").textContent=text;stage.classList.toggle("hidden",!visible);}
  function err(e){return e?.name==="AbortError"?"시간 초과":String(e?.message||e||"알 수 없는 오류");}
  function size(n){return n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`;}
  function clean(){try{rive?.disableFPSCounter?.();rive?.cleanup();}catch(e){console.warn(e);}rive=null;machine="";renderOK=false;fps.textContent="--";pause.disabled=true;pause.textContent="일시정지";paused=false;document.querySelectorAll("[data-soul]").forEach(b=>b.disabled=true);}

  function loadScript(url,ms=18000){return new Promise((ok,no)=>{const s=document.createElement("script"),t=setTimeout(()=>{s.remove();no(new Error(`런타임 시간 초과: ${url}`));},ms);s.src=url;s.async=true;s.onload=()=>{clearTimeout(t);ok();};s.onerror=()=>{clearTimeout(t);s.remove();no(new Error(`런타임 다운로드 실패: ${url}`));};document.head.append(s);});}
  async function runtime(run){if(window.rive?.Rive){runtimeSrc="이미 로드됨";step("runtime","ok",`준비 완료 · canvas-single ${V}`);return;}for(const u of R){if(run!==token)throw new Error("검사가 교체됨");step("runtime","pending",`시도 중: ${u}`);try{await loadScript(u);if(!window.rive?.Rive)throw new Error("Rive API 없음");runtimeSrc=u;step("runtime","ok",`준비 완료 · canvas-single ${V}`);log(`런타임 성공: ${u}`);return;}catch(e){log(`런타임 실패: ${err(e)}`);}}throw new Error("Rive 런타임을 받지 못했습니다.");}
  async function bytes(url,run,ms=15000){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms),start=performance.now();try{const r=await fetch(url,{mode:"cors",cache:"no-store",signal:c.signal});if(run!==token)throw new Error("검사가 교체됨");if(!r.ok)throw new Error(`HTTP ${r.status}`);const b=await r.arrayBuffer();if(b.byteLength<32)throw new Error("파일이 너무 작습니다.");return{buffer:b,elapsed:Math.round(performance.now()-start),type:r.headers.get("content-type")||"알 수 없음"};}finally{clearTimeout(t);}}

  function renderSuccess(asset,why){if(renderOK)return;renderOK=true;step("render","ok",why);status("ready","실행 성공");show(asset.label,"Rive가 아이폰 Safari에서 정상 표시되고 있습니다.",false);summary.textContent="Rive 런타임, 파일 해석, 캔버스 표시가 모두 성공했습니다.";pause.disabled=false;log(`렌더 성공: ${why}`);}
  function afterLoad(asset,run){requestAnimationFrame(()=>requestAnimationFrame(()=>{if(run===token&&rive)renderSuccess(asset,"onLoad 후 첫 화면 표시 확인");}));}

  function inspect(name){inspector.innerHTML="";if(!name||!rive?.stateMachineInputs){inspector.innerHTML='<p class="empty-state">기본 Artboard 또는 선형 애니메이션으로 실행 중입니다.</p>';return 0;}let inputs=[];try{inputs=rive.stateMachineInputs(name)||[];}catch(e){log(`입력 조회 실패: ${err(e)}`);}if(!inputs.length){inspector.innerHTML='<p class="empty-state">상태 머신은 실행됐지만 외부 Input은 없습니다.</p>';return 0;}for(const input of inputs){const row=document.createElement("div");row.className="input-row";const meta=document.createElement("div");meta.className="input-meta";const strong=document.createElement("strong");strong.textContent=input.name;const small=document.createElement("span");const T=window.rive.StateMachineInputType;const type=input.type===T?.Number?"Number":input.type===T?.Boolean?"Boolean":input.type===T?.Trigger?"Trigger":`Type ${input.type}`;small.textContent=type;meta.append(strong,small);const b=document.createElement("button");b.type="button";if(type==="Trigger"){b.textContent="FIRE";b.onclick=()=>input.fire();}else if(type==="Boolean"){const draw=()=>b.textContent=input.value?"TRUE":"FALSE";draw();b.onclick=()=>{input.value=!input.value;draw();};}else{b.textContent=String(Number(input.value)||0);b.onclick=()=>{input.value=(Number(input.value)||0)+1;b.textContent=String(input.value);};}row.append(meta,b);inspector.append(row);}return inputs.length;}

  function instantiate(buffer,asset,run){return new Promise((ok,no)=>{let done=false;const t=setTimeout(()=>{if(!done){done=true;no(new Error("Rive onLoad 시간 초과"));}},15000);const fail=e=>{if(done)return;done=true;clearTimeout(t);no(new Error(err(e)));};try{rive=new window.rive.Rive({buffer,canvas,autoplay:true,autoBind:true,stateMachines:asset.machine||undefined,layout:new window.rive.Layout({fit:window.rive.Fit.Contain,alignment:window.rive.Alignment.Center}),onLoad:()=>{if(run!==token)return;try{rive.resizeDrawingSurfaceToCanvas();}catch(e){log(`리사이즈 경고: ${err(e)}`);}step("parse","ok","Rive 파일 해석 완료 · onLoad 수신");step("render","pending","첫 화면 표시를 확인하는 중");log("Rive onLoad 수신");afterLoad(asset,run);if(!done){done=true;clearTimeout(t);ok();}},onLoadError:e=>fail(`Rive onLoadError: ${err(e)}`),onPlay:()=>{log("Rive 재생 시작");setTimeout(()=>{if(run===token)renderSuccess(asset,"재생 시작 이벤트와 캔버스 표시 확인");},80);},onStateChange:e=>log(`State: ${Array.isArray(e?.data)?e.data.join(", "):String(e?.data||"변경")}`)});}catch(e){fail(e);}});}

  async function runAsset(key){const run=++token,asset=A[key];clean();reset();assetName=asset.label;assetBytes=0;status("loading","진단 중");show("Rive 런타임 확인","엔진과 파일을 분리해서 검사합니다.");summary.textContent=`${asset.label} 검사를 시작합니다.`;try{await runtime(run);step("asset","pending",`${asset.url} 다운로드 중`);const f=await bytes(asset.url,run);assetBytes=f.buffer.byteLength;step("asset","ok",`${size(assetBytes)} · ${f.elapsed}ms · ${f.type}`);step("parse","pending","ArrayBuffer를 Rive 엔진에 전달했습니다.");show("Rive 파일 해석","Artboard를 읽고 있어요.");await instantiate(f.buffer,asset,run);if(run!==token)return;if(asset.machine){machine=asset.machine;const n=inspect(machine);step("machine","ok",`${machine} 실행 · Input ${n}개`);badge.textContent=`${machine} · ${n} inputs`;badge.classList.add("bound");document.querySelectorAll("[data-soul]").forEach(b=>b.disabled=false);}else{machine="";inspect("");step("machine","ok","기본 Artboard/선형 애니메이션으로 실행");badge.textContent="기본 재생";badge.classList.remove("bound");}try{rive.enableFPSCounter?.(n=>fps.textContent=Number.isFinite(n)?String(Math.round(n)):"--");}catch(e){log(`FPS 미지원: ${err(e)}`);}}catch(e){if(run!==token)return;const m=err(e);status("error","실패 지점 표시됨");summary.textContent=m;show("Rive 실행 실패",m);if(!window.rive?.Rive)step("runtime","error",m);else if(steps.asset.dataset.state!=="ok")step("asset","error",m);else if(steps.parse.dataset.state!=="ok")step("parse","error",m);else step("render","error",m);log(`검사 실패: ${m}`);}}

  async function runLocal(file){const run=++token;clean();reset();assetName=file.name;status("loading","로컬 파일 검사");show("아이폰 파일 읽기",file.name);try{await runtime(run);const start=performance.now(),buffer=await file.arrayBuffer();assetBytes=buffer.byteLength;step("asset","ok",`아이폰 로컬 파일 · ${size(assetBytes)} · ${Math.round(performance.now()-start)}ms`);step("parse","pending","로컬 ArrayBuffer를 전달했습니다.");const asset={label:file.name,machine:""};await instantiate(buffer,asset,run);step("machine","ok","기본 Artboard/애니메이션으로 실행");inspect("");}catch(e){const m=err(e);status("error","로컬 파일 실패");show("로컬 .riv 실행 실패",m);summary.textContent=m;if(!window.rive?.Rive)step("runtime","error",m);else if(steps.parse.dataset.state!=="ok")step("parse","error",m);else step("render","error",m);log(`로컬 파일 실패: ${m}`);}}

  function inputs(){try{return rive&&machine?rive.stateMachineInputs(machine)||[]:[];}catch(e){return[];}}
  function soulPreset(p){const all=inputs();if(!all.length){soul.textContent="현재 샘플에 조작 가능한 Input이 없습니다.";return;}const words=p==="pet"?["pet","tap","press","wave"]:p==="happy"?["happy","jump","celebrate"]:p==="talking"?["talk","speak"]:p==="sleepy"?["sleep","yawn"]:p==="curious"?["look","curious","notice"]:["idle","calm"];let matched=false;for(const i of all){if(!words.some(w=>i.name.toLowerCase().includes(w)))continue;const T=window.rive.StateMachineInputType;if(i.type===T?.Trigger)i.fire();else if(i.type===T?.Boolean)i.value=true;else i.value=(Number(i.value)||0)+1;matched=true;}soul.textContent=matched?`‘${p}’ 명령을 전달했습니다.`:"이 샘플에는 같은 이름의 Input이 없습니다.";}
  function diagnostic(){const a=["PocketPal Rive P1.5.2",`시간: ${new Date().toISOString()}`,`페이지: ${location.href}`,`온라인: ${navigator.onLine}`,`브라우저: ${navigator.userAgent}`,`런타임: ${runtimeSrc||"없음"}`,`애셋: ${assetName||"없음"}`,`크기: ${assetBytes}`];document.querySelectorAll(".diagnostic-item").forEach(i=>a.push(`${i.querySelector("strong")?.textContent}: ${i.dataset.state} / ${i.querySelector("span")?.textContent}`));[...logList.children].reverse().forEach(i=>a.push(i.textContent.trim()));return a.join("\n");}

  $("#retryAll").onclick=()=>runAsset("github");
  $("#testGithubAsset").onclick=()=>runAsset("github");
  $("#testRiveCdn").onclick=()=>runAsset("vehicles");
  $("#clearLog").onclick=()=>logList.innerHTML="";
  $("#copyDiagnostics").onclick=async()=>{try{await navigator.clipboard.writeText(diagnostic());summary.textContent="진단 내용을 복사했습니다.";}catch(e){summary.textContent="복사 권한이 없어 화면을 캡처해 주세요.";}};
  fileInput.onchange=()=>{const f=fileInput.files?.[0];if(f)runLocal(f);};
  pause.onclick=()=>{if(!rive)return;paused=!paused;paused?rive.pause():rive.play();pause.textContent=paused?"계속 재생":"일시정지";};
  document.querySelectorAll("[data-soul]").forEach(b=>b.onclick=()=>soulPreset(b.dataset.soul));
  if("ResizeObserver"in window){observer=new ResizeObserver(()=>{try{rive?.resizeDrawingSurfaceToCanvas();}catch(e){}});observer.observe(canvas);}else window.onresize=()=>rive?.resizeDrawingSurfaceToCanvas?.();
  build.textContent=`${navigator.platform||"device"} · online ${navigator.onLine?"yes":"no"}`;
  window.addEventListener("unhandledrejection",e=>log(`Unhandled: ${err(e.reason)}`));
  window.addEventListener("error",e=>log(`Window error: ${e.message}`));
  window.addEventListener("beforeunload",()=>{observer?.disconnect();clean();});
  reset();runAsset("github");
})();
