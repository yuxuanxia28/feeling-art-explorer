import * as THREE from '/node_modules/three/build/three.module.js';
import { artworkPosition, safeImageUrl } from '/lib/discovery/spatial-state.mjs';
import { createArtworkFrame, disposeArtworkFrame } from '/lib/discovery/artwork-frame.mjs';
import { artworkArrival } from '/lib/discovery/opening.mjs';

const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>';

export class ArtworkSpace {
  constructor({onArtwork,onChoice,onDepth}) {
    this.host=document.querySelector('#scene');
    this.artLayer=document.querySelector('#art-layer');
    this.pillLayer=document.querySelector('#pill-layer');
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
    this.move=event=>{if(event.pointerType==='mouse'){this.pointer.x=(event.clientX/this.w-.5)*2;this.pointer.y=(event.clientY/this.h-.5)*2;}};
    window.addEventListener('resize',this.resize);
    window.addEventListener('pointermove',this.move,{passive:true});
    this.setStill(this.still);this.resize();this.tick=this.tick.bind(this);this.raf=requestAnimationFrame(this.tick);
  }

  setStill(value) {
    this.still=value;document.body.classList.toggle('still',value);
    if(value)this.renderer?.clear();
    for(const {button} of this.items){button.tabIndex=0;button.removeAttribute('aria-hidden');button.style.visibility='';}
    document.querySelector('#motion-toggle').textContent=value?'Use spatial view':'Use still view';
    document.querySelector('#travel-back').disabled=value;
    document.querySelector('#travel-forward').disabled=value;
  }

  clear(){
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
      button.onclick=()=>this.onChoice(choice);node.append(button,count);this.pillLayer.append(node);this.pills.push({node,index});
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
      const x=item.base.x*fitX*spread,y=item.base.y*spread+bob-(1-arrival)*.25,z=item.base.z-(1-arrival)*5;
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
      item.button.style.width=`${width}px`;item.button.style.height=`${height}px`;
      item.button.style.transform=`translate3d(${px-width/2}px,${py-height/2}px,0)`;
      item.button.style.opacity=opacity;item.button.style.visibility=onScreen?'visible':'hidden';
      item.button.style.zIndex=Math.round(100-distance);item.button.tabIndex=onScreen?0:-1;
    });
    const anchors=this.w<700?[[.22,.27],[.71,.2],[.79,.53],[.21,.61],[.49,.76],[.78,.84]]:[[.2,.34],[.51,.2],[.8,.35],[.28,.69],[.59,.68],[.81,.8]];
    this.pills.forEach(({node,index})=>{
      const [nx,ny]=anchors[index%6];
      // Foreground words travel gently with the camera, remaining reachable at every depth.
      const distance=8.5+(index%3)*.5;
      const drift=Math.sin(this.depth*.15+index)*.08;
      v.set((nx-.5)*worldHeight*this.camera.aspect*(distance/10),(.5-ny)*worldHeight*(distance/10)+drift,this.camera.position.z-distance).project(this.camera);
      let px=(v.x+1)*this.w/2,py=(1-v.y)*this.h/2;
      const width=node.offsetWidth,height=node.offsetHeight;
      px=Math.max(width/2+12,Math.min(this.w-width/2-12,px));
      py=Math.max(115,Math.min(this.h-135,py));
      node.style.transform=`translate3d(${px-width/2}px,${py-height/2}px,0)`;
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

  dispose(){cancelAnimationFrame(this.raf);this.clear();this.frameTextures.forEach(texture=>texture.dispose());window.removeEventListener('resize',this.resize);window.removeEventListener('pointermove',this.move);this.renderer?.dispose();}
}
