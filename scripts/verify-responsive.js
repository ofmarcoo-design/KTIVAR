// Optional browser verification; Playwright is a development tool, not an app dependency.
const assert=require('node:assert/strict');
const express=require('express');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
(async()=>{
 const app=express();app.use(express.json());app.use('/assets',express.static(path.join(__dirname,'../public')));
 for(const page of ['login','plates','manage','reports'])app.get('/'+page,(req,res)=>res.sendFile(path.join(__dirname,`../views/${page}.html`)));
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
 const client={...plate.client,enabled:true,revision:0,contacts:[],client_tags:[],plates:[plate],sales:[]};
 const product={...plate.product,enabled:true,revision:0,priceCents:12990,generatesPlate:true};
 app.get('/api/workspace/reports',(req,res)=>{const current={newClients:0,confirmedSales:1,salesCents:25000,purchasingClients:1,platesSold:2,newPlates:1,registeredAccesses:30,won:1,lost:0,closed:1};res.json({from:req.query.from,to:req.query.to,previousFrom:'2026-09-01',previousTo:'2026-09-30',current,previous:{...current,salesCents:0},activePlatesNow:1,overdueNow:0,products:[{...product,salesCents:25000,quantity:2}],lossReasons:[],sources:[],segments:[],plateAccesses:[{code:plate.code,name:client.name,count:30}]});});
 app.get('/api/workspace/operators',(req,res)=>res.json([{id:client.id,email:'operator@example.test'}]));
 app.get('/api/workspace/catalogs/:kind',(req,res)=>res.json([{id:client.id,name:'Opção longa '.repeat(8),enabled:true,revision:0,color:'#667085',position:0}]));
 app.get('/api/workspace/clients/:id/profile',(req,res)=>res.json(client));
 const deal={id:client.id,clientId:client.id,name:'Negociação '.repeat(12),estimatedCents:40000,stageId:client.id,result:'open',revision:0,client:{...client,sales:[]},activities:[],deal_tags:[]};
 const activity={id:client.id,clientId:client.id,dealId:deal.id,typeId:client.id,name:'Atividade '.repeat(25),note:'Observação longa '.repeat(100),dueDate:'2026-10-06',revision:0,enabled:true,client,type:{name:'Follow-up'}};
 app.get('/api/workspace/clients/:id/timeline',(req,res)=>res.json({items:[{id:'event',createdAt:plate.createdAt,kind:'deals',description:'Cadastro: name',actorEmail:'operator@example.test',metadata:{}}],hasMore:false}));
 for(const type of ['clients','products','sales','deals','activities'])app.get('/api/workspace/'+type,(req,res)=>res.json({items:type==='clients'?[client]:type==='products'?[product]:type==='deals'?[deal]:type==='activities'?[activity]:[],hasMore:false}));
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
   for(const module of ['clients','products','sales','deals','activities','config']){
    await page.goto(`http://127.0.0.1:${server.address().port}/manage?module=${module}`);await page.locator('#module-title').waitFor();await check(module+' list');
    await page.locator('#create').click();await page.locator('#record-editor[open]').waitFor();await check(module+' form');
    if(module==='sales'){await page.locator('#add-item').click();await page.locator('.sale-item').nth(1).waitFor();await check('multiple sale items');}
    await page.locator('#editor-close').click();
    if(module==='clients'){await page.getByRole('button',{name:'Ver',exact:true}).click();await page.locator('#profile[open]').waitFor();await check('client profile');await page.locator('#profile-close').click();}
   }
   await page.goto(`http://127.0.0.1:${server.address().port}/reports`);await page.locator('#metrics .record-card').first().waitFor();await check('reports');await page.locator('#preset').selectOption('quarter');await check('quarter reports');await page.locator('#preset').selectOption('custom');await check('custom period');
   console.log(`PASS responsive: ${width}×${height}, login/plates/QR/forms/clients/sales/CRM/activities/config/reports.`);
  }
  assert.deepEqual(failures,[],'Browser JavaScript errors');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
