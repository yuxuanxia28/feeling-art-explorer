import { advanceQuery, safeImageUrl } from '/lib/discovery/spatial-state.mjs';
import { startOpening } from '/lib/discovery/opening.mjs';

const $=selector=>document.querySelector(selector);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let space, request, detailRequest, selected, pending=false;
const stops=[{label:'Begin',query:{},scroll:0,data:null}];
let current=0;
const introHeading=$('#intro h1');
const opening=startOpening();
const feelingTip=document.createElement('span');
feelingTip.id='feeling-tooltip';feelingTip.className='feeling-tooltip';
feelingTip.setAttribute('role','tooltip');feelingTip.textContent='Scroll to wander';
$('#intro').append(feelingTip);
function connectFeelingTip(){
  const word=introHeading.querySelector('.title-focus');
  if(!word)return;
  word.tabIndex=0;word.setAttribute('aria-describedby','feeling-tooltip');
}
new MutationObserver(connectFeelingTip).observe(introHeading,{childList:true});
connectFeelingTip();
introHeading.addEventListener('keydown',event=>{
  if(event.key==='Escape')$('#intro').classList.add('tip-dismissed');
});
introHeading.addEventListener('pointerleave',()=>$('#intro').classList.remove('tip-dismissed'));
introHeading.addEventListener('focusout',()=>$('#intro').classList.remove('tip-dismissed'));
document.querySelector('.skip-link').addEventListener('click',()=>opening.finish());
const clearTitleFocus=()=>introHeading.removeAttribute('data-title-focus');
window.addEventListener('pointermove',event=>{
  if(document.documentElement.dataset.opening||event.pointerType!=='mouse'||$('#intro').hidden||document.querySelector('dialog[open]')){clearTitleFocus();return;}
  const r=introHeading.getBoundingClientRect();
  const over=event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom&&!event.target.closest('button,a');
  introHeading.toggleAttribute('data-title-focus',over);
},{passive:true});
window.addEventListener('blur',clearTitleFocus);
window.addEventListener('scroll',clearTitleFocus,{passive:true});
document.documentElement.addEventListener('pointerleave',clearTitleFocus);

function status(text,retry=null){
  $('#message').hidden=!text;
  $('#message').replaceChildren();
  if(text)$('#message').append(document.createTextNode(text));
  if(retry){const button=document.createElement('button');button.textContent='Try again';button.onclick=retry;$('#message').append(button);}
}

function renderTrail(){
  $('#trail').replaceChildren();
  stops.slice(0,current+1).forEach((stop,index)=>{
    if(index){const separator=document.createElement('span');separator.className='separator';separator.textContent='/';separator.setAttribute('aria-hidden','true');$('#trail').append(separator);}
    const button=document.createElement('button');button.textContent=stop.label;button.title=`Return to ${stop.label}`;
    if(index===current)button.setAttribute('aria-current','step');
    button.onclick=()=>goBack(index);$('#trail').append(button);
  });
}

function display(stop,enter=false){
  space.setData(stop.data,{enter});
  const initial=stop.data.initial;
  $('#intro').hidden=!initial;$('#scene-title').hidden=initial;
  $('#scene-title h1').textContent=stop.label;
  $('#scene-title p').textContent=stop.data.choices.length?'Follow another word, or stay a while.':'Stay a while. Open a work to look closer.';
  $('#collection-count').textContent=initial?'Choose a feeling to begin.':`${stop.data.total.toLocaleString()} matching works · ${stop.data.results.length} in this space`;
  $('#empty').hidden=stop.data.results.length>0;
  $('#more-works').hidden=!space.still||initial||Number(stop.query.offset||0)+stop.data.results.length>=stop.data.total;
  window.scrollTo({top:stop.scroll,behavior:'instant'});space.depth=stop.scroll/100;
  renderTrail();
}

async function loadStop(index,{enter=false}={}){
  request?.abort();request=new AbortController();const controller=request;
  pending=true;$('#space').setAttribute('aria-busy','true');status('Finding a way through the collection…');
  const stop=stops[index];
  try{
    const response=await fetch('/api/spatial?'+new URLSearchParams(stop.query),{signal:controller.signal});
    const data=await response.json();if(!response.ok)throw Error(data.error||'The collection could not be opened.');
    if(controller.signal.aborted)return;
    stop.data=data;current=index;display(stop,enter);status('');
  }catch(error){if(error.name!=='AbortError'){opening.finish();status('The collection could not be opened. Check the local server and try again.',()=>loadStop(index,{enter}));}}
  finally{if(request===controller){pending=false;$('#space').setAttribute('aria-busy','false');}}
}

async function choose(choice){
  if(pending)return;
  stops[current].scroll=scrollY;
  const query=advanceQuery(stops[current].query,choice);
  const next={label:choice.label,query,scroll:0,data:null};
  stops.splice(current+1,stops.length,next);
  // Keep the current space visible until its next branch is ready.
  await loadStop(current+1,{enter:true});
}

function goBack(index){
  if(index<0||index>current||pending)return;
  stops[current].scroll=scrollY;
  current=index;
  if(stops[index].data)display(stops[index],false);else loadStop(index);
  status('');
}

function showDialog(id){space.paused=true;document.body.classList.add('modal-open');$(id).showModal();}
function closeDialog(id){$(id).close();}
for(const dialog of document.querySelectorAll('dialog')){
  dialog.addEventListener('close',()=>{space.paused=false;document.body.classList.remove('modal-open');if(dialog.id==='detail')detailRequest?.abort();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
}

async function showArtwork(row){
  selected=row;detailRequest?.abort();detailRequest=new AbortController();
  const artist=row.artist?.replace(/^[;\s]+$/,'')||'Artist not listed in this index';
  const record=/^https:\/\/www\.nga\.gov\//.test(row.objectUrl)?row.objectUrl:'https://www.nga.gov/';
  $('#detail').innerHTML=`<button class="close" data-close="detail" aria-label="Close artwork">×</button><div class="detail-layout"><div class="detail-image"><img src="${escape(safeImageUrl(row.thumbnailUrl))}" alt="${escape(row.title)}"></div><div class="detail-copy"><h2>${escape(row.title)}</h2><p>${escape(artist)}<br>${escape(row.date||'Date not listed')}</p><p>${escape(row.medium)}</p><h3>How you arrived here</h3><p>${escape(stops.slice(1,current+1).map(stop=>stop.label).join(' / ')||'An introductory selection from the feeling routes.')}</p><p class="fine">${(row.reasons||[]).map(escape).join('<br>')}</p><h3>Threads to follow</h3><p>${escape(row.terms||'No subject terms listed.')}</p>${row.hasVector?'<button id="visual-anchor" class="solid">Explore visual connections <span>↗</span></button>':'<p class="fine">Visual similarity is not yet indexed for this work.</p>'}<div id="dna"></div><a href="${escape(record)}" target="_blank" rel="noopener">View the NGA catalogue record ↗</a></div></div>`;
  showDialog('#detail');
  $('#visual-anchor')?.addEventListener('click',()=>{closeDialog('#detail');choose({kind:'anchor',value:String(selected.id),label:'Visual connections'});});
  try{
    const response=await fetch(`/api/artwork-dna/${row.id}`,{signal:detailRequest.signal});
    if(!response.ok)return;const data=await response.json();if(selected?.id!==row.id)return;
    $('#dna').innerHTML=`<details><summary>Artwork DNA</summary><p class="fine">Model-assisted readings, not emotional certainty.</p><p>${data.modelReading.scores.slice(0,3).map(score=>`${escape(score.label)} · ${score.score.toFixed(3)}`).join('<br>')}</p><div class="palette">${data.visual.palette.map(colour=>`<span style="background:${/^#[0-9a-f]{6}$/i.test(colour.hex)?colour.hex:'#ddd'}" title="${escape(colour.hex)}"></span>`).join('')}</div></details>`;
  }catch{}
}

$('#research-open').onclick=()=>{
  const form=$('#research-form');form.reset();
  for(const [key,value] of Object.entries(stops[current].query))if(form.elements[key])form.elements[key].value=value;
  $('#filter-error').textContent='';showDialog('#research');
};
$('#research-form').onsubmit=event=>{
  event.preventDefault();
  const values=Object.fromEntries([...new FormData(event.target)].map(([key,value])=>[key,String(value).trim()]));
  if(values.from&&values.to&&Number(values.from)>Number(values.to)){$('#filter-error').textContent='The start year must be before the end year.';return;}
  stops[current].scroll=scrollY;
  const query={...stops[current].query,...values};delete query.anchor;delete query.offset;
  if(!query.feeling)query.scope='catalogue';
  stops.splice(current+1,stops.length,{label:values.q||values.artist||values.medium||'A closer look',query,scroll:0,data:null});
  closeDialog('#research');loadStop(current+1,{enter:true});
};
$('#about-open').onclick=()=>showDialog('#about');
$('#motion-toggle').onclick=()=>{space.setStill(!space.still);display(stops[current]);window.scrollTo({top:0,behavior:'instant'});};
$('#empty-back').onclick=()=>goBack(Math.max(0,current-1));
$('#travel-back').onclick=()=>window.scrollBy({top:-innerHeight*.85,behavior:'smooth'});
$('#travel-forward').onclick=()=>window.scrollBy({top:innerHeight*.85,behavior:'smooth'});
$('#more-works').onclick=()=>{
  if(pending)return;
  const stop=stops[current];stop.scroll=scrollY;
  const offset=Number(stop.query.offset||0)+stop.data.results.length;
  stops.splice(current+1,stops.length,{label:'Further',query:{...stop.query,offset},scroll:0,data:null});
  loadStop(current+1,{enter:true});
};
document.addEventListener('click',event=>{const button=event.target.closest('[data-close]');if(button)closeDialog('#'+button.dataset.close);});

try{
  const {ArtworkSpace}=await import('/spatial-scene.js');
  space=new ArtworkSpace({onArtwork:showArtwork,onChoice:choose,onDepth:progress=>{
    const stop=stops[current];
    $('#more-works').hidden=pending||progress<.93||!stop.data||stop.data.initial||Number(stop.query.offset||0)+stop.data.results.length>=stop.data.total;
  }});
  await loadStop(0);
  opening.ready(space);
  window.addEventListener('pagehide',event=>{if(!event.persisted)space.dispose();});
}catch(error){
  opening.finish();
  status('The spatial renderer could not start.');
  const link=document.createElement('a');link.href='/discover.html';link.textContent=' Open catalogue view';$('#message').append(link);
}
