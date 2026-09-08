"use strict";
(() => {
  const base = window.POCKETPAL_ASSET_BASE || new URL("assets/pixel-adventure/", document.currentScript.src).href;
  const CLIPS = {idle:11, run:12, jump:1, fall:1, "double-jump":6};
  // Measured original sprite bounding boxes; offsets follow the authored bobbing.
  const TOP = {pink:{idle:[7,7,7,6,6,5,5,5,5,6,6],run:[4,3,3,5,7,7,4,3,3,5,7,7],jump:[3],fall:[5]},
    frog:{idle:[8,8,8,7,7,6,6,6,6,7,7],run:[5,4,4,6,8,8,5,4,4,6,8,8],jump:[4],fall:[6]}};
  class PixelPal {
    constructor(element, options={}) {
      this.el=element;
      this.sprite=element.querySelector(".pixel-sprite");
      this.facing=element.querySelector(".pixel-facing");
      this.lift=element.querySelector(".pixel-lift");
      this.emote=element.querySelector(".pixel-emote");
      this.gift=element.querySelector(".pixel-gift");
      this.onState=options.onState || (()=>{});
      this.skin="pink";this.clip="idle";this.action="idle";
      this.elapsed=0;this.last=0;this.x=0;this.startX=0;this.direction=1;
      this.autoplay=options.autoplay!==false;this.manualPause=false;
      this.reduced=matchMedia("(prefers-reduced-motion: reduce)");
      this.loaded=new Set();this.disposed=false;this.ready=false;
      this.visibility=()=>{this.last=0;this.updatePause();};
      document.addEventListener("visibilitychange",this.visibility);
      this.reduced.addEventListener?.("change",this.visibility);
      this.setSkin(options.skin || "pink");
      this.raf=requestAnimationFrame(t=>this.tick(t));
    }
    asset(skin,clip){const path=skin+"/"+clip+".png";return window.POCKETPAL_ASSETS?.[path] || base+path;}
    setSkin(skin){
      if(!["pink","frog"].includes(skin))skin="pink";
      const changed=this.skin!==skin || !this.ready;
      this.skin=skin;this.el.dataset.skin=skin;
      this.el.closest(".pixel-room")?.setAttribute("data-skin",skin);
      if(changed){
        this.ready=false;this.el.dataset.failed="false";
        const token=skin;
        Promise.all(Object.keys(CLIPS).map(clip=>new Promise((resolve,reject)=>{
          const im=new Image();im.onload=()=>resolve();im.onerror=reject;im.src=this.asset(skin,clip);
        }))).then(()=>{
          if(this.skin!==token || this.disposed)return;
          this.ready=true;this.play("idle");
        }).catch(()=>{
          if(this.skin!==token)return;
          this.el.dataset.failed="true";this.emote.textContent="이미지 불러오기 실패";
          this.onState("캐릭터 파일을 확인해 주세요");
        });
        this.x=0;this.direction=1;this.setClip("idle",true);this.play("idle");
      }
    }
    setClip(clip,force=false){
      if(this.clip===clip && !force)return;
      this.clip=clip;
      const frames=CLIPS[clip];
      this.sprite.style.backgroundImage='url("'+this.asset(this.skin,clip)+'")';
      this.sprite.style.setProperty("--frames",frames);
      this.sprite.style.setProperty("--sheet-end",(-32*frames)+"px");
      this.sprite.style.setProperty("--cycle",(frames*50)+"ms");
      this.sprite.style.animation="none";void this.sprite.offsetWidth;this.sprite.style.animation="";
      this.updatePause();
    }
    play(action){
      if(!["idle","pet","wave","run","jump","sleepy","happy","curious","proactive","talk"].includes(action))action="idle";
      this.action=action;this.el.dataset.action=action;this.elapsed=0;this.startX=this.x;
      this.runTarget=this.x>0?-9:9;
      this.autoAt=5500+Math.random()*7000;
      this.emote.textContent={pet:"♥",happy:"♥",wave:"♪",curious:"?",proactive:"?",sleepy:"···",talk:"♪"}[action]||"";
      this.setClip(action==="run"?"run":action==="jump"?"jump":"idle",true);
      if(action==="sleepy")this.sprite.style.setProperty("--cycle","2200ms");
      this.onState({idle:"나랑 같이 놀자",pet:"쓰담쓰담, 기분 좋아",wave:"만나서 반가워!",run:"작은 발로 타다닥",jump:"하나, 둘, 폴짝!",sleepy:"여기서 잠깐 쉬자",happy:"내 선물, 정말 좋아",curious:"궁금한 게 있어",proactive:"이야기 하나 들려줄래?",talk:"네 이야기를 듣고 있어"}[action]);
    }
    setGift(gift){
      if(!this.gift)return;
      this.gift.hidden=!gift;
      if(gift){this.gift.src=gift.image;this.gift.alt=gift.name;this.gift.dataset.slot=gift.slot;}
      else this.gift.removeAttribute("src");
      this.positionGift();
    }
    positionGift(){
      if(!this.gift || this.gift.hidden)return;
      const anim=this.sprite.getAnimations?.()[0];
      const cycle=this.action==="sleepy"?2200:CLIPS[this.clip]*50;
      const frame=Math.floor((Number(anim?.currentTime||0)%cycle)/cycle*CLIPS[this.clip]);
      const top=(TOP[this.skin][this.clip]||[6])[frame]||6;
      const y=top-6;
      const p={head:[16,5+y,17,12],face:[16,14+y,14,8],body:[16,25+y,16,12],badge:[21,24+y,7,7],hand:[27,25+y,11,13]}[this.gift.dataset.slot] || [16,5+y,17,12];
      ["left","top","width","height"].forEach((name,i)=>this.gift.style[name]=p[i]+"px");
    }
    setAutoplay(value){this.autoplay=!!value;this.elapsed=0;this.autoAt=6000;}
    setPaused(value){this.manualPause=!!value;this.updatePause();}
    updatePause(){
      this.paused=this.manualPause || this.reduced.matches || document.hidden;
      this.el.dataset.paused=String(this.paused);
      this.sprite.style.animationPlayState=this.paused?"paused":"running";
    }
    tick(t){
      if(this.disposed)return;
      const dt=this.last?Math.min(t-this.last,70):0;this.last=t;
      if(!this.paused && this.ready){
        this.elapsed+=dt;
        const e=this.elapsed,a=this.action;
        let lift=0,tilt=0;
        if(a==="run"){
          this.direction=Math.sign(this.runTarget-this.startX)||1;
          this.x=this.startX+(this.runTarget-this.startX)*Math.min(e/1500,1);
          if(e>1500)this.play("idle");
        }else if(a==="jump" || a==="happy"){
          const jumpAt=a==="happy"?e%760:e;
          if(jumpAt<600){lift=-10*Math.sin(Math.PI*jumpAt/600);this.setClip(jumpAt<300?"jump":"fall");}
          else this.setClip("idle");
          if(e>(a==="happy"?1650:900))this.play("idle");
        }else if(a==="pet"){
          tilt=Math.sin(e/200)*3;
          if(e>1900)this.play("idle");
        }else if(a==="wave"){
          lift=-2.5*Math.abs(Math.sin(Math.PI*Math.min(e,1200)/400));
          if(e>1500)this.play("idle");
        }else if(["curious","proactive","talk"].includes(a)){
          tilt=Math.sin(e/450)*2;
          if(e>2600)this.play("idle");
        }else if(a==="idle" && this.autoplay && e>this.autoAt){
          this.play(Math.random()<.65?"run":"jump");
        }
        this.facing.style.transform="translateX("+this.x.toFixed(2)+"px) scaleX("+this.direction+")";
        this.lift.style.transform="translateY("+lift.toFixed(2)+"px) rotate("+tilt.toFixed(2)+"deg)";
        this.emote.style.transform="translateX(calc(-50% + "+(this.x*Number(getComputedStyle(this.el).getPropertyValue("--pixel-scale"))).toFixed(1)+"px))";
        this.positionGift();
      }
      this.raf=requestAnimationFrame(t=>this.tick(t));
    }
    destroy(){this.disposed=true;cancelAnimationFrame(this.raf);document.removeEventListener("visibilitychange",this.visibility);this.reduced.removeEventListener?.("change",this.visibility);}
  }
  window.PixelPal=PixelPal;
})();
