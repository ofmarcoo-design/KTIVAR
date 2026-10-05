// Restore rehearsal on an isolated PGlite fixture only. No production connection accepted.
const tables=['plate_statuses','client_segments','client_sources','tags','product_categories','product_types','activity_types','loss_reasons','crm_stages','clients','products','contacts','client_tags','deals','deal_tags','activities','sales','sale_items','plates','plate_destination_history','plate_scan_events','plate_scan_daily','audit_log'];
async function restoreFixture(db,backup){
 if(!(db instanceof require('@electric-sql/pglite').PGlite)||typeof db.exec!=='function')throw new Error('Use an isolated PGlite fixture.');
 if(backup?.format!=='ktivar-app-backup'||backup.version!==1||tables.some(t=>!Array.isArray(backup.tables?.[t])))throw new Error('Invalid backup format.');
 const quote=s=>'"'+s.replaceAll('"','""')+'"';
 await db.exec('begin');try{
  const owners=new Set((backup.operators||[]).map(x=>x.id));for(const table of ['clients','deals','activities'])for(const row of backup.tables[table])if(row.ownerId)owners.add(row.ownerId);
  for(const id of owners)await db.query('insert into auth.users(id,email) values($1,$2) on conflict(id) do nothing',[id,backup.operators?.find(x=>x.id===id)?.email||null]);
  for(const operator of backup.operators||[])await db.query('insert into plate_access("userId") values($1) on conflict do nothing',[operator.id]);
  for(const table of tables)await db.exec(`alter table public.${table} disable trigger user`);
  await db.exec(`truncate ${tables.map(t=>'public.'+t).join(',')}`);
  for(const table of tables){
   const columns=(await db.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2 and is_generated=$3',['public',table,'NEVER'])).rows.map(r=>r.column_name);
   for(const row of backup.tables[table]){
    const names=columns.filter(c=>Object.hasOwn(row,c));const values=names.map(c=>row[c]!==null&&typeof row[c]==='object'?JSON.stringify(row[c]):row[c]);
    // PGlite encodes JS arrays as json; text[] must be supplied as a PostgreSQL array literal.
    if(table==='audit_log'){const index=names.indexOf('changedFields');if(index>=0)values[index]='{'+row.changedFields.map(v=>'"'+v.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"').join(',')+'}';}
    await db.query(`insert into public.${table} (${names.map(quote).join(',')}) values (${names.map((_,i)=>'$'+(i+1)).join(',')})`,values);
   }
  }
  await db.exec('set constraints all immediate');
  for(const table of tables)await db.exec(`alter table public.${table} enable trigger user`);
  await db.exec("select setval('public.plate_code_sequence',greatest(coalesce((select max(substring(code from 4)::integer) from public.plates),0)+1,1),false)");
  await db.exec('commit');
 }catch(e){await db.exec('rollback');throw e;}
}
module.exports={restoreFixture,tables};
