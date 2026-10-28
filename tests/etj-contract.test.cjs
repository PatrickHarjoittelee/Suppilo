const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const crmCode = fs.readFileSync(__dirname+'/../etj-contract.js','utf8');
const path = require('node:path');
const etjDir = process.env.ETJ_DASHBOARD_DIR || path.resolve(__dirname, '../../ETJ/dashboard');
const etjCode = fs.readFileSync(path.join(etjDir, 'suppilo-order.js'),'utf8');
const html = fs.readFileSync(path.join(etjDir, 'etj-plus.html'),'utf8');
const ETJ='https://etj.sparaenergia.com', CRM='https://patrickharjoittelee.github.io';
function sourceFunction(name) {
  const start=html.search(new RegExp('(?:async )?function '+name+'\\('));
  assert.ok(start>=0, name);
  const tail=html.slice(start), next=tail.slice(1).search(/\n(?:async )?function \w+\(/);
  return next<0?tail:tail.slice(0,next+1);
}
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
function harness(opts={}) {
  const crm=new JSDOM('<!doctype html><body></body>',{url:CRM+'/Suppilo/crm.html',runScripts:'outside-only'});
  const etj=new JSDOM('<!doctype html><body><div id="order-link-modal"><div id="order-link-modal-body"></div></div></body>',{url:ETJ+'/etj-plus.html',runScripts:'outside-only'});
  const c=crm.window,e=etj.window, calls=[],saved=[],toasts=[];
  for(const w of [c,e]){w.setInterval=()=>1;w.clearInterval=()=>{};w.focus=()=>{};}
  c.allProspects=[{spara_id:'ID1',yritys_nimi:'Testiyhtiö Oy',y_tunnus:'1234567-8',kaupunki:'Oulu','yhteyshenkilö':'Vanha henkilö',henk_sahkoposti:'old@example.test',suora_numero:'OLD',titteli:'Vanha',aktiviteetit:'[]'}];
  c.allContacts=[{id:'C1',tili_id:'ID1',nimi:'Valittu Henkilö',sahkoposti:'chosen@example.test',puhelin:'+358 40 123',titteli:'Johtaja'},{id:'C2',tili_id:'ID1',nimi:'Toinen',sahkoposti:'second@example.test'}];
  c.currentYhId='C1';c.currentId='ID1';c.currentUser={nimi:'Testimyyjä'};c.currentUserEmail='staff@example.test';
  c.parseActs=p=>JSON.parse(p.aktiviteetit||'[]');c.showToast=(...x)=>toasts.push(x);c.renderActivities=()=>{};
  c.saveCrmState=async p=>{saved.push(p.aktiviteetit);if(opts.failSave&&saved.length===1)throw Error('Tilapäinen tallennusvirhe');};
  e.DEMO_MODE=false;e.currentProfile={role:opts.role||'spara_admin'};e.showToast=(...x)=>toasts.push(x);
  e.escHtml=s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  e.olPrhWire=()=>{};
  e.etjApi={post:async(path,payload)=>{calls.push({path,payload});return {lead_code:'ABC123',order_url:ETJ+'/etj-tilaussopimus.html?koodi=ABC123',email_sent:!opts.failEmail};}};
  for(const name of ['openOrderLinkModal','closeOrderLinkModal','olToggleSvcQty','sendOrderLink','renderOrderLinkResult'])e.eval(sourceFunction(name));
  c.postMessage=data=>queueMicrotask(()=>c.dispatchEvent(new c.MessageEvent('message',{origin:ETJ,source:e,data})));
  e.postMessage=data=>queueMicrotask(()=>e.dispatchEvent(new e.MessageEvent('message',{origin:CRM,source:c,data})));
  e.opener=c;
  c.open=url=>{
    if(opts.blockPopup)return null;
    e.history.replaceState(null,'',url); e.eval(etjCode); if(!opts.delayAuth)e.etjSuppiloOrder.ready(); return e;
  };
  c.eval(crmCode);
  const g=id=>c.document.getElementById('ec-'+id), ol=id=>e.document.getElementById('ol-'+id);
  const start=async()=>{g('form').dispatchEvent(new c.Event('submit',{cancelable:true}));await flush();};
  return {c,e,g,ol,start,calls,saved,toasts,close:()=>{c.close();e.close();}};
}

test('selected contact and all services transfer; explicit send creates link and history',async()=>{
  const h=harness();try {
    h.c.openEtjContractForContact();assert.equal(h.g('contact_email').value,'chosen@example.test');
    for(const id of ['katselmus_selected','kohde_selected']){h.g(id).checked=true;h.g(id).onchange();}
    h.g('kohde_m2').value='20000';h.g('etjplus_qty').value='3';h.g('notes').value='35% alennus, yhteistyö äö';
    await h.start();assert.equal(h.calls.length,0);assert.equal(h.ol('email').value,'chosen@example.test');
    assert.equal(h.ol('svc-kohde-m2').value,'20000');assert.equal(h.ol('svc-etjplus-qty').value,'3');assert.equal(h.ol('notes').value,'35% alennus, yhteistyö äö');
    assert.equal(h.e.location.search,'');assert.equal(h.e.location.hash,'');
    await h.e.sendOrderLink();await flush();
    assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/leads/send-link');assert.equal(h.saved.length,1);
    const acts=h.c.parseActs(h.c.allProspects[0]);assert.equal(acts.length,1);assert.match(acts[0].teksti,/chosen@example.test/);assert.match(acts[0].teksti,/lähetetty/);
    assert.match(h.e.document.getElementById('suppilo-order-status').textContent,/tallennettu Suppilon/);
  }finally{h.close();}
});
test('missing selected contact details never borrow old contact details',()=>{
  const h=harness();try{h.c.openEtjContract('ID1','C2');assert.equal(h.g('contact_name').value,'Toinen');assert.equal(h.g('contact_phone').value,'');assert.equal(h.g('contact_title').value,'');}finally{h.close();}
});
test('failed email and history retry preserve result without resending',async()=>{
  const h=harness({failEmail:true,failSave:true});try {
    h.c.openEtjContract('ID1','C1');await h.start();await h.e.sendOrderLink();await flush();
    assert.equal(h.calls.length,1);assert.equal(h.saved.length,1);assert.equal(h.g('retry-save').hidden,false);assert.match(h.g('status').textContent,/sähköposti ei lähtenyt/);
    await h.g('retry-save').onclick();await flush();assert.equal(h.saved.length,2);assert.equal(h.calls.length,1);assert.equal(h.c.parseActs(h.c.allProspects[0]).length,1);assert.equal(h.g('retry-save').hidden,true);
  }finally{h.close();}
});
test('untrusted origins, windows and forged links cannot write CRM history',async()=>{
  const h=harness();try {
    h.c.openEtjContract('ID1','C1');await h.start();const id=h.e.document.getElementById('order-link-modal').getAttribute('data-suppilo-request');
    const result={lead_code:'ABC123',order_url:ETJ+'/etj-tilaussopimus.html?koodi=ABC123',email_sent:true,contact_email:'chosen@example.test'};
    const send=(origin,source,r)=>h.c.dispatchEvent(new h.c.MessageEvent('message',{origin,source,data:{type:'etj:suppilo-result',requestId:id,result:r}}));
    send('https://evil.example',h.e,result);send(ETJ,h.c,result);send(ETJ,h.e,{...result,order_url:'https://evil.example/'});await flush();assert.equal(h.saved.length,0);
    // A spoofed sender also cannot replace ETJ form data.
    h.e.dispatchEvent(new h.e.MessageEvent('message',{origin:'https://evil.example',source:h.c,data:{type:'suppilo:order-data',requestId:id,payload:{company_name:'Injected'}}}));
    assert.equal(h.ol('company').value,'Testiyhtiö Oy');
  }finally{h.close();}
});
test('customer role cannot receive Suppilo payload or submit through handoff',async()=>{
  const h=harness({role:'customer'});try{h.c.openEtjContract('ID1','C1');await h.start();assert.equal(h.ol('company'),null);assert.equal(h.calls.length,0);}finally{h.close();}
});
test('handoff survives redirect-style reload before sign-in finishes',async()=>{
  const h=harness({delayAuth:true});try {
    h.c.openEtjContract('ID1','C1');await h.start();assert.ok(h.e.sessionStorage.getItem('etj.suppilo-order.v1'));assert.equal(h.e.location.hash,'');
    h.e.eval(etjCode);h.e.etjSuppiloOrder.ready();await flush();assert.equal(h.ol('company').value,'Testiyhtiö Oy');assert.equal(h.calls.length,0);
  }finally{h.close();}
});
test('blocked popup and invalid service quantities do not send data',async()=>{
  const h=harness({blockPopup:true});try {
    h.c.openEtjContract('ID1','C1');await h.start();assert.match(h.g('status').textContent,/esti/);assert.equal(h.calls.length,0);
    h.g('etjplus_qty').value='0';assert.equal(h.g('form').checkValidity(),false);
  }finally{h.close();}
});
test('later ordinary ETJ form is not attributed to the previous CRM request',async()=>{
  const h=harness();try{h.c.openEtjContract('ID1','C1');await h.start();h.e.openOrderLinkModal();h.ol('company').value='Erillinen Oy';h.ol('contact').value='Muu';h.ol('email').value='other@example.test';await h.e.sendOrderLink();await flush();assert.equal(h.calls.length,1);assert.equal(h.saved.length,0);}finally{h.close();}
});
