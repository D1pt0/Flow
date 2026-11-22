const {spawnSync}=require('node:child_process');
const {readdirSync}=require('node:fs');
const {join}=require('node:path');
process.chdir(join(__dirname,'..'));
for(const file of readdirSync(__dirname).filter(name=>name.endsWith('.cjs')&&name!=='run.cjs')){
 const result=spawnSync(process.execPath,[join(__dirname,file)],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status||1);
}
