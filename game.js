'use strict';

const VERSION = 1;
const SAVE_KEY = 'underleaf_night_shift_v1';
const $ = (id) => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const lerp = (a,b,t) => a+(b-a)*t;
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const todayKey = () => new Date().toISOString().slice(0,10);
const fmt = n => Math.floor(n).toLocaleString();

function hashString(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296}}
function pick(rng,arr){return arr[Math.floor(rng()*arr.length)]}

const BUGS = [
  {id:'ant',name:'Field Ant',rank:1,sigil:'A1',role:'Courier',ability:'Anchor Dash',desc:'Fast acceleration and the strongest carry speed. Anchor Dash punches through danger and briefly stuns anything in the lane.',speed:1.08,detect:1.0,color:'#8ce0a7'},
  {id:'beetle',name:'Iron Beetle',rank:2,sigil:'B2',role:'Bulwark',ability:'Shell Brace',desc:'Slower but durable. Shell Brace cancels contact damage and turns your body into a moving battering ram.',speed:.88,detect:1.05,color:'#d7c47b'},
  {id:'mosquito',name:'Glass Mosquito',rank:3,sigil:'M3',role:'Skimmer',ability:'Air Skip',desc:'Light and evasive. Air Skip ignores terrain for a short window and lets you cut across routes other bugs cannot.',speed:1.18,detect:1.18,color:'#9ec8ef'},
  {id:'mantis',name:'Orchid Mantis',rank:5,sigil:'M5',role:'Disruptor',ability:'Blade Arc',desc:'Precise close-range control. Blade Arc sweeps nearby threats and disables them long enough to finish an objective.',speed:1.02,detect:1.08,color:'#d79cec'},
  {id:'firefly',name:'Lantern Firefly',rank:7,sigil:'F7',role:'Scout',ability:'Signal Flash',desc:'Sees farther in dark sectors. Signal Flash freezes nearby predators and reveals every active objective for a moment.',speed:1.03,detect:.9,color:'#eff39a'},
  {id:'stick',name:'Bark Stickbug',rank:10,sigil:'S10',role:'Ghost',ability:'Still Cloak',desc:'Low profile and difficult to detect. Still Cloak cuts predator tracking to zero while you cross exposed ground.',speed:.98,detect:.68,color:'#c6a47a'}
];

const ZONES = [
  {name:'Clover Verge',min:1,color:'#2c714d',hazard:'Open grass and wandering hunters'},
  {name:'Rain Gutter',min:2,color:'#45758a',hazard:'Water drops strike marked ground'},
  {name:'Glasshouse',min:3,color:'#6e7d4c',hazard:'Tight lanes and hot vents'},
  {name:'Picnic Ruins',min:5,color:'#8a6649',hazard:'Crumbs attract extra predators'},
  {name:'Moon Garden',min:7,color:'#5c5588',hazard:'Low light and shifting patrols'},
  {name:'Old Conservatory',min:10,color:'#7b5a65',hazard:'Dense cover and elite hunters'}
];

const MISSION_TYPES = [
  {id:'scavenge',name:'SCAVENGE',verbs:['Recover dew capsules','Collect resin fragments','Gather seed glass'],brief:'Sweep the sector and recover marked field material.'},
  {id:'relay',name:'RELAY',verbs:['Restore signal posts','Wake the scent relays','Prime survey beacons'],brief:'Hold position at each relay until its signal locks.'},
  {id:'rescue',name:'RESCUE',verbs:['Extract a lost larva','Recover the field runner','Bring the scout home'],brief:'Reach the stranded bug, then carry it to the extraction ring.'},
  {id:'sabotage',name:'SABOTAGE',verbs:['Break web anchors','Cut trap supports','Collapse hunter snares'],brief:'Use your specialist ability near each marked anchor.'},
  {id:'survey',name:'SURVEY',verbs:['Map pressure zones','Record scent pockets','Scan the night lanes'],brief:'Stay inside each scan field until the reading completes.'}
];

const LABS = [
  {id:'vitality',name:'Chitin Weave',max:8,base:170,desc:'Adds 10 maximum health per level.'},
  {id:'speed',name:'Leg Tuning',max:8,base:190,desc:'Adds 6% base movement speed per level.'},
  {id:'cooldown',name:'Reflex Loop',max:8,base:220,desc:'Reduces specialist ability cooldown by 5% per level.'},
  {id:'pickup',name:'Antenna Reach',max:8,base:160,desc:'Adds 4 pixels of objective pickup range per level.'},
  {id:'reward',name:'Field Ledger',max:6,base:260,desc:'Adds 6% Sap payout per successful contract.'},
  {id:'burst',name:'Burst Spring',max:6,base:240,desc:'Reduces universal Burst cooldown and increases its travel.'}
];

const CHIPS = [
  {id:'moss',name:'Moss Trace',rarity:'Common',color:'#92c79d',condition:'Complete 1 contract.',test:s=>s.stats.wins>=1},
  {id:'rain',name:'Rainline',rarity:'Uncommon',color:'#80b9dc',condition:'Win in Rain Gutter.',test:s=>s.stats.zoneWins['Rain Gutter']>=1},
  {id:'clean',name:'Clean Exit',rarity:'Rare',color:'#78a8f2',condition:'Finish a contract with full health.',test:s=>s.stats.fullHealthWins>=1},
  {id:'ghost',name:'Ghost Thread',rarity:'Epic',color:'#c086e4',condition:'Win 3 contracts without taking damage.',test:s=>s.stats.noDamageWins>=3},
  {id:'gold',name:'Amber Crown',rarity:'Legendary',color:'#e6be65',condition:'Earn 50 Amber total.',test:s=>s.stats.amberEarned>=50},
  {id:'night',name:'Night Bloom',rarity:'Mythical',color:'#ed7e98',condition:'Win once with all six specialists.',test:s=>Object.keys(s.stats.bugWins).length>=6},
  {id:'divine',name:'Luminous Vein',rarity:'Divine',color:'#ecf49d',condition:'Reach Rank 15 and win 25 contracts.',test:s=>rankFromXp(s.xp)>=15&&s.stats.wins>=25}
];

const defaultState = () => ({
  version:VERSION,sap:600,amber:5,xp:0,selectedBug:'ant',equippedChip:null,selectedContract:0,refreshes:0,
  lab:{vitality:0,speed:0,cooldown:0,pickup:0,reward:0,burst:0},
  daily:{date:'',claimed:false},
  settings:{master:100,music:70,sfx:100,shake:true,contrast:false,reducedMotion:false},
  stats:{wins:0,losses:0,fullHealthWins:0,noDamageWins:0,amberEarned:0,bugWins:{},zoneWins:{}},
});

let state = loadState();
let contracts = [];
let audio = {ctx:null,master:null,music:null,sfx:null,timer:null,step:0};
let game = null;
let raf = null;

function loadState(){
  try{
    const raw=localStorage.getItem(SAVE_KEY); if(!raw)return defaultState();
    const s=JSON.parse(raw), d=defaultState();
    return {...d,...s,lab:{...d.lab,...s.lab},daily:{...d.daily,...s.daily},settings:{...d.settings,...s.settings},stats:{...d.stats,...s.stats,bugWins:{...d.stats.bugWins,...(s.stats?.bugWins||{})},zoneWins:{...d.stats.zoneWins,...(s.stats?.zoneWins||{})}}};
  }catch(e){return defaultState()}
}
function saveState(){localStorage.setItem(SAVE_KEY,JSON.stringify(state));refreshHeader()}
function rankFromXp(xp){return Math.max(1,Math.floor(Math.sqrt(xp/260))+1)}
function xpForNext(rank){return 260*rank*rank}
function currentBug(){return BUGS.find(b=>b.id===state.selectedBug)||BUGS[0]}
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1800)}

function refreshHeader(){
  $('sapValue').textContent=fmt(state.sap);$('amberValue').textContent=fmt(state.amber);$('rankValue').textContent=rankFromXp(state.xp);
}

function makeBugArt(bug){
  const c=bug.color, dark='#173027', line='rgba(226,255,235,.52)';
  const common=`stroke="${line}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  let body='';
  if(bug.id==='ant') body=`
    <g ${common}><path d="M82 73 48 48M82 82 42 82M83 92 48 122M139 73 173 48M139 82 179 82M137 93 172 122"/></g>
    <ellipse cx="111" cy="112" rx="35" ry="27" fill="${c}"/><ellipse cx="111" cy="78" rx="25" ry="22" fill="${c}"/><circle cx="111" cy="45" r="21" fill="${c}"/>
    <g ${common}><path d="M99 31 84 16M123 31 139 16"/></g>`;
  else if(bug.id==='beetle') body=`
    <g ${common}><path d="M77 70 43 49M72 84 38 84M77 99 45 122M145 70 179 49M150 84 184 84M145 99 177 122"/></g>
    <ellipse cx="111" cy="91" rx="47" ry="54" fill="${c}"/><path d="M111 40V143" stroke="${dark}" stroke-width="5"/><ellipse cx="111" cy="48" rx="27" ry="24" fill="${dark}"/><path d="M94 35 78 18M128 35 145 18" ${common}/>`;
  else if(bug.id==='mosquito') body=`
    <g ${common}><path d="M98 73 45 36M96 82 35 82M101 92 53 131M122 73 175 36M124 82 187 82M120 93 168 131"/></g>
    <ellipse cx="86" cy="74" rx="36" ry="18" transform="rotate(-22 86 74)" fill="${c}" fill-opacity=".38"/><ellipse cx="136" cy="74" rx="36" ry="18" transform="rotate(22 136 74)" fill="${c}" fill-opacity=".38"/>
    <ellipse cx="111" cy="98" rx="11" ry="39" fill="${c}"/><ellipse cx="111" cy="61" rx="14" ry="18" fill="${dark}"/><circle cx="111" cy="42" r="12" fill="${c}"/><path d="M111 31V8" ${common}/>`;
  else if(bug.id==='mantis') body=`
    <g ${common}><path d="M99 69 67 47 48 69M123 69 155 47 174 69M99 89 55 119M123 89 167 119M104 100 82 139M118 100 140 139"/></g>
    <ellipse cx="111" cy="105" rx="18" ry="43" fill="${c}"/><ellipse cx="111" cy="73" rx="20" ry="19" fill="${dark}"/><path d="M92 47 111 31 130 47 124 65 98 65Z" fill="${c}"/><path d="M101 34 91 17M121 34 132 17" ${common}/>`;
  else if(bug.id==='firefly') body=`
    <g ${common}><path d="M88 75 53 55M86 92 48 108M134 75 169 55M136 92 174 108"/></g>
    <ellipse cx="84" cy="86" rx="33" ry="20" transform="rotate(-24 84 86)" fill="${c}" fill-opacity=".27"/><ellipse cx="138" cy="86" rx="33" ry="20" transform="rotate(24 138 86)" fill="${c}" fill-opacity=".27"/>
    <ellipse cx="111" cy="106" rx="23" ry="37" fill="${c}"/><ellipse cx="111" cy="78" rx="22" ry="19" fill="${dark}"/><circle cx="111" cy="54" r="17" fill="${c}"/><ellipse cx="111" cy="124" rx="16" ry="18" fill="#efff9d" opacity=".9"/><path d="M101 42 91 25M121 42 132 25" ${common}/>`;
  else body=`
    <g ${common}><path d="M104 49 67 22M105 68 55 60M105 89 62 119M118 49 155 22M117 68 167 60M117 89 160 119"/></g>
    <rect x="104" y="40" width="14" height="86" rx="7" fill="${c}"/><ellipse cx="111" cy="46" rx="13" ry="16" fill="${dark}"/><circle cx="111" cy="27" r="11" fill="${c}"/><path d="M106 20 97 8M116 20 125 8" ${common}/>`;
  return `<svg class="bugSvg" viewBox="0 0 220 160" role="img" aria-label="${bug.name}"><defs><filter id="glow-${bug.id}"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g filter="url(#glow-${bug.id})">${body}</g><g fill="#effff3"><circle cx="104" cy="42" r="2.4"/><circle cx="118" cy="42" r="2.4"/></g></svg>`;
}

function generateContracts(){
  const rank=rankFromXp(state.xp); const seed=hashString(todayKey()+'|'+state.refreshes+'|underleaf'); const rng=mulberry32(seed);
  const unlockedZones=ZONES.filter(z=>z.min<=rank);
  contracts=Array.from({length:3},(_,i)=>{
    const type=pick(rng,MISSION_TYPES), zone=pick(rng,unlockedZones);
    const maxDiff=Math.min(5,1+Math.floor(rank/3)); const difficulty=clamp(1+Math.floor(rng()*maxDiff),1,5);
    const sap=Math.round((120+difficulty*65+zone.min*14)*(1+state.lab.reward*.06));
    const amber=difficulty>=4?(rng()<.55?2:1):(rng()<.18?1:0);
    const xp=90+difficulty*45+zone.min*10;
    return {id:`${seed}-${i}`,type:type.id,typeName:type.name,title:pick(rng,type.verbs),brief:type.brief,zone:zone.name,zoneColor:zone.color,hazard:zone.hazard,difficulty,sap,amber,xp,seed:Math.floor(rng()*99999999)};
  });
  state.selectedContract=clamp(state.selectedContract,0,2); renderHome();
}

function renderHome(){
  refreshHeader();
  const bug=currentBug();
  $('selectedBugPreview').innerHTML=makeBugArt(bug)+`<div style="position:absolute;right:20px;bottom:12px;text-align:right"><div class="eyebrow">${bug.role.toUpperCase()}</div><b style="font-size:19px">${bug.name}</b></div>`;
  $('boardStamp').textContent=todayKey();
  $('contractGrid').innerHTML=contracts.map((c,i)=>`<article class="contract ${i===state.selectedContract?'selected':''}" style="--accent:${c.zoneColor}" data-contract="${i}"><div class="contractType">${c.typeName} / DIFFICULTY ${c.difficulty}</div><h3>${c.title}</h3><p>${c.zone}. ${c.hazard}.</p><div class="contractMeta"><span>${c.sap} Sap${c.amber?` + ${c.amber} Amber`:''}</span><span>${c.xp} XP</span></div><button>${i===state.selectedContract?'Selected':'Select Contract'}</button></article>`).join('');
  [...document.querySelectorAll('[data-contract]')].forEach(el=>el.onclick=()=>{state.selectedContract=+el.dataset.contract;saveState();renderHome();playSfx('tap')});
  $('currentBugCard').innerHTML=`<div class="cardTop"><div><span class="rarity Common">${bug.role}</span><h3 style="margin:10px 0 3px">${bug.name}</h3></div><div class="bugSigil">${bug.sigil}</div></div><p style="color:#9fb7aa;line-height:1.5;font-size:13px">${bug.desc}</p><div class="abilityTag"><b>${bug.ability}</b><br>Specialist ability</div>`;
  const dkey=todayKey(); if(state.daily.date!==dkey){state.daily={date:dkey,claimed:false};saveState()}
  $('dailyCard').innerHTML=state.daily.claimed?`<div><div class="eyebrow">CACHE OPENED</div><div class="dailyReward">Claimed for tonight</div><p>The field cache resets on the next date.</p></div><button disabled>Already Claimed</button>`:`<div><div class="eyebrow">AVAILABLE</div><div class="dailyReward">250 Sap + 2 Amber</div><p>A fixed daily field stipend. No random wheel and no rerolling.</p></div><button id="claimDaily" class="primary">Claim Night Cache</button>`;
  if($('claimDaily'))$('claimDaily').onclick=()=>{state.daily.claimed=true;state.sap+=250;state.amber+=2;state.stats.amberEarned+=2;saveState();renderHome();playSfx('reward');toast('Night cache claimed')};
}

function renderBugs(){
  const rank=rankFromXp(state.xp);
  $('bugGrid').innerHTML=BUGS.map(b=>{const unlocked=rank>=b.rank;return `<article class="bugCard ${unlocked?'':'locked'} ${state.selectedBug===b.id?'selected':''}" data-bug="${b.id}"><div class="cardTop"><div class="bugSigil" style="background:linear-gradient(145deg,${b.color},#294638)">${b.sigil}</div><span class="unlockTag">${unlocked?(state.selectedBug===b.id?'ACTIVE':'UNLOCKED'):`RANK ${b.rank}`}</span></div><div class="specimenMini">${makeBugArt(b)}</div><h3>${b.name}</h3><div class="eyebrow">${b.role.toUpperCase()}</div><p>${b.desc}</p><div class="abilityTag"><b>${b.ability}</b></div>${unlocked?`<button style="width:100%;margin-top:12px">${state.selectedBug===b.id?'Selected':'Select'}</button>`:''}</article>`}).join('');
  [...document.querySelectorAll('[data-bug]')].forEach(el=>el.onclick=()=>{const b=BUGS.find(x=>x.id===el.dataset.bug);if(rank<b.rank){toast(`Reach Rank ${b.rank}`);return}state.selectedBug=b.id;saveState();renderBugs();renderHome();playSfx('select')});
}

function labCost(l){const lv=state.lab[l.id];return Math.round(l.base*Math.pow(1.62,lv))}
function renderLab(){
  $('labGrid').innerHTML=LABS.map(l=>{const lv=state.lab[l.id],cost=labCost(l),maxed=lv>=l.max;return `<article class="labCard"><div class="cardTop"><div><div class="eyebrow">LEVEL ${lv} / ${l.max}</div><h3>${l.name}</h3></div><div class="bugSigil">${String(lv).padStart(2,'0')}</div></div><p>${l.desc}</p><div class="levelBar"><i style="width:${lv/l.max*100}%"></i></div><div class="price"><b>${maxed?'MAXED':cost+' Sap'}</b><button data-lab="${l.id}" ${maxed?'disabled':''}>${maxed?'Complete':'Upgrade'}</button></div></article>`}).join('');
  [...document.querySelectorAll('[data-lab]')].forEach(btn=>btn.onclick=()=>{const l=LABS.find(x=>x.id===btn.dataset.lab),cost=labCost(l);if(state.sap<cost){toast('Not enough Sap');playSfx('deny');return}state.sap-=cost;state.lab[l.id]++;saveState();renderLab();playSfx('upgrade');toast(`${l.name} upgraded`)});
}

function renderPins(){
  const unlocked=CHIPS.filter(c=>c.test(state)).map(c=>c.id);
  if(state.equippedChip&&!unlocked.includes(state.equippedChip))state.equippedChip=null;
  $('pinGrid').innerHTML=CHIPS.map(c=>{const yes=unlocked.includes(c.id);return `<article class="pinCard ${yes?'unlocked':''}" data-chip="${c.id}" style="${state.equippedChip===c.id?'border-color:'+c.color:''}"><div class="pinSwatch" style="--pin:${c.color}"></div><span class="rarity ${c.rarity}">${c.rarity}</span><h3>${c.name}</h3><p>${c.condition}</p>${yes?`<button style="width:100%;margin-top:8px">${state.equippedChip===c.id?'Equipped':'Equip Trail'}</button>`:`<div class="unlockTag">LOCKED</div>`}</article>`}).join('');
  [...document.querySelectorAll('[data-chip]')].forEach(el=>el.onclick=()=>{const c=CHIPS.find(x=>x.id===el.dataset.chip);if(!c.test(state)){toast(c.condition);return}state.equippedChip=state.equippedChip===c.id?null:c.id;saveState();renderPins();playSfx('select')});
}

function renderSettings(){
  for(const k of ['master','music','sfx']){const el=$(k+'Volume'),out=$(k+'Readout');el.value=state.settings[k];out.textContent=state.settings[k]+'%';el.oninput=()=>{state.settings[k]=+el.value;out.textContent=el.value+'%';applyAudioVolumes();saveState()}}
  $('shakeToggle').checked=state.settings.shake;$('contrastToggle').checked=state.settings.contrast;$('motionToggle').checked=state.settings.reducedMotion;
  $('shakeToggle').onchange=e=>{state.settings.shake=e.target.checked;saveState()};$('contrastToggle').onchange=e=>{state.settings.contrast=e.target.checked;saveState()};$('motionToggle').onchange=e=>{state.settings.reducedMotion=e.target.checked;saveState()};
}

function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$('screen'+name).classList.add('active');document.querySelectorAll('.bottomNav button').forEach(b=>b.classList.toggle('active',b.dataset.screen===name));
  if(name==='Home')renderHome();if(name==='Bugs')renderBugs();if(name==='Lab')renderLab();if(name==='Pins')renderPins();if(name==='Settings')renderSettings();window.scrollTo({top:0,behavior:state.settings.reducedMotion?'auto':'smooth'});playSfx('tap');
}

function safeGain(pct){if(pct<=0)return 0;return Math.min(1.8,Math.sqrt(pct/100))}
function initAudio(){
  if(audio.ctx)return; const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
  audio.ctx=new Ctx();audio.master=audio.ctx.createGain();audio.music=audio.ctx.createGain();audio.sfx=audio.ctx.createGain();audio.music.connect(audio.master);audio.sfx.connect(audio.master);audio.master.connect(audio.ctx.destination);applyAudioVolumes();
  const notes=[110,146.83,164.81,220,196,146.83,123.47,164.81];
  audio.timer=setInterval(()=>{if(!audio.ctx||audio.ctx.state!=='running')return;const o=audio.ctx.createOscillator(),g=audio.ctx.createGain(),f=audio.ctx.createBiquadFilter();o.type=audio.step%4===0?'triangle':'sine';o.frequency.value=notes[audio.step%notes.length];f.type='lowpass';f.frequency.value=680;g.gain.setValueAtTime(.0001,audio.ctx.currentTime);g.gain.exponentialRampToValueAtTime(.018,audio.ctx.currentTime+.025);g.gain.exponentialRampToValueAtTime(.0001,audio.ctx.currentTime+.52);o.connect(f);f.connect(g);g.connect(audio.music);o.start();o.stop(audio.ctx.currentTime+.56);audio.step++},560);
}
function applyAudioVolumes(){if(!audio.ctx)return;audio.master.gain.value=safeGain(state.settings.master);audio.music.gain.value=safeGain(state.settings.music)*.55;audio.sfx.gain.value=safeGain(state.settings.sfx)*.7}
function playSfx(type){initAudio();if(!audio.ctx)return; if(audio.ctx.state==='suspended')audio.ctx.resume();const t=audio.ctx.currentTime;const o=audio.ctx.createOscillator(),g=audio.ctx.createGain();o.type=type==='deny'?'sawtooth':type==='reward'?'sine':'triangle';const f={tap:260,select:390,deny:120,reward:620,upgrade:480,hit:90,ability:340,collect:720,win:520,fail:100}[type]||280;o.frequency.setValueAtTime(f,t);if(type==='reward'||type==='win')o.frequency.exponentialRampToValueAtTime(f*1.65,t+.18);if(type==='hit'||type==='fail')o.frequency.exponentialRampToValueAtTime(Math.max(50,f*.55),t+.2);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(g);g.connect(audio.sfx);o.start(t);o.stop(t+.24)}

// Mission engine
const canvas=$('gameCanvas'),ctx=canvas.getContext('2d');
let input={keys:{},joy:{x:0,y:0},joyId:null};
function resizeCanvas(){if(!game)return;const r=canvas.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(r.width*dpr);canvas.height=Math.floor(r.height*dpr);game.w=r.width;game.h=r.height;game.dpr=dpr}
window.addEventListener('resize',resizeCanvas);

function startMission(contract){
  initAudio(); const bug=currentBug();
  $('missionLayer').classList.remove('hidden');document.body.style.overflow='hidden';
  game={contract,bug,w:800,h:600,dpr:1,last:performance.now(),time:75+contract.difficulty*9,started:false,ended:false,health:100+state.lab.vitality*10,maxHealth:100+state.lab.vitality*10,damageTaken:0,objectiveDone:0,objectiveTotal:0,abilityCd:0,burstCd:0,abilityActive:0,invuln:0,flash:0,shake:0,keysEdge:{},player:{x:100,y:300,vx:0,vy:0,r:15,trail:[]},obstacles:[],threats:[],objectives:[],hazards:[],exit:null,carrying:false,rng:mulberry32(contract.seed)};
  resizeCanvas();setupWorld();updateMissionUI();raf=requestAnimationFrame(loop);playSfx('select');
}

function randPos(m=70){return {x:m+game.rng()*(game.w-m*2),y:m+game.rng()*(game.h-m*2)}}
function freePos(m=70){for(let tries=0;tries<100;tries++){const p=randPos(m);if(dist(p,game.player)>130&&game.obstacles.every(o=>Math.hypot(p.x-o.x,p.y-o.y)>o.r+45))return p}return randPos(m)}
function setupWorld(){
  game.player.x=80;game.player.y=game.h/2;
  const c=game.contract;
  const obstacleCount=5+c.difficulty*2;
  for(let i=0;i<obstacleCount;i++){const p=randPos(65); if(p.x<150)continue;game.obstacles.push({...p,r:26+game.rng()*34,shape:game.rng()<.5?'leaf':'stone',rot:game.rng()*Math.PI})}
  const threatCount=2+c.difficulty+Math.floor(ZONES.find(z=>z.name===c.zone).min/4);
  for(let i=0;i<threatCount;i++){const p=freePos(60);game.threats.push({...p,homeX:p.x,homeY:p.y,vx:0,vy:0,r:13+game.rng()*3,angle:game.rng()*6.28,stun:0,elite:c.difficulty>=4&&i===0,phase:game.rng()*10})}
  if(c.zone==='Rain Gutter')for(let i=0;i<3+c.difficulty;i++){const p=freePos(30);game.hazards.push({...p,r:26,delay:1+game.rng()*4,active:0,cycle:3.6+game.rng()*1.8})}
  const type=c.type;
  if(type==='scavenge'){
    game.objectiveTotal=5+c.difficulty;for(let i=0;i<game.objectiveTotal;i++){const p=freePos(55);game.objectives.push({...p,r:10,kind:'pickup',done:false,pulse:game.rng()*6.28})}
  }else if(type==='relay'){
    game.objectiveTotal=3+(c.difficulty>=4?1:0);for(let i=0;i<game.objectiveTotal;i++){const p=freePos(65);game.objectives.push({...p,r:24,kind:'relay',done:false,progress:0,pulse:game.rng()*6.28})}
  }else if(type==='rescue'){
    game.objectiveTotal=1;const p=freePos(90);game.objectives.push({...p,r:14,kind:'larva',done:false,picked:false,pulse:0});game.exit={x:game.w-78,y:game.h-78,r:38};
  }else if(type==='sabotage'){
    game.objectiveTotal=3+(c.difficulty>=4?1:0);for(let i=0;i<game.objectiveTotal;i++){const p=freePos(60);game.objectives.push({...p,r:18,kind:'anchor',done:false,pulse:game.rng()*6.28})}
  }else if(type==='survey'){
    game.objectiveTotal=3;for(let i=0;i<game.objectiveTotal;i++){const p=freePos(75);game.objectives.push({...p,r:46,kind:'survey',done:false,progress:0,pulse:game.rng()*6.28})}
  }
}

function objectiveText(){
  const c=game.contract;if(c.type==='scavenge')return 'Recover every marked field capsule. Contact is enough to collect.';
  if(c.type==='relay')return 'Stand inside each relay ring until its lock meter completes.';
  if(c.type==='rescue')return game.carrying?'Carry the rescued bug to the extraction ring.':'Reach the stranded bug and make contact.';
  if(c.type==='sabotage')return 'Move beside a web anchor and trigger your specialist ability.';
  return 'Hold position inside each survey field until the scan completes.';
}
function updateMissionUI(){
  $('missionType').textContent=`${game.contract.typeName} / ${game.contract.zone.toUpperCase()}`;$('missionTitle').textContent=game.contract.title;$('missionObjective').textContent=objectiveText();
  $('healthReadout').textContent=Math.max(0,Math.ceil(game.health));$('objectiveReadout').textContent=`${game.objectiveDone}/${game.objectiveTotal}`;$('abilityName').textContent=game.bug.ability.toUpperCase();
  $('abilityCooldown').textContent=game.abilityCd<=0?'READY':game.abilityCd.toFixed(1)+'s';$('burstCooldown').textContent=game.burstCd<=0?'READY':game.burstCd.toFixed(1)+'s';
  const sec=Math.max(0,Math.ceil(game.time));$('timeLeft').textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}

function loop(now){if(!game||game.ended)return;const dt=Math.min(.033,(now-game.last)/1000||.016);game.last=now;updateGame(dt);drawGame(now/1000);updateMissionUI();raf=requestAnimationFrame(loop)}
function movementVector(){let x=0,y=0;if(input.keys['a']||input.keys['arrowleft'])x--;if(input.keys['d']||input.keys['arrowright'])x++;if(input.keys['w']||input.keys['arrowup'])y--;if(input.keys['s']||input.keys['arrowdown'])y++;x+=input.joy.x;y+=input.joy.y;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m}return{x,y,m:Math.min(1,m)}}
function circleCollision(a,b,pad=0){return Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r+pad}
function resolveObstacles(p){if(game.abilityActive>0&&game.bug.id==='mosquito')return;for(const o of game.obstacles){const dx=p.x-o.x,dy=p.y-o.y,d=Math.hypot(dx,dy),min=p.r+o.r;if(d<min&&d>0){p.x=o.x+dx/d*min;p.y=o.y+dy/d*min}}}

function updateGame(dt){
  game.time-=dt;game.abilityCd=Math.max(0,game.abilityCd-dt);game.burstCd=Math.max(0,game.burstCd-dt);game.abilityActive=Math.max(0,game.abilityActive-dt);game.invuln=Math.max(0,game.invuln-dt);game.flash=Math.max(0,game.flash-dt);game.shake=Math.max(0,game.shake-dt*5);
  if(game.time<=0){endMission(false,'The contract window closed before extraction.');return}
  const mv=movementVector();let speed=175*game.bug.speed*(1+state.lab.speed*.06);if(game.carrying&&game.bug.id!=='ant')speed*=.78;if(game.abilityActive>0&&game.bug.id==='mosquito')speed*=1.52;
  game.player.vx=mv.x*speed;game.player.vy=mv.y*speed;game.player.x+=game.player.vx*dt;game.player.y+=game.player.vy*dt;
  game.player.x=clamp(game.player.x,game.player.r,game.w-game.player.r);game.player.y=clamp(game.player.y,game.player.r,game.h-game.player.r);resolveObstacles(game.player);
  if((Math.abs(game.player.vx)+Math.abs(game.player.vy))>5){game.player.trail.unshift({x:game.player.x,y:game.player.y,t:1});if(game.player.trail.length>20)game.player.trail.pop()}for(const t of game.player.trail)t.t-=dt*2.4;game.player.trail=game.player.trail.filter(t=>t.t>0);

  // objectives
  const range=state.lab.pickup*4;
  for(const o of game.objectives){if(o.done)continue;o.pulse+=dt*2;
    if(o.kind==='pickup'&&Math.hypot(game.player.x-o.x,game.player.y-o.y)<game.player.r+o.r+range){o.done=true;game.objectiveDone++;playSfx('collect')}
    if(o.kind==='relay'){const inside=Math.hypot(game.player.x-o.x,game.player.y-o.y)<o.r+game.player.r+4;if(inside)o.progress+=dt;else o.progress=Math.max(0,o.progress-dt*.22);if(o.progress>=2.2){o.done=true;game.objectiveDone++;playSfx('collect')}}
    if(o.kind==='larva'&&!o.picked&&Math.hypot(game.player.x-o.x,game.player.y-o.y)<game.player.r+o.r+range){o.picked=true;game.carrying=true;playSfx('collect')}
    if(o.kind==='survey'){const inside=Math.hypot(game.player.x-o.x,game.player.y-o.y)<o.r-game.player.r*.2;if(inside)o.progress+=dt;else o.progress=Math.max(0,o.progress-dt*.08);if(o.progress>=3){o.done=true;game.objectiveDone++;playSfx('collect')}}
  }
  if(game.contract.type==='rescue'&&game.carrying&&Math.hypot(game.player.x-game.exit.x,game.player.y-game.exit.y)<game.exit.r+game.player.r){game.objectiveDone=1;game.objectives[0].done=true}
  if(game.objectiveDone>=game.objectiveTotal){endMission(true,'Contract complete. The route back to the nest is clear.');return}

  // threats
  for(const e of game.threats){e.phase+=dt;e.stun=Math.max(0,e.stun-dt);if(e.stun>0)continue;let dx=game.player.x-e.x,dy=game.player.y-e.y,d=Math.hypot(dx,dy)||1;const detect=(112+game.contract.difficulty*10)*(1/game.bug.detect)*(game.abilityActive>0&&game.bug.id==='stick'?0:1);
    if(d<detect){const sp=66+game.contract.difficulty*7+(e.elite?16:0);e.vx=dx/d*sp;e.vy=dy/d*sp;e.angle=Math.atan2(dy,dx)}else{e.angle+=Math.sin(e.phase*.7)*dt*.8;e.vx=Math.cos(e.angle)*(24+(e.elite?8:0));e.vy=Math.sin(e.angle)*(24+(e.elite?8:0))}
    e.x+=e.vx*dt;e.y+=e.vy*dt;if(e.x<20||e.x>game.w-20)e.angle=Math.PI-e.angle;if(e.y<20||e.y>game.h-20)e.angle=-e.angle;e.x=clamp(e.x,18,game.w-18);e.y=clamp(e.y,18,game.h-18);
    if(circleCollision(game.player,e,0)&&game.invuln<=0){if(game.abilityActive>0&&game.bug.id==='beetle'){e.stun=2.4;continue}damagePlayer(e,16+(e.elite?5:0))}
  }
  // Rain hazard: visible telegraph is exact hit radius
  for(const h of game.hazards){h.delay-=dt;if(h.active>0){h.active-=dt;if(h.active>.18&&Math.hypot(game.player.x-h.x,game.player.y-h.y)<game.player.r+h.r&&game.invuln<=0)damagePlayer(h,12)}else if(h.delay<=0){h.active=.48;h.delay=h.cycle;h.x=40+game.rng()*(game.w-80);h.y=40+game.rng()*(game.h-80)}}
}

function damagePlayer(src,amount){game.health-=amount;game.damageTaken+=amount;game.invuln=1;game.shake=state.settings.shake?1:0;const dx=game.player.x-src.x,dy=game.player.y-src.y,d=Math.hypot(dx,dy)||1;game.player.x+=dx/d*22;game.player.y+=dy/d*22;playSfx('hit');if(game.health<=0)endMission(false,'Your specialist was forced to retreat from the sector.')}

function useAbility(){if(!game||game.ended||game.abilityCd>0)return;const b=game.bug;game.abilityCd=(b.id==='mantis'?7:b.id==='firefly'?9:b.id==='stick'?8:6.5)*(1-state.lab.cooldown*.05);playSfx('ability');
  if(b.id==='ant'){const mv=movementVector(),m=mv.m?mv:{x:1,y:0};game.player.x+=m.x*72;game.player.y+=m.y*72;game.player.x=clamp(game.player.x,20,game.w-20);game.player.y=clamp(game.player.y,20,game.h-20);resolveObstacles(game.player);stunNearby(68,2)}
  else if(b.id==='beetle'){game.abilityActive=3;game.invuln=3;stunNearby(54,1.8)}
  else if(b.id==='mosquito'){game.abilityActive=2.7;game.invuln=.25}
  else if(b.id==='mantis'){stunNearby(92,3.4)}
  else if(b.id==='firefly'){game.flash=1.2;stunNearby(168,3.8)}
  else if(b.id==='stick'){game.abilityActive=5.2}
  if(game.contract.type==='sabotage')for(const o of game.objectives){if(!o.done&&Math.hypot(game.player.x-o.x,game.player.y-o.y)<game.player.r+o.r+72){o.done=true;game.objectiveDone++;playSfx('collect');break}}
}
function stunNearby(radius,time){for(const e of game.threats)if(Math.hypot(game.player.x-e.x,game.player.y-e.y)<radius)e.stun=Math.max(e.stun,time)}
function useBurst(){if(!game||game.ended||game.burstCd>0)return;const mv=movementVector();let x=mv.x,y=mv.y;if(mv.m===0){x=1;y=0}const travel=62+state.lab.burst*7;game.player.x=clamp(game.player.x+x*travel,18,game.w-18);game.player.y=clamp(game.player.y+y*travel,18,game.h-18);resolveObstacles(game.player);game.invuln=.22;game.burstCd=Math.max(1.8,3.8-state.lab.burst*.25);playSfx('tap')}

function drawGame(t){
  const dpr=game.dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,game.w,game.h);let sx=0,sy=0;if(game.shake>0){sx=(Math.random()-.5)*7*game.shake;sy=(Math.random()-.5)*7*game.shake}ctx.save();ctx.translate(sx,sy);
  drawBackground(t);for(const o of game.obstacles)drawObstacle(o);for(const h of game.hazards)drawHazard(h,t);for(const o of game.objectives)drawObjective(o,t);if(game.exit)drawExit(game.exit,t);for(const e of game.threats)drawThreat(e,t);drawPlayer(t);ctx.restore();
  if(game.flash>0){ctx.save();ctx.globalAlpha=game.flash*.16;ctx.fillStyle='#eaffb5';ctx.fillRect(0,0,game.w,game.h);ctx.restore()}
}
function drawBackground(t){
  const zone=ZONES.find(z=>z.name===game.contract.zone);const g=ctx.createLinearGradient(0,0,game.w,game.h);g.addColorStop(0,'#08150e');g.addColorStop(1,zone.color+'55');ctx.fillStyle=g;ctx.fillRect(0,0,game.w,game.h);
  ctx.strokeStyle='rgba(210,255,222,.035)';ctx.lineWidth=1;const grid=48;for(let x=(t*7)%grid-grid;x<game.w;x+=grid){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,game.h);ctx.stroke()}for(let y=0;y<game.h;y+=grid){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(game.w,y);ctx.stroke()}
  const vign=ctx.createRadialGradient(game.w/2,game.h/2,40,game.w/2,game.h/2,Math.max(game.w,game.h)*.7);vign.addColorStop(.3,'rgba(0,0,0,0)');vign.addColorStop(1,'rgba(0,0,0,.52)');ctx.fillStyle=vign;ctx.fillRect(0,0,game.w,game.h)
}
function drawObstacle(o){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot);if(o.shape==='leaf'){ctx.fillStyle='#173d28';ctx.beginPath();ctx.ellipse(0,0,o.r*1.25,o.r*.72,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#2a6042';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(-o.r*.8,0);ctx.lineTo(o.r*.85,0);ctx.stroke()}else{ctx.fillStyle='#26352f';ctx.beginPath();for(let i=0;i<7;i++){const a=i/7*Math.PI*2,r=o.r*(.82+(i%2)*.12);const x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.strokeStyle='#3c5048';ctx.stroke()}ctx.restore()}
function drawObjective(o,t){if(o.done)return;const bright=state.settings.contrast?'#ffffff':'#b9ffd0';ctx.save();ctx.translate(o.x,o.y);const pulse=1+Math.sin(t*3+o.pulse)*.06;if(o.kind==='pickup'){ctx.scale(pulse,pulse);ctx.fillStyle=bright;ctx.shadowColor=bright;ctx.shadowBlur=14;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(8,0);ctx.lineTo(0,10);ctx.lineTo(-8,0);ctx.closePath();ctx.fill()}
  else if(o.kind==='relay'){ctx.strokeStyle=bright;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,o.r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.35;ctx.fillStyle=bright;ctx.beginPath();ctx.arc(0,0,o.r*(o.progress/2.2),0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=bright;ctx.fillRect(-4,-14,8,28)}
  else if(o.kind==='larva'){if(!o.picked){ctx.fillStyle='#d7ebb1';ctx.beginPath();ctx.ellipse(0,0,15,9,.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffffff88';ctx.stroke()}}
  else if(o.kind==='anchor'){ctx.strokeStyle='#d8e9df';ctx.lineWidth=2;for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-24);ctx.stroke()}ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#e9c1c1';ctx.beginPath();ctx.arc(0,0,5,0,6.28);ctx.fill()}
  else if(o.kind==='survey'){ctx.strokeStyle=bright;ctx.lineWidth=2;ctx.globalAlpha=.55;ctx.beginPath();ctx.arc(0,0,o.r,0,6.28);ctx.stroke();ctx.globalAlpha=.12;ctx.fillStyle=bright;ctx.beginPath();ctx.arc(0,0,o.r,0,6.28);ctx.fill();ctx.globalAlpha=.7;ctx.strokeStyle=bright;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,o.r-5,-Math.PI/2,-Math.PI/2+Math.PI*2*(o.progress/3));ctx.stroke()}
  ctx.restore()}
function drawExit(e,t){ctx.save();ctx.translate(e.x,e.y);ctx.strokeStyle='#9fe5b3';ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.lineDashOffset=-t*20;ctx.beginPath();ctx.arc(0,0,e.r,0,6.28);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(159,229,179,.08)';ctx.beginPath();ctx.arc(0,0,e.r,0,6.28);ctx.fill();ctx.restore()}
function drawThreat(e,t){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle+Math.PI/2);const stunned=e.stun>0;ctx.fillStyle=stunned?'#678a80':e.elite?'#c05d57':'#8c5450';ctx.shadowColor=stunned?'#93c6b6':'#b54f49';ctx.shadowBlur=e.elite?12:5;ctx.beginPath();ctx.ellipse(0,0,e.r*.82,e.r*1.15,0,0,6.28);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,220,220,.4)';ctx.lineWidth=2;for(let i=-1;i<=1;i+=2){ctx.beginPath();ctx.moveTo(i*5,-3);ctx.lineTo(i*18,-17);ctx.moveTo(i*5,3);ctx.lineTo(i*19,14);ctx.stroke()}ctx.fillStyle='#ffd0c8';ctx.beginPath();ctx.arc(-4,-6,2,0,6.28);ctx.arc(4,-6,2,0,6.28);ctx.fill();ctx.restore()}
function drawHazard(h,t){ctx.save();ctx.translate(h.x,h.y);if(h.active>0){ctx.fillStyle='rgba(122,184,221,.45)';ctx.beginPath();ctx.arc(0,0,h.r,0,6.28);ctx.fill();ctx.strokeStyle='#c8edff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,h.r,0,6.28);ctx.stroke()}else if(h.delay<1.15){ctx.strokeStyle='rgba(178,223,247,.75)';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.arc(0,0,h.r,0,6.28);ctx.stroke();ctx.setLineDash([])}ctx.restore()}
function drawPlayer(t){
  const p=game.player,bug=game.bug;const chip=CHIPS.find(c=>c.id===state.equippedChip);
  if(chip){for(const tr of game.player.trail){ctx.globalAlpha=tr.t*.34;ctx.fillStyle=chip.color;ctx.beginPath();ctx.arc(tr.x,tr.y,4+tr.t*4,0,6.28);ctx.fill()}ctx.globalAlpha=1}
  ctx.save();ctx.translate(p.x,p.y);if(game.invuln>0&&Math.floor(t*12)%2===0)ctx.globalAlpha=.35;const moving=Math.abs(game.player.vx)+Math.abs(game.player.vy)>2;if(moving)ctx.rotate(Math.atan2(game.player.vy,game.player.vx)+Math.PI/2);
  ctx.strokeStyle=bug.color;ctx.fillStyle=bug.color;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=bug.color;ctx.shadowBlur=9;
  const leg=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};
  if(bug.id==='ant'){
    for(const s of [-1,1]){leg(s*5,-3,s*15,-12);leg(s*6,3,s*17,4);leg(s*5,8,s*14,17)}
    ctx.beginPath();ctx.ellipse(0,9,8,11,0,0,6.28);ctx.fill();ctx.beginPath();ctx.ellipse(0,0,6.5,7,0,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(0,-9,5.8,0,6.28);ctx.fill();
  }else if(bug.id==='beetle'){
    for(const s of [-1,1]){leg(s*7,-5,s*16,-11);leg(s*8,2,s*18,3);leg(s*7,9,s*16,16)}ctx.beginPath();ctx.ellipse(0,4,11,16,0,0,6.28);ctx.fill();ctx.strokeStyle='#183027';ctx.lineWidth=2;leg(0,-10,0,18);ctx.fillStyle='#183027';ctx.beginPath();ctx.ellipse(0,-10,7,6,0,0,6.28);ctx.fill();
  }else if(bug.id==='mosquito'){
    for(const s of [-1,1]){leg(s*3,-3,s*18,-16);leg(s*4,2,s*20,2);leg(s*3,7,s*17,18)}ctx.globalAlpha*=.4;ctx.beginPath();ctx.ellipse(-8,0,10,5,-.5,0,6.28);ctx.ellipse(8,0,10,5,.5,0,6.28);ctx.fill();ctx.globalAlpha=1;ctx.beginPath();ctx.ellipse(0,7,4,13,0,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(0,-6,5,0,6.28);ctx.fill();leg(0,-10,0,-22);
  }else if(bug.id==='mantis'){
    leg(-4,-5,-14,-13);leg(-14,-13,-20,-4);leg(4,-5,14,-13);leg(14,-13,20,-4);for(const s of [-1,1]){leg(s*4,4,s*15,13);leg(s*4,9,s*10,20)}ctx.beginPath();ctx.ellipse(0,8,6,15,0,0,6.28);ctx.fill();ctx.beginPath();ctx.moveTo(-8,-10);ctx.lineTo(0,-17);ctx.lineTo(8,-10);ctx.lineTo(5,-3);ctx.lineTo(-5,-3);ctx.closePath();ctx.fill();
  }else if(bug.id==='firefly'){
    for(const s of [-1,1]){leg(s*5,-3,s*15,-10);leg(s*5,5,s*15,13)}ctx.globalAlpha*=.32;ctx.beginPath();ctx.ellipse(-8,0,10,7,-.35,0,6.28);ctx.ellipse(8,0,10,7,.35,0,6.28);ctx.fill();ctx.globalAlpha=1;ctx.beginPath();ctx.ellipse(0,6,8,14,0,0,6.28);ctx.fill();ctx.fillStyle='#efff9d';ctx.shadowColor='#efff9d';ctx.shadowBlur=16;ctx.beginPath();ctx.ellipse(0,13,5,7,0,0,6.28);ctx.fill();ctx.fillStyle=bug.color;ctx.shadowColor=bug.color;ctx.beginPath();ctx.arc(0,-7,6,0,6.28);ctx.fill();
  }else{
    for(const s of [-1,1]){leg(s*2,-8,s*16,-18);leg(s*2,0,s*18,0);leg(s*2,8,s*15,18)}ctx.lineWidth=5;leg(0,-15,0,17);ctx.beginPath();ctx.arc(0,-18,4.5,0,6.28);ctx.fill();
  }
  ctx.shadowBlur=0;ctx.fillStyle='#effff3';ctx.beginPath();ctx.arc(-2.2,-9.5,1.1,0,6.28);ctx.arc(2.2,-9.5,1.1,0,6.28);ctx.fill();ctx.restore();
  if(game.carrying){ctx.fillStyle='#d8ebb7';ctx.beginPath();ctx.ellipse(p.x,p.y-24,11,6,0,0,6.28);ctx.fill()}
}

function endMission(win,reason){if(!game||game.ended)return;game.ended=true;cancelAnimationFrame(raf);const c=game.contract;if(win){const healthRatio=Math.max(0,game.health/game.maxHealth);let sap=c.sap+Math.round(Math.max(0,game.time)*1.2);let amber=c.amber;if(healthRatio>=1){state.stats.fullHealthWins++;amber+=1}if(game.damageTaken===0)state.stats.noDamageWins++;state.sap+=sap;state.amber+=amber;state.xp+=c.xp;state.stats.amberEarned+=amber;state.stats.wins++;state.stats.bugWins[game.bug.id]=(state.stats.bugWins[game.bug.id]||0)+1;state.stats.zoneWins[c.zone]=(state.stats.zoneWins[c.zone]||0)+1;saveState();$('resultKicker').textContent='CONTRACT COMPLETE';$('resultTitle').textContent='Clean extraction.';$('resultText').textContent=reason;$('resultRewards').innerHTML=`<div><span>SAP</span><b>+${sap}</b></div><div><span>AMBER</span><b>+${amber}</b></div><div><span>XP</span><b>+${c.xp}</b></div>`;playSfx('win')}else{state.stats.losses++;saveState();$('resultKicker').textContent='CONTRACT FAILED';$('resultTitle').textContent='Forced retreat.';$('resultText').textContent=reason;$('resultRewards').innerHTML=`<div><span>SAP</span><b>+0</b></div><div><span>AMBER</span><b>+0</b></div><div><span>XP</span><b>+0</b></div>`;playSfx('fail')}$('resultModal').classList.remove('hidden')}
function closeMission(){if(raf)cancelAnimationFrame(raf);game=null;$('missionLayer').classList.add('hidden');$('resultModal').classList.add('hidden');document.body.style.overflow='';generateContracts();renderPins()}

// Inputs
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();input.keys[k]=true;if((e.code==='Space'||k===' ')&&game){e.preventDefault();useAbility()}if(k==='shift'&&game)useBurst()});window.addEventListener('keyup',e=>{input.keys[e.key.toLowerCase()]=false});
$('abilityButton').addEventListener('pointerdown',e=>{e.preventDefault();useAbility()});$('burstButton').addEventListener('pointerdown',e=>{e.preventDefault();useBurst()});
const joy=$('joystick'),stick=$('stick');function updateJoy(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,m=Math.hypot(dx,dy),max=r.width*.34;const scale=m>max?max/m:1;const x=dx*scale,y=dy*scale;stick.style.transform=`translate(${x}px,${y}px)`;input.joy={x:x/max,y:y/max}}
joystickPointer();function joystickPointer(){joy.addEventListener('pointerdown',e=>{input.joyId=e.pointerId;joy.setPointerCapture(e.pointerId);updateJoy(e)});joy.addEventListener('pointermove',e=>{if(e.pointerId===input.joyId)updateJoy(e)});const end=e=>{if(e.pointerId===input.joyId){input.joyId=null;input.joy={x:0,y:0};stick.style.transform='translate(0,0)'}};joy.addEventListener('pointerup',end);joy.addEventListener('pointercancel',end)}

// UI wiring
document.querySelectorAll('.bottomNav button').forEach(b=>b.onclick=()=>showScreen(b.dataset.screen));
$('quickLaunch').onclick=()=>startMission(contracts[state.selectedContract]);
$('rerollContracts').onclick=()=>{state.refreshes++;saveState();generateContracts();playSfx('select');toast('Contract board refreshed')};
$('missionExit').onclick=()=>{if(game&&!game.ended)endMission(false,'You aborted the contract and returned to the nest.')};
$('resultClose').onclick=closeMission;

document.querySelectorAll('[data-vault]').forEach(btn=>btn.onclick=()=>{const key=btn.dataset.vault,mode=btn.dataset.mode,inputEl=$('vault'+key[0].toUpperCase()+key.slice(1)),v=Number(inputEl.value);if(!Number.isFinite(v))return;if(mode==='add')state[key]=Math.max(0,state[key]+v);else state[key]=Math.max(0,v);saveState();renderSettings();refreshHeader();generateContracts();toast(`${key.toUpperCase()} ${mode.toUpperCase()} complete`);playSfx('reward')});
$('exportSave').onclick=()=>{$('saveBox').value=btoa(unescape(encodeURIComponent(JSON.stringify(state))));$('saveBox').select();toast('Save exported')};
$('importSave').onclick=()=>{try{const parsed=JSON.parse(decodeURIComponent(escape(atob($('saveBox').value.trim()))));state={...defaultState(),...parsed,lab:{...defaultState().lab,...parsed.lab},settings:{...defaultState().settings,...parsed.settings},stats:{...defaultState().stats,...parsed.stats,bugWins:{...(parsed.stats?.bugWins||{})},zoneWins:{...(parsed.stats?.zoneWins||{})}}};saveState();generateContracts();renderBugs();renderLab();renderPins();renderSettings();toast('Save imported');playSfx('reward')}catch(e){toast('That save could not be imported');playSfx('deny')}};
$('resetSave').onclick=()=>{if(confirm('Reset all UNDERLEAF progress? This cannot be undone.')){state=defaultState();saveState();generateContracts();renderBugs();renderLab();renderPins();renderSettings();toast('Save reset')}};

window.addEventListener('pointerdown',()=>initAudio(),{once:true});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

refreshHeader();generateContracts();renderBugs();renderLab();renderPins();renderSettings();
