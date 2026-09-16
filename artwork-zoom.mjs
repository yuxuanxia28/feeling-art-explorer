export function highResolutionUrl(value, edge = 2400) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://api.nga.gov' || !/^\/iiif\/[^/]+\/full\/[^/]+\/0\/default\.jpg$/.test(url.pathname)) return '';
    url.pathname = url.pathname.replace(/\/full\/[^/]+\//, `/full/!${edge},${edge}/`);
    url.search = ''; url.hash = '';
    return url.href;
  } catch { return ''; }
}
export function zoomLimit(pixels, fittedWidth, density = 1) {
  return fittedWidth > 0 ? Math.max(1, pixels / (fittedWidth * Math.max(1, density))) : 1;
}
export function clampPan(x, y, width, height, viewportWidth, viewportHeight) {
  const dx = Math.max(0, (width - viewportWidth) / 2), dy = Math.max(0, (height - viewportHeight) / 2);
  return {x: Math.max(-dx, Math.min(dx, x)), y: Math.max(-dy, Math.min(dy, y))};
}

function mountViewer(host, dialog) {
  const image = host.querySelector('img');
  if (!image) return () => {};
  const controller = new AbortController(), {signal} = controller;
  const loading = new AbortController();
  let disposed = false, scale = 1, x = 0, y = 0, width = 0, height = 0, limit = 1;
  let quality = 'Loading higher-resolution image…';
  const original = image.src, pointers = new Map();
  const viewport = document.createElement('div'); viewport.className = 'zoom-viewport';
  viewport.tabIndex = 0; viewport.setAttribute('aria-label', 'Artwork image. Use plus and minus to zoom, arrow keys to pan, zero to reset.');
  const controls = document.createElement('div'); controls.className = 'zoom-controls';
  controls.innerHTML = '<button type="button" aria-label="Zoom out">−</button><output aria-label="Zoom level">1.0×</output><button type="button" aria-label="Zoom in">+</button><button type="button" aria-label="Reset artwork zoom">Reset</button>';
  const note = document.createElement('p'); note.className = 'zoom-note'; note.setAttribute('role', 'status');
  host.classList.add('artwork-viewer'); host.replaceChildren(viewport, controls, note); viewport.append(image);
  image.draggable = false;
  const [minus, plus, reset] = controls.querySelectorAll('button');
  function paint() {
    ({x,y} = clampPan(x,y,width*scale,height*scale,viewport.clientWidth,viewport.clientHeight));
    image.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    controls.querySelector('output').textContent = `${scale.toFixed(1)}×`;
    minus.disabled = scale <= 1.001; plus.disabled = scale >= limit - .001;
    reset.disabled = scale === 1 && x === 0 && y === 0;
    viewport.style.cursor = scale > 1 ? 'grab' : 'default';
    note.textContent = quality + (scale >= limit - .001 && quality !== 'Loading higher-resolution image…' ? ' · Resolution limit reached' : scale > 1 ? ' · Drag to look closer' : '');
  }
  function layout() {
    if (!image.naturalWidth || !viewport.clientWidth) return;
    const fit = Math.min(viewport.clientWidth / image.naturalWidth, viewport.clientHeight / image.naturalHeight, 1);
    width = image.naturalWidth * fit; height = image.naturalHeight * fit;
    image.style.width = `${width}px`; image.style.height = `${height}px`;
    limit = zoomLimit(image.naturalWidth, width, window.devicePixelRatio);
    scale = Math.min(scale, limit); paint();
  }
  function zoom(next, cx = 0, cy = 0) {
    next = Math.max(1, Math.min(limit, next));
    const ratio = next / scale; x = cx - (cx-x)*ratio; y = cy-(cy-y)*ratio; scale = next; paint();
  }
  const listen = (el,type,fn,options={}) => el.addEventListener(type,fn,{...options,signal});
  listen(minus,'click',()=>zoom(scale/1.3)); listen(plus,'click',()=>zoom(scale*1.3));
  listen(reset,'click',()=>{scale=1;x=y=0;paint();});
  listen(viewport,'wheel',event=>{
    // Keep ordinary scrolling available; Ctrl/Command + wheel zooms only this image.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault(); const r=viewport.getBoundingClientRect();
    zoom(scale*Math.exp(-event.deltaY*.008),event.clientX-r.left-r.width/2,event.clientY-r.top-r.height/2);
  },{passive:false});
  listen(viewport,'keydown',event=>{
    if (['+','=','-','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) event.preventDefault();
    if (event.key==='+'||event.key==='=') zoom(scale*1.3);
    if (event.key==='-') zoom(scale/1.3);
    if (event.key==='0') {scale=1;x=y=0;paint();}
    if (event.key==='ArrowLeft') x+=30;
    if (event.key==='ArrowRight') x-=30;
    if (event.key==='ArrowUp') y+=30;
    if (event.key==='ArrowDown') y-=30;
    paint();
  });
  listen(viewport,'pointerdown',event=>{
    if(event.button!==0)return;
    viewport.setPointerCapture(event.pointerId); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  });
  listen(viewport,'pointermove',event=>{
    const old=pointers.get(event.pointerId); if(!old)return;
    const before=[...pointers.values()]; pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const after=[...pointers.values()];
    if(after.length===2){
      const distance=p=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
      const prior=distance(before), r=viewport.getBoundingClientRect();
      if(prior>0)zoom(scale*distance(after)/prior,(after[0].x+after[1].x)/2-r.left-r.width/2,(after[0].y+after[1].y)/2-r.top-r.height/2);
    } else {x+=event.clientX-old.x;y+=event.clientY-old.y;paint();}
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(viewport,event,e=>pointers.delete(e.pointerId));
  listen(image,'load',layout);
  const resize = new ResizeObserver(layout); resize.observe(viewport);
  layout(); paint();
  let high;
  const timer=setTimeout(()=>loading.abort(),20000);
  (async()=>{
    try {
      const candidate=highResolutionUrl(original); if(!candidate)throw Error('No IIIF source');
      const infoUrl=candidate.split('/full/')[0]+'/info.json';
      const response=await fetch(infoUrl,{signal:loading.signal}); if(!response.ok)throw Error('Metadata unavailable');
      const info=await response.json();
      if(!Number.isFinite(info.width)||!Number.isFinite(info.height)||info.width<=0||info.height<=0)throw Error('Invalid dimensions');
      // Never ask IIIF to upscale a small original. Bound decoded memory on phones.
      const edge=Math.min(2400,Math.max(info.width,info.height));
      high=new Image(); high.src=highResolutionUrl(original,Math.floor(edge));
      await high.decode(); if(disposed)return;
      if(loading.signal.aborted)throw Error('Image timed out');
      image.src=high.src; quality='Higher-resolution image'; layout();
    } catch {if(!disposed){quality='Original image · Higher resolution unavailable';layout();paint();}}
    finally {clearTimeout(timer);}
  })();
  return ()=>{disposed=true;clearTimeout(timer);loading.abort();controller.abort();resize.disconnect();if(high)high.src='';};
}

if (typeof document !== 'undefined') {
  const style=document.createElement('style');
  style.textContent=`
  #detail .artwork-viewer{display:flex;flex-direction:column;justify-content:center;gap:12px;padding:30px 20px;min-width:0;align-self:stretch}
  .zoom-viewport{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:min(58dvh,580px);overflow:hidden;touch-action:none;outline-offset:3px}
  #detail .zoom-viewport img{max-width:none;max-height:none;object-fit:contain;flex:none;user-select:none;transform-origin:center;transition:none}
  .zoom-controls{display:flex;align-items:center;justify-content:center;gap:8px;flex:none}
  #detail .zoom-controls button{min-width:44px;min-height:44px;padding:8px 12px;margin:0;border:1px solid #83908270;border-radius:24px;background:#f5f7efcc;color:inherit;font:14px Arial,sans-serif}
  .zoom-controls output{font:12px Arial,sans-serif;min-width:42px;text-align:center;font-variant-numeric:tabular-nums}
  #detail .zoom-controls button:disabled{opacity:.4;cursor:default}
  #detail .zoom-note{font:11px/1.5 Arial,sans-serif;text-align:center;margin:0;min-height:34px;color:var(--muted,#59675c)}
  @media(max-width:700px){#detail .artwork-viewer{padding:24px 14px 12px}.zoom-viewport{height:40dvh}}
  `; document.head.append(style);
  const dialog=document.querySelector('#detail');
  if(dialog){
    let cleanup=()=>{}, mounted;
    const sync=()=>{
      const host=dialog.querySelector('.detail-image,.detail-visual');
      if(!dialog.open){cleanup();mounted=null;return;}
      if(host && host!==mounted){cleanup();mounted=host;cleanup=mountViewer(host,dialog);}
    };
    new MutationObserver(sync).observe(dialog,{childList:true,attributes:true,attributeFilter:['open']});
    dialog.addEventListener('close',sync);sync();
  }
}
