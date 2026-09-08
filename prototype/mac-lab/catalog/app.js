"use strict";
(() => {
  const records=window.POCKETPAL_CATALOG;
  const palette=["#efdbec","#f4edc9","#e7edd8","#edece1","#e0eaf0","#efe2d7"];
  const gallery=document.querySelector("#gallery"),dialog=document.querySelector("#detail");
  const large=document.querySelector("#detailSprite"),pause=document.querySelector("#pauseDetail");
  let paused=false,detailPaused=false,flipped=false,selected=null;
  function paint(el,clip,big=false){
    const [x,y,r,b]=clip.box,w=r-x,h=b-y;
    const scale=Math.max(1,Math.floor(Math.min((big?360:116)/w,(big?238:101)/h)));
    el.style.cssText="width:"+w+"px;height:"+h+"px;--scale:"+scale+";--frames:"+clip.n+";--duration:"+(clip.n*50)+"ms;--start-x:"+(-x)+"px;--start-y:"+(-y)+"px;--end-x:"+(-clip.w*clip.n-x)+"px;--flip:"+(flipped&&big?-1:1);
    el.style.backgroundImage='url("'+clip.data+'")';
    el.style.backgroundSize=(clip.w*clip.n)+"px "+clip.h+"px";
    if(big)el.style.animationPlayState=detailPaused?"paused":"running";
  }
  function selectClip(index){
    const c=selected.clips[index];paint(large,c,true);
    document.querySelectorAll("#clips button").forEach((b,i)=>b.setAttribute("aria-pressed",String(i===index)));
    document.querySelector("#frameInfo").textContent="원본 "+c.w+"×"+c.h+"px · "+c.n+"프레임"+(c.n>1?" · 20 FPS":" · 한 장의 포즈");
  }
  function open(record,index){
    selected=record;flipped=false;detailPaused=false;
    document.querySelector("#detailTitle").textContent=record.ko;
    document.querySelector("#detailOriginal").textContent=record.name+" · Pixel Adventure "+record.pack;
    document.querySelector("#detailNote").textContent=record.note;
    document.querySelector("#detailStage").style.setProperty("--scene",palette[index%palette.length]);
    pause.textContent="이 동작 멈추기";pause.setAttribute("aria-pressed","false");
    const clips=document.querySelector("#clips");clips.replaceChildren();
    record.clips.forEach((c,i)=>{const b=document.createElement("button");b.textContent=c.label;b.addEventListener("click",()=>selectClip(i));clips.append(b);});
    selectClip(0);document.body.classList.add("dialog-open");dialog.showModal();
  }
  records.forEach((r,index)=>{
    const card=document.createElement("button");card.className="card";card.setAttribute("aria-label",r.ko+" 크게 보기");
    card.style.setProperty("--scene",palette[index%palette.length]);
    const area=document.createElement("span");area.className="art-area";
    const sprite=document.createElement("span");sprite.className="sprite";sprite.setAttribute("aria-hidden","true");paint(sprite,r.clips[0]);area.append(sprite);
    const label=document.createElement("span");label.className="card-label";
    const name=document.createElement("strong");name.textContent=r.ko;
    const original=document.createElement("small");original.textContent=r.name;label.append(name,original);
    card.append(area,label);card.addEventListener("click",()=>open(r,index));gallery.append(card);
  });
  document.querySelector("#pauseAll").addEventListener("click",e=>{paused=!paused;document.body.classList.toggle("paused",paused);e.currentTarget.setAttribute("aria-pressed",String(paused));e.currentTarget.textContent=paused?"목록 움직임 다시 시작":"목록 움직임 멈추기";});
  document.querySelector("#closeDetail").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>document.body.classList.remove("dialog-open"));
  document.querySelector("#flip").addEventListener("click",()=>{flipped=!flipped;large.style.setProperty("--flip",flipped?-1:1);});
  pause.addEventListener("click",()=>{detailPaused=!detailPaused;large.style.animationPlayState=detailPaused?"paused":"running";pause.setAttribute("aria-pressed",String(detailPaused));pause.textContent=detailPaused?"이 동작 다시 시작":"이 동작 멈추기";});
  document.addEventListener("visibilitychange",()=>document.body.classList.toggle("hidden-tab",document.hidden));
})();
