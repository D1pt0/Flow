const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('android/assets/web/app.js','utf8');
const now=Date.now(),week=7*86400000;
const data={
 'flow-online-art-v1':JSON.stringify({old:{at:now-week-1},recent:{at:now-1000}}),
 'flow-artwork-v2':'{}',
 'flow-catalog:old':JSON.stringify({at:now-week-1,items:[]}),
 'flow-catalog:legacy':'[]',
 'flow-catalog:new':JSON.stringify({at:now,items:[]}),
 'flow-watchlist-v2':'[{"url":"keep"}]','flow-watched-v1':'{"keep":true}','flow-recent-v2':'[1]',
 'flow-server':'http://keep/'
};
const storage=new Proxy({},{
 ownKeys:()=>Object.keys(data),getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true}),
 get(_,key){if(key==='removeItem')return name=>delete data[name];if(key==='setItem')return (name,value)=>data[name]=value;return data[key]}
});
const context={Date,JSON,Object,Set,Map,localStorage:storage,CACHE_WEEK:week,read:(key,fallback)=>data[key]?JSON.parse(data[key]):fallback,write:(key,value)=>data[key]=JSON.stringify(value)};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function pruneStoredCaches'),source.indexOf('pruneStoredCaches();')),context);
context.pruneStoredCaches(now);
assert(!JSON.parse(data['flow-online-art-v1']).old);
assert(JSON.parse(data['flow-online-art-v1']).recent);
assert(!data['flow-catalog:old']&&!data['flow-catalog:legacy']);
assert(data['flow-catalog:new']);
for(const key of ['flow-watchlist-v2','flow-watched-v1','flow-recent-v2','flow-server'])assert(data[key]);
Object.assign(context,{watched:{},title:item=>item.title||item.name,year:item=>item.year||'',state:{view:'home'},document:{querySelectorAll:()=>[]},$:()=>null,toast(){},onlineArtCache:{},infoCache:new Map(),artCache:{},serverArtFallback:new Map(),artKey:item=>item.name,renderHomeGrid(){},renderSaved(){}});
vm.runInContext(source.slice(source.indexOf('function watchedKey('),source.indexOf('const detailWatched=')),context);
const item={name:'Arrival (2016)',title:'Arrival',year:'2016',url:'http://server/a',artwork:'https://image',directory:true};
context.toggleWatched(item);assert(context.isWatched(item));
assert(context.isWatched({...item,url:'http://server/duplicate'}));
assert(!JSON.stringify(context.watched).includes('https://image'));
context.toggleWatched(item);assert(!context.isWatched(item));
console.log('PASS seven-day expiry, legacy migration, fresh-cache retention, personal-data retention, watched toggle and duplicate-release identity.');
