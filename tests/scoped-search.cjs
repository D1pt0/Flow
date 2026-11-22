const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('android/assets/web/app.js','utf8');
const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:''});return nodes.get(id)};
const dir=(name,url)=>({name,url,directory:true}),file=(name,url)=>({name,url,directory:false});
let rootRelease,englishRelease;const calls=[];
const listings={
 'http://test/h/':{files:[dir('1999','http://test/h/1999/'),dir('2026','http://test/h/2026/')]},
 'http://test/h/1999/':{files:[file('Old Hindi (1999).mkv','http://cdn.test/h/old.mkv')]},
 'http://test/h/2026/':{files:[file('New Hindi (2026).mkv','http://cdn.test/h/new.mkv')]},
 'http://test/e/':{files:[file('English (2026).mkv','http://test/e/movie.mkv')]}
};
const context={console,URL,Map,Set,Promise,$,ROOT:'http://test/',catalogGeneration:0,catalog:new Map(),catalogRunning:false,catalogFailed:0,
catalogController:null,homeScope:{url:'http://test/h/',label:'Hindi'},stableFeedOrder:[],state:{view:'home'},feedLimit:24,
read:()=>({items:[]}),write(){},scheduleCatalogPaint(){},catalogStatus:$('status'),isMovie:item=>!item.directory,
window:{flowListNetwork:url=>{calls.push(url);if(url==='http://test/')return new Promise(resolve=>rootRelease=resolve);if(url==='http://test/e/')return new Promise(resolve=>englishRelease=resolve);return Promise.resolve(listings[url]);}}};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function catalogItems('),source.indexOf('// Preserve quality ranking')),context);
vm.runInContext(source.slice(source.indexOf('async function startCatalog('),source.indexOf('function watchedKey(')),context);
(async()=>{
 const scanning=context.startCatalog();
 context.catalogController.prioritize('http://test/h/');
 assert.equal(calls[1],'http://test/h/');
 rootRelease({files:[dir('English','http://test/e/'),dir('Hindi','http://test/h/')]});
 for(let i=0;i<20;i++)await Promise.resolve();
 assert(context.catalogRunning);
 assert.equal(context.scopeStatus('http://test/h/').running,false);
 const hindi=context.homeItemsInScope();
 assert.equal(hindi.length,2);assert(hindi.some(item=>item.name.includes('1999')));
 assert(hindi.every(item=>item.name.includes('Hindi')));
 assert.equal(calls.filter(url=>url==='http://test/h/').length,1);
 englishRelease(listings['http://test/e/']);await scanning;
 assert.equal(context.itemsInScope(context.ROOT).length,3);
 context.homeScope=null;assert.equal(context.homeItemsInScope().length,3);
 assert(!context.withinFolder('http://test/hindi-other/movie','http://test/h/'));
 assert(!context.withinFolder('http://other.test/h/movie','http://test/h/'));
 console.log('PASS prioritized category traversal, every year, CDN provenance, independent scope completion, whole-server reset and no duplicate scans.');
})().catch(error=>{console.error(error);process.exit(1)});
