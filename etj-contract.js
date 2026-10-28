/* ETJ creates the lead and sends the email on its own authenticated origin.
 * Only order data/results cross postMessage; access tokens never leave ETJ. */
(function () {
  'use strict';
  const ETJ_ORIGIN = 'https://etj.sparaenergia.com';
  const pending = new Map();
  let context = null;
  const get = id => document.getElementById('ec-' + id);
  const field = (id, label, type = 'text', extra = '') => `<div class="form-group"><label for="ec-${id}">${label}</label><input class="form-control" id="ec-${id}" type="${type}" ${extra}></div>`;

  function ensureModal() {
    if (get('overlay')) return;
    const el = document.createElement('div');
    el.id = 'ec-overlay'; el.className = 'modal-overlay hidden'; el.style.zIndex = '1100';
    el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ec-heading" style="max-width:600px">
      <div class="modal-header"><div class="modal-title" id="ec-heading">Luo ETJ-sopimuslinkki</div><button class="modal-close" type="button" aria-label="Sulje">✕</button></div>
      <form id="ec-form" class="modal-body" style="padding:20px">
        <p>Asiakkaan tiedot tulevat Suppilosta. Tarkista tiedot ja palvelut. Linkin lähetys vahvistetaan ETJ:ssä.</p>
        <div class="form-group"><label for="ec-contact">Yhteyshenkilö</label><select class="form-control" id="ec-contact"></select></div>
        <div class="form-grid">
          ${field('company_name','Yritys *','text','required maxlength="300"')}${field('y_tunnus','Y-tunnus')}
          ${field('contact_name','Yhteyshenkilön nimi *','text','required maxlength="300"')}${field('contact_email','Sähköposti *','email','required maxlength="320"')}
          ${field('contact_phone','Puhelin','tel')}${field('contact_title','Titteli')}${field('city','Kaupunki')}
        </div>
        <div class="cs-title" style="margin-top:18px">Esivalitut palvelut</div>
        <label><input id="ec-etjplus_selected" type="checkbox" checked> ETJ+ energianhallintapalvelu</label>
        ${field('etjplus_qty','Y-tunnusten lukumäärä','number','min="1" step="1" value="1"')}
        <label><input id="ec-katselmus_selected" type="checkbox"> Energiakatselmus</label>
        ${field('katselmus_qty','Y-tunnusten lukumäärä','number','min="1" step="1" value="1"')}
        <label><input id="ec-kohde_selected" type="checkbox"> Kohdekatselmointi</label>
        <div class="form-grid">${field('kohde_count','Kohteiden lukumäärä','number','min="1" step="1" value="1"')}${field('kohde_m2','Kokonaispinta-ala (m²)','number','min="0" step="1"')}</div>
        <div class="form-group"><label for="ec-notes">Lisätiedot / sovittu alennus</label><textarea class="form-control" id="ec-notes" rows="3" maxlength="10000" placeholder="Esim. 35% alennus kohdekatselmointiin, koska…"></textarea></div>
        <p style="font-size:12px;color:var(--text2)">Pidä tämä Suppilon välilehti auki. ETJ palauttaa luodun linkin ja sähköpostin lähetystuloksen asiakashistoriaan. Asiakas voi vielä muuttaa palveluvalintoja.</p>
        <p id="ec-status" role="status" aria-live="polite"></p>
        <div id="ec-result" hidden><label for="ec-url">Luotu sopimuslinkki</label><input class="form-control" id="ec-url" readonly><button class="btn btn-ghost" id="ec-copy" type="button">Kopioi linkki</button><button class="btn btn-ghost" id="ec-retry-save" type="button" hidden>Tallenna historiaan uudelleen</button></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px"><button class="btn btn-ghost" type="button" id="ec-close">Sulje</button><button class="btn btn-primary" id="ec-submit" type="submit">Jatka ETJ:hin →</button></div>
      </form></div>`;
    document.body.appendChild(el);
    el.querySelector('.modal-close').onclick = close;
    get('close').onclick = close;
    get('form').onsubmit = start;
    get('contact').onchange = fillContact;
    get('copy').onclick = async () => {
      try { await navigator.clipboard.writeText(get('url').value); get('status').textContent = 'Linkki kopioitu.'; }
      catch (_) { get('url').focus(); get('url').select(); get('status').textContent = 'Valitse ja kopioi linkki kentästä.'; }
    };
    for (const svc of ['etjplus','katselmus','kohde']) get(svc + '_selected').onchange = updateQuantities;
    updateQuantities();
  }

  function updateQuantities() {
    for (const svc of ['etjplus','katselmus','kohde']) {
      const selected = get(svc + '_selected').checked;
      for (const id of svc === 'kohde' ? ['kohde_count','kohde_m2'] : [svc + '_qty']) {
        get(id).disabled = !selected;
        get(id).required = selected;
      }
    }
  }

  function fillContact() {
    const c = context.contacts.find(x => String(x.id) === get('contact').value);
    const p = context.prospect;
    // Never mix a selected person's missing fields with another person's details.
    const values = c ? { contact_name:c.nimi, contact_email:c.sahkoposti, contact_phone:c.puhelin, contact_title:c.titteli }
      : { contact_name:p['yhteyshenkilö'], contact_email:p.henk_sahkoposti, contact_phone:p.suora_numero, contact_title:p.titteli };
    for (const [key, value] of Object.entries(values)) get(key).value = value || '';
  }

  window.openEtjContract = function (sid, contactId) {
    const p = allProspects.find(x => x.spara_id === sid);
    if (!p) { showToast('Valitse yritystili ensin.', 'error'); return; }
    ensureModal();
    const existing = [...pending.values()].find(x => x.sid === sid && !x.saved && (!x.window.closed || x.result));
    if (existing) {
      context = existing.context; get('overlay').classList.remove('hidden');
      if (existing.result) showResult(existing); else existing.window.focus();
      return;
    }
    context = { prospect:p, contacts:allContacts.filter(c => c.tili_id === sid), contactId };
    get('form').reset(); get('result').hidden = true; get('retry-save').hidden = true;
    get('status').textContent = ''; get('submit').hidden = false; get('submit').disabled = false;
    get('company_name').value = p.yritys_nimi === '–' ? '' : p.yritys_nimi || '';
    get('y_tunnus').value = p.y_tunnus || ''; get('city').value = p.kaupunki || '';
    get('contact').replaceChildren();
    get('contact').add(new Option('Tilin yhteyshenkilötiedot', ''));
    for (const c of context.contacts) get('contact').add(new Option(`${c.nimi || 'Nimetön'}${c.sahkoposti ? ' · ' + c.sahkoposti : ''}`, String(c.id)));
    if (contactId && context.contacts.some(c => c.id === contactId)) get('contact').value = String(contactId);
    else if (!p.henk_sahkoposti && context.contacts.length === 1) get('contact').value = String(context.contacts[0].id);
    fillContact(); updateQuantities();
    get('overlay').classList.remove('hidden'); get('contact').focus();
  };
  window.openEtjContractForContact = function () {
    const c = allContacts.find(x => x.id === currentYhId);
    if (c) window.openEtjContract(c.tili_id, c.id);
  };
  function close() { get('overlay').classList.add('hidden'); }

  function start(event) {
    event.preventDefault();
    if (!get('form').reportValidity()) return;
    if (![...pending.values()].every(x => x.saved || x.window.closed)) {
      get('status').textContent = 'Viimeistele ensin avoin ETJ-linkin luonti.'; return;
    }
    if (!['etjplus','katselmus','kohde'].some(s => get(s + '_selected').checked)) {
      get('status').textContent = 'Valitse vähintään yksi palvelu.'; return;
    }
    const payload = {};
    for (const key of ['company_name','y_tunnus','contact_name','contact_email','contact_phone','contact_title','city','notes']) payload[key] = get(key).value.trim() || null;
    for (const svc of ['etjplus','katselmus','kohde']) payload[svc + '_selected'] = get(svc + '_selected').checked;
    for (const key of ['etjplus_qty','katselmus_qty','kohde_count','kohde_m2']) payload[key] = get(key).disabled ? null : Number(get(key).value);
    const id = crypto.randomUUID();
    // The fragment contains only a correlation ID, never customer details.
    const popup = window.open(ETJ_ORIGIN + '/etj-plus.html#suppilo-order=' + id, '_blank');
    if (!popup) { get('status').textContent = 'Selain esti uuden välilehden. Salli ponnahdusikkuna ja yritä uudelleen.'; return; }
    const item = { id, sid:context.prospect.spara_id, payload, context, window:popup, created:Date.now() };
    pending.set(id, item); get('submit').disabled = true;
    get('status').textContent = 'ETJ avattu. Kirjaudu tarvittaessa sisään, tarkista tiedot ja paina ETJ:ssä Lähetä linkki. Jos lomake ei täyty, ETJ-päivitystä ei ole vielä julkaistu.';
    const timer = setInterval(() => {
      if (popup.closed || item.saved || Date.now() - item.created > 30 * 60 * 1000) {
        clearInterval(timer);
        if (!item.result && !item.saved) {
          pending.delete(id);
          if (context === item.context) { get('submit').disabled = false; get('status').textContent = 'ETJ-yhteys päättyi ilman palautettua tulosta. Tarkista ETJ ennen uuden linkin luontia.'; }
        }
      }
    }, 1500);
  }

  function validResult(result) {
    if (!result || typeof result.lead_code !== 'string' || result.lead_code.length > 100 || typeof result.email_sent !== 'boolean') return false;
    if (result.order_url !== null && typeof result.order_url !== 'string') return false;
    if (result.order_url) {
      try { const u = new URL(result.order_url); if (u.origin !== ETJ_ORIGIN || u.pathname !== '/etj-tilaussopimus.html' || u.searchParams.get('koodi') !== result.lead_code) return false; }
      catch (_) { return false; }
    }
    return typeof result.contact_email === 'string' && result.contact_email.length <= 320;
  }
  window.addEventListener('message', async event => {
    if (event.origin !== ETJ_ORIGIN || !event.data || typeof event.data !== 'object') return;
    const item = pending.get(event.data.requestId);
    if (!item || event.source !== item.window || Date.now() - item.created > 30 * 60 * 1000) return;
    if (event.data.type === 'etj:suppilo-ready') {
      item.window.postMessage({ type:'suppilo:order-data', requestId:item.id, payload:item.payload }, ETJ_ORIGIN);
    } else if (event.data.type === 'etj:suppilo-result' && validResult(event.data.result)) {
      if (!item.result) item.result = event.data.result;
      await saveResult(item);
    }
  });

  function showResult(item) {
    context = item.context;
    get('overlay').classList.remove('hidden'); get('result').hidden = false;
    get('url').value = item.result.order_url || ''; get('copy').hidden = !item.result.order_url;
    get('submit').hidden = true;
    const delivery = !item.result.order_url ? 'ETJ loi asiakaskoodin, mutta sopimuslinkin osoite puuttuu. Tarkista ETJ:n ilmoitus.' : item.result.email_sent ? 'Sopimuslinkki luotu ja sähköposti lähetetty.' : 'Sopimuslinkki luotu, mutta sähköposti ei lähtenyt. Tarkista ETJ:n ilmoitus ja kopioi linkki tarvittaessa.';
    get('status').textContent = delivery + (item.saved ? ' Tallennettu asiakashistoriaan.' : ' Historian tallennus ei onnistunut. Yritä tallennusta uudelleen; älä lähetä linkkiä uudelleen.');
    get('retry-save').hidden = !!item.saved;
    get('retry-save').onclick = () => saveResult(item);
  }

  async function saveResult(item) {
    if (item.saving) return;
    if (item.saved) { item.window.postMessage({ type:'suppilo:order-saved', requestId:item.id }, ETJ_ORIGIN); return; }
    item.saving = true;
    try {
      const p = allProspects.find(x => x.spara_id === item.sid);
      if (!p) throw new Error('Asiakastiliä ei löydy.');
      // Retrying history storage reuses the activity, never the send-link call.
      if (!parseActs(p).some(a => a.etj_request_id === item.id)) {
        const r = item.result;
        const acts = parseActs(p);
        acts.push({ tyyppi:'kommentti', teksti:`ETJ-tilauslinkin tulos. Koodi: ${r.lead_code}. Vastaanottaja: ${r.contact_email}. Sähköposti: ${r.email_sent ? 'lähetetty' : 'ei lähetetty'}.\n${r.order_url || 'Sopimuslinkin osoite puuttuu.'}`, tekija:currentUser?.nimi || currentUserEmail || null, created_at:new Date().toISOString(), etj_request_id:item.id });
        p.aktiviteetit = JSON.stringify(acts);
      }
      await saveCrmState(p);
      item.saved = true;
      if (currentId === p.spara_id) renderActivities(p);
      item.window.postMessage({ type:'suppilo:order-saved', requestId:item.id }, ETJ_ORIGIN);
    } catch (error) { showToast('ETJ-linkki luotu, historian tallennus epäonnistui: ' + error.message, 'error'); }
    finally { item.saving = false; showResult(item); }
  }
})();
