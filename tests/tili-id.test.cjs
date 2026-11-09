const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {nextIds,isRemovedTiliRow}=require('../tili-id.js');

test('new ID follows latest regular Sheets ID rather than 202699xx repair series',()=>{
  const ids=['Spara Account ID','ID20260516','ID20269903','ID20260517','ID20269901','ID20269907'].map(s=>[s]);
  assert.deepEqual(nextIds(ids),['ID20260518']);
});
test('JSON/TXT batch receives sequential distinct IDs from one fresh Sheets read',()=>{
  assert.deepEqual(nextIds([['ID20260517'],['ID20269905']],5),[
    'ID20260518','ID20260519','ID20260520','ID20260521','ID20260522'
  ]);
});
test('deleted account row keeps reserved ID but is hidden from account list',()=>{
  const removed=['ID20260518','','','',''];
  assert.equal(isRemovedTiliRow(removed),true);
  assert.equal(isRemovedTiliRow(['ID20260518','','','','Uusi Oy']),false);
  assert.deepEqual(nextIds([['ID20260517'],removed]),['ID20260519']);
});
test('account ID is not reused even after multiple deletions',()=>{
  assert.deepEqual(nextIds([['ID20260517'],['ID20260518','','','',''],['ID20260519','','','','']]),['ID20260520']);
});
test('existing duplicated IDs block a save instead of making a new collision',()=>{
  assert.throws(()=>nextIds([['ID20260512'],['ID20260512']]),/päällekkäinen/);
});
test('repair IDs remain permanently reserved if the normal sequence reaches them',()=>{
  assert.deepEqual(nextIds([['ID20269900'],...Array.from({length:7},(_,i)=>['ID2026990'+(i+1)])]),['ID20269908']);
});
test('all account-creation paths use fresh Sheet IDs and deletion keeps tombstone',()=>{
  const crm=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
  assert.match(crm,/async function createProspectAccountsBatch\([\s\S]+?const newIds=SparaTiliId\.nextIds\(tiliColA,candidates\.length\)/);
  assert.match(crm,/async function saveNewTili\([\s\S]+?const id=SparaTiliId\.nextIds\(colA\)\[0\]/);
  assert.match(crm,/async function createTiliFromContactForm\([\s\S]+?const id=SparaTiliId\.nextIds\(colA\)\[0\]/);
  assert.match(crm,/function parseProspects\([\s\S]+?SparaTiliId\.isRemovedTiliRow\(c\)/);
  assert.match(crm,/async function confirmDeleteTili\([\s\S]+?\[sid,\.\.\.Array\(27\)\.fill\(''\)\]/);
  assert.match(crm,/accept="\.json,\.txt,application\/json,text\/plain"/);
});
