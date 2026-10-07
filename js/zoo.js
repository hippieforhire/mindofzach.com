/* Zoo Tycoon (2001) clone — neon night safari. Build exhibits, hire keepers,
 * keep animals happy, rake in admissions. Real guest/economy simulation. */
(function () {
'use strict';
const A = window.Arcade;
const canvas = document.getElementById('zooCanvas');
const ctx = canvas.getContext('2d');
const modalEl = document.getElementById('zooModal');
const scoreEl = document.getElementById('zooScore');
const hiEl = document.getElementById('zooHi');
const bestEl = document.getElementById('zooBest');
const pauseBtn = document.getElementById('zooPause');
const toolsEl = document.getElementById('zooTools');
const speedBtn = document.getElementById('zooSpeed');

const W = 640, H = 640, TS = 40, N = 16, DAY_LEN = 150, MAXG = 120, MAXA = 24;
A.fitCanvas(canvas, W, H);
const particles = new A.Particles();
const floaters = new A.Floaters();
const shake = new A.Shake();

const G='.',P='P',F='F',WTR='W',FOL='T',ROCK='R',SHL='S',FT='1',WT='2',TOY='3',
      BUR='B',DRK='D',GFT='G',BATH='O',BNCH='N',BIN='X',ENT='E',LIT='L',GATE='A';
const BLOCK_K=[F,WTR,BUR,DRK,GFT,BATH,SHL,FT,WT,TOY];
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const TOOLS=[
 {id:'path',n:'Path',c:10,k:'1',t:P,paint:1},
 {id:'fence',n:'Fence',c:25,k:'2',t:F,paint:1},
 {id:'gate',n:'Gate',c:30,k:'v',t:GATE,paint:1},
 {id:'demolish',n:'Demolish',c:0,k:'3',paint:1},
 {id:'water',n:'Water',c:40,k:'4',t:WTR,paint:1},
 {id:'foliage',n:'Foliage',c:30,k:'5',t:FOL},
 {id:'rock',n:'Rock',c:20,k:'6',t:ROCK},
 {id:'shelter',n:'Shelter',c:150,k:'7',t:SHL},
 {id:'foodt',n:'FoodTrough',c:100,k:'8',t:FT},
 {id:'watert',n:'WaterTrough',c:80,k:'9',t:WT},
 {id:'toy',n:'Toy',c:120,k:'0',t:TOY},
 {id:'burger',n:'BurgerStall',c:400,k:'b',t:BUR},
 {id:'drink',n:'DrinkStall',c:300,k:'d',t:DRK},
 {id:'gift',n:'GiftShop',c:500,k:'g',t:GFT},
 {id:'bath',n:'Bathroom',c:250,k:'o',t:BATH},
 {id:'bench',n:'Bench',c:40,k:'n',t:BNCH},
 {id:'bin',n:'TrashBin',c:25,k:'x',t:BIN},
 {id:'animal',n:'BuyAnimal',c:0,k:'a'},
 {id:'keeper',n:'Keeper$80/d',c:0,k:'h'},
];
const SPECIES={
 lion:{c:800,e:'🦁',min:12},elephant:{c:1500,e:'🐘',min:20},giraffe:{c:900,e:'🦒',min:14},
 penguin:{c:700,e:'🐧',min:10},panda:{c:1200,e:'🐼',min:12},zebra:{c:600,e:'🦓',min:12}
};
const PEOPLE=['🚶','🚶‍♀️','🚶‍♂️','🧍','🧍‍♀️','🧍‍♂️'];

let grid,costG,shade,regId,regions,regDirty;
let animals,guests,keepers,litterAge;
let cash,day,dayT,admission,tool,selSpecies,speed,state,best,newBest,won,peakGuests,spawnT,suitT;
let painting=false;

const startOverlay = A.wireStartOverlay('zooModal', startGame);
const overOverlay = A.gameOverOverlay('zooModal');

const inB=(x,y)=>x>=0&&y>=0&&x<N&&y<N;
const at=(x,y)=>inB(x,y)?grid[y][x]:F;
const walkG=(x,y)=>{const t=at(x,y);return t===P||t===ENT;};
const walkK=(x,y)=>{if(!inB(x,y))return false;const t=at(x,y);return BLOCK_K.indexOf(t)<0||t===GATE;};
const cx=x=>x*TS+TS/2, cy=y=>y*TS+TS/2;

function bfs(sx,sy,pass,isT){
  const K=(x,y)=>y*N+x,seen=new Uint8Array(N*N),prev=new Int16Array(N*N).fill(-1),q=[[sx,sy]];
  if(!inB(sx,sy))return null; seen[K(sx,sy)]=1;
  while(q.length){
    const cur=q.shift(),x=cur[0],y=cur[1];
    if(isT(x,y)){const path=[];let c=K(x,y);while(c>=0){path.push([c%N,(c/N)|0]);c=prev[c];}return path.reverse();}
    for(let i=0;i<4;i++){const nx=x+DIRS[i][0],ny=y+DIRS[i][1];
      if(inB(nx,ny)&&!seen[K(nx,ny)]&&pass(nx,ny)){seen[K(nx,ny)]=1;prev[K(nx,ny)]=K(x,y);q.push([nx,ny]);}}
  }
  return null;
}
function adjTile(x,y,t){for(let i=0;i<4;i++)if(at(x+DIRS[i][0],y+DIRS[i][1])===t)return true;return false;}

function computeRegions(){
  regId=[];regions={};regDirty=false;
  const out=new Uint8Array(N*N),q=[];
  for(let x=0;x<N;x++)for(let y=0;y<N;y++)
    if((x===0||y===0||x===N-1||y===N-1)&&at(x,y)!==F&&at(x,y)!==GATE){out[y*N+x]=1;q.push([x,y]);}
  while(q.length){const c=q.pop(),x=c[0],y=c[1];
    for(let i=0;i<4;i++){const nx=x+DIRS[i][0],ny=y+DIRS[i][1];
      if(inB(nx,ny)&&!out[ny*N+nx]&&at(nx,ny)!==F&&at(nx,ny)!==GATE){out[ny*N+nx]=1;q.push([nx,ny]);}}}
  let rid=0;
  for(let y=0;y<N;y++){regId[y]=[];
    for(let x=0;x<N;x++){
      if(at(x,y)===F||out[y*N+x]){regId[y][x]=-1;continue;}
      regId[y][x]=rid;
    }}
  // label connected enclosed components
  const seen=new Uint8Array(N*N);let comp=0;const compTiles={};
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    if(regId[y][x]!==-1&&!seen[y*N+x]){
      const qq=[[x,y]];seen[y*N+x]=1;compTiles[comp]=[];
      while(qq.length){const c=qq.pop(),ax=c[0],ay=c[1];
        regId[ay][ax]=comp;compTiles[comp].push([ax,ay]);
        for(let i=0;i<4;i++){const nx=ax+DIRS[i][0],ny=ay+DIRS[i][1];
          if(inB(nx,ny)&&regId[ny][nx]!==-1&&!seen[ny*N+nx]){seen[ny*N+nx]=1;qq.push([nx,ny]);}}}
      comp++;
    }}
  regions=compTiles;
}
function regionOf(x,y){x|=0;y|=0;return inB(x,y)?regId[y][x]:-1;}

function reset(){
  grid=[];costG=[];shade=[];
  for(let y=0;y<N;y++){grid[y]=[];costG[y]=[];shade[y]=[];
    for(let x=0;x<N;x++){grid[y][x]=G;costG[y][x]=0;shade[y][x]=A.rand(-8,8);}}
  grid[15][7]=ENT;grid[15][8]=ENT;costG[15][7]=costG[15][8]=-1;
  grid[14][7]=P;grid[14][8]=P;
  animals=[];guests=[];keepers=[];litterAge={};
  cash=20000;day=1;dayT=0;admission=10;tool=null;selSpecies=null;speed=1;
  state='ready';won=false;peakGuests=0;spawnT=2;suitT=0;newBest=false;
  best=A.getHi('zoo');hiEl.textContent=best;
  bestEl.textContent='';bestEl.classList.add('hidden');
  particles.clear();floaters.clear();
  regDirty=true;buildTools();
  paintScore();
}
function startGame(){
  reset();
  A.bumpPlays('zoo');
  state='playing';
  loop.start();
  A.sfx.power();
}
function paintScore(){
  scoreEl.textContent='$'+Math.floor(cash).toLocaleString()+' · DAY '+day+' · '+guests.length+' GUESTS';
}
function checkHi(){
  if(A.setHi('zoo',peakGuests)){newBest=true;hiEl.textContent=peakGuests;
    bestEl.textContent='★ NEW BEST ★';bestEl.classList.remove('hidden');}
}

/* ---------- toolbar ---------- */
function buildTools(){
  toolsEl.innerHTML='';
  const mk=(label,fn,title)=>{
    const b=document.createElement('button');b.textContent=label;b.title=title||label;
    b.style.cssText='font:600 11px Rajdhani,sans-serif;margin:2px;padding:6px 8px;border-radius:8px;border:1px solid rgba(0,240,255,.35);background:rgba(0,240,255,.07);color:#e8ecff;cursor:pointer';
    b.onclick=fn;toolsEl.appendChild(b);return b;
  };
  TOOLS.forEach(t=>{
    const b=mk((t.k?'['+t.k+'] ':'')+t.n+(t.c?' $'+t.c:''),()=>selectTool(t.id));
    b.dataset.tool=t.id;
  });
  const sp=document.createElement('span');sp.id='zooSpecies';sp.style.display='none';toolsEl.appendChild(sp);
  mk('ADM −',()=>{admission=A.clamp(admission-1,5,25);A.sfx.tick();},'Lower admission');
  mk('ADM +',()=>{admission=A.clamp(admission+1,5,25);A.sfx.tick();},'Raise admission');
}
function selectTool(id){
  tool=(tool===id)?null:id;selSpecies=null;
  const sp=document.getElementById('zooSpecies');
  Array.prototype.forEach.call(toolsEl.querySelectorAll('[data-tool]'),b=>{
    b.style.background=b.dataset.tool===tool?'rgba(0,240,255,.28)':'rgba(0,240,255,.07)';
  });
  if(tool==='animal'&&sp){
    sp.style.display='inline';sp.innerHTML='';
    Object.keys(SPECIES).forEach(s=>{
      const d=SPECIES[s],b=document.createElement('button');
      b.textContent=d.e+' '+s+' $'+d.c;
      b.style.cssText='font:600 12px Rajdhani,sans-serif;margin:2px;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,47,214,.5);background:rgba(255,47,214,.1);color:#e8ecff;cursor:pointer';
      b.onclick=()=>{selSpecies=s;A.sfx.click();};
      sp.appendChild(b);
    });
  }else if(sp){sp.style.display='none';sp.innerHTML='';}
  if(tool==='keeper')hireKeeper();
  A.sfx.click();
}
function hireKeeper(){
  if(keepers.length>=3){floaters.add(W/2,H/2,'MAX 3 KEEPERS','#ff6b6b',16);A.sfx.bad();tool=null;return;}
  keepers.push({x:7.5,y:14.5,tx:7,ty:14,wt:0,state:'idle'});
  floaters.add(W/2,H/2-40,'KEEPER HIRED · $80/DAY','#a6ff00',18);
  particles.burst(W/2,H/2,{n:20,colors:['#a6ff00','#ffffff'],speed:200,life:.6,size:3});
  A.sfx.power();tool=null;
}

/* ---------- building ---------- */
function tileCost(t){
  for(let i=0;i<TOOLS.length;i++)if(TOOLS[i].t===t)return TOOLS[i].c;
  return 0;
}
function paintAt(tx,ty){
  if(!inB(tx,ty)||state!=='playing')return;
  const t=TOOLS.find(t=>t.id===tool);
  if(tool==='animal'){
    if(!selSpecies){floaters.add(cx(tx),cy(ty),'PICK A SPECIES','#ffb300',14);return;}
    if(regDirty)computeRegions();
    if(regionOf(tx,ty)<0||at(tx,ty)===F){A.sfx.bad();return;}
    if(animals.length>=MAXA){A.sfx.bad();return;}
    const sp=SPECIES[selSpecies];
    if(cash<sp.c){A.sfx.bad();floaters.add(cx(tx),cy(ty),'NEED $'+sp.c,'#ff6b6b',14);return;}
    cash-=sp.c;
    animals.push({sp:selSpecies,x:tx,y:ty,hx:tx,hy:ty,hunger:90,thirst:90,happy:70,suit:80,wt:0,reg:regionOf(tx,ty),bob:A.rand(0,6)});
    particles.burst(cx(tx),cy(ty),{n:22,colors:['#ff2fd6','#ffffff'],speed:220,life:.6,size:4});
    floaters.add(cx(tx),cy(ty)-24,sp.e+' $'+sp.c,'#ff2fd6',15);
    A.sfx.power();paintScore();return;
  }
  if(!t)return;
  const cur=at(tx,ty);
  if(tool==='demolish'){
    if(cur===G||cur===ENT||costG[ty][tx]<0){A.sfx.bad();return;}
    cash+=Math.floor(costG[ty][tx]/2);
    floaters.add(cx(tx),cy(ty),'+$'+Math.floor(costG[ty][tx]/2),'#a6ff00',13);
    grid[ty][tx]=G;costG[ty][tx]=0;regDirty=true;
    particles.burst(cx(tx),cy(ty),{n:12,colors:['#8b93b8','#ffffff'],speed:160,life:.5,size:3});
    A.sfx.pop();paintScore();return;
  }
  if(cur===t.t||cur===ENT)return;
  if(cash<t.c){A.sfx.bad();floaters.add(cx(tx),cy(ty),'NEED $'+t.c,'#ff6b6b',14);return;}
  // animals block building on their tile (except paths under them are fine)
  if(animals.some(a=>a.x===tx&&a.y===ty&&t.t!==P))return;
  cash-=t.c;grid[ty][tx]=t.t;costG[ty][tx]=t.c;
  if(t.t===F||t.t===GATE||t.t===P)regDirty=true;
  particles.burst(cx(tx),cy(ty),{n:10,colors:['#00f0ff','#ffffff'],speed:150,life:.4,size:3});
  A.sfx.place();paintScore();
}

/* ---------- animals ---------- */
function suitScore(a){
  if(regDirty)computeRegions();
  const tiles=regions[a.reg]||[];
  const sp=SPECIES[a.sp],size=tiles.length;
  let s=100,cW=0,cF=0,cS=0,cFT=0,cWT=0,cT=0,cA=0;
  tiles.forEach(t=>{const tl=at(t[0],t[1]);
    if(tl===WTR)cW++;if(tl===FOL)cF++;if(tl===SHL)cS++;if(tl===FT)cFT++;if(tl===WT)cWT++;if(tl===TOY)cT++;});
  animals.forEach(o=>{if(o.reg===a.reg)cA++;});
  if(size<sp.min)s-=40*(1-size/sp.min);
  if(a.sp==='penguin'&&cW<4)s-=50;
  if((a.sp==='panda'||a.sp==='giraffe')&&cF<3)s-=25;
  if(!cS)s-=15;if(!cFT)s-=20;if(!cWT)s-=20;
  if(cT)s+=10;
  if(cA>Math.max(1,size/6))s-=20;
  if(a.reg<0)s=Math.min(s,20);
  return A.clamp(Math.round(s),0,100);
}

/* ---------- guests ---------- */
function appeal(){
  let ap=0;const spp={};
  animals.forEach(a=>{ap+=a.happy;spp[a.sp]=1;});
  ap+=Object.keys(spp).length*20;
  let stalls=0,lit=0;
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const t=grid[y][x];
    if(t===BUR||t===DRK||t===GFT)stalls++;if(t===LIT)lit++;}
  return ap+stalls*8-lit*8;
}
function spawnGuest(){
  const g={x:7.5,y:15.5,tx:7,ty:14,nx:7,ny:14,happy:70,hunger:A.rand(10,40),thirst:A.rand(10,40),
    bladder:A.rand(0,30),cash:A.randi(20,60),age:0,state:'wander',wt:0,vis:[],path:null,pi:0,emo:A.choice(PEOPLE)};
  guests.push(g);cash+=admission;
  floaters.add(cx(7),cy(14)-20,'+$'+admission,'#ffd700',13);
}
function gTarget(g,tx,ty){
  g.nx=tx;g.ny=ty;g.state='walk';
}
function chooseNext(g){
  const opts=[];
  for(let i=0;i<4;i++){const nx=g.tx+DIRS[i][0],ny=g.ty+DIRS[i][1];
    if(walkG(nx,ny)&&g.vis.indexOf(ny*N+nx)<0)opts.push([nx,ny]);}
  if(!opts.length){ // backtrack
    for(let i=0;i<4;i++){const nx=g.tx+DIRS[i][0],ny=g.ty+DIRS[i][1];
      if(walkG(nx,ny))opts.push([nx,ny]);}
  }
  if(opts.length){const o=A.choice(opts);gTarget(g,o[0],o[1]);g.vis.push(g.ty*N+g.tx);if(g.vis.length>8)g.vis.shift();}
}
function stallPath(g,tile){
  return bfs(g.tx,g.ty,walkG,(x,y)=>adjTile(x,y,tile));
}
function buyAt(g,tile){
  const deals={};deals[BUR]={c:6,n:'hunger'};deals[DRK]={c:4,n:'thirst'};deals[GFT]={c:12,n:'happy'};
  if(tile===BATH){g.bladder=5;g.happy=Math.min(100,g.happy+6);A.sfx.tick();return;}
  const d=deals[tile];if(!d||g.cash<d.c){g.happy=Math.max(0,g.happy-6);return;}
  g.cash-=d.c;cash+=d.c;
  if(tile===GFT){g.happy=Math.min(100,g.happy+22);floaters.add(cx(g.tx),cy(g.ty)-18,'+$'+d.c,'#ff2fd6',13);}
  else{g[d.n]=5;g.happy=Math.min(100,g.happy+12);floaters.add(cx(g.tx),cy(g.ty)-18,'+$'+d.c,'#ffd700',13);}
  particles.burst(cx(g.tx),cy(g.ty),{n:8,colors:['#ffd700','#ffffff'],speed:140,life:.4,size:3});
  A.sfx.pop();paintScore();
}

/* ---------- update ---------- */
function update(dt){
  if(state!=='playing')return;
  dt*=speed;
  dayT+=dt;
  if(dayT>=DAY_LEN){
    dayT=0;day++;
    const wages=keepers.length*80;
    if(wages){cash-=wages;floaters.add(W/2,60,'WAGES −$'+wages,'#ff6b6b',16);}
    for(const k in litterAge){litterAge[k]++;
      if(litterAge[k]>=1){const p=k.split(',');grid[+p[1]][+p[0]]=P;delete litterAge[k];}}
    A.sfx.tick();
  }
  if(regDirty)computeRegions();

  // spawn
  spawnT-=dt;
  if(spawnT<=0){
    spawnT=A.clamp(9-appeal()/45,1.2,9);
    if(guests.length<MAXG&&(at(7,14)===P||at(8,14)===P))spawnGuest();
  }

  // animals
  suitT-=dt;
  const doSuit=suitT<=0;if(doSuit)suitT=2;
  for(const a of animals){
    a.bob+=dt*3;
    a.hunger=Math.max(0,a.hunger-dt*0.9);
    a.thirst=Math.max(0,a.thirst-dt*1.1);
    if(doSuit){a.reg=regionOf(a.x,a.y);a.suit=suitScore(a);}
    let tgt=a.suit;
    if(a.hunger<30||a.thirst<30)tgt=Math.min(tgt,25);
    a.happy+=(tgt-a.happy)*dt*0.2;
    a.wt-=dt;
    if(a.wt<=0){
      a.wt=A.rand(2,4);
      const tiles=regions[a.reg];
      if(tiles&&tiles.length){const t=A.choice(tiles);a.hx=t[0];a.hy=t[1];}
    }
    const dx=a.hx-a.x,dy=a.hy-a.y,d=Math.hypot(dx,dy);
    if(d>0.05){a.x+=dx/d*Math.min(d,dt*1.1);a.y+=dy/d*Math.min(d,dt*1.1);}
  }

  // keepers
  for(const k of keepers){
    k.wt-=dt;
    if(k.state==='idle'&&k.wt<=0){
      k.wt=1;
      let worst=null,ws=55;
      for(const a of animals){
        const need=Math.min(a.hunger,a.thirst);
        if(need<ws){ws=need;worst=a;}
      }
      if(worst){
        // only go if the exhibit has a food trough
        const tiles=regions[worst.reg]||[];
        const hasTrough=tiles.some(t=>at(t[0],t[1])===FT);
        if(hasTrough){
          const p=bfs(k.tx,k.ty,walkK,(x,y)=>x===(worst.x|0)&&y===(worst.y|0));
          if(p&&p.length>1){k.path=p;k.pi=1;k.state='go';k.a=worst;}
        }
      }
    }else if(k.state==='go'&&k.path){
      const n=k.path[k.pi];
      if(!n){k.state='idle';k.wt=2;}
      else{
        const dx=n[0]+0.5-k.x,dy=n[1]+0.5-k.y,d=Math.hypot(dx,dy);
        if(d<0.15){k.tx=n[0];k.ty=n[1];k.pi++;
          if(k.pi>=k.path.length){
            // refill whole exhibit
            const reg=k.a?k.a.reg:-1;
            animals.forEach(a=>{if(a.reg===reg){a.hunger=100;a.thirst=100;}});
            cash-=15;floaters.add(cx(k.tx),cy(k.ty)-22,'−$15 FEED','#ffb300',13);
            particles.burst(cx(k.tx),cy(k.ty),{n:14,colors:['#a6ff00','#ffffff'],speed:170,life:.5,size:3});
            A.sfx.eat();paintScore();
            k.state='idle';k.wt=3;k.path=null;
          }
        }else{k.x+=dx/d*dt*3;k.y+=dy/d*dt*3;}
      }
    }
  }

  // guests
  for(let i=guests.length-1;i>=0;i--){
    const g=guests[i];
    g.age+=dt;g.hunger+=dt*0.8;g.thirst+=dt*1.0;g.bladder+=dt*0.5;
    if(g.state==='watch'){
      g.wt-=dt;
      if(g.wt<=0){g.state='wander';chooseNext(g);}
      continue;
    }
    if(g.state==='walk'&&g.path){
      const n=g.path[g.pi];
      if(!n){g.path=null;g.state='wander';}
      else{
        const dx=n[0]+0.5-g.x,dy=n[1]+0.5-g.y,d=Math.hypot(dx,dy);
        if(d<0.12){g.tx=n[0];g.ty=n[1];g.pi++;
          if(g.pi>=g.path.length){g.path=null;g.state='wander';
            if(g.need==='leave'){guests.splice(i,1);continue;}
            if(g.need)buyAt(g,g.needTile);g.need=null;}
        }else{g.x+=dx/d*dt*2.4;g.y+=dy/d*dt*2.4;}
      }
      continue;
    }
    // arrived at next tile
    const dx=g.nx+0.5-g.x,dy=g.ny+0.5-g.y,d=Math.hypot(dx,dy);
    if(d<0.1){g.tx=g.nx;g.ty=g.ny;}
    else{g.x+=dx/d*dt*2.2;g.y+=dy/d*dt*2.2;continue;}
    // watch animals?
    g.wt-=dt;
    if(g.wt<=0){
      g.wt=0.4;
      let bestA=null,bd=3.2;
      for(const a of animals){
        const dd=Math.hypot(a.x-g.x,a.y-g.y);
        if(dd<bd&&a.happy>50){bd=dd;bestA=a;}
      }
      if(bestA){
        g.state='watch';g.wt=A.rand(3,6);
        g.happy=Math.min(100,g.happy+bestA.happy/10);
        if(bestA.happy>75&&g.cash>5&&Math.random()<0.5){
          const don=A.randi(1,5);g.cash-=don;cash+=don;
          floaters.add(cx(g.tx),cy(g.ty)-20,'+$'+don+' ♥','#ff2fd6',13);
          particles.burst(cx(g.tx),cy(g.ty),{n:8,colors:['#ff2fd6','#ffffff'],speed:130,life:.4,size:3});
          A.sfx.good();paintScore();
        }
        continue;
      }
    }
    // needs → retarget
    if(g.age>150||g.happy<15){
      const p=bfs(g.tx,g.ty,walkG,(x,y)=>(x===7||x===8)&&y===15);
      if(p&&p.length>1){g.path=p;g.pi=1;g.state='walk';g.need='leave';}
      else guests.splice(i,1);
      continue;
    }
    let need=null,nt=null;
    if(g.bladder>70){need=BATH;}
    else if(g.hunger>70){need=BUR;}
    else if(g.thirst>70){need=DRK;}
    if(need){
      const p=stallPath(g,need);
      if(p&&p.length>1){g.path=p;g.pi=1;g.state='walk';g.need=need;g.needTile=need;continue;}
      else g.happy=Math.max(0,g.happy-dt*4);
    }
    // litter
    if(Math.random()<dt*0.03&&at(g.tx,g.ty)===P){
      let bin=false;
      for(let by=-4;by<=4&&!bin;by++)for(let bx=-4;bx<=4;bx++)
        if(at(g.tx+bx,g.ty+by)===BIN){bin=true;break;}
      if(!bin){grid[g.ty][g.tx]=LIT;litterAge[g.tx+','+g.ty]=0;}
    }
    chooseNext(g);
  }
  if(guests.length>peakGuests){peakGuests=guests.length;checkHi();}

  // victory / bankrupt
  const stars=rating();
  if(!won&&stars>=3.5&&guests.length>=60){
    won=true;A.sfx.win();
    particles.burst(W/2,H/2,{n:80,colors:['#ffd700','#a6ff00','#00f0ff','#ffffff'],speed:400,life:1,size:5});
    setTimeout(()=>{
      overOverlay.show(
        '<div class="go-title">★ ZOO LEGEND ★</div>'+
        '<div class="go-score">'+stars.toFixed(1)+' STARS · '+guests.length+' GUESTS</div>'+
        '<button class="go-btn" id="zooRetry">KEEP BUILDING</button>');
      document.getElementById('zooRetry').onclick=()=>{overOverlay.hide();};
    },600);
  }
  if(cash<0){
    state='over';A.sfx.lose();shake.add(0.6);
    setTimeout(()=>{
      overOverlay.show(
        '<div class="go-title lost">BANKRUPT!</div>'+
        '<div class="go-score">'+day+' DAYS · PEAK '+peakGuests+' GUESTS</div>'+
        (newBest?'<div class="go-best">★ NEW BEST ★</div>':'')+
        '<button class="go-btn" id="zooRetry">TRY AGAIN</button>');
      document.getElementById('zooRetry').onclick=()=>{overOverlay.hide();startGame();};
      loop.stop();
    },700);
  }

  particles.update(dt);floaters.update(dt);shake.update(dt);
  paintScore();
}
function rating(){
  if(!animals.length)return 0;
  let ah=0;animals.forEach(a=>ah+=a.happy);ah/=animals.length;
  let gh=70;if(guests.length){gh=0;guests.forEach(g=>gh+=g.happy);gh/=guests.length;}
  const spp={};animals.forEach(a=>spp[a.sp]=1);
  const variety=Math.min(6,Object.keys(spp).length)/6*5;
  return ah/20*0.5+gh/20*0.3+variety*0.2;
}

/* ---------- render ---------- */
function tileBase(t,x,y){
  const px=x*TS,py=y*TS,s=shade[y][x];
  switch(t){
    case P:ctx.fillStyle='#2e2a1c';ctx.fillRect(px,py,TS,TS);
      ctx.strokeStyle='rgba(255,179,0,.28)';ctx.lineWidth=2;
      ctx.strokeRect(px+3,py+3,TS-6,TS-6);break;
    case F:ctx.fillStyle='#0d1410';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#ff2fd6',10);ctx.strokeStyle='#ff2fd6';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(px+4,py+TS/2);ctx.lineTo(px+TS-4,py+TS/2);ctx.stroke();
      ctx.fillStyle='#ff2fd6';
      ctx.fillRect(px+3,py+6,5,TS-12);ctx.fillRect(px+TS-8,py+6,5,TS-12);
      A.neonOff(ctx);break;
    case WTR:{const w=Math.sin(Date.now()/600+x+y)*4;
      ctx.fillStyle='#0a2a4a';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#00bfff',8);ctx.strokeStyle='rgba(0,191,255,.7)';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(px+6,py+TS/2+w);ctx.quadraticCurveTo(px+TS/2,py+TS/2-w,px+TS-6,py+TS/2+w);ctx.stroke();
      A.neonOff(ctx);break;}
    case FOL:ctx.fillStyle='#0a1a10';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#39d353',8);ctx.fillStyle='#1d5c2e';
      ctx.beginPath();ctx.arc(px+TS/2,py+TS/2,13,0,A.TAU);ctx.fill();A.neonOff(ctx);
      ctx.fillStyle='#39d353';ctx.fillRect(px+TS/2-1,py+TS/2+8,2,8);break;
    case ROCK:ctx.fillStyle='#0c0e14';ctx.fillRect(px,py,TS,TS);
      ctx.fillStyle='#4a5060';ctx.beginPath();
      ctx.moveTo(px+8,py+30);ctx.lineTo(px+14,py+12);ctx.lineTo(px+26,py+10);ctx.lineTo(px+32,py+30);ctx.closePath();ctx.fill();break;
    case SHL:ctx.fillStyle='#141008';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#ffb300',8);ctx.fillStyle='#5c4318';
      A.rr(ctx,px+7,py+14,TS-14,TS-20,3);ctx.fill();
      ctx.fillStyle='#8a6a2a';ctx.beginPath();ctx.moveTo(px+4,py+16);ctx.lineTo(px+TS/2,py+4);ctx.lineTo(px+TS-4,py+16);ctx.closePath();ctx.fill();
      A.neonOff(ctx);break;
    case FT:ctx.fillStyle='#100c08';ctx.fillRect(px,py,TS,TS);
      ctx.fillStyle='#6a4a22';A.rr(ctx,px+6,py+12,TS-12,TS-20,4);ctx.fill();
      ctx.fillStyle='#a6ff00';for(let i=0;i<4;i++)ctx.fillRect(px+10+i*6,py+18,4,4);break;
    case WT:ctx.fillStyle='#0a1018';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#00bfff',8);ctx.fillStyle='#123a5c';A.rr(ctx,px+6,py+12,TS-12,TS-20,4);ctx.fill();A.neonOff(ctx);
      ctx.fillStyle='rgba(0,191,255,.8)';ctx.fillRect(px+9,py+15,TS-18,8);break;
    case TOY:ctx.fillStyle='#0c0c14';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#ff2fd6',10);ctx.fillStyle='#ff2fd6';
      ctx.beginPath();ctx.arc(px+TS/2,py+TS/2,9,0,A.TAU);ctx.fill();A.neonOff(ctx);
      ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect(px+TS/2-6,py+TS/2-6,12,3);break;
    case BUR:case DRK:case GFT:
      ctx.fillStyle='#0d0d18';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#ffb300',10);ctx.fillStyle='#2a2118';A.rr(ctx,px+4,py+8,TS-8,TS-14,4);ctx.fill();A.neonOff(ctx);
      ctx.font='20px serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(t===BUR?'🍔':t===DRK?'🥤':'🎁',px+TS/2,py+TS/2-2);break;
    case BATH:ctx.fillStyle='#0d0d18';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#00f0ff',10);ctx.fillStyle='#18242a';A.rr(ctx,px+4,py+8,TS-8,TS-14,4);ctx.fill();A.neonOff(ctx);
      ctx.font='20px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🚻',px+TS/2,py+TS/2-2);break;
    case BNCH:ctx.fillStyle='#0c0c12';ctx.fillRect(px,py,TS,TS);
      ctx.fillStyle='#6a5638';ctx.fillRect(px+6,py+14,TS-12,6);ctx.fillRect(px+8,py+20,4,10);ctx.fillRect(px+TS-12,py+20,4,10);break;
    case BIN:ctx.fillStyle='#0c0e12';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#a6ff00',8);ctx.fillStyle='#2a3a1a';A.rr(ctx,px+12,py+10,TS-24,TS-16,3);ctx.fill();A.neonOff(ctx);break;
    case GATE:ctx.fillStyle='#0d1410';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#ffb300',10);ctx.strokeStyle='#ffb300';ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(px+4,py+TS/2);ctx.lineTo(px+TS-4,py+TS/2);ctx.stroke();
      ctx.fillStyle='#ffb300';ctx.fillRect(px+3,py+6,5,TS-12);ctx.fillRect(px+TS-8,py+6,5,TS-12);
      ctx.fillRect(px+TS/2-8,py+TS/2-3,16,6);
      A.neonOff(ctx);break;
    case ENT:ctx.fillStyle='#101a2a';ctx.fillRect(px,py,TS,TS);
      A.neonOn(ctx,'#ffd700',12);ctx.strokeStyle='#ffd700';ctx.lineWidth=3;
      ctx.strokeRect(px+2,py+2,TS-4,TS-4);A.neonOff(ctx);break;
    case LIT:ctx.fillStyle='#2e2a1c';ctx.fillRect(px,py,TS,TS);
      ctx.fillStyle='#6a5a3a';for(let i=0;i<5;i++)ctx.fillRect(px+6+i*6,py+10+(i%2)*12,4,3);break;
    default:
      ctx.fillStyle='rgb('+(10+s)+','+(26+s)+','+(18+s)+')';ctx.fillRect(px,py,TS,TS);
  }
}
function render(){
  ctx.save();
  ctx.fillStyle='#02030a';ctx.fillRect(0,0,W,H);
  shake.apply(ctx);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++)tileBase(at(x,y),x,y);
  // day/night tint
  ctx.fillStyle='rgba(20,20,80,'+(0.08+0.05*Math.sin(dayT/DAY_LEN*A.TAU)).toFixed(3)+')';
  ctx.fillRect(0,0,W,H);
  // entrance label
  A.glowText(ctx,'ENTRANCE',cx(7)+TS/2,cy(15)-2,'700 13px Orbitron, sans-serif','#ffd700');
  // animals
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(const a of animals){
    const bob=Math.sin(a.bob)*3;
    if(a.happy<30){A.neonOn(ctx,'#ff3355',10);}
    ctx.font='30px serif';
    ctx.fillText(SPECIES[a.sp].e,cx(a.x),cy(a.y)+bob-2);
    A.neonOff(ctx);
    // happiness bar
    ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(cx(a.x)-14,cy(a.y)+16,28,4);
    ctx.fillStyle=a.happy>50?'#a6ff00':a.happy>30?'#ffb300':'#ff3355';
    ctx.fillRect(cx(a.x)-14,cy(a.y)+16,28*a.happy/100,4);
  }
  // guests
  for(const g of guests){
    const c=g.happy>60?'#a6ff00':g.happy>30?'#ffb300':'#ff3355';
    A.neonOn(ctx,c,8);ctx.fillStyle=c;
    ctx.beginPath();ctx.arc(cx(g.x),cy(g.y),4,0,A.TAU);ctx.fill();A.neonOff(ctx);
  }
  // keepers
  ctx.font='24px serif';
  for(const k of keepers)ctx.fillText('🧑‍🌾',cx(k.x),cy(k.y));
  particles.draw(ctx);
  floaters.draw(ctx);
  // HUD strip
  ctx.fillStyle='rgba(2,4,12,.82)';ctx.fillRect(0,0,W,54);
  ctx.font='700 15px Orbitron, sans-serif';ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.fillStyle='#a6ff00';ctx.fillText('$'+Math.floor(cash).toLocaleString(),10,18);
  ctx.fillStyle='#e8ecff';ctx.fillText('DAY '+day,150,18);
  ctx.fillStyle='#00f0ff';ctx.fillText('👥'+guests.length,240,18);
  const st=rating();
  ctx.fillStyle='#ffd700';ctx.fillText('★'+st.toFixed(1),330,18);
  ctx.fillStyle='#ff2fd6';ctx.fillText('🧑‍🌾'+keepers.length+'/3',420,18);
  ctx.fillStyle='#8b93b8';ctx.fillText('ADM $'+admission,520,18);
  ctx.font='600 12px Rajdhani, sans-serif';ctx.fillStyle='#8b93b8';
  const tn=TOOLS.find(t=>t.id===tool);
  ctx.fillText(tn?('TOOL: '+tn.n+(tn.c?' $'+tn.c:'')):'pick a tool below · drag to paint',10,40);
  if(tool==='animal'&&selSpecies)ctx.fillText('placing: '+SPECIES[selSpecies].e+' '+selSpecies,300,40);
  ctx.restore();
  if(state==='paused'){
    ctx.save();ctx.fillStyle='rgba(2,4,12,.6)';ctx.fillRect(0,0,W,H);
    A.glowText(ctx,'PAUSED',W/2,H/2,'900 44px Orbitron, sans-serif','#00f0ff');ctx.restore();
  }
}

const loop=A.createLoop(update,render);

/* ---------- input ---------- */
function evTile(e){
  const r=canvas.getBoundingClientRect();
  const cxp=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
  const cyp=(e.touches?e.touches[0].clientY:e.clientY)-r.top;
  return [A.clamp((cxp/r.width*W/TS)|0,0,N-1),A.clamp((cyp/r.height*H/TS)|0,0,N-1)];
}
canvas.addEventListener('mousedown',e=>{painting=true;const t=evTile(e);paintAt(t[0],t[1]);});
canvas.addEventListener('mousemove',e=>{if(painting){const t=evTile(e);paintAt(t[0],t[1]);}});
window.addEventListener('mouseup',()=>{painting=false;});
canvas.addEventListener('touchstart',e=>{painting=true;const t=evTile(e);paintAt(t[0],t[1]);},{passive:true});
canvas.addEventListener('touchmove',e=>{if(painting){e.preventDefault();const t=evTile(e);paintAt(t[0],t[1]);}},{passive:false});
canvas.addEventListener('touchend',()=>{painting=false;});

document.addEventListener('keydown',e=>{
  if(modalEl.classList.contains('hidden'))return;
  const k=e.key.toLowerCase();
  const t=TOOLS.find(t=>t.k===k);
  if(t){selectTool(t.id);return;}
  if(k==='escape'&&tool)selectTool(tool);
  else if(k==='p')togglePause();
  else if(k==='+'||k==='='){admission=A.clamp(admission+1,5,25);A.sfx.tick();}
  else if(k==='-'||k==='_'){admission=A.clamp(admission-1,5,25);A.sfx.tick();}
});
function togglePause(){
  if(state==='playing'){state='paused';pauseBtn.textContent='▶';}
  else if(state==='paused'){state='playing';pauseBtn.textContent='⏸';}
}
pauseBtn.addEventListener('click',togglePause);
A.bindTap(speedBtn,()=>{
  speed=speed===1?3:1;speedBtn.textContent=speed+'×';A.sfx.click();
});

A.registerModalGame('zooModal',{
  onOpen(){reset();overOverlay.hide();startOverlay.show('<div class="go-title">ZOO TYCOON</div><div class="go-sub">build exhibits · keep em happy · click to start</div>');loop.stop();state='ready';render();},
  onClose(){loop.stop();startOverlay.hide();overOverlay.hide();}
});
A.trapGameKeys(modalEl);
reset();render();

window.__zoo={
  start:startGame,update,render,selectTool,paintAt,hireKeeper,
  buyAnimal(sp,x,y){selSpecies=sp;tool='animal';paintAt(x,y);},
  get state(){return state;},get cash(){return cash;},get day(){return day;},
  get guests(){return guests.length;},get animals(){return animals.length;},
  get keepers(){return keepers.length;},get stars(){return rating();},
  get tool(){return tool;},get admission(){return admission;},
  get hunger0(){return animals.length?animals[0].hunger:-1;},
  get keeperState(){return keepers.length?keepers[0].state:'none';}
};
})();
