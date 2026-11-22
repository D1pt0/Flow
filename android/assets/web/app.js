let $=id=>document.getElementById(id),media=$('media'),ROOT=localStorage.getItem('flow-server')||'http://172.16.50.4/';

const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};

const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};

const CACHE_WEEK=7*86400000;
function pruneStoredCaches(now=Date.now()){
 const posters=read('flow-online-art-v1',{});
 for(const [key,value] of Object.entries(posters))if(!value?.at||now-value.at>=CACHE_WEEK)delete posters[key];
 write('flow-online-art-v1',posters);
 localStorage.removeItem('flow-artwork-v2');
 for(const key of Object.keys(localStorage)){
  if(!key.startsWith('flow-catalog:'))continue;
  const entry=read(key,null);
  if(typeof entry?.at!=='number'||now-entry.at>=CACHE_WEEK)localStorage.removeItem(key);
 }
}
pruneStoredCaches();
let watched=read('flow-watched-v1',{}),watchedView=false,includeWatched=false;

const state={view:'home',categories:[],homeItems:[],homeURL:null,homeLabel:'',history:[],browseItems:[],browseURL:null,list:false,current:null,selected:null,hero:null};

let saved=read('flow-watchlist-v2',[]).filter(x=>x&&/^(https?|content):/.test(x.url)).slice(0,200),recent=read('flow-recent-v2',[]).filter(x=>x&&/^(https?|content):/.test(x.url)).slice(0,30),artCache=read('flow-artwork-v2',{}),toastTimer,lastProgress=0,homeVersion=0,browseVersion=0,detailVersion=0;

const onlineArtCache=read('flow-online-art-v1',{}),artInflight=new Map(),serverArtFallback=new Map(),artJobs=[];let artActive=0;
const detailsCache=new Map(),inflight=new Map(),jobs=[];let activeJobs=0;

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}

function icon(name){const n=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS(n.namespaceURI,'use');use.setAttribute('href','#i-'+name);n.append(use);return n}

function setIcon(button,name){button.replaceChildren(icon(name))}

function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500)}

function releaseName(item) {
  return (item.name || '').replace(/\.(mp4|mkv|webm|avi|mov|ts|m2ts|mpg|mpeg|m4v|wmv|flv|3gp|3g2|vob|ogv|mp3|m4a|aac|wav|ogg|opus|flac|ac3|eac3|dts|aiff|aif|wma|mka|m3u8|mpd)$/i, '')
    .replace(/^(?:www\.)?[a-z0-9-]+\.(?:com|net|org|site|bd)\s*[-–]\s*/i, '')
    .replace(/[._]+/g, ' ').trim();
}

function releaseDate(name) {
  const explicit = /[([]((?:19|20)\d{2})[)\]]/.exec(name);
  if (explicit) return explicit;
  const candidates = Array.from(name.matchAll(/\b((?:19|20)\d{2})\b/g));
  return candidates.reverse().find(match => match.index > 0 && /^(?:\s*[-–(\[]?\s*(?:2160p|1080[pi]|720p|480p|4k|s\d{1,2}\b|amzn|nf\b|web|bluray|x26[45]|h26[45]|hdtc|hdcam|hdrip|multi|dual|hindi|english|bengali)|\s*$)/i.test(name.slice(match.index + 4)));
}

function year(item){return releaseDate(releaseName(item))?.[1] || ''}

function title(item) {
  if (item.title) return item.title;
  const name = releaseName(item);
  const date = releaseDate(name);
  const cleaned = (date ? name.slice(0,date.index) : name)
    .replace(/\b(?:2160p|1080[pi]|720p|480p|WEBRip|WEB[ -]DL|BluRay|x264|x265)\b.*$/i,'')
    .replace(/\s*[-–(\[]?\s*$/,'').trim();
  return cleaned || name || 'Untitled media';
}

function quality(item){return item.name.match(/\b(2160p|1080p|720p|480p|4K)\b/i)?.[0]||''}

function isAudio(item){return item.audio||/\.(mp3|m4a|aac|wav|ogg|opus|flac|ac3|eac3|dts|aiff|aif|wma|mka)(?:\?|$)/i.test(item.url)}

function isMovie(item){if(item.directory&&item.local)return false;return !item.directory || (!!year(item) && !/^[[(]?\d{4}[)\]]?$/.test(item.name.trim()))}

function language(item){return /dual|multi.?audio/i.test(item.name)?'Dual audio':isAudio(item)?'Audio':'Video'}

function artKey(item){return title(item).toLowerCase()+'|'+year(item)}
function safeOnlineImage(url){try{const u=new URL(url);return u.protocol==='https:'&&['m.media-amazon.com','upload.wikimedia.org'].includes(u.hostname)}catch{return false}}
function art(item) {
  const entry=onlineArtCache[artKey(item)];
  const remote = [entry&&Date.now()-entry.at<CACHE_WEEK?entry.url:'', item.artwork].find(url => safeOnlineImage(url) && !failedImages.has(url));
  const fallback = serverArtFallback.get(item.url);
  return remote || (fallback && !failedImages.has(fallback) ? fallback : '');
}

function metadata(target,item){target.replaceChildren();for(const text of [year(item),quality(item),/dual|multi.?audio/i.test(item.name)?'Dual audio':isAudio(item)?'Audio':''].filter(Boolean))target.append(el('span','',text))}

function rememberArtwork(item,url){url=onlineArtCache[artKey(item)]?.url||url;if(!url)return;artCache[item.url]=url;const entries=Object.entries(artCache);if(entries.length>350)artCache=Object.fromEntries(entries.slice(-300));write('flow-artwork-v2',artCache);let changed=false;for(const s of saved)if(s.url===item.url&&s.artwork!==url){s.artwork=url;changed=true}if(changed)write('flow-watchlist-v2',saved)}

function pump(){while(activeJobs<3&&jobs.length){activeJobs++;const job=jobs.shift();job.run().then(job.resolve,job.reject).finally(()=>{activeJobs--;pump()})}}

function queued(run){return new Promise((resolve,reject)=>{jobs.push({run,resolve,reject});pump()})}

function getDetails(item){if(!item.directory)return Promise.resolve({url:item.url,files:[item],artwork:art(item)});if(detailsCache.has(item.url))return Promise.resolve(detailsCache.get(item.url));if(inflight.has(item.url))return inflight.get(item.url);const request=queued(()=>window.flowListNetwork(item.url)).then(data=>{detailsCache.set(item.url,data);if(detailsCache.size>160)detailsCache.delete(detailsCache.keys().next().value);rememberArtwork(item,data.artwork);return data}).finally(()=>inflight.delete(item.url));inflight.set(item.url,request);return request}

const alternativeArt=new Map(), failedImages=new Set();const observed=new WeakMap();const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);const item=observed.get(entry.target);if(!item)continue;getArtwork(item).then(data=>setPosterImage(entry.target,data.url||art(item))).catch(()=>{})}},{rootMargin:'180px'});

const posterRequests=new WeakMap();
function setPosterImage(target,url){
 if(!url)return;
 const existing=target.querySelector('img');
 if(existing?.getAttribute('src')===url||posterRequests.get(target)?.url===url)return;
 const img=el('img'),request={url,img};
 posterRequests.set(target,request);
 img.alt='';img.decoding='async';
 const commit=()=>{
  if(posterRequests.get(target)!==request)return;
  // Keep the previous decoded poster visible until its replacement is ready.
  img.classList.add('loaded');
  const previous=target.querySelector('img');
  if(previous)previous.replaceWith(img);else target.append(img);
  posterRequests.delete(target);
 };
 img.onload=()=>{
  if(typeof img.decode==='function')img.decode().then(commit).catch(()=>{if(img.naturalWidth)commit()});
  else commit();
 };
 img.onerror=()=>{
  if(posterRequests.get(target)!==request)return;
  posterRequests.delete(target);
  const item=observed.get(target);
  if(item)getAlternativeArtwork(item,url).then(data=>{
   if(data.url&&data.url!==url)setPosterImage(target,data.url);
  }).catch(()=>{});
 };
 img.src=url;
}

function savedItem(item){return saved.some(x=>x.url===item.url)}

function saveItem(item){if(item.local&&!/^(content:|flowmedia:)/.test(item.url)){toast('Local files need to be opened again from your device.');return}if(savedItem(item)){saved=saved.filter(x=>x.url!==item.url);toast('Removed from your watchlist.')}else{saved.unshift({...item,artwork:art(item)});saved=saved.slice(0,200);toast('A good one for later. Added to your watchlist.')}write('flow-watchlist-v2',saved);syncSaved();if(state.view==='saved')renderSaved()}

function syncSaved(){syncWatched();document.querySelectorAll('[data-save-url]').forEach(button=>{const yes=saved.some(x=>x.url===button.dataset.saveUrl);button.classList.toggle('saved',yes);button.setAttribute('aria-label',(yes?'Remove ':'Save ')+(button.dataset.saveTitle||'movie')+(yes?' from watchlist':' to watchlist'))});if(state.selected){$('detail-save').classList.toggle('saved',savedItem(state.selected));$('detail-save').querySelector('span').textContent=savedItem(state.selected)?'Saved to watchlist':'Add to watchlist'}if(state.hero){$('hero-save').classList.toggle('saved',savedItem(state.hero))}if(state.current)$('save-track').classList.toggle('saved',savedItem(state.current.folder||state.current))}

function palette(item){const colours=[['#3f5846','#1b3022'],['#4c414f','#241c2b'],['#3d4d60','#1b2634'],['#5b4c35','#2a231a'],['#4d3d3b','#2d1d1b']];let hash=0;for(const c of item.name)hash=(hash*31+c.charCodeAt(0))|0;return colours[Math.abs(hash)%colours.length]}

function movieCard(item){const card=el('article','movie-card'),button=el('button','poster-button'),poster=el('div','poster'),fallback=el('span','poster-fallback');const colours=palette(item);poster.style.setProperty('--poster-a',colours[0]);poster.style.setProperty('--poster-b',colours[1]);fallback.append(icon(isAudio(item)?'music':'film'),el('b','',title(item)),el('small','','FLOW COLLECTION'));poster.append(fallback);if(quality(item))poster.append(el('span','quality',quality(item).toUpperCase()));setPosterImage(poster,art(item));if(!item.local){observed.set(poster,item);observer.observe(poster)}const name=el('h3','',title(item));const meta=el('span','card-meta');if(year(item))meta.append(el('span','',year(item)),el('span','dot'));meta.append(el('span','',language(item)));if(item.chartMatch?.rating)meta.append(el('span','chart-rating','IMDb '+item.chartMatch.rating.toFixed(1)));button.append(poster,name,meta);button.setAttribute('aria-label','Open '+title(item));button.onclick=()=>openDetails(item);const save=el('button','poster-save');save.append(icon('bookmark'));save.dataset.saveUrl=item.url;save.dataset.saveTitle=title(item);save.classList.toggle('saved',savedItem(item));save.setAttribute('aria-label',savedItem(item)?'Remove '+title(item)+' from watchlist':'Save '+title(item)+' to watchlist');save.onclick=()=>saveItem(item);card.append(button,save,watchedButton(item,'poster-watched'));return card}

function folderCard(item){const card=el('button','folder-card'),words=el('span');words.append(el('b','',item.name),el('small','',/^\(?\d{4}\)?$/.test(item.name)?'Browse this year':'Browse collection'));card.append(icon('folder'),words);card.onclick=()=>browse(item.url,item.name);return card}

function filtered(items,query,sort='az'){
 const q=normalizeSearch(query),words=q.split(' ').filter(Boolean);
 const result=items.filter(item=>words.every(word=>normalizeSearch(item.name+' '+title(item)).includes(word)));
 if(sort!=='recommended')result.sort((a,b)=>sort==='newest'?(Number(year(b))-Number(year(a))||title(a).localeCompare(title(b))):sort==='za'?title(b).localeCompare(title(a)):title(a).localeCompare(title(b)));
 return result;
}

const gridRecords=new WeakMap();
function renderGrid(target,items,query='',limit=Infinity,sort='az'){
 const shown=filtered(items,query,sort).slice(0,limit);
 const previous=gridRecords.get(target)||new Map(),next=new Map();
 const keep=new Set();
 for(const item of shown){
  const key=item.url+'|'+Boolean(item.directory);
  let record=previous.get(key);
  if(record&&record.node.parentElement!==target)record=null;
  if(!record){
   const stableItem={...item};
   record={item:stableItem,node:isMovie(stableItem)?movieCard(stableItem):folderCard(stableItem)};
  }else{
   const oldRating=record.item.chartMatch?.rating;
   Object.assign(record.item,item);
   const rating=item.chartMatch?.rating;
   if(oldRating!==rating){
    const meta=record.node.querySelector('.card-meta'),label=record.node.querySelector('.chart-rating');
    if(rating&&meta){const value='IMDb '+rating.toFixed(1);if(label)label.textContent=value;else meta.append(el('span','chart-rating',value));}
    else label?.remove();
   }
  }
  next.set(key,record);keep.add(record.node);
 }
 for(const child of Array.from(target.children)){
  if(keep.has(child))continue;
  child.querySelectorAll('.poster').forEach(poster=>observer.unobserve(poster));
  child.remove();
 }
 let cursor=target.firstElementChild;
 for(const record of next.values()){
  if(record.node===cursor)cursor=cursor.nextElementSibling;
  else target.insertBefore(record.node,cursor);
 }
 gridRecords.set(target,next);
 if(!shown.length&&!target.querySelector('.empty-state')){
  const empty=el('div','empty-state');
  empty.append(icon('search'),el('h3','',query?'Nothing by that name.':'A quiet corner.'),el('p','',query?'Try another title in this collection.':'There are no playable files or folders here.'));
  target.append(empty);
 }
 return shown.length;
}

function skeleton(target,count=6){target.replaceChildren();for(let i=0;i<count;i++){const card=el('div','movie-card skeleton');card.append(el('div','poster'),el('h3'),el('span','card-meta'));target.append(card)}}

function showError(target,text,retry){target.replaceChildren();const box=el('div','error-state',text);if(retry){const b=el('button','','Try again');b.onclick=retry;box.append(b)}target.append(box)}

function showView(view){state.view=view;document.querySelectorAll('main>.view').forEach(n=>n.hidden=n.id!==view+'-view');document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view===view));if(view==='saved')renderSaved();if(view==='device'&&!deviceURL)loadDeviceRoots();if(view==='home')renderContinue();if(view==='explore'&&!state.browseURL)browse(ROOT,'Explore');$('mini-player').hidden=!state.current||view==='player';document.body.classList.toggle('has-mini',!!state.current&&view!=='player');window.scrollTo({top:0,behavior:'instant'})}

function renderChips(active='For you'){const chips=$('home-chips');chips.replaceChildren();const picks=[['For you',null],['English',/English Movies$/i],['Hindi',/^Hindi Movies$/i],['Bangla',/Kolkata Bangla/i],['TV series',/^TV.*WEB Series$/i],['Animation',/^Animation Movies$/i]];for(const [label,test] of picks){const item=test?state.categories.find(x=>test.test(x.name)):null;if(test&&!item)continue;const b=el('button','chip'+(active===label?' active':''),label);b.onclick=()=>selectHomeCategory(item||state.categories.find(x=>/^English Movies$/i.test(x.name))||state.categories[0],label);chips.append(b)}}

function renderCategories(){const rail=$('category-rail');rail.replaceChildren();for(const item of state.categories.filter(x=>!/(Tutorial|Awards|WWE|3D)/i.test(x.name)).slice(0,8)){const button=el('button','category-card');button.append(icon(/Series/i.test(item.name)?'grid':'film'),el('strong','',item.name.replace(' Movies','').replace('Kolkata Bangla','Bangla').replace('Foreign Language','World cinema')),el('small','','BROWSE COLLECTION'));button.onclick=()=>browse(item.url,item.name);rail.append(button)}}

async function loadHome(){startCatalog();const version=++homeVersion;$('home-status').replaceChildren();skeleton($('home-grid'));$('hero').hidden=true;$('home-collection-meta').textContent='Connecting to your server…';try{const root=await window.flowListNetwork(ROOT);if(version!==homeVersion)return;state.categories=root.files.filter(x=>x.directory);$('connection').className='connection online';$('connection').querySelector('span').textContent=new URL(ROOT).hostname;renderCategories();renderChips();const first=state.categories.find(x=>/^English Movies$/i.test(x.name))||state.categories[0];if(!first)throw Error('No media folders');await selectHomeCategory(first,'For you')}catch{$('connection').className='connection offline';$('connection').querySelector('span').textContent='Offline';$('home-grid').replaceChildren();$('home-collection-meta').textContent='Your media network is out of reach.';showError($('home-status'),'Connect to the network that provides your server, or set another address in the link menu.',loadHome)}}

function selectHomeCategory(category,label){
 if(!category)return;
 homeScope=label==='For you'?null:{url:category.url,label};suggestionVersion++;
 stableFeedOrder=[];feedLimit=24;state.homeURL=category.url;state.homeLabel=label;
 state.hero=null;renderChips(label);$('home-status').replaceChildren();
 $('home-search').placeholder=homeScope?'Search '+label+' collection':'Search the whole server';
 $('home-search').setAttribute('aria-label',homeScope?'Search '+label+' collection':'Search home collection');
 catalogController?.prioritize(homeScope?.url||ROOT);
 renderHomeGrid();renderSuggestions();
 if(!$('home-search').value){const item=stableRecommendations()[0];if(item)renderHero(item,homeVersion);}
}

function renderHomeGrid(){
 const query=$('home-search').value;
 const status=scopeStatus(homeScope?.url);
 const items=query?searchItems(query):stableRecommendations();
 if(query)$('home-collection-meta').textContent=(homeScope?homeScope.label:'Whole server')+' · '+(status.running?'Indexing folders…':status.failed?'Some folders unavailable':'Collection scan complete');if(!query&&state.hero&&isWatched(state.hero)&&!includeWatched){if(items.length)renderHero(items[0],homeVersion);else state.hero=null;}
 if(!query)$('home-collection-meta').textContent=charts.length?'Recent releases + favourites · IMDb chart picks':'Recent releases + favourites · Flow picks';
 $('hero').hidden=!!query||!state.hero;
 $('home-collection-title').textContent=query?(homeScope?homeScope.label+' search':'Server search'):(homeScope?homeScope.label+' · Worth a watch':'Worth a watch');
 renderGrid($('home-grid'),items,query,query?Infinity:feedLimit,'recommended');
 if(query&&!status.running&&$('home-grid').querySelector('.empty-state')){
  $('home-grid').querySelector('h3').textContent=status.failed?'Collection scan incomplete':homeScope?'Not found in '+homeScope.label:'Not found on server';
  $('home-grid').querySelector('p').textContent=status.failed?'Retry unavailable folders before ruling this title out.':'Try another movie name or refresh the server catalog.';
 }
 if(query&&status.running&&$('home-grid').querySelector('.empty-state')){
  $('home-grid').querySelector('h3').textContent=homeScope?'Searching '+homeScope.label+' folders…':'Still searching the server…';
  $('home-grid').querySelector('p').textContent='Results appear as more folders are indexed.';
 }
 $('see-all').hidden=true;
 moreFeed.hidden=!!query||items.length<=feedLimit;
 // Playback history changes only when playback changes, not on catalog updates.
}


function renderHero(item,version){state.hero=item;$('hero').hidden=!!$('home-search').value;$('hero-title').textContent=title(item);metadata($('hero-meta'),item);$('hero-image').hidden=true;const setHero=url=>{if(!url||state.hero?.url!==item.url)return;const image=$('hero-image');image.onload=()=>image.hidden=false;image.onerror=()=>{image.hidden=true;getAlternativeArtwork(item,url).then(data=>{if(data.url&&data.url!==url)setHero(data.url)}).catch(()=>{})};image.src=url};setHero(art(item));getArtwork(item).then(data=>{if(version!==homeVersion)return;setHero(data.url||art(item))}).catch(()=>{});$('hero-watch').onclick=()=>openDetails(item);$('hero-save').onclick=()=>saveItem(item);syncSaved()}

async function browse(url,label,back=false){if(/^(content:|flowmedia:)/.test(url)){browseDevice(url,label,back);return}showViewWithoutBrowse();const version=++browseVersion;if(!back)state.history.push({url,label});$('folder-back').hidden=state.history.length<2;$('explore-title').textContent=label||'Explore';$('explore-subtitle').textContent=url===ROOT?'Every collection, ready to explore.':'Choose a title or keep exploring.';$('explore-search').value='';$('explore-status').replaceChildren();$('explore-count').textContent='Opening collection…';skeleton($('explore-grid'));state.browseURL=url;catalogController?.prioritize(url);try{const data=await window.flowListNetwork(url);if(version!==browseVersion)return;state.browseItems=data.files.map(x=>({...x,artwork:!x.directory?data.artwork:art(x)}));renderExplore()}catch{if(version!==browseVersion)return;$('explore-grid').replaceChildren();$('explore-count').textContent='Connection unavailable';showError($('explore-status'),'This folder could not be loaded. Stay on the media server’s network.',()=>browse(url,label,true))}}

function showViewWithoutBrowse(){state.view='explore';document.querySelectorAll('main>.view').forEach(n=>n.hidden=n.id!=='explore-view');document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view==='explore'));$('mini-player').hidden=!state.current;document.body.classList.toggle('has-mini',!!state.current);window.scrollTo({top:0,behavior:'instant'})}

function renderExplore(){const q=$('explore-search').value,count=renderGrid($('explore-grid'),q?itemsInScope(state.browseURL):state.browseItems,q,Infinity,$('sort').value);$('explore-count').textContent=count+' '+(count===1?'item':'items');$('explore-grid').classList.toggle('list-layout',state.list)}

function backFolder(){if(state.history.length<2){showView('home');return}state.history.pop();const parent=state.history.at(-1);browse(parent.url,parent.label,true)}

function renderSaved(){if(watchedView){const items=Object.values(watched);if(items.length)renderGrid($('saved-grid'),items);else $('saved-grid').replaceChildren(el('p','empty-state','No watched titles yet. Mark a movie using the check button.'));return}if(saved.length)renderGrid($('saved-grid'),saved);else{const empty=el('div','empty-state'),button=el('button','primary','Find your next movie');empty.append(icon('bookmark'),el('h3','','Good things are worth saving.'),el('p','','Tap the bookmark on a movie to keep it here.'),button);button.onclick=()=>showView('home');$('saved-grid').replaceChildren(empty)}}

function renderContinue(){const entries=recent.filter(x=>x.position>3&&x.duration&&x.position<x.duration-15).slice(0,5);$('continue-section').hidden=!entries.length||!!$('home-search').value;$('continue-list').replaceChildren();for(const item of entries){const button=el('button','continue-card'),words=el('span');if(item.artwork){const image=el('img');image.src=item.artwork;image.alt='';image.loading='lazy';image.onerror=()=>image.replaceWith(el('span','continue-placeholder'));button.append(image)}else button.append(el('span','continue-placeholder'));const line=el('span','progress-line'),fill=el('i');fill.style.width=Math.min(100,item.position/item.duration*100)+'%';line.append(fill);words.append(el('b','',item.title),el('small','',Math.max(1,Math.round((item.duration-item.position)/60))+' min left'),line);button.append(words);button.onclick=()=>playItem(item);$('continue-list').append(button)}}

function detailPoster(item,url){const box=$('detail-poster');box.replaceChildren(icon('film'));if(url){const img=el('img');img.alt='Poster for '+title(item);img.src=url;img.onerror=()=>{img.remove();getAlternativeArtwork(item,url).then(data=>{if(data.url&&data.url!==url&&state.selected?.url===item.url){detailPoster(item,data.url);$('detail-art-source').textContent='Poster: '+data.source}}).catch(()=>{})};box.append(img)}}

// Keep the selected file in the queue even when a folder contains more than 30 items.
function playbackQueue(files, selected) {
  const index = Math.max(0, files.indexOf(selected));
  const start = Math.max(0, Math.min(index - 15, files.length - 30));
  return files.slice(start, start + 30).map(file => ({
    name: file.name, url: file.url, title: title(file), audio: !!isAudio(file), local: !!file.local
  }));
}

async function openDetails(item){state.selected=item;const version=++detailVersion;$('detail-title').textContent=title(item);metadata($('detail-meta'),item);detailPoster(item,art(item));$('detail-status').replaceChildren(el('p','loading-line','Finding your media…'));$('detail-files').replaceChildren();$('detail-watch').disabled=true;$('detail-watch').querySelector('span').textContent='Watch now';if(!$('details').open)$('details').showModal();syncSaved();loadMovieInfo(item,version);$('detail-art-source').textContent='';getArtwork(item).then(image=>{if(version===detailVersion&&$('details').open){if(image.url)detailPoster(item,image.url);$('detail-art-source').textContent=image.source?'Poster: '+image.source:''}}).catch(()=>{});try{const data=await getDetails(item);if(version!==detailVersion||!$('details').open)return;detailPoster(item,art(item));$('detail-status').replaceChildren();const files=data.files.filter(x=>!x.directory);if(!files.length){$('detail-watch').disabled=false;$('detail-watch').querySelector('span').textContent='Browse folders';$('detail-watch').onclick=()=>{$('details').close();browse(item.url,title(item))};$('detail-status').append(el('p','','This collection contains folders. Open one to find its media.'));return}const makeTrack=file=>({...file,title:files.length===1?title(item):title(file),artwork:art(item),folder:item.directory?item:undefined,queue:playbackQueue(files,file),favourite:savedItem(item)});const first=makeTrack(files[0]),resume=recent.find(x=>x.url===first.url);$('detail-watch').disabled=false;$('detail-watch').querySelector('span').textContent=resume?.position>3&&resume.position<resume.duration-15?'Resume watching':isAudio(first)?'Listen now':'Watch now';$('detail-watch').onclick=()=>{$('details').close();playItem(first)};if(files.length>1){$('detail-files').append(el('p','files-heading','CHOOSE A FILE'));for(const file of files){const button=el('button','file-option');button.append(icon(isAudio(file)?'music':'play'),el('span','',file.name));button.onclick=()=>{$('details').close();playItem(makeTrack(file))};$('detail-files').append(button)}}}catch{if(version!==detailVersion)return;$('detail-status').replaceChildren(el('p','','Could not open this folder. Check your server connection.'));$('detail-watch').querySelector('span').textContent='Try again';$('detail-watch').disabled=false;$('detail-watch').onclick=()=>openDetails(item)}}

function format(seconds){if(!Number.isFinite(seconds))return 'LIVE';seconds=Math.max(0,Math.floor(seconds));const hours=Math.floor(seconds/3600);return (hours?hours+':':'')+String(Math.floor(seconds/60)%60).padStart(hours?2:1,'0')+':'+String(seconds%60).padStart(2,'0')}

function saveProgress(){const item=state.current;if(item?.native)return;if(!item||item.local||!Number.isFinite(media.currentTime)||media.currentTime<1)return;const record={...item,title:title(item),position:media.currentTime,duration:Number.isFinite(media.duration)?media.duration:0};recent=[record,...recent.filter(x=>x.url!==item.url)].slice(0,30);write('flow-recent-v2',recent)}

async function playItem(item){if(window.FlowAndroid?.play){startNative(item);return}saveProgress();state.current=item;showView('player');$('player-empty').hidden=true;$('player-error').replaceChildren();$('screen').classList.add('has-media');$('screen').classList.toggle('is-audio',Boolean(isAudio(item)));$('audio-art').hidden=!isAudio(item);$('track-title').textContent=title(item);$('track-filename').textContent=item.name||title(item);$('player-source').textContent=item.local?'A file on this device':'Direct from '+new URL(item.url).hostname;metadata($('player-meta'),item);$('mini-title').textContent=title(item);$('mini-thumb').replaceChildren(icon(isAudio(item)?'music':'film'));if(art(item)){const img=el('img');img.alt='';img.src=art(item);img.onerror=()=>img.remove();$('mini-thumb').replaceChildren(img)}$('seek').value=0;$('elapsed').textContent='0:00';$('duration').textContent='0:00';media.src=item.url;media.controls=false;media.load();syncSaved();try{await media.play()}catch(e){if(e.name!=='AbortError')toast('Ready when you are. Tap Play to start.')}}

function togglePlay(){if(window.FlowAndroid?.play&&state.current){startNative(state.current);return}if(!state.current){showView('home');return}if(media.paused)media.play().catch(()=>toast('This source could not start. Check its format and connection.'));else media.pause()}

media.addEventListener('loadedmetadata',()=>{$('duration').textContent=format(media.duration);$('seek').disabled=!Number.isFinite(media.duration);$('screen').classList.toggle('landscape-video',media.videoWidth>media.videoHeight);const record=recent.find(x=>x.url===state.current?.url);if(record?.position>3&&record.position<media.duration-15)media.currentTime=record.position;media.playbackRate=Number($('speed').value)});

media.addEventListener('timeupdate',()=>{$('elapsed').textContent=format(media.currentTime);$('seek').value=Number.isFinite(media.duration)&&media.duration?media.currentTime/media.duration*100:0;if(Date.now()-lastProgress>4000){saveProgress();lastProgress=Date.now()}});

function playingChanged(){const name=media.paused?'play':'pause';setIcon($('play'),name);setIcon($('mini-play'),name);$('play').setAttribute('aria-label',media.paused?'Play':'Pause');$('mini-play').setAttribute('aria-label',media.paused?'Play current media':'Pause current media');try{window.FlowAndroid?.keepAwake(!media.paused)}catch{}if(media.paused)saveProgress()}

media.addEventListener('play',playingChanged);media.addEventListener('pause',playingChanged);media.addEventListener('ended',()=>{saveProgress();renderContinue()});media.addEventListener('error',()=>{showError($('player-error'),'This file could not be played. Check your network. Some video or audio codecs are not supported by this device.');playingChanged()});

async function exitFullscreen(){if(document.fullscreenElement)await document.exitFullscreen();else if(media.webkitDisplayingFullscreen)media.webkitExitFullscreen()}

async function enterFullscreen(){if(!state.current)return;if(isAudio(state.current)){toast('Fullscreen is available for video.');return}if(document.fullscreenElement){await exitFullscreen();return}media.controls=true;try{if($('screen').requestFullscreen){await $('screen').requestFullscreen();if(media.videoWidth>media.videoHeight){try{await window.screen.orientation?.lock('landscape')}catch{}}}else if(media.webkitEnterFullscreen)media.webkitEnterFullscreen();else throw Error()}catch{media.controls=false;toast('Fullscreen is unavailable. Try rotating your device.')}}

document.addEventListener('fullscreenchange',()=>{media.controls=!!document.fullscreenElement;if(!document.fullscreenElement){try{window.screen.orientation?.unlock()}catch{}}});media.addEventListener('webkitendfullscreen',()=>media.controls=false);

function openLink(raw){let url;try{url=new URL(raw)}catch{throw Error('Enter a complete HTTP or HTTPS media link.')}if(!['http:','https:','ftp:','ftps:'].includes(url.protocol)||url.username||url.password)throw Error('Use an HTTP or HTTPS link without embedded passwords.');if(/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|spotify\.com)$/.test(url.hostname))throw Error('Use a direct media file URL, rather than a watch-page link.');if($('server-mode').checked){
 ROOT=url.href.endsWith('/')?url.href:url.href+'/';write('flow-server-history',[ROOT]);localStorage.setItem('flow-server',ROOT);
 $('link-dialog').close();state.history=[];state.browseURL=null;detailsCache.clear();inflight.clear();state.homeItems=[];homeScope=null;startCatalog(true);loadHome();showView('home');return;
 }if(location.protocol==='https:'&&!window.FlowAndroid&&url.protocol==='http:')throw Error('HTTP media is available inside the Android app.');const name=decodeURIComponent(url.pathname.split('/').pop()||'Untitled media');$('link-dialog').close();playItem({url:url.href,name,directory:false})}

let searchTimer;$('home-search').oninput=()=>{
 clearTimeout(searchTimer);suggestionVersion++;selectedTitleQuery='';
 searchTimer=setTimeout(()=>{renderHomeGrid();updateSuggestions()},220);
};$('explore-search').oninput=renderExplore;$('sort').onchange=renderExplore;$('layout').onclick=()=>{state.list=!state.list;setIcon($('layout'),state.list?'grid':'list');$('layout').setAttribute('aria-label',state.list?'Switch to grid view':'Switch to list view');renderExplore()};$('folder-back').onclick=backFolder;$('see-all').onclick=()=>{if(state.homeURL)browse(state.homeURL,state.homeLabel)};$('brand').onclick=()=>showView('home');document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>showView(button.dataset.view));$('detail-save').onclick=()=>state.selected&&saveItem(state.selected);$('details-close').onclick=()=>$('details').close();$('open-link').onclick=()=>{$('link-error').textContent='';$('link-dialog').showModal()};$('link-close').onclick=()=>$('link-dialog').close();$('help').onclick=()=>$('help-dialog').showModal();$('help-close').onclick=()=>$('help-dialog').close();$('player-browse').onclick=()=>showView('home');$('link-form').onsubmit=e=>{e.preventDefault();try{openLink($('media-url').value.trim())}catch(error){$('link-error').textContent=error.message}};$('local-file').onclick=()=>{if(window.FlowAndroid?.pickFile)window.FlowAndroid.pickFile();else $('file-input').click()};$('file-input').onchange=()=>{const file=$('file-input').files[0];if(!file)return;$('link-dialog').close();playItem({url:URL.createObjectURL(file),name:file.name,local:true,audio:file.type.startsWith('audio/')})};$('play').onclick=$('mini-play').onclick=togglePlay;$('mini-open').onclick=()=>showView('player');$('seek').oninput=()=>{if(Number.isFinite(media.duration))media.currentTime=Number($('seek').value)/100*media.duration};$('back-ten').onclick=()=>{if(state.current)media.currentTime=Math.max(0,media.currentTime-10)};$('forward-ten').onclick=()=>{if(state.current)media.currentTime=Math.min(Number.isFinite(media.duration)?media.duration:Infinity,media.currentTime+10)};$('speed').onchange=()=>media.playbackRate=Number($('speed').value);$('mute').onclick=()=>{media.muted=!media.muted;$('mute').textContent=media.muted?'Unmute':'Mute'};$('fullscreen').onclick=enterFullscreen;$('fullscreen-exit').onclick=exitFullscreen;$('save-track').onclick=()=>state.current&&saveItem(state.current.folder||state.current);

window.flowBack=()=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return true}if(state.view==='device'&&deviceHistory.length){deviceBack();return true}if(state.view==='explore'&&state.history.length>1){backFolder();return true}if(state.view!=='home'){showView('home');return true}return false};window.addEventListener('pagehide',saveProgress);document.addEventListener('keydown',e=>{if(/INPUT|SELECT|BUTTON/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.code==='Space'){e.preventDefault();togglePlay()}if(e.code==='ArrowLeft')$('back-ten').click();if(e.code==='ArrowRight')$('forward-ten').click()});renderContinue();setTimeout(loadHome,0);



let deviceURL='',deviceHistory=[];const infoCache=new Map();

function startNative(item){saveProgress();media.pause();state.current={...item,native:true};showView('player');$('screen').classList.add('native-mode');$('player-empty').hidden=true;$('audio-art').hidden=true;$('native-ready').hidden=false;$('track-title').textContent=title(item);$('track-filename').textContent=item.name||title(item);$('player-source').textContent=item.local?'Offline file · Built-in player':'Network stream · Built-in player';metadata($('player-meta'),item);$('player-error').replaceChildren();$('mini-title').textContent=title(item);$('mini-thumb').replaceChildren(icon(isAudio(item)?'music':'film'));if(art(item)){const img=el('img');img.src=art(item);img.alt='';$('mini-thumb').replaceChildren(img)}syncSaved();const progress=recent.find(x=>x.url===item.url);try{window.FlowAndroid.play(JSON.stringify({...item,title:title(item),audio:!!isAudio(item),position:progress?.position||item.position||0}))}catch{toast('The native player could not be opened.')}}

window.FlowPlaybackResult=item=>{const {queue,...record}=item;recent=[{...record,native:true},...recent.filter(x=>x.url!==item.url)].slice(0,30);write('flow-recent-v2',recent);if(state.current?.url===item.url)state.current={...item,native:true};$('native-launch').querySelector('span').textContent=item.position>3?'Resume in Flow':'Play in Flow';if(typeof item.favourite==='boolean'){const movie=item.folder||item;if(item.favourite&&!savedItem(movie))saved.unshift({...movie,artwork:art(movie)});if(!item.favourite)saved=saved.filter(x=>x.url!==movie.url);write('flow-watchlist-v2',saved);syncSaved()}renderContinue()};

$('native-launch').onclick=()=>state.current&&startNative(state.current);

window.FlowLocalSelected=item=>{if($('link-dialog').open)$('link-dialog').close();playItem(item)};

window.FlowFolderSelected=item=>{deviceHistory=[];browseDevice(item.url,item.name)};

async function loadDeviceRoots(){showViewDevice();$('device-title').textContent='Your folders';$('device-back').hidden=true;$('device-grid').replaceChildren();if(!window.FlowAndroid){showError($('device-status'),'Offline folders are available in the Android app. In this browser preview you can test local files from the link menu.');return}try{$('device-status').textContent='Scanning your media folders…';const folders=await window.flowNativeCall('localFolders');$('device-status').replaceChildren();if(!folders.length){const box=el('div','empty-state');box.append(icon('folder'),el('h3','','Your files. Your space.'),el('p','','No shared media found. Allow video/audio access in Android settings, or add a folder.'));$('device-grid').append(box)}else renderGrid($('device-grid'),folders)}catch{showError($('device-status'),'Folder access could not be read. Choose the folder again.')}}

function showViewDevice(){state.view='device';document.querySelectorAll('main>.view').forEach(n=>n.hidden=n.id!=='device-view');document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n.dataset.view==='device'));$('mini-player').hidden=!state.current;document.body.classList.toggle('has-mini',!!state.current);window.scrollTo({top:0,behavior:'instant'})}

async function browseDevice(url,label,back=false){showViewDevice();if(!back)deviceHistory.push({url,label});deviceURL=url;$('device-title').textContent=label||'On device';$('device-subtitle').textContent='Offline files · No network needed';$('device-back').hidden=false;$('device-status').replaceChildren(el('p','loading-line','Reading your folder…'));$('device-grid').replaceChildren();try{const data=await window.flowListNetwork(url);if(deviceURL!==url)return;$('device-status').replaceChildren();renderGrid($('device-grid'),data.files)}catch{showError($('device-status'),'This folder could not be opened. Grant access again using Add a folder.')}}

function deviceBack(){deviceHistory.pop();if(deviceHistory.length){const parent=deviceHistory.at(-1);browseDevice(parent.url,parent.label,true)}else{deviceURL='';loadDeviceRoots()}}

$('device-back').onclick=deviceBack;$('choose-folder').onclick=()=>{if(window.FlowAndroid?.pickFolder)window.FlowAndroid.pickFolder();else toast('Folder access is available in the Android app.')};$('choose-video').onclick=()=>{if(window.FlowAndroid?.pickFile)window.FlowAndroid.pickFile();else $('file-input').click()};

async function loadMovieInfo(item,version){$('movie-summary').textContent=item.local?'Your offline media stays on this device. Playback works without an online lookup.':'Loading a short movie introduction…';$('movie-facts').replaceChildren();$('movie-source').textContent='';if(item.local)return;try{const info=await movieInfoFor(item);if(version!==detailVersion||!$('details').open)return;if(!info.found){$('movie-summary').textContent=info.message||'No confident online match was found for this title.';return}$('movie-summary').textContent=info.summary;const facts=[['Genre',info.genre],['Runtime',info.runtime],['Director',info.director],['Cast',info.cast?.join(', ')]];for(const [name,value]of facts)if(value){const row=el('p','movie-fact');row.append(el('b','',name),el('span','',value));$('movie-facts').append(row)}$('movie-source').textContent='Wikipedia lead · CC BY-SA 4.0'+(info.cached?' · Cached':'')+' · Facts: Wikidata';if(info.sourceURL){const source=el('button','source-button','Source details');source.onclick=()=>toast(info.sourceURL);$('movie-source').append(document.createTextNode(' · '),source)}if(safeOnlineImage(info.poster)&&!failedImages.has(info.poster)&&!art(item)){detailPoster(item,info.poster)} }catch{if(version===detailVersion)$('movie-summary').textContent='Online information is unavailable right now. You can still play the movie.'}}



$("license-details").ontoggle=()=>{if($("license-details").open)fetch("LGPL-2.1.txt").then(r=>r.text()).then(t=>$("license-text").textContent=t).catch(()=>{})};


function pumpArt(){while(artActive<3&&artJobs.length){artActive++;const job=artJobs.shift();job.run().then(job.resolve,job.reject).finally(()=>{artActive--;pumpArt()})}}
function queueArt(run){return new Promise((resolve,reject)=>{artJobs.push({run,resolve,reject});pumpArt()})}
function cacheOnlinePoster(item, result) {
  const image = {...result, at: Date.now()};
  onlineArtCache[artKey(item)] = image;
  const keys = Object.keys(onlineArtCache);
  if (keys.length > 350) for (const oldKey of keys.slice(0, keys.length - 300)) delete onlineArtCache[oldKey];
  write('flow-online-art-v1', onlineArtCache);
  rememberArtwork(item, image.url);
  return image;
}

async function serverPoster(item) {
  if (!item.directory || item.local) return {};
  const data = await getDetails(item);
  if (!data.artwork || failedImages.has(data.artwork)) return {};
  serverArtFallback.set(item.url, data.artwork);
  return {url: data.artwork, source: 'Media server fallback'};
}

function getArtwork(item) {
  if (item.local) return Promise.resolve({url:art(item), source:''});
  const key = artKey(item);
  const cached = onlineArtCache[key];
  const usable = safeOnlineImage(cached?.url) && Date.now()-cached.at<CACHE_WEEK && !failedImages.has(cached.url);
  if (usable && Date.now() - cached.at < 7 * 86400000) return Promise.resolve(cached);
  if (!artInflight.has(key)) {
    const job = queueArt(async () => {
      let result;
      try {
        result = window.FlowAndroid ? await window.flowNativeCall('artwork', [title(item),year(item)])
          : await fetch('/preview/art?title='+encodeURIComponent(title(item))+'&year='+year(item)).then(r=>r.json());
      } catch {}
      if (result?.found && safeOnlineImage(result.url) && !failedImages.has(result.url)) return cacheOnlinePoster(item, result);
      return usable ? cached : {};
    }).finally(() => artInflight.delete(key));
    artInflight.set(key, job);
  }
  return artInflight.get(key).then(image => image.url ? image : serverPoster(item));
}

function movieInfoFor(item) {
  const key = artKey(item);
  if (!infoCache.has(key)) {
    const request = window.FlowAndroid ? window.flowNativeCall('movieInfo',[title(item),year(item)])
      : fetch('/preview/info?title='+encodeURIComponent(title(item))+'&year='+year(item)).then(r=>r.json());
    infoCache.set(key, request.catch(error => { infoCache.delete(key); throw error; }));
  }
  return infoCache.get(key);
}

function getAlternativeArtwork(item, failed) {
  if (item.local) return Promise.resolve({});
  failedImages.add(failed);
  const key = artKey(item);
  if (!alternativeArt.has(key)) {
    const job = queueArt(async () => {
      const info = await movieInfoFor(item);
      if (safeOnlineImage(info.poster) && !failedImages.has(info.poster)) {
        return cacheOnlinePoster(item, {found:true, url:info.poster, source:'Wikipedia / Wikimedia'});
      }
      return {};
    }).catch(() => ({})).finally(() => alternativeArt.delete(key));
    alternativeArt.set(key,job);
  }
  return alternativeArt.get(key).then(image => image.url && !failedImages.has(image.url) ? image : serverPoster(item));
}

let homeScope=null,catalogController=null;
let stableFeedOrder=[],selectedTitleQuery='';
let feedLimit=24,catalogGeneration=0,catalog=new Map(),catalogRunning=false,catalogFailed=0,charts=[];
const moreFeed=el('button','outline wide','See more');
$('home-grid').after(moreFeed);
moreFeed.onclick=()=>{feedLimit+=24;renderHomeGrid()};
const surprise=el('button','text-button','Surprise me');
moreFeed.after(surprise);
surprise.onclick=()=>{const options=recommendationItems();const picks=options.filter(item=>item.chartMatch);const pool=picks.length?picks:options;if(pool.length)openDetails(pool[Math.floor(Math.random()*pool.length)]);else toast('Still reading the server catalog. Try again shortly.')};
const catalogStatus=el('p','small-print');
$('home-collection-meta').after(catalogStatus);
const refreshCatalog=el('button','text-button','Refresh server catalog');
catalogStatus.after(refreshCatalog);
refreshCatalog.onclick=()=>startCatalog(true);
const flowPicks=new Set(('dune part two|oppenheimer|poor things|the holdovers|past lives|anatomy of a fall|perfect days|all we imagine as light|laapataa ladies|12th fail|sita ramam|rrr|kantara|maharaja|the wild robot|flow|spider man across the spider verse|everything everywhere all at once|parasite|the shawshank redemption|the godfather|the dark knight|inception|interstellar|the prestige|the departed|whiplash|the grand budapest hotel|the truman show|good will hunting|spirited away|your name|grave of the fireflies|princess mononoke|se7en|arrival|blade runner 2049|mad max fury road|the matrix|gladiator|the lord of the rings the fellowship of the ring|the lord of the rings the return of the king|3 idiots|taare zameen par|dangal|andhadhun|drishyam|drishyam 2|kahaani|queen|piku|swades|lagaan|zindagi na milegi dobara|gully boy|bajrangi bhaijaan|barfi|the lunchbox|udaan|tumbbad|vikram vedha|super deluxe|jigarthanda doublex|jallikattu|kumbalangi nights|manjummel boys|premam|baishe srabon|chotushkone|pather panchali|aparajito|charulata|aynalbaji|hawa|debi|breaking bad|better call saul|chernobyl|the wire|the sopranos|succession|severance|dark|the bear|shogun|panchayat|scam 1992|the family man|patal lok|paat al lok|sherlock|true detective').split('|'));
const normalizeSearch=value=>value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function catalogItems(){return Array.from(catalog.values())}
function withinFolder(address,folder){
 try{
  const child=new URL(address),parent=new URL(folder);
  const base=parent.pathname.endsWith('/')?parent.pathname:parent.pathname+'/';
  return child.protocol===parent.protocol&&child.host===parent.host&&(child.pathname===parent.pathname||child.pathname.startsWith(base));
 }catch{return false;}
}
function itemsInScope(folder){
 return folder&&folder!==ROOT?catalogItems().filter(item=>item.collectionURL===folder||withinFolder(item.url,folder)):catalogItems();
}
function homeItemsInScope(){return itemsInScope(homeScope?.url);}
function scopeStatus(folder){
 if(!folder||folder===ROOT)return {running:catalogRunning,failed:catalogFailed};
 return catalogController?.scopeState(folder)||{running:catalogRunning,failed:catalogFailed};
}

// Preserve quality ranking within each age group, then reserve slots for recent releases.
function mixRecommendations(ranked,currentYear=new Date().getFullYear()){
 const recent=[],older=[];
 for(const item of ranked){
  const released=Number(year(item));
  if(released>=currentYear-1&&released<=currentYear)recent.push(item);
  else older.push(item);
 }
 // Unrated new releases follow established recent picks. A low known rating
 // must not outrank an unrated release merely because it appears in a chart.
 const qualityTier=item=>{
  if(flowPicks.has(normalizeSearch(title(item)))||item.chartMatch?.rating>=7)return 0;
  return item.chartMatch?.rating>0&&item.chartMatch.rating<6?2:1;
 };
 recent.sort((a,b)=>qualityTier(a)-qualityTier(b));
 const mixed=[];let newIndex=0,oldIndex=0;
 while(newIndex<recent.length||oldIndex<older.length){
  for(let slot=0;slot<2&&newIndex<recent.length;slot++)mixed.push(recent[newIndex++]);
  if(oldIndex<older.length)mixed.push(older[oldIndex++]);
 }
 return mixed;
}
// Only displayed recommendations are pinned. New rankings affect unseen cards.
function stableRecommendations(){
 const ranked=mixRecommendations(recommendationItems()),byURL=new Map(ranked.map(item=>[item.url,item]));
 const pinned=stableFeedOrder.map(url=>byURL.get(url)).filter(Boolean);
 const pinnedURLs=new Set(pinned.map(item=>item.url));
 const combined=pinned.concat(ranked.filter(item=>!pinnedURLs.has(item.url)));
 stableFeedOrder=combined.slice(0,feedLimit).map(item=>item.url);
 return combined;
}
function searchItems(query){
 if(!selectedTitleQuery||normalizeSearch(query)!==selectedTitleQuery)return homeItemsInScope();
 const terms=selectedTitleQuery.split(' ').filter(Boolean);
 return homeItemsInScope().filter(item=>{
  const name=normalizeSearch(title(item));
  return terms.every(term=>name.split(' ').includes(term));
 }).sort((a,b)=>{
  const rank=item=>normalizeSearch(title(item))===selectedTitleQuery?0:normalizeSearch(title(item)).startsWith(selectedTitleQuery)?1:2;
  return rank(a)-rank(b)||Number(year(b))-Number(year(a));
 });
}
function recommendationItems(){
 const unique=new Map();
 for(const item of homeItemsInScope()){
  if(isAudio(item)||!isMovie(item)||(!includeWatched&&isWatched(item)))continue;
  const key=normalizeSearch(title(item))+'|'+year(item);
  if(!unique.has(key))unique.set(key,item);
 }
 const chartIndex=new Map();
 for(const entry of charts){const key=normalizeSearch(entry.name);if(!chartIndex.has(key))chartIndex.set(key,[]);chartIndex.get(key).push(entry);}
 const match=item=>(chartIndex.get(normalizeSearch(title(item)))||[]).find(entry=>!entry.year||!year(item)||entry.year===year(item));
 return Array.from(unique.values()).map(item=>({...item,chartMatch:match(item)})).sort((a,b)=>{
  const score=item=>item.chartMatch?(item.chartMatch.rating>=7?10000:5000)+(1000-item.chartMatch.rank):0;
  return score(b)-score(a)||(Number(flowPicks.has(normalizeSearch(title(b))))-Number(flowPicks.has(normalizeSearch(title(a)))))||Number(year(b))-Number(year(a))||title(a).localeCompare(title(b));
 });
}
let catalogPaintTimer=0,lastCatalogScroll=0;
window.addEventListener('scroll',()=>{lastCatalogScroll=Date.now()},{passive:true});
function scheduleCatalogPaint(){
 if(catalogPaintTimer)return;
 const paint=()=>{
  if(Date.now()-lastCatalogScroll<300){catalogPaintTimer=setTimeout(paint,300);return;}
  catalogPaintTimer=0;
  if(state.view==='home'){renderHomeGrid();renderSuggestions();}
  if(state.view==='explore'&&$('explore-search').value)renderExplore();
 };
 catalogPaintTimer=setTimeout(paint,500);
}

async function startCatalog(force=false){
 if(catalogRunning&&!force)return;
 const generation=++catalogGeneration,server=ROOT;
 catalogRunning=true;catalogFailed=0;feedLimit=24;stableFeedOrder=[];catalog=new Map();
 if(!force){for(const item of read('flow-catalog:'+server,{items:[]}).items||[])catalog.set(item.url,item);}
 let pending=[{url:server,collection:null}],scheduled=new Set([server]),seen=new Set(),discovered=new Map(),active=0,done=0,failed=0;
 const activeJobs=new Set(),completed=new Set(),errors=[];let priorityFolder=null;
 const matches=(job,folder)=>job.collection===folder||withinFolder(job.url,folder);
 catalogController={
  prioritize(folder){
   if(generation!==catalogGeneration)return;if(folder===server){priorityFolder=null;return;}priorityFolder=folder;
   if(!scheduled.has(folder)){catalogRunning=true;scheduled.add(folder);pending.unshift({url:folder,collection:folder});}
   pending.sort((a,b)=>Number(matches(b,folder))-Number(matches(a,folder)));
   pumpCatalog();
  },
  scopeState(folder){return {running:!completed.has(folder)||pending.some(job=>matches(job,folder))||Array.from(activeJobs).some(job=>matches(job,folder)),failed:errors.filter(job=>matches(job,folder)).length};}
 };
 let pumpCatalog=()=>{};
 catalogStatus.textContent='Indexing server folders. Search results will grow as folders are read.';
 if(window.FlowAndroid?.recommendations)window.flowNativeCall('recommendations').then(data=>{if(generation!==catalogGeneration)return;charts=data;scheduleCatalogPaint()}).catch(()=>{});
 return new Promise(resolve=>{
  pumpCatalog=()=>{
   if(generation!==catalogGeneration){resolve();return}
   while(active<3&&pending.length){
    const job=pending.shift(),url=job.url;if(seen.has(url))continue;seen.add(url);active++;activeJobs.add(job);
    window.flowListNetwork(url).then(data=>{
     if(generation!==catalogGeneration)return;
     for(const item of data.files){
      item.collectionURL=job.collection;
      if(!item.directory||isMovie(item)){catalog.set(item.url,item);discovered.set(item.url,item);}
      if(item.directory&&!scheduled.has(item.url)){scheduled.add(item.url);const child={url:item.url,collection:job.collection||item.url};
       if(priorityFolder&&matches(child,priorityFolder))pending.unshift(child);else pending.push(child);}
     }
    }).catch(()=>{failed++;errors.push(job);}).finally(()=>{
     if(generation!==catalogGeneration){resolve();return}
     active--;activeJobs.delete(job);completed.add(url);done++;catalogFailed=failed;if(!active&&!pending.length){catalogRunning=false;if(!failed)catalog=discovered;}
     catalogStatus.textContent='Server catalog · '+catalog.size+' entries · '+done+' folders read'+(failed?' · '+failed+' unavailable':'')+(active||pending.length?' · Still indexing…':' · Scan complete');
     if(done===1||done%8===0||(!active&&!pending.length)){write('flow-catalog:'+server,{at:Date.now(),items:catalogItems()});scheduleCatalogPaint();}
     if(!active&&!pending.length){catalogRunning=false;resolve()}else pumpCatalog();
    });
   }
  };pumpCatalog();
 });
}

function watchedKey(item){
 const movie=item.folder||item;
 return title(movie).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim()+'|'+year(movie);
}
function isWatched(item){return !!watched[watchedKey(item)]}
function watchedButton(item,className='save-text'){
 const button=el('button',className);button.append(icon('check'),el('span','','Watched'));
 button.dataset.watchedKey=watchedKey(item);
 button.setAttribute('aria-label',(isWatched(item)?'Mark unwatched ':'Mark watched ')+title(item));
 button.setAttribute('aria-pressed',String(isWatched(item)));
 button.classList.toggle('saved',isWatched(item));
 button.onclick=()=>toggleWatched(item);
 return button;
}
function syncWatched(){
 document.querySelectorAll('[data-watched-key]').forEach(button=>{
  const yes=!!watched[button.dataset.watchedKey];
  button.classList.toggle('saved',yes);button.setAttribute('aria-pressed',String(yes));
  button.setAttribute('aria-label',yes?'Mark as unwatched':'Mark as watched');
 });
 const movie=state.selected;
 if(movie&&$('detail-watched')){$('detail-watched').textContent=isWatched(movie)?'✓ Watched · Undo':'Mark as watched';$('detail-watched').setAttribute('aria-pressed',String(isWatched(movie)));}
 if(state.current&&$('track-watched'))$('track-watched').textContent=isWatched(state.current)?'✓ Watched · Undo':'Mark as watched';
}
function toggleWatched(item){
 const movie=item.folder||item,key=watchedKey(movie);
 if(watched[key]){delete watched[key];toast('Marked as unwatched.')}
 else{
  watched[key]={name:movie.name||title(movie),title:title(movie),url:movie.url,directory:!!movie.directory,local:!!movie.local,watchedAt:Date.now()};
  delete onlineArtCache[artKey(movie)];infoCache.delete(artKey(movie));artCache={};serverArtFallback.delete(movie.url);
  write('flow-online-art-v1',onlineArtCache);toast('Marked as watched. Hidden from recommendations.');
 }
 write('flow-watched-v1',watched);syncWatched();renderHomeGrid();if(state.view==='saved')renderSaved();
}
const detailWatched=el('button','save-text','Mark as watched');
detailWatched.id='detail-watched';detailWatched.onclick=()=>state.selected&&toggleWatched(state.selected);$('detail-save').after(detailWatched);
const trackWatched=el('button','outline','Mark as watched');trackWatched.id='track-watched';trackWatched.onclick=()=>state.current&&toggleWatched(state.current);$('save-track').after(trackWatched);
const watchedTab=el('button','outline','Show watched titles');$('saved-grid').before(watchedTab);
watchedTab.onclick=()=>{watchedView=!watchedView;watchedTab.textContent=watchedView?'Show watchlist':'Show watched titles';renderSaved()};
const watchedLabel=el('label','small-print');const watchedToggle=el('input');watchedToggle.type='checkbox';watchedLabel.append(watchedToggle,document.createTextNode(' Include watched in recommendations'));refreshCatalog.after(watchedLabel);
watchedToggle.onchange=()=>{includeWatched=watchedToggle.checked;renderHomeGrid()};
const cacheInfo=el('p','small-print','Artwork, movie details and server catalogs expire after 7 days. Cleanup runs when you open or resume Flow. Your watchlist, watched titles and playback progress are kept.');
const clearCache=el('button','outline wide','Clear cached data');
$('license-details').before(cacheInfo,clearCache);
clearCache.onclick=async()=>{
 clearCache.disabled=true;
 try{
  if(window.FlowAndroid?.clearCachedData)await window.flowNativeCall('clearCachedData');
  for(const key of Object.keys(localStorage))if(key.startsWith('flow-catalog:')||key==='flow-online-art-v1'||key==='flow-artwork-v2')localStorage.removeItem(key);
  for(const key of Object.keys(onlineArtCache))delete onlineArtCache[key];
  artCache={};infoCache.clear();detailsCache.clear();serverArtFallback.clear();alternativeArt.clear();suggestionVersion++;suggestionCache.clear();onlineSuggestions=[];suggestionBox.replaceChildren();
  toast('Cached data cleared. Your library and progress are kept.');
 }catch{toast('Cache cleanup could not finish. Try again.')}
 finally{clearCache.disabled=false;}
};
setInterval(()=>{
 pruneStoredCaches();
 for(const key of Object.keys(onlineArtCache))if(Date.now()-onlineArtCache[key].at>=CACHE_WEEK)delete onlineArtCache[key];
 infoCache.clear();detailsCache.clear();
},3600000);

// Suggestions combine known server titles with public movie names. Availability remains
// provisional until the recursive scan finishes without unavailable folders.
let suggestionVersion=0,onlineSuggestions=[],suggestionQuery='';
const suggestionCache=new Map();
const suggestionBox=el('div','title-suggestions');suggestionBox.id='title-suggestions';
suggestionBox.setAttribute('aria-label','Movie name suggestions');
$('home-search').setAttribute('aria-controls',suggestionBox.id);
$('home-search').setAttribute('autocomplete','off');
$('home-search').parentElement.after(suggestionBox);
function titleAvailability(candidate,items=homeItemsInScope()){
 const wanted=normalizeSearch(candidate.name);
 const found=items.some(item=>normalizeSearch(title(item))===wanted&&(!candidate.year||!year(item)||String(candidate.year)===year(item)));
 const status=scopeStatus(homeScope?.url);
 const location=homeScope?homeScope.label:'server';
 if(found)return homeScope?'Available in '+location:'Available on server';
 return status.running?'Checking '+location+'…':status.failed?'Some folders unavailable · Not confirmed':homeScope?'Not found in '+location:'Not found on server';
}
function renderSuggestions(){
 const query=$('home-search').value.trim(),normal=normalizeSearch(query);
 if(selectedTitleQuery===normal&&normal){suggestionBox.hidden=true;return}
 if(suggestionBox.contains(document.activeElement))return;
 suggestionBox.replaceChildren();suggestionBox.hidden=normal.length<2;
 if(normal.length<2)return;
 const choices=new Map();
 for(const item of homeItemsInScope()){
  if(!isMovie(item)||!normalizeSearch(title(item)).includes(normal))continue;
  const candidate={name:title(item),year:year(item)};
  choices.set(normalizeSearch(candidate.name)+'|'+candidate.year,candidate);
  if(choices.size>=6)break;
 }
 if(normal===suggestionQuery)for(const candidate of onlineSuggestions){
  const key=normalizeSearch(candidate.name)+'|'+(candidate.year||'');
  if(!choices.has(key))choices.set(key,candidate);
 }
 for(const candidate of Array.from(choices.values()).slice(0,8)){
  const button=el('button','title-suggestion');
  button.type='button';
  button.append(el('b','',candidate.name+(candidate.year?' ('+candidate.year+')':'')),el('small','',titleAvailability(candidate)));
  button.onclick=()=>{$('home-search').value=candidate.name;selectedTitleQuery=normalizeSearch(candidate.name);clearTimeout(searchTimer);onlineSuggestions=[];suggestionQuery='';suggestionVersion++;renderHomeGrid();suggestionBox.hidden=true;};
  suggestionBox.append(button);
 }
 if(!choices.size){
  const status=scopeStatus(homeScope?.url),location=homeScope?homeScope.label:'server';
  suggestionBox.append(el('p','small-print',status.running?'Searching '+location+' folders…':status.failed?'Collection scan is incomplete. Retry unavailable folders.':'No matching title found in '+location+'.'));
 }
}
async function updateSuggestions(){
 const query=$('home-search').value.trim(),normal=normalizeSearch(query),version=++suggestionVersion;
 if(selectedTitleQuery===normal)return;
 onlineSuggestions=[];suggestionQuery=normal;renderSuggestions();
 if(normal.length<2||!window.FlowAndroid?.suggestions)return;
 const cached=suggestionCache.get(normal);
 try{
  const titles=cached&&Date.now()-cached.at<3600000?cached.items:await window.flowNativeCall('suggestions',[query]);
  if(version!==suggestionVersion||normalizeSearch($('home-search').value)!==normal)return;
  onlineSuggestions=titles;suggestionCache.set(normal,{at:Date.now(),items:titles});
  if(suggestionCache.size>40)suggestionCache.delete(suggestionCache.keys().next().value);
  renderSuggestions();
 }catch{/* Server search remains available when the public suggestion service is offline. */}
}
$('home-search').addEventListener('keydown',event=>{
 if(event.key==='Escape'){suggestionBox.hidden=true;suggestionVersion++;}
 if(event.key==='ArrowDown'&&!suggestionBox.hidden){suggestionBox.querySelector('button')?.focus();event.preventDefault();}
});
suggestionBox.addEventListener('keydown',event=>{
 const buttons=Array.from(suggestionBox.querySelectorAll('button')),index=buttons.indexOf(document.activeElement);
 if(event.key==='ArrowDown'){buttons[(index+1)%buttons.length]?.focus();event.preventDefault();}
 if(event.key==='ArrowUp'){if(index<=0)$('home-search').focus();else buttons[index-1].focus();event.preventDefault();}
 if(event.key==='Escape'){$('home-search').focus();suggestionBox.hidden=true;}
});
