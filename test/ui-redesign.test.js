const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const dashboard=read('public/dashboard.js');
const view=read('views/dashboard.html');
const css=read('public/app.css');
const shell=read('public/shell.js');

test('dashboard renders four real KPIs from overview without demo percentages',()=>{
 for(const field of ['data.clients','data.active','data.stock','data.scans.days30'])assert.ok(dashboard.includes(field),field);
 assert.ok(view.includes('id="overview-metrics"'));
 assert.ok(!view.includes('+600%'));
 assert.ok(!view.includes('Ticket médio'));
 assert.ok(!dashboard.includes('Math.random('));
});
test('ranking uses actual access counts and links to the existing plates module',()=>{
 assert.ok(dashboard.includes('data.topPlates.map('));
 assert.ok(dashboard.includes('plate.count'));
 assert.ok(dashboard.includes('/plates?code='));
 assert.ok(dashboard.includes('ranked-plate-track'));
});
test('all layout modules share the same UI foundation, current theme and route contracts',()=>{
 assert.ok(css.includes('KTIVAR product-wide visual foundation'));
 assert.ok(css.includes('KTIVAR Dashboard reference design'));
 assert.ok(css.includes('html[data-theme="dark"]'));
 assert.ok(shell.includes('document.body.dataset.uiModule=uiModule'));
 for(const name of ['dashboard','manage','plates','reports']){
  const html=read('views/'+name+'.html');
  assert.ok(html.includes('/assets/theme.js'),name);
  assert.ok(html.includes('/assets/shell.js'),name);
  assert.ok(html.includes('/assets/app.css'),name);
 }
});
