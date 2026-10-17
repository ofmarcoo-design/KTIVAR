// Independent of npm audit: check GitHub's reviewed advisories for every pinned direct dependency.
const {dependencies={},devDependencies={}}=require('../package.json');
(async()=>{
 const results=await Promise.all(Object.entries({...dependencies,...devDependencies}).map(async([name,version])=>{
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error(`Pin an exact version for ${name}.`);
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if(process.env.GITHUB_TOKEN)headers.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
  const url='https://api.github.com/advisories?ecosystem=npm&per_page=100&affects='+encodeURIComponent(name+'@'+version);
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(!response.ok)throw new Error(`Advisory lookup failed for ${name}: HTTP ${response.status}.`);
  const data=await response.json();if(!Array.isArray(data))throw new Error(`Invalid advisory response for ${name}.`);
  const advisories=data.filter(item=>!item.withdrawn_at);
  console.log(`${name}@${version}: ${advisories.length} reviewed advisories`);
  for(const advisory of advisories)console.error(`${advisory.ghsa_id} (${advisory.severity}): ${advisory.html_url}`);
  return advisories.length;
 }));
 if(results.some(count=>count>0))process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
