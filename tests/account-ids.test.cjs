const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../crm.html','utf8');
// Extract actual production functions, including templates and nested braces.
function source(name) {
  const start=html.search(new RegExp('(?:async )?function '+name+'\\('));
  assert.ok(start>=0,name);
  for(let end=html.indexOf('}',start);end>=0;end=html.indexOf('}',end+1)) {
    const code=html.slice(start,end+1);
    try { new vm.Script('('+code+')'); return code; } catch {}
  }
  throw Error('Cannot parse '+name);
}
const clone=x=>JSON.parse(JSON.stringify(x));
function harness(opts={}) {
  const sheets={Tilit:clone(opts.rows||[['id'],['ID20260517','Project','','','Existing']]),
    'CRM-tila':clone(opts.crm||[['spara_id']]), 'Yhteyshenkilöt':clone(opts.contacts||[['id','tili_id']])};
  if(opts.history) sheets['Tili-ID-historia']=clone(opts.history);
  const events=[],toasts=[],fields={};
  const get=id=>fields[id]??=({value:'',textContent:'Save',disabled:false,style:{},classList:{contains:()=>false,add(){},remove(){}}});
  get('tf_name').value='Manual'; get('gc-nt-nimi').value='Contact company';
  const c={console,Date,URL,setTimeout,allProspects:clone(opts.cached||[]),allContacts:[],
    currentUser:{nimi:'Tester'}, currentUserEmail:'test@example.test',
    MAIN_TAB:'Tilit',CRM_TAB:'CRM-tila',YH_TAB:'Yhteyshenkilöt',YH_VERIFY_TAB:'Yhteyshenkilövarmennus',
    document:{getElementById:get},confirm:()=>true,showToast:(...x)=>toasts.push(x),
    IMPORT_MAX_TEXT_LENGTH:500000,IMPORT_MAX_CANDIDATES:50,PROSPECTING_CHUNK_SIZE:5,
    chatGptImportFileText:'',chatGptImportFileName:'',chatGptImportCancelled:false,chatGptImportInProgress:false,
    renderChatGptImportProgress:()=>{},renderChatGptImportSummary:()=>{},fuzzyMatchExisting:()=>null,
    baseProjektiNimi:()=> 'Project',findExistingAccountByBusinessId:()=>null, normalizeBusinessId:x=>x,
    parseProspects:rows=>rows.slice(1).filter(r=>r[0]).map((r,i)=>({spara_id:r[0],yritys_nimi:r[4],y_tunnus:r[8],_isTili:true,_rowIndex:i+2})),
    apiGet:async()=>({sheets:Object.keys(sheets).map(title=>({properties:{title}}))}),
    addSheet:async(title,cols)=>{events.push(['addSheet',title]);sheets[title]=[cols];},
    sheetGet:async range=>{
      events.push(['get',range]);
      if(opts.failRead&&range===opts.failRead) throw Error('Read failed');
      const [tab,cols]=range.split('!'), rows=sheets[tab]||[];
      if(cols==='A:A')return rows.map(r=>r[0]===undefined?[]:[r[0]]);
      if(cols==='B:B')return rows.map(r=>r[1]===undefined?[]:[r[1]]);
      return clone(rows);
    },
    sheetPut:async(range,rows)=>{
      events.push(['put',range,clone(rows)]);
      if(opts.failPut&&range.startsWith(opts.failPut))throw Error('Write failed');
      const [tab,area]=range.split('!'), start=Number(area.match(/^A(\d+)/)[1])-1;
      sheets[tab]??=[]; rows.forEach((r,i)=>sheets[tab][start+i]=clone(r));
    },
    sheetAppend:async(range,rows)=>{events.push(['append',range,clone(rows)]);const tab=range.split('!')[0];(sheets[tab]??=[]).push(...clone(rows));},
    saveCrmState:async p=>{if(opts.failCrm)throw Error('CRM failed');sheets['CRM-tila'].push([p.spara_id]);},
  };
  for(const name of ['closeAddTili','openModal','closeModal','buildSegmentFilter','updateSummary','applyFilters','renderDashboard','renderKanban','applyYhFilters','applyCrmState'])c[name]=()=>{};
  vm.createContext(c);
  const helper=html.slice(html.indexOf('let tiliCreationQueue ='),html.indexOf('async function createProspectAccountsBatch('));
  vm.runInContext(helper,c);
  for(const name of ['blankCrm','createProspectAccountsBatch','createProspectAccountsBatchImpl','saveNewTili','saveNewTiliImpl',
    'createTiliFromContactForm','createTiliFromContactFormImpl','confirmDeleteTili','confirmDeleteTiliImpl',
    'manualImportForm','isSourcedAssociationCandidate','verifyAndCreateCandidatesChunk',
    'parseProspectCandidatesJson','normalizeImportCandidate','parseAndNormalizeImportText',
    'handleChatGptImportFile','routeImportCandidates','runChatGptImportBatch','openAddTiliWithImportPrefill'])vm.runInContext(source(name),c);
  c.checkDuplicateAccount=()=>null;
  return {c,sheets,events,toasts,get,opts};
}
const options={kampanja:'Project',wantContact:false,wantDeal:false,wantSignal:false,wantDraft:false};
const candidate=name=>({tf_name:name,tf_ytunnus:''});
const accountWrites=h=>h.events.filter(e=>e[0]==='put'&&e[1].startsWith('Tilit!'));

test('all inline CRM scripts parse',()=>{
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
  assert.ok(scripts.length);for(const code of scripts)new vm.Script(code);
});
for(const path of ['manual','batch','contact'])test(path+' reads fresh A and ignores stale browser IDs and seven repair IDs',async()=>{
  const rows=[['id'],['ID20260517','P','','','Old'],[],['ID20260520','P','','','Fresh'],
    ...Array.from({length:7},(_,i)=>['ID'+(20269901+i),'P','','','Repair'])];
  const h=harness({rows,cached:[{spara_id:'ID99999999'}]});
  if(path==='manual')await h.c.saveNewTili();
  if(path==='batch')await h.c.createProspectAccountsBatch([candidate('Batch')],options);
  if(path==='contact')await h.c.createTiliFromContactForm('Person');
  assert.equal(accountWrites(h).length,1,JSON.stringify(h.toasts));
  assert.equal(accountWrites(h)[0][2][0][0],'ID20260521');
  assert.equal(accountWrites(h)[0][1],`Tilit!A${rows.length+1}:AB${rows.length+1}`);
  const read=h.events.findIndex(e=>e[0]==='get'&&e[1]==='Tilit!A:A');
  const history=h.events.findIndex(e=>e[0]==='put'&&e[1].startsWith('Tili-ID-historia!'));
  const write=h.events.findIndex(e=>e[0]==='put'&&e[1].startsWith('Tilit!'));
  assert.ok(read>=0&&read<history&&history<write);
});
test('batch gets sequential unique IDs and contact references match',async()=>{
  const h=harness();const candidates=['A','B','C'].map(name=>({...candidate(name),contactSuggestion:{nimi:name}}));
  const ids=await h.c.createProspectAccountsBatch(candidates,{...options,wantContact:true});
  assert.deepEqual(clone(ids),['ID20260518','ID20260519','ID20260520']);
  assert.deepEqual(h.sheets['Yhteyshenkilöt'].slice(1).map(r=>r[1]),clone(ids));
  assert.deepEqual(h.sheets['CRM-tila'].slice(1).map(r=>r[0]),clone(ids));
});
test('history and surviving CRM/contact references protect deleted highest IDs after reload',async()=>{
  const h=harness({history:[['spara_id'],['ID20260525']],crm:[['spara_id'],['ID20260526']],contacts:[['id','tili_id'],['YH1','ID20260527']]});
  await h.c.saveNewTili();assert.equal(accountWrites(h)[0][2][0][0],'ID20260528');
});
test('deleting before first creation preserves existing maximum across reload',async()=>{
  const h=harness({rows:[['id'],['ID20260540','P','','','Delete']],cached:[{spara_id:'ID20260540',yritys_nimi:'Delete',_isTili:true,_rowIndex:2}]});
  await h.c.confirmDeleteTili('ID20260540');
  assert.equal(h.sheets.Tilit[1][0],'');
  const reloaded=harness({rows:h.sheets.Tilit,history:h.sheets['Tili-ID-historia']});
  await reloaded.c.saveNewTili();assert.equal(accountWrites(reloaded)[0][2][0][0],'ID20260541');
});
test('known historical floor and holes are never recycled',async()=>{
  const h=harness({rows:[['id'],['ID20260510','P','','','Low'],[],['T77','Legacy']]});
  await h.c.saveNewTili();assert.equal(accountWrites(h)[0][2][0][0],'ID20260518');
});
test('normal sequence skips repair IDs when eventually reaching them',async()=>{
  const h=harness({history:[['spara_id'],['ID20269900']]});
  const ids=await h.c.createProspectAccountsBatch([candidate('A'),candidate('B')],options);
  assert.deepEqual(clone(ids),['ID20269908','ID20269909']);
});
for(const [name,rows] of [
  ['duplicates',[['id'],['ID20260518','A'],[' id20260518 ','B']]],
  ['missing ID',[['id'],['','Company without ID']]],
  ['invalid ID',[['id'],['IDoops','Company']]],
])test(name+' stops before writes',async()=>{
  const h=harness({rows});await assert.rejects(h.c.createProspectAccountsBatch([candidate('A')],options));
  assert.equal(h.events.some(e=>e[0]==='put'||e[0]==='addSheet'),false);
});
for(const range of ['Tilit!A:A','Tilit!A:AB','CRM-tila!A:A','Yhteyshenkilöt!B:B','Tili-ID-historia!A:A'])test('failed read '+range+' cannot create an account',async()=>{
  const h=harness({history:[['spara_id']],failRead:range});
  await assert.rejects(h.c.createProspectAccountsBatch([candidate('A')],options));assert.equal(accountWrites(h).length,0);
});
test('history failure prevents account write; main-write failure burns the number and queue recovers',async()=>{
  const blocked=harness({failPut:'Tili-ID-historia!'});
  await assert.rejects(blocked.c.createProspectAccountsBatch([candidate('A')],options));assert.equal(accountWrites(blocked).length,0);
  const h=harness({failPut:'Tilit!'});
  await assert.rejects(h.c.createProspectAccountsBatch([candidate('A')],options));
  h.opts.failPut=null;
  await h.c.createProspectAccountsBatch([candidate('B')],options);
  assert.equal(accountWrites(h)[1][2][0][0],'ID20260519');
});
test('same-page overlapping batch and contact saves read and write in order',async()=>{
  const h=harness();
  const [ids,contact]=await Promise.all([h.c.createProspectAccountsBatch([candidate('A'),candidate('B')],options),h.c.createTiliFromContactForm('Person')]);
  assert.deepEqual(clone(ids),['ID20260518','ID20260519']);assert.equal(contact.id,'ID20260520');
  assert.equal(new Set(h.sheets.Tilit.slice(1).map(r=>r[0])).size,4);
});
test('manual double-click creates once, button recovers on validation/read failures',async()=>{
  const h=harness();await Promise.all([h.c.saveNewTili(),h.c.saveNewTili()]);assert.equal(accountWrites(h).length,1);
  h.get('tf_name').value='';await h.c.saveNewTili();assert.equal(h.get('addtili-save-btn').disabled,false);
  h.get('tf_name').value='Retry';h.opts.failRead='Tilit!A:A';await h.c.saveNewTili();assert.equal(h.get('addtili-save-btn').disabled,false);
});
test('ChatGPT import verified chunk reaches shared batch numbering and ignores supplied IDs',async()=>{
  const h=harness();
  const raw=[{name:'JSON Company',spara_id:'ID20269999'},{name:'TXT Company',id:'ID1'}];
  const result=await h.c.verifyAndCreateCandidatesChunk(raw,{...options,skipPrhVerification:true},[],[],null,null,()=>false);
  assert.deepEqual(clone(result).map(p=>p.spara_id),['ID20260518','ID20260519']);
});
test('empty batch does not read or reserve anything',async()=>{
  const h=harness();assert.deepEqual(clone(await h.c.createProspectAccountsBatch([],options)),[]);assert.equal(h.events.length,0);
});
for(const extension of ['json','txt'])test(extension+' file parsing and multi-chunk import allocate only at save',async()=>{
  const h=harness();
  const text=JSON.stringify({candidates:Array.from({length:7},(_,i)=>({name:'Import '+i,id:'ID1',spara_id:'ID20269999'}))});
  await h.c.handleChatGptImportFile({target:{files:[{name:'accounts.'+extension,type:extension==='txt'?'text/plain':'application/json',size:text.length,text:async()=>text}]}});
  assert.equal(h.events.length,0);
  const candidates=h.c.parseAndNormalizeImportText(h.c.chatGptImportFileText);
  assert.ok(candidates.every(c=>!('spara_id' in c)&&!('id' in c)));
  await h.c.runChatGptImportBatch(candidates,{...options,skipPrhVerification:true});
  assert.equal(accountWrites(h).length,2);
  assert.deepEqual(h.sheets.Tilit.slice(1).map(r=>r[0]),Array.from({length:8},(_,i)=>'ID'+(20260517+i)));
});
test('single plain import prefills without reserving an ID; later manual save reads fresh state',async()=>{
  const h=harness();
  h.c.openAddTili=()=>{};h.c.fillTiliForm=values=>{for(const [id,v] of Object.entries(values))h.get(id).value=v||'';};
  h.c.checkAddTiliDuplicates=()=>{};h.c.fetchAndFillYTJ=async()=>{};
  const candidates=h.c.parseAndNormalizeImportText(JSON.stringify({candidates:[{name:'Single',id:'ID1'}]}));
  h.c.routeImportCandidates(candidates,options);assert.equal(h.events.length,0);
  h.sheets.Tilit.push(['ID20260530','P','','','Added after prefill']);
  await h.c.saveNewTili();assert.equal(accountWrites(h)[0][2][0][0],'ID20260531');
});
