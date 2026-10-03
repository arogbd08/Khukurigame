import {GROUND, WORLD, PLATFORM_LAYOUT, VILLAGE_COLLISION_HOUSES, STUPA_X, STUPA_SCALE, MOMO_X, DUNGEON_STEPS, DUNGEON_ALCOVES, DUNGEON_ENTRY_X, DUNGEON_FLOOR} from './config.js?v=20261002-23';

/* ================= ENTITIES ================= */
// Player gets 10 HP now
export const player={x:60,y:GROUND-58,w:28,h:58,vx:0,vy:0,onGround:false,facing:1,jumps:2,
  hp:10,maxHp:10,coins:0,ammo:3,maxAmmo:6,atk:0,throwCd:0,dodge:0,dodgeCd:0,dodgeDir:1,
  hurt:0,parry:0,parryCd:0,charges:0,ult:0,wasOnGround:false,
  // ---- combo system ----
  move:null,      // current move key ('L1','L2','L3','H1','HF') or null
  mv:null,        // the MOVES[...] object for the current move
  atkT:0,         // frames elapsed in the current move
  atkId:0,        // unique id per swing — one hit per target per swing
  deathblow:0,    // deathblow animation timer
  dbTarget:null,  // enemy being deathblown
  buffer:null,    // buffered next input ('L'/'H') to chain at the cancel window
  comboCount:0,   // hits landed in the current chain (HUD counter)
  comboTimer:0,   // frames until the combo counter resets
  // ---- animation state ----
  walkPhase:0,    // advances with distance travelled; drives the leg cycle
  breathe:0,      // idle breathing oscillator
  squash:0,       // landing squash-and-stretch, decays to 0
  parryFlash:0,   // lights up the guard on a successful deflect
  throwAnim:0,    // arm follow-through after a khukuri throw
  turnLean:0,     // body leans into acceleration, smoothed
  atkLean:0};     // extra forward lean during an attack, smoothed

const roofPlats=VILLAGE_COLLISION_HOUSES.map(([x,s])=>({x:x-35*s,y:GROUND-50*s,w:70*s,h:9,kind:'roof'}));
export const plats=[...PLATFORM_LAYOUT.map(p=>({...p,h:12})),...roofPlats,...DUNGEON_STEPS.map(p=>({...p,h:14})),...DUNGEON_ALCOVES.map(p=>({...p,h:12}))];
export const structures=[
  ...VILLAGE_COLLISION_HOUSES.map(([x,scale])=>({kind:'house',x:x-32*scale,w:64*scale,top:GROUND-50*scale,bottom:GROUND})),
  ...PLATFORM_LAYOUT.filter(p=>p.kind==='terrace').map(p=>({kind:'terrace',x:p.x+4,w:p.w-8,top:p.y,bottom:GROUND})),
  ...DUNGEON_STEPS.map(p=>({kind:'step',x:p.x+5,w:p.w-5,top:p.y,bottom:DUNGEON_FLOOR})),
  ...DUNGEON_ALCOVES.map(p=>({kind:'alcove',x:p.x,w:p.w,top:p.y,bottom:p.y+22})),
  {kind:'chorten',x:STUPA_X-34*STUPA_SCALE,w:68*STUPA_SCALE,top:GROUND-77*STUPA_SCALE,bottom:GROUND}
];

export function makeMomo(){return MOMO_X.map(x=>({x,y:(x>=DUNGEON_ENTRY_X?DUNGEON_FLOOR:GROUND)-30,got:false}));}
export const momos=makeMomo();

export const paper={x:2645,y:GROUND-72,got:false};

/* ---- Enemy types ----
  type: 'cadre'  — basic swordsman, balanced
  type: 'thug'   — fast, low HP, dodge-rolls
  type: 'heavy'  — slow, tanky, big slam, drops more loot
*/
export function cadre(x, type, floorY=GROUND){
  const t2=type||'cadre';
  return {x,y:floorY-46,w:34,h:46,dir:-1,vx:0,vy:0,floorY,
    hp: t2==='heavy'?6:t2==='thug'?2:3,
    maxHp: t2==='heavy'?6:t2==='thug'?2:3,
    type:t2,
    state:'patrol',move:'lunge',timer:0,hitT:0,alive:true,
    min:x-100,max:x+100,spawn:false,
    dodgeCd:0, dodged:false, lastAtkId:-1,
    posture:0, maxPosture: t2==='heavy'?5:t2==='thug'?2:3, stagger:0, blockFlash:0,
    anim:Math.random()*6.28};   // walk-cycle phase, desynced per enemy
}

export function makeEnemies(){
  // mix of types across the level
  return [
    cadre(600,'cadre'), cadre(1050,'thug'), cadre(1500,'cadre'),
    cadre(1950,'heavy'), cadre(2450,'thug'), cadre(3200,'cadre'),
    cadre(3500,'heavy'), cadre(4050,'cadre'),
    (()=>{const e=cadre(5260,'cadre',DUNGEON_FLOOR);e.min=5200;e.max=5680;return e;})(),
    cadre(5950,'thug',DUNGEON_FLOOR),
    cadre(7040,'heavy',DUNGEON_FLOOR)
  ];
}
export const enemies=makeEnemies();

export const yak={x:1180,y:GROUND-48,w:66,h:48,dir:-1,min:1125,max:1260,speed:0.7,
  state:'graze',charge:0,cooldown:0,anim:0,hitCooldown:0};

/* ---- Boss — 3 phases, 18 HP ---- */
export const boss={x:7800,y:DUNGEON_FLOOR-112,w:72,h:112,hp:18,maxHp:18,dir:-1,state:'wait',
  timer:60,hitT:0,alive:true,active:false,started:false,phase:1,vx:0,vy:0,summoned:0,barkTimer:0,
  spinT:0,rageT:0,enrageFlash:0,stomp:0,anim:0,lastAtkId:-1,
  posture:0,maxPosture:12,stagger:0,blockFlash:0};
export const cage={x:8240,y:DUNGEON_FLOOR-52};
// cs.i = index of the dialogue line currently on screen (player-advanced)
export const cs={t:0,i:0,shock:0,muna:{x:8180,y:DUNGEON_FLOOR-52},raju:{x:8460,y:DUNGEON_FLOOR-52},hari:{x:7960},rajuIn:false};

export const shots=[], pthrows=[], ethrows=[], drops=[], shocks=[], healDrops=[];

// arrays reassigned on reset — mutate in place so importers keep the same reference
export function resetEnemies(){ enemies.length=0; enemies.push(...makeEnemies()); }
export function resetMomos(){ momos.length=0; momos.push(...makeMomo()); }
