// Optional browser verification; Playwright is a development tool, not an app dependency.
const assert=require('node:assert/strict');
const express=require('express');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
(async()=>{
 const app=express();app.use(express.json());app.use('/assets',express.static(path.join(__dirname,'../public')));
 for(const page of ['login','plates'])app.get('/'+page,(req,res)=>res.sendFile(path.join(__dirname,`../views/${page}.html`)));
 const statuses=[{id:'00000000-0000-4000-8000-000000000001',key:'active',name:'Ativa',color:'#187446',position:0,enabled:true,redirects:true}];
 const plate={code:'PL-000143',revision:0,status:'active',purpose:'other',clientId:statuses[0].id,client:{id:statuses[0].id,name:'Nome muito longo '.repeat(10),company:'Empresa '.repeat(20)},product:{id:statuses[0].id,name:'Produto '.repeat(20)},installationLocation:'Local '.repeat(60),destinationUrl:'https://example.test/'+ 'destino'.repeat(200),permanentUrl:'https://plates.example.test/r/PL-000143',createdAt:new Date().toISOString()};
 app.get('/api/session',(req,res)=>res.json({email:'operator-with-a-long-email-address@example.test'}));
 app.get('/api/plate-statuses',(req,res)=>res.json(statuses));
 app.get('/api/plates',(req,res)=>res.json({items:[plate],hasMore:false}));
 app.get('/api/plates/:code',(req,res)=>res.json(plate));
 app.get('/api/plates/:code/analytics',(req,res)=>res.json({today:123,days7:321,days30:432,total:1000}));
 app.get('/api/plates/:code/destination-history',(req,res)=>res.json({items:[{createdAt:plate.createdAt,actorEmail:'operator@example.test',previousUrl:plate.destinationUrl,destinationUrl:plate.destinationUrl}],hasMore:false}));
 app.get('/api/plates/:code/qr.svg',async(req,res)=>res.type('svg').send(await require('qrcode').toString(plate.permanentUrl,{type:'svg'})));
 for(const type of ['clients','products'])app.get('/api/'+type,(req,res)=>res.json([type==='clients'?plate.client:plate.product]));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
 const failures=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
  const page=await browser.newPage();page.on('pageerror',error=>failures.push(error.message));
  for(const [width,height] of [[320,640],[390,844],[768,1024],[1440,900],[844,390]]){
   await page.setViewportSize({width,height});
   const check=async label=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}: page overflow in ${label}`);for(const dialog of await page.locator('dialog[open]').all())assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true,`${width}: dialog overflow in ${label}`);};
   await page.goto(`http://127.0.0.1:${server.address().port}/login`);await check('login');
   await page.goto(`http://127.0.0.1:${server.address().port}/plates`);await page.getByRole('button',{name:'Ver',exact:true}).waitFor();await check('list');
   await page.getByRole('button',{name:'Ver',exact:true}).click();await page.locator('#qr-image').waitFor();await check('viewer');
   await page.locator('#view-destination').click();await check('destination');await page.locator('#destination-cancel').click();await page.locator('#view-close').click();
   await page.locator('#new').click();await page.locator('#editor[open]').waitFor();await check('editor');await page.locator('#add-client').click();await check('client');await page.locator('#reference-cancel').click();await page.locator('#editor [data-close]').first().click();
   await page.locator('#configure-statuses').click();await page.locator('.status-row').waitFor();await check('status manager');await page.locator('#status-close').click();
   console.log(`PASS responsive: ${width}×${height}, login/list/QR/edit/destination/client/status.`);
  }
  assert.deepEqual(failures,[],'Browser JavaScript errors');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
