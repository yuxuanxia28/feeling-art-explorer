export const MOODS = [
  ['calm','Calm','landscape'], ['dreamlike','Dreamlike','moon'],
  ['intense','Intense','storm'], ['warm','Warm','flowers'],
  ['melancholic','Melancholic','winter'], ['curious','Curious','animals'],
];

export function artworkFocus(current,active,elapsed,dt){
  const target=0; // Hover previews retain the artwork's original spatial position.
  return current+(target-current)*(1-Math.exp(-Math.min(dt,.05)*1.8));
}

export function insidePreview(pointer,rects){
  return Boolean(pointer&&rects.some(r=>r&&pointer.x>=r.x&&pointer.x<=r.x+r.w&&pointer.y>=r.y&&pointer.y<=r.y+r.h));
}

export function hidePill(p,regions,active,wasHidden,pointer){
  if(active)return false;
  if(regions.some(r=>r&&p.x<r.x+r.w&&p.x+p.w>r.x&&p.y<r.y+r.h&&p.y+p.h>r.y))return true;
  return Boolean(wasHidden&&pointer&&pointer.x>=p.x&&pointer.x<=p.x+p.w&&pointer.y>=p.y&&pointer.y<=p.y+p.h);
}

// Protect approaching navigation targets; only sustained overlap earns a fade.
export function pillVisibility(p,regions,active,pointer,previous={},now=0){
  const near=pointer&&pointer.x>=p.x-64&&pointer.x<=p.x+p.w+64&&pointer.y>=p.y-64&&pointer.y<=p.y+p.h+64;
  const moved=pointer&&(!previous.pointer||Math.hypot(pointer.x-previous.pointer.x,pointer.y-previous.pointer.y)>=2);
  const approachAt=near&&moved?now:previous.approachAt;
  const tracking={pointer:moved?{...pointer}:previous.pointer,approachAt};
  const approaching=near&&approachAt!=null&&now-approachAt<350;
  if(active||approaching||!hidePill(p,regions,false,false,null))return {...tracking,since:null,hidden:false,inert:false};
  const since=previous.since??now;
  const elapsed=now-since;
  return {...tracking,since,hidden:elapsed>=650,inert:elapsed>=1100};
}

// Screen-space clearance: prefer the shortest move to a free edge.
export function clearArtwork(p,art,w,h){
  const gap=12;
  const overlaps=q=>q.x<art.x+art.w+gap&&q.x+p.w>art.x-gap&&q.y<art.y+art.h+gap&&q.y+p.h>art.y-gap;
  if(!overlaps(p))return {x:p.x,y:p.y};
  const clamp=q=>({x:Math.max(12,Math.min(w-p.w-12,q.x)),y:Math.max(90,Math.min(h-p.h-90,q.y))});
  const candidates=[{x:art.x-p.w-gap,y:p.y},{x:art.x+art.w+gap,y:p.y},{x:p.x,y:art.y-p.h-gap},{x:p.x,y:art.y+art.h+gap}].map(clamp);
  const area=q=>Math.max(0,Math.min(q.x+p.w,art.x+art.w)-Math.max(q.x,art.x))*Math.max(0,Math.min(q.y+p.h,art.y+art.h)-Math.max(q.y,art.y));
  candidates.sort((a,b)=>(Number(overlaps(a))-Number(overlaps(b)))*1e9+(area(a)-area(b))*1e4+Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
  return candidates[0];
}

export function advanceQuery(previous, choice) {
  if (choice.kind === 'feeling') return { feeling: choice.value };
  const next = { ...previous };
  delete next.offset;
  if (choice.kind === 'term') next.q = [next.q,choice.value].filter(Boolean).join(' ');
  else if (['q','medium','artist','anchor'].includes(choice.kind)) next[choice.kind] = choice.value;
  else if (choice.kind === 'period') {
    const [from,to] = choice.value.split(':');
    next.from=from; next.to=to;
  } else throw Error('Unknown exploration choice');
  return next;
}

export function artworkPosition(index) {
  const slots=[[-4.3,1.6,0],[0.6,2.65,-4],[4.5,.8,-1],[-3.2,-2,-3],[1.2,-1.9,-.5],[5,-2.6,-5]];
  const slot=slots[index%6], row=Math.floor(index/6);
  return { x:slot[0]*(row%2?-1:1),y:slot[1],z:slot[2]-row*11 };
}

export function safeImageUrl(value) {
  try { const url=new URL(value); return url.protocol==='https:'&&url.hostname==='api.nga.gov'?url.href:''; }
  catch { return ''; }
}
