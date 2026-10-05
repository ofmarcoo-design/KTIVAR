const {readdirSync}=require('node:fs');
const {execFileSync}=require('node:child_process');
const files=['server.js',...['modules','public','scripts'].flatMap(dir=>readdirSync(dir).filter(name=>name.endsWith('.js')).map(name=>`${dir}/${name}`))];
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
console.log(`Syntax checked: ${files.length} JavaScript files.`);
