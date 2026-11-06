/* KTIVAR theme preferences: no external dependency, no user data or server calls. */
(()=>{
 'use strict';
 const key='ktivar.ui.theme';
 const allowed=['light','dark','auto'];
 const media=window.matchMedia('(prefers-color-scheme: dark)');
 const read=()=>{try{const value=localStorage.getItem(key);return allowed.includes(value)?value:'light';}catch{return 'light';}};
 let preference=read();
 const apply=()=>{
  const resolved=preference==='auto'?(media.matches?'dark':'light'):preference;
  document.documentElement.dataset.theme=resolved;
  document.documentElement.dataset.themePreference=preference;
  document.documentElement.style.colorScheme=resolved;
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=resolved==='dark'?'#0b0b0c':'#F9FBFF';
  document.querySelectorAll('[data-theme-choice]').forEach(button=>{
   const active=button.dataset.themeChoice===preference;
   button.setAttribute('aria-pressed',String(active));
  });
 };
 const set=value=>{
  if(!allowed.includes(value))return;
  preference=value;
  try{localStorage.setItem(key,value);}catch{/* Theme still switches when storage is disabled. */}
  apply();
 };
 apply();
 if(media.addEventListener)media.addEventListener('change',()=>{if(preference==='auto')apply();});
 window.addEventListener('storage',event=>{if(event.key===key){preference=read();apply();}});
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-theme-choice]');
  if(button)set(button.dataset.themeChoice);
 });
 document.addEventListener('DOMContentLoaded',apply);
 window.KTIVARTheme={apply,set,get:()=>preference};
})();
