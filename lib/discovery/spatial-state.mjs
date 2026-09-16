export const MOODS = [
  ['calm','Calm','landscape'], ['dreamlike','Dreamlike','moon'],
  ['intense','Intense','storm'], ['warm','Warm','flowers'],
  ['melancholic','Melancholic','winter'], ['curious','Curious','animals'],
];

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
