export const TYPE_END=1900;
export function typedCount(ms){return Math.max(0,Math.min(17,Math.floor((ms-180)/90)));}
export function artworkArrival(ms,index){const p=Math.max(0,Math.min(1,(ms-index*110)/1150));return 1-(1-p)**3;}
export function openingDuration(count){return 1150+Math.max(0,count-1)*110;}

export function startOpening(){
  const root=document.documentElement,heading=document.querySelector('#intro h1');
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let finished=!root.dataset.opening||media.matches,raf=0,start=0,galleryStart=0,space=null,chars=[],lastCount=-1;
  const original=heading.innerHTML;
  const locked=[...document.querySelectorAll('.topbar,#scene,.bottom-bar')];
  const skip=document.querySelector('#skip-opening');
  function finish(){
    finished=true;cancelAnimationFrame(raf);delete root.dataset.opening;
    heading.innerHTML=original;heading.removeAttribute('aria-label');
    locked.forEach(n=>n.inert=false);skip.hidden=true;
    if(space)space.openingStart=null;
    window.removeEventListener('opening-timeout',finish);window.removeEventListener('keydown',onKey);media.removeEventListener('change',onMotion);
  }
  function onKey(e){if(e.key==='Escape')finish();}
  function onMotion(){if(media.matches)finish();}
  if(finished){finish();return {ready(){},finish};}
  heading.setAttribute('aria-label','Follow a feeling.');
  for(const selector of ['.context-rest','.title-focus']){
    const node=heading.querySelector(selector),text=node.textContent;node.textContent='';node.setAttribute('aria-hidden','true');
    for(const letter of text){const span=document.createElement('span');span.className='typing-char';span.textContent=letter;node.append(span);chars.push(span);}
  }
  locked.forEach(n=>n.inert=true);skip.hidden=false;skip.onclick=finish;
  window.addEventListener('opening-timeout',finish);window.addEventListener('keydown',onKey);media.addEventListener('change',onMotion);
  function frame(time){
    if(finished)return;
    if(!start)start=time;
    const elapsed=time-start,count=typedCount(elapsed);
    if(count!==lastCount){chars.forEach((n,i)=>{n.classList.toggle('typed',i<count);n.classList.toggle('typing-cursor',i===Math.max(0,count-1));});lastCount=count;}
    if(elapsed>=TYPE_END&&space&&!galleryStart){
      galleryStart=time;space.openingStart=time;root.dataset.opening='gallery';
      chars.forEach(n=>n.classList.remove('typing-cursor'));
    }
    if(galleryStart&&time-galleryStart>=openingDuration(space.items.length)){finish();return;}
    raf=requestAnimationFrame(frame);
  }
  // Give the display font a bounded opportunity to load without trapping slow connections.
  Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,600))]).then(()=>{if(!finished)raf=requestAnimationFrame(frame);});
  return {ready(value){space=value;if(finished)return;if(space.still){finish();return;}space.openingStart=Infinity;},finish};
}
