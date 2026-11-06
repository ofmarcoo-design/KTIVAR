const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const script=fs.readFileSync(path.join(__dirname,'../public/theme.js'),'utf8');
function setup(stored=null,darkSystem=false,allowStorage=true){
 const listeners={};
 const buttons=['light','dark','auto'].map(value=>({
  dataset:{themeChoice:value},attributes:{},
  setAttribute(name,value){this.attributes[name]=value;}
 }));
 const meta={content:'#0F172A'};
 const storage={value:stored,getItem(){if(!allowStorage)throw Error('blocked');return this.value;},setItem(key,value){if(!allowStorage)throw Error('blocked');this.value=value;}};
 const root={dataset:{},style:{}};
 const media={matches:darkSystem,addEventListener(type,callback){listeners.media=callback;}};
 const document={
  documentElement:root,
  querySelector(selector){return selector==='meta[name="theme-color"]'?meta:null;},
  querySelectorAll(selector){return selector==='[data-theme-choice]'?buttons:[];},
  addEventListener(type,callback){listeners[type]=callback;}
 };
 const window={matchMedia:()=>media,addEventListener(type,callback){listeners[type]=callback;}};
 vm.runInNewContext(script,{document,window,localStorage:storage});
 return {root,meta,buttons,storage,media,listeners,theme:window.KTIVARTheme};
}

test('light is the initial neutral theme and dark persists across navigation',()=>{
 const a=setup();
 assert.equal(a.root.dataset.theme,'light');
 assert.equal(a.theme.get(),'light');
 a.theme.set('dark');
 assert.equal(a.root.dataset.theme,'dark');
 assert.equal(a.meta.content,'#0b0b0c');
 assert.equal(a.buttons[1].attributes['aria-pressed'],'true');
 const b=setup(a.storage.value);
 assert.equal(b.root.dataset.theme,'dark');
});

test('automatic mode responds to system theme changes without rewriting preference',()=>{
 const s=setup('auto',true);
 assert.equal(s.root.dataset.theme,'dark');
 s.media.matches=false;s.listeners.media();
 assert.equal(s.root.dataset.theme,'light');
 assert.equal(s.theme.get(),'auto');
 assert.equal(s.buttons[2].attributes['aria-pressed'],'true');
});

test('blocked storage and invalid preferences fail safely',()=>{
 const s=setup('other',false,false);
 assert.equal(s.root.dataset.theme,'light');
 s.theme.set('dark');
 assert.equal(s.root.dataset.theme,'dark');
 s.theme.set('invalid');
 assert.equal(s.root.dataset.theme,'dark');
});

test('admin and public pages load theme before the main CSS',()=>{
 for(const page of ['dashboard','manage','plates','reports','login','client-portal']){
  const html=fs.readFileSync(path.join(__dirname,'../views/'+page+'.html'),'utf8');
  assert.ok(html.indexOf('/assets/theme.js')>=0,page);
  assert.ok(html.indexOf('/assets/theme.js')<html.indexOf('/assets/app.css'),page);
 }
});
