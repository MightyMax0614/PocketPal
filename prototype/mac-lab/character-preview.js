"use strict";
(() => {
 const root=document.querySelector('#previewPal');
 const pal=new PixelPal(root,{onState:t=>document.querySelector('#previewMood').textContent=t});
 let auto=true,paused=false;
 document.querySelectorAll('[data-skin-choice]').forEach(b=>b.addEventListener('click',()=>{
  pal.setSkin(b.dataset.skinChoice);
  document.querySelectorAll('[data-skin-choice]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 }));
 document.querySelectorAll('[data-motion]').forEach(b=>b.addEventListener('click',()=>pal.play(b.dataset.motion)));
 root.addEventListener('click',()=>pal.play('pet'));
 root.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pal.play('pet');}});
 document.querySelector('#previewAuto').addEventListener('click',e=>{auto=!auto;pal.setAutoplay(auto);e.currentTarget.setAttribute('aria-pressed',String(auto));e.currentTarget.textContent='자유롭게 움직이기 '+(auto?'켜짐':'꺼짐');if(!auto)pal.play('idle');});
 document.querySelector('#previewPause').addEventListener('click',e=>{paused=!paused;pal.setPaused(paused);e.currentTarget.setAttribute('aria-pressed',String(paused));e.currentTarget.textContent=paused?'움직임 다시 시작':'움직임 멈추기';});
 const file=document.querySelector('#previewGift'),note=document.querySelector('#giftNote');
 document.querySelector('.gift-button').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click();}});
 file.addEventListener('change',()=>{
  const f=file.files[0];if(!f)return;
  if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>10*1024*1024){note.textContent='10MB 이하 PNG·JPG·WebP 그림을 골라 주세요.';return;}
  const reader=new FileReader();reader.onload=()=>{
   const im=new Image();im.onload=()=>{pal.setGift({image:reader.result,name:f.name,slot:'head'});pal.play('happy');document.querySelector('#previewRemove').hidden=false;note.textContent='네가 그린 모자, 고마워!';};im.onerror=()=>note.textContent='그림 파일을 읽지 못했어요.';im.src=reader.result;
  };reader.onerror=()=>note.textContent='그림 파일을 읽지 못했어요.';reader.readAsDataURL(f);
 });
 document.querySelector('#previewRemove').addEventListener('click',e=>{pal.setGift(null);e.currentTarget.hidden=true;file.value='';note.textContent='';});
})();
