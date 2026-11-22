const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('android/assets/web/app.js','utf8');
class Node {
 constructor(tag='div'){this.tag=tag;this.children=[];this.parentElement=null;this.classList={add(){}};this.moves=0;this.naturalWidth=100;}
 get firstElementChild(){return this.children[0]||null}
 get nextElementSibling(){if(!this.parentElement)return null;const a=this.parentElement.children;return a[a.indexOf(this)+1]||null}
 append(...nodes){for(const node of nodes)this.insertBefore(node,null)}
 insertBefore(node,cursor){if(node.parentElement)node.remove();const index=cursor?this.children.indexOf(cursor):this.children.length;this.children.splice(index,0,node);node.parentElement=this;this.moves++;}
 remove(){if(!this.parentElement)return;const a=this.parentElement.children;a.splice(a.indexOf(this),1);this.parentElement=null;}
 replaceWith(node){const parent=this.parentElement,index=parent.children.indexOf(this);this.remove();parent.children.splice(index,0,node);node.parentElement=parent;}
 querySelector(selector){return this.children.find(n=>selector==='img'?n.tag==='img':n.cls===selector.slice(1))||null}
 querySelectorAll(){return []}
 getAttribute(name){return this[name]}
}
let cards=0,ranked=[],input='Dune',selected='dune';
const context={flowPicks:new Set(),Date,console,WeakMap,Map,Set,Array,Boolean,Promise,
 filtered:items=>items,isMovie:()=>true,movieCard:item=>{cards++;const n=new Node();n.url=item.url;return n;},folderCard:()=>new Node(),
 observer:{unobserve(){}},icon:()=>new Node(),el:(tag,cls)=>{const n=new Node(tag);n.cls=cls;return n;},
 observed:new WeakMap(),getAlternativeArtwork:async()=>({}),recommendationItems:()=>ranked,stableFeedOrder:[],feedLimit:2,
 normalizeSearch:s=>s.toLowerCase(),title:i=>i.name,year:i=>i.year||'',catalogItems:()=>ranked,homeItemsInScope:()=>ranked,
 $:()=>({value:input}),selectedTitleQuery:selected,suggestionBox:{hidden:false}};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('const gridRecords='),source.indexOf('function skeleton(')),context);
const grid=new Node(),a={url:'a'},b={url:'b'},c={url:'c'};
context.renderGrid(grid,[a,b]);const first=grid.children[0],second=grid.children[1];const moves=grid.moves;
context.renderGrid(grid,[a,b]);assert.equal(cards,2);assert.equal(grid.moves,moves);assert.equal(grid.children[0],first);
context.renderGrid(grid,[a,b,c]);assert.equal(grid.children[1],second);assert.equal(cards,3);
vm.runInContext(source.slice(source.indexOf('function mixRecommendations('),source.indexOf('function recommendationItems(')),context);
ranked=[a,b];assert.deepEqual(context.stableRecommendations().map(i=>i.url),['a','b']);
ranked=[c,b,a];assert.deepEqual(context.stableRecommendations().map(i=>i.url),['a','b','c']);
context.feedLimit=3;context.stableRecommendations();ranked=[{url:'d'},c,b,a];assert.deepEqual(context.stableRecommendations().slice(0,3).map(i=>i.url),['a','b','c']);
ranked=[{name:'Dune',url:'a'},{name:'Dune Part Two',url:'b'},{name:'Other movie Dunes',url:'c'}];assert.equal(context.searchItems('Dune').length,2);
vm.runInContext(source.slice(source.indexOf('function renderSuggestions('),source.indexOf('async function updateSuggestions(')),context);
context.renderSuggestions();assert(context.suggestionBox.hidden);
vm.runInContext(source.slice(source.indexOf('const posterRequests='),source.indexOf('function savedItem(')),context);
(async()=>{
 const poster=new Node(),old=new Node('img');old.src='old';poster.append(old);
 const images=[];context.el=(tag)=>{const n=new Node(tag);images.push(n);return n;};
 context.setPosterImage(poster,'new');assert.equal(poster.children[0],old);
 const pending=images[0];pending.decode=()=>Promise.resolve();pending.onload();await Promise.resolve();await Promise.resolve();
 assert.equal(poster.children[0],pending);
 context.setPosterImage(poster,'broken');images[1].onerror();assert.equal(poster.children[0],pending);
 context.setPosterImage(poster,'stale');context.setPosterImage(poster,'latest');images[2].onload();assert.equal(poster.children[0],pending);
 images[3].onload();assert.equal(poster.children[0],images[3]);
 console.log('PASS stable card/image identity, append-only feed, decoded image swap, failed/stale image retention, focused title search and dismissed suggestions.');
})().catch(error=>{console.error(error);process.exit(1)});
