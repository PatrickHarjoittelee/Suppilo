/* Suppilo – media- ja hankintaseuranta
 * Tämä moduuli on tarkoitettu ladattavaksi crm.html:n jälkeen.
 * Se käyttää Suppilon olemassa olevia Google Sheets -apuja (sheetGet, sheetAppend,
 * sheetPut, addSheet, apiGet, showToast) eikä tuo uutta tietokantaa.
 */
(function () {
  'use strict';

  const WATCH_TAB = 'Seurannat';
  const SIGNAL_TAB = 'Signaalit';
  const WATCH_COLS = ['id','nimi','hakusanat','lahteet','alue','min_pisteet','aktiivinen','created_at','updated_at'];
  const SIGNAL_COLS = ['id','seuranta_id','otsikko','lahde','url','julkaistu_at','deadline','organisaatio','y_tunnus','tili_id','yhteyshenkilo_id','pisteet','tila','tiivistelma','created_at'];

  let watches = [];
  let signals = [];

  async function ensureSheets() {
    if (typeof apiGet !== 'function' || typeof addSheet !== 'function') return;
    const meta = await apiGet('?fields=sheets.properties');
    const names = (meta.sheets || []).map(s => s.properties?.title).filter(Boolean);
    if (!names.includes(WATCH_TAB)) await addSheet(WATCH_TAB, WATCH_COLS);
    if (!names.includes(SIGNAL_TAB)) await addSheet(SIGNAL_TAB, SIGNAL_COLS);
  }

  async function loadMediaData() {
    await ensureSheets();
    if (typeof sheetGet !== 'function') return;

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
  }

  function escMedia(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function badgeSource(src) {
    const s = (src || '').toLowerCase();
    if (s.includes('hilma')) return 'HILMA';
    if (s.includes('ted')) return 'TED';
    if (s.includes('media')) return 'MEDIA';
    return (src || 'MUU').toUpperCase();
  }

  function renderWatches() {
    const host = document.getElementById('media-watch-list');
    if (!host) return;
    if (!watches.length) {
      host.innerHTML = '<div class="media-empty">Ei vielä seurantoja. Luo ensimmäinen seuranta oikeasta yläkulmasta.</div>';
      return;
    }
    host.innerHTML = watches.map(w => `
      <article class="media-watch-card ${w.aktiivinen ? '' : 'is-off'}">
        <div class="media-watch-main">
          <div class="media-watch-title">${escMedia(w.nimi)}</div>
          <div class="media-watch-meta">${escMedia(w.hakusanat || 'Ei hakusanoja')} · ${escMedia(w.lahteet || 'Kaikki lähteet')} ${w.alue ? '· '+escMedia(w.alue) : ''}</div>
        </div>
        <div class="media-watch-actions">
          <span class="media-score">≥ ${Number(w.min_pisteet||0)}</span>
          <button class="btn btn-ghost btn-sm" data-watch-toggle="${escMedia(w.id)}">${w.aktiivinen ? 'Päällä' : 'Pois'}</button>
        </div>
      </article>`).join('');

    host.querySelectorAll('[data-watch-toggle]').forEach(btn => btn.addEventListener('click', () => toggleWatch(btn.dataset.watchToggle)));
  }

  function renderSignals() {
    const host = document.getElementById('media-signal-list');
    const count = document.getElementById('media-signal-count');
    if (!host) return;
    const open = signals.filter(s => s.tila !== 'ohitettu' && s.tila !== 'kasitelty');
    if (count) count.textContent = String(open.length);
    if (!signals.length) {
      host.innerHTML = '<div class="media-empty">Ei signaaleja vielä. Kun seurantalähteet tuottavat osumia, ne näkyvät tässä.</div>';
      return;
    }
    host.innerHTML = [...signals].sort((a,b)=>(b.pisteet||0)-(a.pisteet||0)).map(s => `
      <article class="media-signal-card" data-signal-id="${escMedia(s.id)}">
        <div class="media-signal-top">
          <span class="media-source">${escMedia(badgeSource(s.lahde))}</span>
          <span class="media-score">${Number(s.pisteet||0)} p</span>
          <span class="media-state">${escMedia(s.tila)}</span>
        </div>
        <div class="media-signal-title">${escMedia(s.otsikko)}</div>
        <div class="media-signal-org">${escMedia(s.organisaatio || 'Organisaatio tunnistamatta')}</div>
        ${s.tiivistelma ? `<div class="media-signal-summary">${escMedia(s.tiivistelma)}</div>` : ''}
        <div class="media-signal-links">
          ${s.url ? `<a class="btn btn-ghost btn-sm" href="${escMedia(s.url)}" target="_blank" rel="noopener">Avaa lähde</a>` : ''}
          ${s.tili_id ? `<button class="btn btn-ghost btn-sm" data-open-account="${escMedia(s.tili_id)}">Avaa tili</button>` : '<span class="media-unlinked">Ei linkitetty tiliin</span>'}
        </div>
      </article>`).join('');
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
    const sources = (document.getElementById('media-watch-sources')?.value || '').trim();
    const area = (document.getElementById('media-watch-area')?.value || '').trim();
    const minScore = Number(document.getElementById('media-watch-score')?.value || 0);
    if (!name) { if (typeof showToast==='function') showToast('Anna seurannalle nimi','error'); return; }
    if (typeof sheetAppend !== 'function') return;
    const now = new Date().toISOString();
    const id = 'SEU'+Date.now();
    const row = [id,name,words,sources,area,minScore,'true',now,now];
    await sheetAppend(`${WATCH_TAB}!A:I`, [row]);
    watches.push({id,nimi:name,hakusanat:words,lahteet:sources,alue:area,min_pisteet:minScore,aktiivinen:true,created_at:now,updated_at:now});
    ['media-watch-name','media-watch-words','media-watch-area'].forEach(x=>{const el=document.getElementById(x); if(el) el.value='';});
    renderWatches();
    if (typeof showToast==='function') showToast('Seuranta lisätty ✓','success');
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
        <span class="media-head-count"><strong id="media-signal-count">0</strong> avointa signaalia</span>
      </div>
      <div class="media-layout">
        <section class="media-panel">
          <div class="media-panel-head"><h3>Seurannat</h3></div>
          <div class="media-watch-form">
            <input class="form-control" id="media-watch-name" placeholder="Seurannan nimi, esim. ETJ+ julkiset hankinnat">
            <input class="form-control" id="media-watch-words" placeholder="Hakusanat pilkuilla: energiatehokkuus, energiakatselmus…">
            <div class="media-form-row">
              <select class="form-control" id="media-watch-sources"><option value="HILMA,TED,MEDIA">HILMA + TED + media</option><option value="HILMA">HILMA</option><option value="TED">TED</option><option value="MEDIA">Media</option></select>
              <input class="form-control" id="media-watch-area" placeholder="Alue, esim. Uusimaa">
              <input class="form-control" id="media-watch-score" type="number" min="0" max="100" value="40" title="Vähimmäispisteet">
            </div>
            <button class="btn btn-primary" id="media-add-watch">+ Lisää seuranta</button>
          </div>
          <div id="media-watch-list"></div>
        </section>
        <section class="media-panel">
          <div class="media-panel-head"><h3>Signaalit</h3><span class="media-panel-note">Korkein pisteytys ensin</span></div>
          <div id="media-signal-list"></div>
        </section>
      </div>`;
    document.getElementById('media-add-watch')?.addEventListener('click', createWatch);
    renderWatches(); renderSignals();
  }

  async function initMediaSeuranta() {
    try { await loadMediaData(); } catch (e) { console.error('Mediaseuranta:', e); }
    renderMediaPage();
  }

  window.SuppiloMediaSeuranta = { init:initMediaSeuranta, render:renderMediaPage, reload:async()=>{await loadMediaData();renderMediaPage();} };
})();
