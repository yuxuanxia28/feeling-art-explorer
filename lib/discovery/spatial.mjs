import { discover, FEELING_TERMS } from './search.mjs';
import { MOODS, advanceQuery } from './spatial-state.mjs';

export function spatialPayload(indexPath, query={}) {
  if (!Object.values(query).some(Boolean)) {
    const choices=[], results=[], seen=new Set(), routes=[];
    for (const [value,label,subject] of MOODS) {
      const data=discover(indexPath,{feeling:value});
      if(!data.total)continue;
      choices.push({kind:'feeling',value,label,count:data.total});
      const preview=discover(indexPath,{q:subject,medium:'Painting'});
      const pool=preview.results.length?preview.results:data.results;
      // The primary image sits behind its corresponding feeling pill.
      const primary=value==='intense'?pool.find(row=>/landscape|buffalo|frigate/i.test(row.title)):pool[0];
      routes.push([primary,...pool.filter(row=>row!==primary)].filter(Boolean).slice(0,3));
    }
    for(let depth=0;depth<3;depth++)for(const route of routes){const row=route[depth];if(row&&!seen.has(row.id)){results.push(row);seen.add(row.id);}}
    return {results,choices,total:null,initial:true};
  }
  const data=discover(indexPath,query);
  const candidates=[];
  if(!query.q)for(const term of FEELING_TERMS[query.feeling]||[])candidates.push({kind:'q',value:term,label:term[0].toUpperCase()+term.slice(1)});
  if(!query.medium)for(const medium of ['Painting','Drawing','Print','Photograph'])candidates.push({kind:'medium',value:medium,label:medium==='Painting'?'Painted colour':medium==='Drawing'?'Drawn lines':medium==='Print'?'Printmaking':'Photography'});
  if(query.q&&!query.from&&!query.to) {
    candidates.push({kind:'period',value:':1799',label:'Before 1800'},{kind:'period',value:'1800:1899',label:'19th century'},{kind:'period',value:'1900:',label:'Modern era'});
  }
  const seen=new Set();
  if(query.q)for(const row of data.results)for(const value of row.terms.split(';').map(v=>v.trim())){
    if(value.length<4||value.length>24||/surface|unknown/i.test(value)||String(query.q).toLowerCase().includes(value.toLowerCase())||seen.has(value))continue;
    seen.add(value); if(seen.size<=6)candidates.push({kind:'term',value,label:value});
  }
  const choices=[];
  if(data.total)for(const choice of candidates){
    const count=discover(indexPath,advanceQuery(query,choice)).total;
    if(count>0&&count<data.total){choices.push({...choice,count});if(choices.length===6)break;}
  }
  return {...data,choices,initial:false};
}
