// Read-only monitoring metadata for authenticated KTIVAR users.
// Never request credentials, expose server environment, or write to GitHub.
const RUNS_URL='https://api.github.com/repos/ofmarcoo-design/KTIVAR/actions/workflows/ktivar-database-monitor.yml/runs?per_page=1';
async function latestMonitorRun(fetchFn=fetch){
  const response=await fetchFn(RUNS_URL,{
    headers:{Accept:'application/vnd.github+json','User-Agent':'KTIVAR-notification-center'},
    signal:AbortSignal.timeout(6000)
  });
  if(!response.ok)throw new Error('Monitor status unavailable');
  const payload=await response.json();
  const run=Array.isArray(payload.workflow_runs)?payload.workflow_runs[0]:null;
  if(!run)return null;
  return {
    state:run.status==='completed'?(run.conclusion==='success'?'success':'failed'):'running',
    completedAt:run.updated_at||null,
    url:typeof run.html_url==='string'&&run.html_url.startsWith('https://github.com/ofmarcoo-design/KTIVAR/actions/runs/')?run.html_url:null
  };
}
function registerAutomationStatus(api,{getLatest=latestMonitorRun}={}){
 api.get('/automations/status',async(req,res)=>{
   res.set('Cache-Control','no-store');
   try{res.json({monitor:await getLatest()});}
   catch{res.status(503).json({error:'Histórico do monitor temporariamente indisponível.'});}
 });
}
module.exports={registerAutomationStatus,latestMonitorRun};
