// Optional actual-browser verification; no application/production data is changed.
const express=require('express');const path=require('node:path');const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
(async()=>{
 const app=express();app.use((req,res,next)=>{res.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");next();});require('../modules/pwa').registerPwa(app);app.use('/assets',express.static(path.join(__dirname,'../public')));
 app.get('/login',(req,res)=>res.sendFile(path.join(__dirname,'../views/login.html')));
 let reads=0,writes=0,lookups=0,destination='first';app.get('/api/session',(req,res)=>res.set('Cache-Control','no-store').json({reads:++reads}));app.post('/api/action',(req,res)=>res.json({writes:++writes}));app.get('/r/:code',(req,res)=>{lookups++;res.set('Cache-Control','no-store').redirect(302,'/destination/'+destination);});app.get('/destination/:name',(req,res)=>res.send(req.params.name));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base+'/login');await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const cdp=await context.newCDPSession(page);const manifest=await cdp.send('Page.getAppManifest');assert.equal(manifest.errors.length,0);assert.equal(JSON.parse(manifest.data).display,'standalone');const installation=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installation.installabilityErrors,[]);
  assert.equal(await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).scope),base+'/');assert.deepEqual(await page.evaluate(()=>caches.keys().then(keys=>keys.filter(k=>k.startsWith('ktivar')))),[]);
  const fresh=()=>page.evaluate(()=>fetch('/api/session').then(r=>r.json()));assert.equal((await fresh()).reads,1);assert.equal((await fresh()).reads,2);
  assert.equal(await page.evaluate(()=>fetch('/api/action',{method:'POST'}).then(r=>r.json()).then(d=>d.writes)),1);
  await page.goto(base+'/r/PL-000143');assert.equal(await page.locator('body').textContent(),'first');destination='second';await page.goto(base+'/r/PL-000143');assert.equal(await page.locator('body').textContent(),'second');assert.equal(lookups,2);
  await page.goto(base+'/login');await context.setOffline(true);assert.equal(await page.evaluate(()=>fetch('/api/session').then(()=>true,()=>false)),false,'Offline API must fail rather than serve cached private data');await context.setOffline(false);
  await page.emulateMedia({colorScheme:'light'});await page.setViewportSize({width:390,height:844});await page.reload();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#login input').first().evaluate(n=>getComputedStyle(n).fontSize),'16px');assert.deepEqual(errors,[]);
  console.log('PASS PWA: manifest/installability, root worker, PNG icons, fresh API/POST, mutable redirect and no private cache.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
