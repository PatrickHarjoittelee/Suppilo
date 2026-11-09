/* Suppilo: tilitunnisteet luetaan aina tallennushetkellä Sheetsin Tilit-sarakkeesta. */
(function(root) {
  'use strict';
  const repairedIds = new Set([
    'ID20269901','ID20269902','ID20269903','ID20269904',
    'ID20269905','ID20269906','ID20269907'
  ]);
  function nextIds(rows, count=1) {
    if (!Array.isArray(rows) || !Number.isInteger(count) || count<1 || count>100)
      throw new Error('Virheellinen Tilit-taulun ID-tarkistus');
    const used=new Set();
    let max=20260119;
    for (const row of rows) {
      const id=String(Array.isArray(row)?(row[0]??''):(row??'')).trim();
      if (!/^ID\d+$/.test(id)) continue;
      if (used.has(id)) throw new Error('Tilit-taulussa on päällekkäinen tili-ID: '+id);
      used.add(id);
      // Vuoden 2026 käsin korjatut tunnisteet ovat erillinen poikkeussarja.
      // Niitä ei muuteta eikä niiden vuoksi siirretä juoksevaa sarjaa 699xx:ään.
      if (!repairedIds.has(id)) max=Math.max(max,Number(id.slice(2)));
    }
    if (!Number.isSafeInteger(max)) throw new Error('Virheellinen tili-ID:n numeroarvo');
    const result=[];
    while (result.length<count) {
      const id='ID'+(++max);
      if (used.has(id)) continue;
      used.add(id);
      result.push(id);
    }
    return result;
  }
  function isRemovedTiliRow(row) {
    return Array.isArray(row) && /^ID\d+$/.test(String(row[0]??'').trim()) &&
      !String(row[4]??'').trim();
  }
  const api={nextIds,isRemovedTiliRow};
  root.SparaTiliId=api;
  if (typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
