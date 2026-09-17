/* Suppilo – media- ja hankintaseuranta
 * Media- ja hankintavahti elää Suppilon nykyisen Google Sheets -datan päällä.
 * Tämä tiedosto lisää oman Seuranta-välilehden, seurantasäännöt ja signaalit.
 */
(function () {
  'use strict';

  const WATCH_TAB = 'Seurannat';
  const SIGNAL_TAB = 'Signaalit';
  const WATCH_COLS = ['id','nimi','hakusanat','lahteet','alue','min_pisteet','aktiivinen','created_at','updated_at'];
  const SIGNAL_COLS = ['id','seuranta_id','otsikko','lahde','url','julkaistu_at','deadline','organisaatio','y_tunnus','tili_id','yhteyshenkilo_id','pisteet','tila','tiivistelma','created_at'];
  const MEDIA_VERSION = '2026-09-17.2';

  let watches = [];
  let signals = [];
  let loading = false;
  let initialized = false;

  function escMedia(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function injectStyles() {
    if (document.getElementById('media-seuranta-styles')) return;
    const s = document.createElement('style');
    s.id = 'media-seuranta-styles';
    s.textContent = `
      #tab-seuranta{max-width:1600px;margin:0 auto;}
      .media-page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px;}
      .media-page-head h2{font-size:22px;margin:0 0 4px;}
      .media-page-head p{font-size:13px;color:var(--text2);margin:0;}
      .media-head-count{background:var(--bg2);border:1px solid var(--border);border-radius:999px;padding:7px 12px;font-size:12px;color:var(--text2);white-space:nowrap;}
      .media-head-count strong{color:var(--accent);font-size:14px;margin-right:4px;}
      .media-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:16px;align-items:start;}
      .media-panel{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;min-width:0;}
      .media-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border);}
      .media-panel-head h3{font-size:14px;margin:0;}
      .media-panel-note{font-size:11px;color:var(--text2);}
      .media-watch-form{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:8px;}
      .media-watch-form .form-control{width:100%;}
      .media-form-row{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.9fr) 86px;gap:8px;}
      .media-watch-card,.media-signal-card{padding:13px 16px;border-bottom:1px solid var(--border);}
      .media-watch-card:last-child,.media-signal-card:last-child{border-bottom:none;}
      .media-watch-card{display:flex;align-items:center;justify-content:space-between;gap:12px;}
      .media-watch-card.is-off{opacity:.55;}
      .media-watch-main{min-width:0;}
      .media-watch-title,.media-signal-title{font-size:13px;font-weight:700;color:var(--text);}
      .media-watch-meta,.media-signal-org,.media-signal-summary{font-size:11px;color:var(--text2);margin-top:4px;line-height:1.45;}
      .media-watch-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
      .media-score,.media-source,.media-state{display:inline-flex;align-items:center;border:1px solid var(--border);border-radius:999px;padding:3px 8px;font-size:10px;font-weight:700;white-space:nowrap;}
      .media-score{color:var(--accent);}
      .media-source{color:var(--text);background:var(--bg3);}
      .media-state{color:var(--text2);font-weight:600;}
      .media-signal-top{display:flex;align-items:center;gap:6px;margin-bottom:7px;}
      .media-signal-title{line-height:1.35;}
      .media-signal-summary{margin-top:7px;}
      .media-signal-links{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;}
      .media-unlinked{font-size:10px;color:var(--text2);}
      .media-empty{padding:24px 16px;text-align:center;color:var(--text2);font-size:12px;line-height:1.55;}
      .media-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
      .media-status{font-size:11px;color:var(--text2);margin-right:auto;}
      .media-source-note{margin:0 16px 14px;padding:10px 12px;border:1px dashed var(--border);border-radius:8px;font-size:11px;color:var(--text2);line-height:1.5;}
      .media-loading{opacity:.55;pointer-events:none;}
      .media-kpi-badge{margin-left:5px;min-width:20px;height:20px;border-radius:999px;background:var(--accent);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;padding:0 6px;}
      [data-dash-theme="spara"] .media-panel,[data-dash-theme="spara"] .media-head-count{background:var(--spara-paper);border-color:var(--spara-hairline);}
      [data-dash-theme="spara"] .media-page-head p,[data-dash-theme="spara"] .media-watch-meta,[data-dash-theme="spara"] .media-signal-org,[data-dash-theme="spara"] .media-signal-summary,[data-dash-theme="spara"] .media-panel-note,[data-dash-theme="spara"] .media-unlinked,[data-dash-theme="spara"] .media-source-note,[data-dash-theme="spara"] .media-status{color:var(--spara-ink-soft);}
      [data-dash-theme="spara"] .media-watch-title,[data-dash-theme="spara"] .media-signal-title,[data-dash-theme="spara"] .media-panel-head h3,[data-dash-theme="spara"] .media-page-head h2{color:var(--spara-ink);}
      [data-dash-theme="spara"] .media-panel-head,[data-dash-theme="spara"] .media-watch-form,[data-dash-theme="spara"] .media-watch-card,[data-dash-theme="spara"] .media-signal-card{border-color:var(--spara-hairline);}
      @media(max-width:980px){.media-layout{grid-template-columns:1fr}.media-form-row{grid-template-columns:1fr}.media-page-head{flex-direction:column}.media-head-count{align-self:flex-start}}
    `;
    document.head.appendChild(s);
  }

  function installTab() {
    injectStyles();
    const tabs = document.querySelector('.tabs');
    const main = document.querySelector('main');
    if (!tabs || !main) return false;

    let tab = tabs.querySelector('[data-tab="seuranta"]');
    if (!tab) {
      tab = document.createElement('div');
      tab.className = 'tab';
      tab.dataset.tab = 'seuranta';
      tab.innerHTML = 'Seuranta <span id="media-nav-count" class="media-kpi-badge" style="display:none">0</span>';
      tabs.appendChild(tab);
    }

    let content = document.getElementById('tab-seuranta');
    if (!content) {
      content = document.createElement('div');
      content.className = 'tab-content';
      content.id = 'tab-seuranta';
      content.innerHTML = '<div id="media-seuranta-root"><div class="media-empty">Avaa Seuranta-välilehti ladataksesi seurannat.</div></div>';
      main.appendChild(content);
    }

    if (!tab.dataset.mediaBound) {
      tab.dataset.mediaBound = '1';
      tab.addEventListener('click', async () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
        tab.classList.add('active');
        content.classList.add('active');
        await initMediaSeuranta();
      });
    }
    return true;
  }

  async function ensureSheets() {
    if (typeof apiGet !== 'function' || typeof addSheet !== 'function') throw new Error('Google Sheets -yhteys ei ole vielä käytettävissä.');
    const meta = await apiGet('?fields=sheets.properties');
    const names = (meta.sheets || []).map(s => s.properties?.title).filter(Boolean);
    if (!names.includes(WATCH_TAB)) await addSheet(WATCH_TAB, WATCH_COLS);
    if (!names.includes(SIGNAL_TAB)) await addSheet(SIGNAL_TAB, SIGNAL_COLS);
  }

  async function loadMediaData() {
    await ensureSheets();
    if (typeof sheetGet !== 'function') throw new Error('Google Sheets -lukutoiminto puuttuu.');
    const w = await sheetGet(`${WATCH_TAB}!A:I`);
    watches = w.slice(1).map((r, i) => ({
      id:r[0], nimi:r[1]||'', hakusanat:r[2]||'', lahteet:r[3]||'', alue:r[4]||'',
      min_pisteet:Number(r[5]||0), aktiivinen:String(r[6]||'true').toLowerCase()!=='false',
      created_at:r[7]||'', updated_at:r[8]||'', _rowIndex:i+2
    })).filter(x => x.id);
    const s = await sheetGet(`${SIGNAL_TAB}!A:O`);
    signals = s.slice(1).map((r, i) => ({
      id:r[0], seuranta_id:r[1]||'', otsikko:r[2]||'', lahde:r[3]||'', url:r[4]||'',
      julkaistu_at:r[5]||'', deadline:r[6]||'', organisaatio:r[7]||'', y_tunnus:r[8]||'',
      tili_id:r[9]||'', yhteyshenkilo_id:r[10]||'', pisteet:Number(r[11]||0),
      tila:r[12]||'uusi', tiivistelma:r[13]||'', created_at:r[14]||'', _rowIndex:i+2
    })).filter(x => x.id);
    autoLinkSignals();
    updateNavCount();
  }

  function openSignals() {
    return signals.filter(s => !['ohitettu','kasitelty'].includes((s.tila||'').toLowerCase()));
  }

  function updateNavCount() {
    const n = openSignals().length;
    const badge = document.getElementById('media-nav-count');
    if (!badge) return;
    badge.textContent = String(n);
    badge.style.display = n ? 'inline-flex' : 'none';
  }

  function normalizeCompany(s) {
    return String(s||'').toLowerCase()
      .replace(/\b(oyj|oy|ab|ltd|plc|kunta|kaupunki)\b/g,'')
      .replace(/[^a-zåäö0-9]/g,'')
      .trim();
  }

  function autoLinkSignals() {
    if (!Array.isArray(window.allProspects) && typeof allProspects === 'undefined') return;
    const prospects = typeof allProspects !== 'undefined' ? allProspects : window.allProspects;
    if (!Array.isArray(prospects)) return;
    signals.forEach(sig => {
      if (sig.tili_id) return;
      const target = normalizeCompany(sig.organisaatio);
      if (!target) return;
      const hit = prospects.find(p => {
        const name = p.yritys_nimi || p.name || p.nimi || '';
        const y = (p.y_tunnus || p.ytunnus || '').replace(/\s/g,'');
        return (sig.y_tunnus && y && sig.y_tunnus.replace(/\s/g,'') === y) || normalizeCompany(name) === target;
      });
      if (hit) sig.tili_id = hit.spara_id || hit.id || '';
    });
  }

  function scoreSignal(text, watch) {
    const hay = String(text||'').toLowerCase();
    const words = String(watch.hakusanat||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    let score = 0;
    words.forEach(w => { if (hay.includes(w)) score += 22; });
    if (/markkinavuoropuhelu|ennakkoilmoitus|tietopyyntö|request for information|prior information/i.test(hay)) score += 20;
    if (/energiatehok|energiakatsel|led|valaistus|rakennusautomaat|kiinteistö|lämmitys|heat pump|energy efficien/i.test(hay)) score += 16;
    if (/tarjous|hankinta|tender|procurement/i.test(hay)) score += 10;
    return Math.min(100, score);
  }

  function badgeSource(src) {
    const s = (src || '').toLowerCase();
    if (s.includes('hilma')) return 'HILMA';
    if (s.includes('ted')) return 'TED';
    if (s.includes('media') || s.includes('gdelt')) return 'MEDIA';
    return (src || 'MUU').toUpperCase();
  }

  function renderWatches() {
    const host = document.getElementById('media-watch-list');
    if (!host) return;
    if (!watches.length) {
      host.innerHTML = '<div class="media-empty">Ei vielä seurantoja. Luo ensimmäinen seuranta yllä olevalla lomakkeella.</div>';
      return;
    }
    host.innerHTML = watches.map(w => `
      <article class="media-watch-card ${w.aktiivinen ? '' : 'is-off'}">
        <div class="media-watch-main">
          <div class="media-watch-title">${escMedia(w.nimi)}</div>
          <div class="media-watch-meta">${escMedia(w.hakusanat || 'Ei hakusanoja')} · ${escMedia(w.lahteet || 'Kaikki lähteet')} ${w.alue ? '· '+escMedia(w.alue) : ''}</div>
        </div>
        <div class="media-watch-actions">
          <span class="media-score">≥ ${Number(w.min_pisteet||0)} p</span>
          <button class="btn btn-ghost btn-sm" data-watch-run="${escMedia(w.id)}">Hae nyt</button>
          <button class="btn btn-ghost btn-sm" data-watch-toggle="${escMedia(w.id)}">${w.aktiivinen ? 'Päällä' : 'Pois'}</button>
        </div>
      </article>`).join('');
    host.querySelectorAll('[data-watch-toggle]').forEach(btn => btn.addEventListener('click', () => toggleWatch(btn.dataset.watchToggle)));
    host.querySelectorAll('[data-watch-run]').forEach(btn => btn.addEventListener('click', () => runWatch(btn.dataset.watchRun)));
  }

  function renderSignals() {
    const host = document.getElementById('media-signal-list');
    const count = document.getElementById('media-signal-count');
    if (!host) return;
    const open = openSignals();
    if (count) count.textContent = String(open.length);
    updateNavCount();
    if (!signals.length) {
      host.innerHTML = '<div class="media-empty">Ei signaaleja vielä. Luo seuranta ja paina “Hae nyt”.</div>';
      return;
    }
    host.innerHTML = [...signals]
      .sort((a,b)=>(b.pisteet||0)-(a.pisteet||0) || String(b.julkaistu_at||'').localeCompare(String(a.julkaistu_at||'')))
      .map(s => `
      <article class="media-signal-card" data-signal-id="${escMedia(s.id)}">
        <div class="media-signal-top">
          <span class="media-source">${escMedia(badgeSource(s.lahde))}</span>
          <span class="media-score">${Number(s.pisteet||0)} p</span>
          <span class="media-state">${escMedia(s.tila || 'uusi')}</span>
        </div>
        <div class="media-signal-title">${escMedia(s.otsikko)}</div>
        <div class="media-signal-org">${escMedia(s.organisaatio || 'Organisaatio tunnistamatta')}${s.deadline ? ' · DL '+escMedia(s.deadline) : ''}</div>
        ${s.tiivistelma ? `<div class="media-signal-summary">${escMedia(s.tiivistelma)}</div>` : ''}
        <div class="media-signal-links">
          ${s.url ? `<a class="btn btn-ghost btn-sm" href="${escMedia(s.url)}" target="_blank" rel="noopener">Avaa lähde</a>` : ''}
          ${s.tili_id ? `<button class="btn btn-ghost btn-sm" data-open-account="${escMedia(s.tili_id)}">Avaa tili</button>` : '<span class="media-unlinked">Ei vielä linkitetty tiliin</span>'}
          ${!['kasitelty','ohitettu'].includes((s.tila||'').toLowerCase()) ? `<button class="btn btn-ghost btn-sm" data-signal-done="${escMedia(s.id)}">Käsitelty</button><button class="btn btn-ghost btn-sm" data-signal-ignore="${escMedia(s.id)}">Ohita</button>` : ''}
        </div>
      </article>`).join('');

    host.querySelectorAll('[data-signal-done]').forEach(btn=>btn.addEventListener('click',()=>setSignalState(btn.dataset.signalDone,'kasitelty')));
    host.querySelectorAll('[data-signal-ignore]').forEach(btn=>btn.addEventListener('click',()=>setSignalState(btn.dataset.signalIgnore,'ohitettu')));
    host.querySelectorAll('[data-open-account]').forEach(btn=>btn.addEventListener('click',()=>openLinkedAccount(btn.dataset.openAccount)));
  }

  function openLinkedAccount(id) {
    if (typeof openModal === 'function') { openModal(id); return; }
    if (typeof showToast === 'function') showToast('Tili löytyi, mutta avausfunktiota ei löytynyt.','error');
  }

  async function setSignalState(id, state) {
    const sig = signals.find(x=>x.id===id); if (!sig || typeof sheetPut !== 'function') return;
    sig.tila = state;
    await sheetPut(`${SIGNAL_TAB}!M${sig._rowIndex}`, [[state]]);
    renderSignals();
  }

  async function toggleWatch(id) {
    const w = watches.find(x => x.id === id); if (!w || typeof sheetPut !== 'function') return;
    w.aktiivinen = !w.aktiivinen;
    w.updated_at = new Date().toISOString();
    await sheetPut(`${WATCH_TAB}!G${w._rowIndex}:I${w._rowIndex}`, [[w.aktiivinen ? 'true' : 'false', w.created_at, w.updated_at]]);
    renderWatches();
  }

  async function createWatch() {
    const name = (document.getElementById('media-watch-name')?.value || '').trim();
    const words = (document.getElementById('media-watch-words')?.value || '').trim();
    const sources = Array.from(document.querySelectorAll('[name="media-source"]:checked')).map(x=>x.value).join(',');
    const area = (document.getElementById('media-watch-area')?.value || '').trim();
    const minScore = Number(document.getElementById('media-watch-score')?.value || 0);
    if (!name) { if (typeof showToast==='function') showToast('Anna seurannalle nimi','error'); return; }
    if (!words) { if (typeof showToast==='function') showToast('Anna vähintään yksi hakusana','error'); return; }
    if (!sources) { if (typeof showToast==='function') showToast('Valitse vähintään yksi lähde','error'); return; }
    if (typeof sheetAppend !== 'function') return;
    const now = new Date().toISOString();
    const id = 'SEU'+Date.now();
    const row = [id,name,words,sources,area,minScore,'true',now,now];
    await sheetAppend(`${WATCH_TAB}!A:I`, [row]);
    const a = await sheetGet(`${WATCH_TAB}!A:A`);
    watches.push({id,nimi:name,hakusanat:words,lahteet:sources,alue:area,min_pisteet:minScore,aktiivinen:true,created_at:now,updated_at:now,_rowIndex:a.length});
    ['media-watch-name','media-watch-words','media-watch-area'].forEach(x=>{const el=document.getElementById(x); if(el) el.value='';});
    renderWatches();
    if (typeof showToast==='function') showToast('Seuranta lisätty ✓','success');
  }

  function uniqByUrl(items) {
    const seen = new Set(signals.map(s => (s.url||'').trim()).filter(Boolean));
    const out = [];
    items.forEach(x => {
      const key = (x.url||'').trim() || `${x.lahde}:${x.otsikko}:${x.organisaatio}`;
      if (!key || seen.has(key)) return;
      seen.add(key); out.push(x);
    });
    return out;
  }

  async function persistSignals(items) {
    if (!items.length || typeof sheetAppend !== 'function') return 0;
    const rows = items.map(s => [s.id,s.seuranta_id,s.otsikko,s.lahde,s.url,s.julkaistu_at,s.deadline,s.organisaatio,s.y_tunnus||'',s.tili_id||'',s.yhteyshenkilo_id||'',s.pisteet,s.tila||'uusi',s.tiivistelma||'',s.created_at]);
    await sheetAppend(`${SIGNAL_TAB}!A:O`, rows);
    const colA = await sheetGet(`${SIGNAL_TAB}!A:A`);
    const first = Math.max(2, colA.length - items.length + 1);
    items.forEach((s,i)=>s._rowIndex=first+i);
    signals.push(...items);
    autoLinkSignals();
    renderSignals();
    return items.length;
  }

  async function searchGdelt(watch) {
    const qWords = String(watch.hakusanat||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
    if (!qWords.length) return [];
    const query = qWords.length === 1 ? qWords[0] : `(${qWords.map(x=>'"'+x.replace(/"/g,'')+'"').join(' OR ')})`;
    const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query='+encodeURIComponent(query)+'&mode=ArtList&format=json&maxrecords=40&sort=HybridRel';
    const r = await fetch(url);
    if (!r.ok) throw new Error('Mediahaku epäonnistui ('+r.status+')');
    const data = await r.json();
    return (data.articles || []).map((a,i)=>{
      const text = `${a.title||''} ${a.domain||''}`;
      return {
        id:'SIG'+Date.now()+'G'+i, seuranta_id:watch.id, otsikko:a.title||'Mediaosuma', lahde:'MEDIA/GDELT',
        url:a.url||'', julkaistu_at:a.seendate||'', deadline:'', organisaatio:a.domain||'', y_tunnus:'', tili_id:'', yhteyshenkilo_id:'',
        pisteet:scoreSignal(text,watch), tila:'uusi', tiivistelma:a.language ? `Kieli: ${a.language}` : '', created_at:new Date().toISOString()
      };
    }).filter(x=>x.pisteet >= Number(watch.min_pisteet||0));
  }

  async function searchTed(watch) {
    const words = String(watch.hakusanat||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,5);
    if (!words.length) return [];
    const query = words.map(w=>`notice-title ~ "${w.replace(/"/g,'')}"`).join(' OR ');
    const body = {
      query: `(${query})`,
      fields: ['publication-number','notice-title','buyer-name','publication-date','deadline-receipt-tender-date-lot','notice-type'],
      page: 1, limit: 50, scope: 'ACTIVE', checkQuerySyntax: false, paginationMode: 'PAGE_NUMBER'
    };
    const r = await fetch('https://api.ted.europa.eu/v3/notices/search', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    if (!r.ok) throw new Error('TED-haku epäonnistui ('+r.status+')');
    const data = await r.json();
    const rows = data.notices || data.results || [];
    return rows.map((n,i)=>{
      const title = Array.isArray(n['notice-title']) ? n['notice-title'][0] : (n['notice-title']||n.title||'TED-hankinta');
      const buyer = Array.isArray(n['buyer-name']) ? n['buyer-name'][0] : (n['buyer-name']||'');
      const pub = Array.isArray(n['publication-date']) ? n['publication-date'][0] : (n['publication-date']||'');
      const num = n['publication-number'] || n.publicationNumber || '';
      const deadline = Array.isArray(n['deadline-receipt-tender-date-lot']) ? n['deadline-receipt-tender-date-lot'][0] : (n['deadline-receipt-tender-date-lot']||'');
      const url = n.links?.html?.FIN || n.links?.html?.ENG || n.links?.html?.FI || (num ? `https://ted.europa.eu/fi/notice/-/detail/${encodeURIComponent(num)}` : '');
      return {
        id:'SIG'+Date.now()+'T'+i, seuranta_id:watch.id, otsikko:title, lahde:'TED', url, julkaistu_at:pub, deadline,
        organisaatio:buyer, y_tunnus:'', tili_id:'', yhteyshenkilo_id:'', pisteet:scoreSignal(`${title} ${buyer}`,watch), tila:'uusi', tiivistelma:'EU:n julkinen hankintailmoitus', created_at:new Date().toISOString()
      };
    }).filter(x=>x.pisteet >= Number(watch.min_pisteet||0));
  }

  function hilmaSearchUrl(watch) {
    const q = String(watch.hakusanat||'').split(',')[0]?.trim() || '';
    return 'https://www.hankintailmoitukset.fi/fi/search?q='+encodeURIComponent(q);
  }

  async function runWatch(id) {
    const watch = watches.find(x=>x.id===id); if (!watch || loading) return;
    loading = true;
    document.getElementById('media-seuranta-root')?.classList.add('media-loading');
    const sources = String(watch.lahteet||'').split(',').map(x=>x.trim().toUpperCase());
    const gathered = [];
    const problems = [];
    try {
      if (sources.includes('MEDIA')) {
        try { gathered.push(...await searchGdelt(watch)); } catch(e) { problems.push(e.message); }
      }
      if (sources.includes('TED')) {
        try { gathered.push(...await searchTed(watch)); } catch(e) { problems.push(e.message); }
      }
      if (sources.includes('HILMA')) {
        problems.push('HILMA: virallinen AVP-Read ei salli selaimen CORS-kutsuja. HILMA-välityspalvelu lisätään seuraavassa backend-vaiheessa.');
      }
      const fresh = uniqByUrl(gathered);
      const n = await persistSignals(fresh);
      const msg = `${n} uutta signaalia${problems.length ? ' · '+problems.join(' · ') : ''}`;
      if (typeof showToast==='function') showToast(msg, problems.length && !n ? 'error' : 'success');
      const status = document.getElementById('media-last-status');
      if (status) status.textContent = `Viimeisin haku: ${new Date().toLocaleString('fi-FI')} · ${n} uutta`;
      if (sources.includes('HILMA')) {
        const a = document.getElementById('media-hilma-link'); if (a) a.href = hilmaSearchUrl(watch);
      }
    } finally {
      loading = false;
      document.getElementById('media-seuranta-root')?.classList.remove('media-loading');
    }
  }

  async function runAllWatches() {
    const active = watches.filter(w=>w.aktiivinen);
    for (const w of active) await runWatch(w.id);
  }

  function renderMediaPage() {
    const root = document.getElementById('media-seuranta-root');
    if (!root) return;
    root.innerHTML = `
      <div class="media-page-head">
        <div>
          <h2>Seuranta</h2>
          <p>Julkiset hankinnat, kilpailutukset ja mediasignaalit samassa näkymässä.</p>
        </div>
        <div class="media-toolbar">
          <span id="media-last-status" class="media-status">Versio ${MEDIA_VERSION}</span>
          <button class="btn btn-primary btn-sm" id="media-run-all">Hae kaikki nyt</button>
          <span class="media-head-count"><strong id="media-signal-count">0</strong> avointa signaalia</span>
        </div>
      </div>
      <div class="media-layout">
        <section class="media-panel">
          <div class="media-panel-head"><h3>Seurannat</h3><span class="media-panel-note">Mitä haluat löytää?</span></div>
          <div class="media-watch-form">
            <input class="form-control" id="media-watch-name" placeholder="Seurannan nimi, esim. ETJ+ julkiset hankinnat">
            <input class="form-control" id="media-watch-words" placeholder="Hakusanat pilkuilla: energiatehokkuus, energiakatselmus, LED…">
            <div class="media-form-row">
              <input class="form-control" id="media-watch-area" placeholder="Alue, esim. Uusimaa">
              <input class="form-control" id="media-watch-score" type="number" min="0" max="100" value="35" title="Vähimmäispisteet">
              <span></span>
            </div>
            <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--text2)">
              <label><input type="checkbox" name="media-source" value="HILMA" checked> HILMA</label>
              <label><input type="checkbox" name="media-source" value="TED" checked> TED</label>
              <label><input type="checkbox" name="media-source" value="MEDIA" checked> Media</label>
            </div>
            <button class="btn btn-primary" id="media-add-watch">+ Lisää seuranta</button>
          </div>
          <div class="media-source-note">HILMA on mukana seurantalähteenä. Sen virallinen AVP-Read-rajapinta on ilmainen, mutta se ei salli suoraa CORS-hakua selaimesta, joten automaattinen HILMA-haku tarvitsee pienen palvelin-/proxykerroksen. <a id="media-hilma-link" href="https://www.hankintailmoitukset.fi/fi/search" target="_blank" rel="noopener">Avaa HILMA-haku</a>.</div>
          <div id="media-watch-list"></div>
        </section>
        <section class="media-panel">
          <div class="media-panel-head"><h3>Signaalit</h3><span class="media-panel-note">Korkein pisteytys ensin</span></div>
          <div id="media-signal-list"></div>
        </section>
      </div>`;
    document.getElementById('media-add-watch')?.addEventListener('click', createWatch);
    document.getElementById('media-run-all')?.addEventListener('click', runAllWatches);
    renderWatches();
    renderSignals();
  }

  async function initMediaSeuranta() {
    if (loading) return;
    loading = true;
    try {
      renderMediaPage();
      await loadMediaData();
      renderWatches();
      renderSignals();
      initialized = true;
    } catch (e) {
      console.error('Mediaseuranta:', e);
      const root = document.getElementById('media-seuranta-root');
      if (root) root.innerHTML = `<div class="media-empty">Seurannan lataus epäonnistui: ${escMedia(e.message)}<br><br>Kirjaudu ensin Google-tilillä Suppiloon ja yritä uudelleen.</div>`;
    } finally {
      loading = false;
    }
  }

  function boot() {
    if (!installTab()) { setTimeout(boot, 250); return; }
    if (initialized) updateNavCount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

  window.SuppiloMediaSeuranta = {
    init:initMediaSeuranta,
    render:renderMediaPage,
    reload:async()=>{await loadMediaData();renderMediaPage();},
    runAll:runAllWatches
  };
})();
