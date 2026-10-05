const { PGlite } = require('@electric-sql/pglite');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of readdirSync(path.join(__dirname,'../supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()) {
    try { await db.exec(readFileSync(path.join(__dirname,'../supabase/migrations',file),'utf8')); }
    catch(error) {throw new Error(`${file}: ${error.message}`,{cause:error});}
  }
  return db;
}
module.exports={database};
