// pb-internal.js — main script for PatternBreak Alcon Job Tracker
// Loaded via jsDelivr from CripGod/webflow-assets repo

const ST_OPTS=[
  {label:'Delivered',     bg:'var(--gd)',  col:'var(--green)', dot:'var(--green)'},
  {label:'In Progress',   bg:'var(--ad)',  col:'var(--amber)', dot:'var(--amber)'},
  {label:'Needs Review',  bg:'var(--pd)',  col:'var(--pl)',    dot:'var(--pl)'},
  {label:'Not Started',   bg:'var(--bg4)', col:'var(--text2)', dot:'var(--text3)'},
  {label:'Action Needed', bg:'var(--rd)',  col:'var(--red)',   dot:'var(--red)'}
];
function stStyle(s){
  const o=ST_OPTS.find(x=>x.label.toLowerCase()===(s||'').toLowerCase().trim());
  return o||{bg:'var(--bg4)',col:'var(--text2)',dot:'var(--text3)'};
}
function dSt(s,id){
  const o=stStyle(s);
  return '<button class="st-pill" style="background:'+o.bg+';color:'+o.col+'" data-id="'+id+'" onclick="openStDrop(event)">'+( s||'Not Started')+'</button>';
}
let _stBtn=null;
function openStDrop(e){
  e.stopPropagation();
  _stBtn=e.currentTarget;
  const id=_stBtn.dataset.id;
  const drop=document.getElementById('st-drop');
  const r=_stBtn.getBoundingClientRect();
  drop.style.top=(r.bottom+4)+'px';
  drop.style.left=r.left+'px';
  drop.innerHTML=ST_OPTS.map(o=>'<div class="st-opt" onclick="pickSt(event,\''+id+'\',\''+encodeURIComponent(o.label)+'\')"><span class="st-dot" style="background:'+o.dot+'"></span>'+o.label+'</div>').join('');
  drop.classList.add('open');
  setTimeout(()=>document.addEventListener('click',closeStDrop,{once:true}),0);
}
function closeStDrop(){document.getElementById('st-drop').classList.remove('open');}
async function pickSt(e,id,encLabel){
  e.stopPropagation();
  closeStDrop();
  const label=decodeURIComponent(encLabel);
  Object.values(allDelivs).forEach(a=>a.forEach(d=>{if(d.id===id)d.status=label;}));
  const o=stStyle(label);
  document.querySelectorAll('.st-pill[data-id="'+id+'"]').forEach(b=>{b.style.background=o.bg;b.style.color=o.col;b.textContent=label;});
  try{await fetch(SU,{method:'POST',body:JSON.stringify({action:'delivStatus',id:id,status:label})});setTimeout(syncData,5000);}catch(e){}
}

const SID='1E_9_0qprkPJw2RESKF2f4HebsiD_1OM1zaSNSyITaTc';
const SU='https://script.google.com/macros/s/AKfycbyms6eQaHL-RtxMHay-4B_1ecjmNAxLpeMBeZKZNW5pQxtn6x2RUUfzwrnC5RiyZ4ek/exec';
const HK='AIzaSyDBBHifDD2WDarCBSXJWvm3rpY5x6gBbWE';
const C={A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,O:14,P:15,Q:16,R:17,S:18,T:19};
const TC=['#7c6ff7','#22d3a5','#38bdf8','#f59e0b','#f43f5e'];
let allJobs=[],allDelivs={},pendingItems=[],archivedItems=[],curFilt='all',curFiltP='all',deleteTarget=null,editMode=false,editKey=null,curSection='overview';

const $=id=>document.getElementById(id);
const fa=n=>n>=1e6?'$'+(n/1e6).toFixed(1)+'M':n>=1000?'$'+~~(n/1000)+'K':'$'+n;
const fd=d=>d?d.toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
const pa=v=>{const n=parseFloat(String(v||0).replace(/[$,\s]/g,''));return isNaN(n)?0:n;};
const ad=(d,days)=>{const r=new Date(d);r.setDate(r.getDate()+days);return r;};
const pd=s=>{if(!s)return null;const d=new Date(s);return isNaN(d)?null:d;};

// THEME
function toggleTheme(){
  const light=document.documentElement.getAttribute('data-theme')==='light';
  document.documentElement.setAttribute('data-theme',light?'dark':'light');
  $('theme-btn').innerHTML=light?'&#9788;':'&#9790;';
  localStorage.setItem('pb_theme',light?'dark':'light');
}
document.addEventListener('DOMContentLoaded',()=>{
  const t=localStorage.getItem('pb_theme')||'dark';
  $('theme-btn').innerHTML=t==='light'?'&#9790;':'&#9788;';
});

// PARTICLES — loaded externally; see pb-particles.js (script tag in <head>)

// SECTIONS
function switchSection(s){
  curSection=s;
  ['overview','projects','pipeline'].forEach(id=>{
    $('sec-'+id).style.display=id===s?'block':'none';
    $('nav-'+id).classList.toggle('on',id===s);
  });
  if(s==='projects')renderJobs2(curFiltP);
  if(s==='pipeline'){const el=$('pend-list-p');if(el)el.innerHTML=$('pend-list').innerHTML;}
}

// DATA
// shared fetch helper for connect() + syncData()
// Returns raw rows so caller can decide whether to parse+render.
async function fetchSheets(){
  const [r1,r2]=await Promise.all([
    fetch('https://sheets.googleapis.com/v4/spreadsheets/'+SID+'/values/Sheet1!A1:T200?key='+HK),
    fetch('https://sheets.googleapis.com/v4/spreadsheets/'+SID+'/values/MARL%C3%96!A1:Q500?key='+HK)
  ]);
  if(!r1.ok)throw new Error('HTTP '+r1.status);
  const d1=await r1.json(),d2=r2.ok?await r2.json():{values:[]};
  return{jobs:d1.values||[],delivs:d2.values||[]};
}
async function connect(){
  setSync('loading','Syncing...');
  try{
    const {jobs,delivs}=await fetchSheets();
    parseDelivs(delivs);parseJobs(jobs);
    setSync('live','Live');
    const s=$('hero-sub');
    if(s)s.textContent=allJobs.length+' active projects \u00b7 '+new Date().toLocaleDateString('en-US',{month:'long',day:'numeric'});
    lastHash=JSON.stringify({j:jobs,d:delivs});
  }catch(e){
    setSync('err','Error: '+e.message);
    $('proj-list').innerHTML='<div class="err-msg">'+e.message+'</div>';
  }
}
// 30s sync → notify pill with 60s countdown, pause/refresh
let lastHash='',pendData=null,pendTimer=null,pendLeft=0,pendPaused=false;
async function syncData(){
  if(document.querySelector('.due-input'))return;
  if($('slide-panel')?.classList.contains('open'))return;
  try{
    const {jobs,delivs}=await fetchSheets();
    const h=JSON.stringify({j:jobs,d:delivs});
    if(h===lastHash)return;
    pendData={jobs,delivs,hash:h};
    const p=$('upd-pill');
    if(!p.classList.contains('on')){
      pendLeft=60;pendPaused=false;
      $('upd-pause').textContent='Pause';
      p.classList.add('on');updTick();pendTimer=setInterval(updTick,1000);
    }
  }catch(e){}
}
function updTick(){
  if(pendPaused){$('upd-cd').textContent='paused';return;}
  $('upd-cd').textContent='0:'+String(pendLeft).padStart(2,'0');
  if(pendLeft<=0)return updRefresh();
  pendLeft--;
}
function updPause(){
  pendPaused=!pendPaused;
  $('upd-pause').textContent=pendPaused?'Resume':'Pause';
  updTick();
}
function updRefresh(){
  if(!pendData)return;
  clearInterval(pendTimer);pendTimer=null;
  $('upd-pill').classList.remove('on');
  lastHash=pendData.hash;
  parseDelivs(pendData.delivs);parseJobs(pendData.jobs);
  pendData=null;pendPaused=false;
}
setInterval(syncData,30000);
function setSync(s,l){
  $('ldot').className='ldot'+(s==='live'?' ':s==='err'?' err':' loading');
  $('slbl').textContent=l;
}
function parseDelivs(rows){
  allDelivs={};if(!rows.length)return;
  const data=rows[0]&&rows[0][5]&&rows[0][5].toString().toLowerCase()==='deliverable'?rows.slice(1):rows;
  data.forEach(r=>{
    const t=i=>(r[i]||'').toString().trim();
    const g=t(3).toLowerCase();if(!g)return;
    if(!allDelivs[g])allDelivs[g]=[];
    allDelivs[g].push({id:t(0),name:t(5),status:t(7),due:t(8),link:t(10),visible:t(12).toUpperCase()==='TRUE'});
  });
}
function parseJobs(rows){
  const grouped={},order=[];
  rows.forEach(row=>{
    const g=(row[C.D]||'').toString().trim().toLowerCase();
    if(!g||g==='group tag'||g==='group')return;
    if(!grouped[g]){grouped[g]=[];order.push(g);}
    grouped[g].push(row);
  });
  const arch=JSON.parse(localStorage.getItem('pb_arch')||'[]');
  allJobs=order.filter(g=>g!=='pending'&&!arch.includes(g)).map(k=>bJ(k,grouped[k]));
  archivedItems=arch.filter(g=>grouped[g]).map(k=>bJ(k,grouped[k]));
  const parch=JSON.parse(localStorage.getItem('pb_parch')||'[]');
  pendingItems=(grouped['pending']||[]).map(r=>({name:(r[C.K]||r[C.B]||'').toString().trim(),note:(r[C.N]||'').toString().trim(),hold:(r[C.N]||'').toString().toLowerCase().includes("don't bill")})).filter(p=>p.name&&!parch.includes(p.name));
  updateMetrics();renderJobs(curFilt);renderPending();renderArchive();
  if(curSection==='projects')renderJobs2(curFiltP);
}
function bJ(key,gRows){
  const invoices={};
  let total=0,po='',delivery='',notes='',contractor='',sow='',sowLink='',name='',type='',cStatus='',cMsg='',iStatus='',paidDate='',clientVis=true;
  gRows.forEach(r=>{
    const t=c=>(r[C[c]]||'').toString().trim();
    const inv=t('H'),amt=pa(r[C.J]);
    if(inv&&!invoices[inv])invoices[inv]={num:inv,date:t('I'),amount:0};
    if(inv)invoices[inv].amount+=amt;if(amt>0)total+=amt;
    po=po||t('G');sow=sow||t('E');sowLink=sowLink||t('F');delivery=delivery||t('L');contractor=contractor||t('O');type=type||t('C');cStatus=cStatus||t('Q');cMsg=cMsg||t('R');iStatus=iStatus||t('P');paidDate=paidDate||t('S');
    const nn=t('N');if(!notes&&nn&&!nn.toLowerCase().includes('net '))notes=nn;
    const bb=t('B');if(!name&&bb&&!bb.startsWith('http'))name=bb;
    if(t('T').toUpperCase()==='FALSE')clientVis=false;
  });
  const deliverables=gRows.map(r=>(r[C.K]||'').toString().trim()).filter(d=>d&&!d.startsWith('http'));
  const flag=notes&&notes.toLowerCase().includes('po')&&(notes.toLowerCase().includes('gap')||notes.toLowerCase().includes('was'))?notes:'';
  const effectiveStatus=iStatus==='paid'?'paid':iStatus;
  const invList=Object.values(invoices);
  const firstInv=invList.find(i=>i.date)?.date||null;
  const expectedPayment=firstInv&&effectiveStatus!=='paid'?ad(new Date(firstInv),15):null;
  const pct=effectiveStatus==='paid'?100:cStatus==='production'?55:35;
  return{key,name:name||key,type,sow,sowLink,po,delivery,notes,contractor,total,clientStatus:cStatus,clientMsg:cMsg,invoiceStatus:iStatus,effectiveStatus,paidDate,invoices:invList,deliverables,flag,clientVis,expectedPayment,pct};
}
function updateMetrics(){
  const total=allJobs.reduce((s,p)=>s+p.total,0);
  const collected=allJobs.filter(p=>p.effectiveStatus==='paid').reduce((s,p)=>s+p.total,0);
  const out=allJobs.filter(p=>p.effectiveStatus!=='paid'&&p.invoiceStatus==='invoiced').reduce((s,p)=>s+p.total,0);
  $('m-active').textContent=allJobs.length;
  $('m-total').textContent=fa(total);
  $('m-coll-sub').textContent=fa(collected)+' collected';
  $('m-out').textContent=fa(out);
  const flags=allJobs.filter(p=>p.flag).length;
  $('m-flags').textContent=flags||'0';
  $('m-flags-sub').textContent=flags?'Needs attention':'All clear';
  $('m-hidden').textContent=allJobs.filter(p=>!p.clientVis).length||'0';
}
function dueBadge(p){
  const d=p.delivery,k=p.key;
  if(!d)return '<button class="due-badge" data-key="'+k+'" data-cur="" onclick="editDue(event)">+ Due date</button>';
  const dt=new Date(d),ov=dt<new Date()&&p.effectiveStatus!=='paid';
  return '<button class="due-badge'+(ov?' ov':'')+'" data-key="'+k+'" data-cur="'+d+'" onclick="editDue(event)">'+(ov?'\u26a0 ':'')+dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+'</button>';
}
function editDue(e){
  e.stopPropagation();
  const btn=e.currentTarget,key=btn.dataset.key,cur=btn.dataset.cur;
  const inp=document.createElement('input');
  inp.type='date';inp.className='due-input';
  inp.value=cur?new Date(cur).toISOString().split('T')[0]:'';
  btn.replaceWith(inp);inp.focus();inp.showPicker?.();
  const restore=(v)=>{
    const job=allJobs.find(j=>j.key===key);if(job)job.delivery=v||null;
    const nb=document.createElement('span');nb.innerHTML=dueBadge(job);
    inp.replaceWith(nb.firstChild);
  };
  inp.addEventListener('change',()=>{
    restore(inp.value);
    if(inp.value){fetch(SU,{method:'POST',body:JSON.stringify({action:'job',isEdit:true,editGroup:key,delivery:inp.value})}).catch(()=>{});setTimeout(syncData,5000);}
  });
  inp.addEventListener('blur',()=>{if(document.body.contains(inp))restore(cur);});
}
function dDue(due,id){
  if(!due)return '<button class="dd-btn" data-id="'+id+'" onclick="editDDue(event)">+ date</button>';
  const dt=new Date(due),ov=dt<new Date();
  return '<button class="dd-btn on'+(ov?' ov':'')+'" data-id="'+id+'" data-cur="'+due+'" onclick="editDDue(event)">'+dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</button>';
}
function dItem(d){
  const nm=d.link?'<a class="ditem-name lnk" href="'+d.link+'" target="_blank" rel="noopener">'+d.name+'</a>':'<span class="ditem-name">'+d.name+'</span>';
  return '<div class="ditem">'+nm+
    '<button class="dl-btn'+(d.link?' on':'')+'" data-id="'+d.id+'" onclick="editDLink(event)" title="'+(d.link?'Edit link':'Add link')+'">'+(d.link?'\u2197':'+')+'</button>'+
    dDue(d.due,d.id)+dSt(d.status,d.id)+
    '<button class="ditem-eye'+(d.visible?'':' off')+'" onclick="tDV(event,\''+d.id+'\','+d.visible+')"></button>'+
  '</div>';
}
function editDDue(e){
  e.stopPropagation();
  const btn=e.currentTarget,id=btn.dataset.id,cur=btn.dataset.cur||'';
  const inp=document.createElement('input');
  inp.type='date';inp.className='due-input';
  if(cur)inp.value=new Date(cur).toISOString().split('T')[0];
  btn.replaceWith(inp);inp.focus();inp.showPicker?.();
  const restore=v=>{
    Object.values(allDelivs).forEach(a=>a.forEach(d=>{if(d.id===id)d.due=v||'';}));
    const nb=document.createElement('span');nb.innerHTML=dDue(v,id);
    inp.replaceWith(nb.firstChild);
  };
  inp.addEventListener('change',()=>{
    restore(inp.value);
    fetch(SU,{method:'POST',body:JSON.stringify({action:'delivDue',id:id,due:inp.value})}).catch(()=>{});
    setTimeout(syncData,5000);
  });
  inp.addEventListener('blur',()=>{if(document.body.contains(inp))restore(cur);});
}
function editDLink(e){
  e.stopPropagation();
  const id=e.currentTarget.dataset.id;
  let cur='';
  Object.values(allDelivs).forEach(a=>a.forEach(d=>{if(d.id===id)cur=d.link||'';}));
  const v=prompt('Link for this deliverable (leave empty to remove):',cur);
  if(v===null)return;
  const lk=v.trim();
  Object.values(allDelivs).forEach(a=>a.forEach(d=>{if(d.id===id)d.link=lk;}));
  document.querySelectorAll('.dl-btn[data-id="'+id+'"]').forEach(b=>{
    const row=b.closest('.ditem'),d={};
    Object.values(allDelivs).forEach(a=>a.forEach(x=>{if(x.id===id)Object.assign(d,x);}));
    row.outerHTML=dItem(d);
  });
  fetch(SU,{method:'POST',body:JSON.stringify({action:'delivLink',id:id,link:lk})}).catch(()=>{});
  setTimeout(syncData,5000);
}
function addDeliv(key){
  const dl=$('dl-'+key);if(!dl||dl.querySelector('.deliv-new'))return;
  const r=document.createElement('div');r.className='ditem deliv-new';
  r.innerHTML='<input placeholder="Deliverable name, Enter to save"/>';
  dl.insertBefore(r,dl.querySelector('.add-deliv'));
  const i=r.querySelector('input');i.focus();
  const save=async()=>{
    const n=i.value.trim();if(!n)return r.remove();
    i.disabled=true;
    try{
      const res=await fetch(SU,{method:'POST',body:JSON.stringify({action:'delivAdd',group:key,name:n})});
      const j=await res.json();
      if(j.success&&j.id){
        (allDelivs[key]=allDelivs[key]||[]).push({id:j.id,name:n,status:'Not Started',due:'',link:'',visible:true});
        renderJobs(curFilt);if(curSection==='projects')renderJobs2(curFiltP);
      }else r.remove();
    }catch(e){r.remove();}
    setTimeout(syncData,5000);
  };
  i.addEventListener('keydown',e=>{if(e.key==='Enter')save();else if(e.key==='Escape')r.remove();});
  i.addEventListener('blur',()=>setTimeout(()=>{if(document.body.contains(i)&&!i.value.trim())r.remove();},200));
}
function nextDue(delivs){
  const n=delivs.filter(d=>{const s=(d.status||'').toLowerCase();return d.due&&s!=='delivered'&&s!=='not started';}).sort((a,b)=>new Date(a.due)-new Date(b.due))[0];
  return n?'<div class="next-due">Next: '+new Date(n.due).toLocaleDateString('en-US',{month:'short',day:'numeric'})+' — '+n.name+'</div>':'';
}
function jcHTML(p,idx){
  const invTotal=p.invoices.reduce((s,i)=>s+i.amount,0)||p.total;
  const dot=TC[idx%5];
  const barCol=p.effectiveStatus==='paid'?'var(--green)':p.clientStatus==='action'?'var(--red)':'var(--purple)';
  const stag=p.effectiveStatus==='paid'?'<span class="jtag t-paid">Paid</span>':'<span class="jtag t-inv">Invoiced</span>';
  const delivs=allDelivs[p.key]||[];
  const dHTML=(delivs.length?delivs.map(dItem).join(''):p.deliverables.map(d=>'<div class="ditem"><span class="ditem-name">'+d+'</span></div>').join(''))+'<button class="add-deliv" onclick="addDeliv(\''+p.key+'\')">+ Add deliverable</button>';
  const dc=delivs.length||p.deliverables.length;
  return '<div class="jcard" id="pcard-'+p.key+'" style="animation-delay:'+idx*.07+'s"><style>#pcard-'+p.key+'::before{background:'+dot+'}</style>'+
    '<div class="jcard-top">'+
      '<div class="jcard-type">'+p.type+'</div>'+
      '<div class="jcard-name" onclick="location.href=\'/pb-deliverables?filter='+p.key+'\'">'+p.name+'</div>'+
      '<div class="jcard-tags">'+stag+'<span class="jtag t-net">NET 15</span>'+(p.sow?'<span class="jtag t-sow">'+p.sow+'</span>':'')+(p.flag?'<span class="jtag t-flag">FLAG</span>':'')+(!p.clientVis?'<span class="jtag t-hid">HIDDEN</span>':'')+'</div>'+
      nextDue(delivs)+
      '<div class="jcard-right">'+
        '<div style="display:flex;gap:5px;margin-bottom:6px">'+
          '<button class="eye-btn'+(p.clientVis?'':' hid')+'" onclick="tJV(\''+p.key+'\','+p.clientVis+')" title="Toggle client visibility"></button>'+
          '<button class="act" onclick="openPanel(\''+p.key+'\')">Edit</button>'+
          '<button class="act danger" onclick="sd(\''+p.key+'\',\''+p.name.replace(/'/g,"\\'")+'\')">&#215;</button>'+
        '</div>'+
        '<div style="font-size:9px;color:var(--text2);margin-bottom:2px">Invoiced</div>'+
        '<div class="jamt">'+fa(invTotal)+'</div>'+
        '<div class="'+(p.effectiveStatus==='paid'?'jcoll':'jcoll n')+'">'+(p.effectiveStatus==='paid'?fa(invTotal)+' collected':'Outstanding')+'</div>'+
        (p.expectedPayment?'<div class="exp-pay">Pay by '+fd(p.expectedPayment)+'</div>':'')+
      '</div>'+
    '</div>'+
    '<div class="jcard-body">'+
      (dc?'<div class="dtoggle" onclick="td(\''+p.key+'\')"><span class="darrow" id="da-'+p.key+'">&#9658;</span> '+dc+' deliverables</div><div class="dlist" id="dl-'+p.key+'">'+dHTML+'</div>':'<div class="dlist open" id="dl-'+p.key+'">'+dHTML+'</div>')+
    '</div>'+
    '<div class="jcard-prog"><div class="prog-bar"><div class="prog-fill" style="width:'+p.pct+'%;background:'+barCol+'"></div></div><div class="prog-pct">'+p.pct+'%</div>'+dueBadge(p)+(p.sowLink?'<a class="act hi" href="'+p.sowLink+'" target="_blank">SOW &#8599;</a>':'')+'</div>'+
  '</div>';
}
function applyFilter(data,f){if(f==='flag')return data.filter(p=>p.flag);if(f==='invoiced')return data.filter(p=>p.invoiceStatus==='invoiced'&&p.effectiveStatus!=='paid');if(f==='paid')return data.filter(p=>p.effectiveStatus==='paid');return data;}
function renderJobs(f){curFilt=f;const d=applyFilter(allJobs,f);$('proj-list').innerHTML=d.length?d.map((p,i)=>jcHTML(p,i)).join(''):'<div class="loading-msg">No projects match.</div>';}
function renderJobs2(f){curFiltP=f;const el=$('proj-list-p');if(!el)return;const d=applyFilter(allJobs,f);el.innerHTML=d.length?d.map((p,i)=>jcHTML(p,i)).join(''):'<div class="loading-msg">No match.</div>';}
function filtJobs(f,btn){document.querySelectorAll('#sec-overview .ftab').forEach(b=>b.classList.remove('on'));btn.classList.add('on');renderJobs(f);}
function filtJobsP(f,btn){document.querySelectorAll('#sec-projects .ftab').forEach(b=>b.classList.remove('on'));btn.classList.add('on');renderJobs2(f);}
function td(key){const a=$('da-'+key),l=$('dl-'+key);const o=l.classList.contains('open');l.classList.toggle('open',!o);a.classList.toggle('open',!o);}
function tDV(e,id,cur){
  e.stopPropagation();const nv=!cur;
  Object.values(allDelivs).forEach(a=>a.forEach(d=>{if(d.id===id)d.visible=nv;}));
  const btn=e.currentTarget;btn.classList.toggle('off',!nv);
  btn.setAttribute('onclick','tDV(event,\''+id+'\','+nv+')');
  fetch(SU,{method:'POST',body:JSON.stringify({action:'dv',id:id,visible:nv})}).catch(()=>{});setTimeout(syncData,5000);
}
async function tJV(key,cur){
  const nv=!cur;const job=allJobs.find(j=>j.key===key);if(!job)return;
  job.clientVis=nv;
  const card=$('pcard-'+key);
  if(card){
    const eb=card.querySelector('.eye-btn');
    if(eb){eb.classList.toggle('hid',!nv);eb.setAttribute('onclick','tJV(\''+key+'\','+nv+')');}
    const tags=card.querySelector('.jcard-tags');
    if(tags){const ht=tags.querySelector('.t-hid');
      if(!nv&&!ht)tags.insertAdjacentHTML('beforeend','<span class="jtag t-hid">HIDDEN</span>');
      else if(nv&&ht)ht.remove();}
  }
  updateMetrics();
  try{await fetch(SU,{method:'POST',body:JSON.stringify({action:'job_visibility',group:key,visible:nv})});await fetch(SU,{method:'POST',body:JSON.stringify({action:'bulk_visibility',group:key,visible:nv})});setTimeout(syncData,5000);}catch(e){}
}
function renderPending(){
  const h=pendingItems.map((p,i)=>'<div class="pcard"><div><div class="pcard-name">'+p.name+'</div><div class="pcard-note">'+p.note+'</div></div><div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px"><span class="ptag '+(p.hold?'ptag-hold':'ptag-pend')+'">'+(p.hold?'HOLD':'PENDING')+'</span><button class="act danger" onclick="archivePending('+i+')">&#215;</button></div></div>').join('');
  $('pend-list').innerHTML=h||'<div class="loading-msg" style="padding:10px 0">No pipeline items</div>';
}
function archivePending(idx){const a=JSON.parse(localStorage.getItem('pb_parch')||'[]');if(pendingItems[idx])a.push(pendingItems[idx].name);localStorage.setItem('pb_parch',JSON.stringify(a));connect();}
let archVisible=false;
function renderArchive(){$('arch-lbl').textContent=' Show Archived ('+archivedItems.length+')';}
function toggleArchive(){archVisible=!archVisible;const al=$('archive-list');al.style.display=archVisible?'block':'none';$('arch-arrow').innerHTML=archVisible?'&#9660;':'&#9658;';$('arch-lbl').textContent=(archVisible?' Hide':' Show')+' Archived ('+archivedItems.length+')';al.innerHTML=archivedItems.map(p=>'<div class="arch-card"><div><b style="font-size:12px">'+p.name+'</b><div style="font-size:10px;color:var(--text2)">'+fa(p.total)+' / '+p.type+'</div></div><button class="arch-restore" onclick="rJ(\''+p.key+'\')">Restore</button></div>').join('');}
function sd(key,name){deleteTarget=key;$('del-msg').textContent='"'+name+'" will be moved to archive.';$('del-modal').classList.add('show');}
function confirmDelete(){if(!deleteTarget)return;const a=JSON.parse(localStorage.getItem('pb_arch')||'[]');if(!a.includes(deleteTarget))a.push(deleteTarget);localStorage.setItem('pb_arch',JSON.stringify(a));closeModal();connect();}
function rJ(key){const a=JSON.parse(localStorage.getItem('pb_arch')||'[]');localStorage.setItem('pb_arch',JSON.stringify(a.filter(k=>k!==key)));connect();}
function closeModal(){deleteTarget=null;$('del-modal').classList.remove('show');}
$('del-modal').addEventListener('click',function(e){if(e.target===this)closeModal();});
function openPanel(key){
  editMode=!!key;editKey=key;clearPanel();
  const t=$('panel-title'),b=$('psbtn');
  if(editMode){
    const p=allJobs.find(x=>x.key===key);if(!p)return;
    t.innerHTML='Edit <span>Job</span>';b.textContent='Save Changes';
    const n=p.name.includes(' - ')?p.name.split(' - '):['',p.name];
    [['f-client',n[0]||''],['f-name',n[1]||p.name],['f-type',p.type],['f-group',p.key],['f-sow',p.sow],['f-po',p.po],['f-sowlink',p.sowLink],['f-amount',p.total?'$'+p.total.toLocaleString():''],['f-delivery',p.delivery],['f-contractor',p.contractor],['f-notes',p.notes],['f-status',p.invoiceStatus||''],['f-paiddate',p.paidDate||''],['f-cstatus',p.clientStatus||''],['f-cmsg',p.clientMsg]].forEach(([id,v])=>sv(id,v));
    tPD(p.invoiceStatus||'');
    if(p.invoices.length){sv('f-invnum',p.invoices[0].num);sv('f-invdate',p.invoices[0].date);}
    if(p.deliverables.length)sv('f-desc',p.deliverables.join(', '));
  }else{t.innerHTML='Add <span>New Job</span>';b.textContent='+ Save';}
  $('panel-overlay').classList.add('show');
  $('slide-panel').classList.add('open');
}
function closePanel(){$('panel-overlay').classList.remove('show');$('slide-panel').classList.remove('open');$('pmsg').className='pmsg';$('pb-ov').style.display='none';}
function sv(id,v){const el=$(id);if(el&&v!=null)el.value=v;}
function gv(id){return($(id)||{}).value?.trim()||'';}
function tPD(v){$('pd-row').style.display=(v==='paid'||v==='partial')?'block':'none';}
function clearPanel(){$('slide-panel').querySelectorAll('input,select,textarea').forEach(el=>{if(el.tagName==='SELECT')el.selectedIndex=0;else el.value='';});$('pmsg').className='pmsg';}
function msg(t,m){const el=$('pmsg');el.className='pmsg '+t;el.textContent=m;}
async function submitJob(){
  const req={client:gv('f-client'),name:gv('f-name'),type:gv('f-type'),group:gv('f-group'),amount:gv('f-amount')};
  for(const[k,v]of Object.entries(req)){if(!v){msg('err','Required: '+k);return;}}
  const btn=$('psbtn');
  btn.disabled=true;btn.innerHTML='<span class="spin"></span>Saving...';
  $('pb-ov').style.display='block';msg('load','Writing to sheet...');
  const payload={action:'job',clientName:gv('f-client'),jobName:gv('f-client')+' - '+gv('f-name'),projectType:gv('f-type'),group:gv('f-group'),approvedSow:gv('f-sow'),sowLink:gv('f-sowlink'),po:gv('f-po'),invoiceNum:gv('f-invnum'),invoiceDate:gv('f-invdate'),amount:gv('f-amount'),delivery:gv('f-delivery'),paymentInfo:gv('f-payment'),notes:gv('f-notes'),contractor:gv('f-contractor'),status:gv('f-status'),paidDate:gv('f-paiddate'),clientStatus:gv('f-cstatus'),clientMsg:gv('f-cmsg'),deliverable:gv('f-desc'),isEdit:editMode,editGroup:editKey||''};
  try{
    const res=await fetch(SU,{method:'POST',body:JSON.stringify(payload)});
    const data=await res.json();
    if(data.success){msg('ok','Saved');setTimeout(()=>{closePanel();connect();},700);}
    else throw new Error(data.error||'Unknown');
  }catch(e){msg('err','Error: '+e.message);}
  finally{btn.disabled=false;btn.textContent=editMode?'Save Changes':'+ Save';$('pb-ov').style.display='none';}
}
document.addEventListener('DOMContentLoaded',connect);
