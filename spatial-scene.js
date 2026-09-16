import * as THREE from '/node_modules/three/build/three.module.js';
import { artworkPosition, safeImageUrl, pillVisibility, artworkFocus, insidePreview } from '/lib/discovery/spatial-state.mjs';
import { createArtworkFrame, disposeArtworkFrame } from '/lib/discovery/artwork-frame.mjs';
import { artworkArrival } from '/lib/discovery/opening.mjs';

const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>';

export class ArtworkSpace {
  constructor({onArtwork,onChoice,onDepth}) {
    this.host=document.querySelector('#scene');
    this.artLayer=document.querySelector('#art-layer');
    this.pillLayer=document.querySelector('#pill-layer');
    this.artTip=document.createElement('div');this.artTip.className='artwork-focus-caption';this.artTip.hidden=true;document.body.append(this.artTip);
    this.onArtwork=onArtwork;this.onChoice=onChoice;this.onDepth=onDepth;
    this.scene=new THREE.Scene();
    this.scene.fog=new THREE.Fog(0xe8eae6,19,53);
    const frameLoader=new THREE.TextureLoader();
    this.frameTextures=['baroque-gold','baroque-silver','baroque-ornaments'].map(name=>{const texture=frameLoader.load(`/assets/frames/${name}.png`);texture.colorSpace=THREE.SRGBColorSpace;return texture;});
    this.scene.add(new THREE.HemisphereLight(0xfff8ea,0x637064,2));
    const frameLight=new THREE.DirectionalLight(0xfff1dc,2.4);
    frameLight.position.set(-4,7,10);this.scene.add(frameLight);
    this.camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,100);
    this.camera.position.z=10;
    this.items=[];this.pills=[];this.depth=0;this.entry=0;this.pointer={x:0,y:0};this.maxDepth=1;this.paused=false;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.still=this.reduced;
    try {
      this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
      this.renderer.setClearColor(0xe8eae6,0);
      this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.host.prepend(this.renderer.domElement);
      this.renderer.domElement.setAttribute('aria-hidden','true');
      this.renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();this.setStill(true);});
    } catch { this.still=true; }
    this.resize=()=>{
      this.w=innerWidth;this.h=innerHeight;
      this.camera.aspect=this.w/this.h;this.camera.updateProjectionMatrix();
      this.renderer?.setSize(this.w,this.h);
      document.querySelector('#scroll-track').style.height=`${this.h+this.maxDepth*100}px`;
    };
    this.move=event=>{if(event.pointerType==='mouse'){this.cursor={x:event.clientX,y:event.clientY};this.pointer.x=(event.clientX/this.w-.5)*2;this.pointer.y=(event.clientY/this.h-.5)*2;this.releasePreview?.();}};
    this.leave=()=>{this.cursor=null;clearTimeout(this.hoverTimer);this.hoverTimer=setTimeout(()=>{this.hoverArt=null;},300);};
    document.documentElement.addEventListener('pointerleave',this.leave);window.addEventListener('blur',this.leave);
    window.addEventListener('resize',this.resize);
    window.addEventListener('pointermove',this.move,{passive:true});
    this.setStill(this.still);this.resize();this.tick=this.tick.bind(this);this.raf=requestAnimationFrame(this.tick);
  }

  setStill(value) {
    this.still=value;document.body.classList.toggle('still',value);
    this.hoverArt=null;this.returningArt=null;this.releasePreview=null;this.artTip.hidden=true;
    for(const pill of this.pills){pill.visibility={};pill.node.classList.remove('pill-obscured','pill-unavailable');pill.node.inert=false;}
    if(value)this.renderer?.clear();
    for(const {button} of this.items){button.tabIndex=0;button.removeAttribute('aria-hidden');button.style.visibility='';}
    document.querySelector('#motion-toggle').textContent=value?'Use spatial view':'Use still view';
    document.querySelector('#travel-back').disabled=value;
    document.querySelector('#travel-forward').disabled=value;
  }

  clear(){
    clearTimeout(this.hoverTimer);this.hoverArt=null;this.returningArt=null;this.releasePreview=null;this.lockedPill=null;
    this.artTip.hidden=true;
    for(const item of this.items){disposeArtworkFrame(item.frame);item.mesh?.geometry.dispose();item.mesh?.material.map?.dispose();item.mesh?.material.dispose();if(item.mesh)this.scene.remove(item.mesh);item.image.onload=null;item.image.onerror=null;}
    this.items=[];this.pills=[];this.artLayer.replaceChildren();this.pillLayer.replaceChildren();
  }

  setData(data,{enter=false}={}) {
    this.openingStart=null;
    this.clear();this.entry=enter&&!this.still?3:0;
    this.maxDepth=Math.max(1,(Math.ceil(data.results.length/6)-1)*11+3);
    const loader=new THREE.TextureLoader();
    data.results.forEach((row,index)=>{
      const button=document.createElement('button');button.className='art-target';button.setAttribute('aria-label',`Look closer: ${row.title}`);
      const image=document.createElement('img');image.alt=row.title;image.decoding='async';
      const caption=document.createElement('span');caption.className='caption';
      const title=document.createElement('strong');title.textContent=row.title;
      const meta=document.createElement('span');meta.textContent=[row.artist?.replace(/^[;\s]+$/,''),row.date].filter(Boolean).join(' · ');
      caption.append(title,meta);button.append(image,caption);button.onclick=()=>this.onArtwork(row);
      const base=artworkPosition(index);
      const item={button,image,base,index,width:2.7,height:2.2,ready:false};
      const activate=(keyboard=false)=>{
        if(this.still)return;
        if(!keyboard&&this.hoverArt&&this.hoverArt!==item)return;
        clearTimeout(this.hoverTimer);this.hoverTimer=null;
        if(this.hoverArt!==item){item.focusStart=performance.now();item.origin=item.screen?{...item.screen}:null;}
        this.hoverArt=item;this.returningArt=item;this.releasePreview=release;
        item.keyboard=keyboard;
        this.artTip.replaceChildren(caption.cloneNode(true));
      };
      const release=()=>{
        if(this.hoverArt!==item)return;
        if(item.keyboard&&document.activeElement===button)return;
        if(insidePreview(this.cursor,[item.origin,item.screen])){clearTimeout(this.hoverTimer);this.hoverTimer=null;return;}
        if(this.hoverTimer)return;
        this.hoverTimer=setTimeout(()=>{this.hoverTimer=null;if(!this.lockedPill){this.hoverArt=null;this.releasePreview=null;}},300);
      };
      button.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')activate();});
      button.addEventListener('pointerleave',release);
      button.addEventListener('focus',()=>activate(true));button.addEventListener('blur',()=>{if(this.hoverArt===item){this.hoverArt=null;this.releasePreview=null;}});
      button.dataset.frame=String(index%3);
      this.items.push(item);this.artLayer.append(button);
      image.onload=()=>{
        if(!this.items.includes(item))return;
        const ratio=image.naturalWidth/image.naturalHeight;
        item.width=ratio>1?3.1:2.5*ratio;item.height=ratio>1?3.1/ratio:2.5;item.ready=true;
      };
      image.onerror=()=>{button.setAttribute('aria-label',`${row.title} — image unavailable`);image.remove();caption.style.opacity='1';};
      const src=safeImageUrl(row.thumbnailUrl);
      image.src=src;
      if(this.renderer&&src)loader.load(src,texture=>{
        if(!this.items.includes(item)){texture.dispose();return;}
        texture.colorSpace=THREE.SRGBColorSpace;
        const ratio=texture.image.width/texture.image.height;
        item.width=ratio>1?3.1:2.5*ratio;item.height=ratio>1?3.1/ratio:2.5;
        item.frame=createArtworkFrame(THREE,item.width,item.height,{variant:item.index%3,textures:this.frameTextures});this.scene.add(item.frame);
        const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:1});
        item.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
        this.scene.add(item.mesh);button.classList.add('rendered');
      },undefined,()=>{button.classList.remove('rendered');});
    });
    data.choices.forEach((choice,index)=>{
      const node=document.createElement('div');node.className='word-anchor';
      const button=document.createElement('button');button.className='word-pill';
      button.setAttribute('aria-label',`Explore ${choice.label}, ${choice.count.toLocaleString()} works`);
      const label=document.createElement('span');label.textContent=choice.label;button.append(label);button.insertAdjacentHTML('beforeend',arrow);
      const count=document.createElement('span');count.className='word-count';count.textContent=`${choice.count.toLocaleString()} works to explore`;
      button.onclick=()=>this.onChoice(choice);node.append(button,count);this.pillLayer.append(node);
      const pill={node,index};this.pills.push(pill);
      const lock=()=>{clearTimeout(this.hoverTimer);this.lockedPill=pill;};
      const unlock=()=>{this.lockedPill=null;clearTimeout(this.hoverTimer);this.hoverTimer=setTimeout(()=>{this.hoverArt=null;},300);};
      button.addEventListener('pointerenter',lock);button.addEventListener('pointerleave',unlock);
      button.addEventListener('focus',lock);button.addEventListener('blur',unlock);
    });
    this.resize();
  }

  tick(time) {
    this.raf=requestAnimationFrame(this.tick);
    if(document.hidden||this.paused)return;
    if(this.still)return;
    const dt=Math.min((time-(this.lastTime||time))/1000,.05);this.lastTime=time;
    const ease=1-Math.exp(-dt*6);
    const target=Math.min(this.maxDepth,Math.max(0,scrollY/100));
    this.depth+=(target-this.depth)*ease;
    this.entry*=Math.exp(-dt*4);
    this.camera.position.set(this.pointer.x*.15,-this.pointer.y*.1,10-this.depth+this.entry);
    this.camera.updateMatrixWorld();
    const worldHeight=2*Math.tan(THREE.MathUtils.degToRad(24))*10;
    const fitX=Math.min(1,this.camera.aspect/1.55);
    const v=new THREE.Vector3();
    this.items.forEach(item=>{
      const bob=Math.sin(time*.00028+item.index*2)*.035;
      const spread=1+Math.max(0,-item.base.z)/24;
      const arrival=this.openingStart==null?1:artworkArrival(time-this.openingStart,item.index);
      item.focus=artworkFocus(item.focus||0,this.hoverArt===item,time-(item.focusStart??time),dt);
      const baseX=item.base.x*fitX*spread,baseY=item.base.y*spread+bob-(1-arrival)*.25;
      const x=THREE.MathUtils.lerp(baseX,this.camera.position.x,item.focus);
      const y=THREE.MathUtils.lerp(baseY,this.camera.position.y+.35,item.focus);
      const z=item.base.z-(1-arrival)*5;
      const distance=this.camera.position.z-z;
      const visible=distance>2.3&&distance<60&&arrival>.001;
      const opacity=Math.min(1,Math.max(0,(distance-2.3)/2))*arrival;
      const size=this.h/(2*Math.tan(THREE.MathUtils.degToRad(24))*Math.max(distance,.1));
      if(item.mesh){item.mesh.position.set(x,y,z);item.mesh.scale.set(item.width,item.height,1);item.mesh.visible=visible;item.mesh.material.opacity=opacity;}
      if(item.frame){
        item.frame.position.set(x,y,z);item.frame.visible=visible;
        for(const part of item.frame.children)part.material.opacity=opacity*(part.userData.opacity??1);
      }
      v.set(x,y,z).project(this.camera);
      const px=(v.x+1)*this.w/2,py=(1-v.y)*this.h/2;
      const width=item.width*size,height=item.height*size;
      const onScreen=visible&&px+width/2>0&&px-width/2<this.w&&py+height/2>80&&py-height/2<this.h-70;
      item.screen=onScreen?{x:px-width/2-18,y:py-height/2-18,w:width+36,h:height+36}:null;
      item.button.style.width=`${width}px`;item.button.style.height=`${height}px`;
      item.button.style.transform=`translate3d(${px-width/2}px,${py-height/2}px,0)`;
      item.button.style.opacity=opacity;item.button.style.visibility=onScreen?'visible':'hidden';
      item.button.style.zIndex=Math.round(100-distance);item.button.tabIndex=onScreen?0:-1;
    });
    const anchors=this.w<700?[[.22,.27],[.71,.2],[.79,.53],[.21,.61],[.49,.76],[.78,.84]]:[[.2,.34],[.51,.2],[.8,.35],[.28,.69],[.59,.68],[.81,.8]];
    const captionArt=this.hoverArt||(this.returningArt?.focus>.01?this.returningArt:null);
    const art=captionArt?.screen;
    this.artTip.hidden=!art;
    let tipRect=null;
    if(art){
      const width=this.artTip.offsetWidth,height=this.artTip.offsetHeight;
      const left=Math.max(12,Math.min(this.w-width-12,art.x+art.w/2-width/2));
      const top=Math.max(85,Math.min(this.h-height-90,art.y+art.h+8));
      this.artTip.style.transform=`translate3d(${left}px,${top}px,0)`;
      tipRect={x:left-8,y:top-8,w:width+16,h:height+16};
    }
    this.pills.forEach(pill=>{
      const {node,index}=pill;
      const [nx,ny]=anchors[index%6];
      // Foreground words travel gently with the camera, remaining reachable at every depth.
      let px=nx*this.w,py=ny*this.h;
      const width=node.offsetWidth,height=node.offsetHeight;
      px=Math.max(width/2+12,Math.min(this.w-width/2-12,px));
      py=Math.max(115,Math.min(this.h-135,py));
      const base={x:px-width/2,y:py-height/2,w:width,h:height};
      pill.visibility=pillVisibility(base,[art,tipRect],this.lockedPill===pill,this.cursor,pill.visibility,performance.now());
      node.classList.toggle('pill-obscured',pill.visibility.hidden);
      node.classList.toggle('pill-unavailable',pill.visibility.inert);node.inert=pill.visibility.inert;
      node.style.transform=`translate3d(${base.x}px,${base.y}px,0)`;
    });
    this.renderer?.render(this.scene,this.camera);
    const progress=this.depth/this.maxDepth;
    this.host.dataset.depth=this.depth.toFixed(2);
    document.querySelector('#depth-fill').style.transform=`translateY(${progress*84}px)`;
    document.querySelector('#intro').style.opacity=Math.max(0,1-this.depth/4);
    document.querySelector('#travel-back').disabled=target<.1;
    document.querySelector('#travel-forward').disabled=target>=this.maxDepth-.1;
    this.onDepth?.(progress);
  }

  dispose(){cancelAnimationFrame(this.raf);this.clear();this.artTip.remove();document.documentElement.removeEventListener('pointerleave',this.leave);window.removeEventListener('blur',this.leave);this.frameTextures.forEach(texture=>texture.dispose());window.removeEventListener('resize',this.resize);window.removeEventListener('pointermove',this.move);this.renderer?.dispose();}
}
