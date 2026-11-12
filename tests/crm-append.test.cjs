const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync(__dirname + '/../crm.html', 'utf8');
const start = html.indexOf('let crmAppendQueue = Promise.resolve();');
const end = html.indexOf('// ── Load', start);
assert.ok(start >= 0 && end > start, 'CRM-lisäysapu löytyy crm.html:stä');
assert.doesNotMatch(html, /sheetAppend\(`\$\{CRM_TAB\}!A:M`/);

const ids = [['spara_id'], ['ID1'], [], ['ID3']];
const writes = [];
const context = vm.createContext({
  Promise,
  Array,
  Error,
  Math,
  CRM_TAB: 'CRM-tila',
  CRM_COLS: Array(13).fill(''),
  sheetGet: async range => {
    assert.equal(range, 'CRM-tila!A:A');
    return ids.map(row => [...row]);
  },
  sheetPut: async (range, rows) => {
    writes.push({range, rows});
    for (const row of rows) ids.push([row[0]]);
  }
});
vm.runInContext(html.slice(start, end), context);

(async () => {
  context.rows1 = [['ID4', 'Kontaktoi']];
  context.rows2 = [['ID5', 'Sovi tapaaminen']];
  await Promise.all([
    vm.runInContext('appendCrmRows(rows1)', context),
    vm.runInContext('appendCrmRows(rows2)', context)
  ]);

  assert.deepEqual(writes.map(x => x.range), [
    'CRM-tila!A5:M5',
    'CRM-tila!A6:M6'
  ]);
  assert.deepEqual(writes.map(x => x.rows[0][0]), ['ID4', 'ID5']);

  context.tooWide = [Array(14).fill('x')];
  await assert.rejects(
    vm.runInContext('appendCrmRows(tooWide)', context),
    /enintään 13 saraketta/
  );

  console.log('PASS: CRM-rivit kirjoitetaan A:M-alueen seuraaville riveille, yhtäaikaiset lisäykset jonotetaan ja ylileveä rivi hylätään.');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
