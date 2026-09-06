import {GROUND, WORLD, PLATFORM_LAYOUT, MOMO_X} from './config.js';

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
  iaiCd:0,        // iai-jutsu cooldown
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

function buildPlatforms(){const a=[];for(let i=0;i<PLATFORM_LAYOUT.length;i+=2)a.push({x:PLATFORM_LAYOUT[i],y:PLATFORM_LAYOUT[i+1],w:130,h:14});return a;}
export const plats=buildPlatforms();

export function makeMomo(){return MOMO_X.map(x=>({x,y:GROUND-92,got:false}));}
export const momos=makeMomo();

export const paper={x:2740,y:235-22,got:false};

/* ---- Enemy types ----
  type: 'cadre'  — basic swordsman, balanced
  type: 'thug'   — fast, low HP, dodge-rolls
  type: 'heavy'  — slow, tanky, big slam, drops more loot
*/
export function cadre(x, type){
  const t2=type||'cadre';
  return {x,y:GROUND-46,w:34,h:46,dir:-1,vx:0,vy:0,
    hp: t2==='heavy'?6:t2==='thug'?2:3,
    maxHp: t2==='heavy'?6:t2==='thug'?2:3,
    type:t2,
    state:'patrol',move:'lunge',timer:0,hitT:0,alive:true,
    min:x-100,max:x+100,spawn:false,
    dodgeCd:0, dodged:false, lastAtkId:-1,
    anim:Math.random()*6.28};   // walk-cycle phase, desynced per enemy
}

export function makeEnemies(){
  // mix of types across the level
  return [
    cadre(600,'cadre'), cadre(1050,'thug'), cadre(1500,'cadre'),
    cadre(1950,'heavy'), cadre(2450,'thug'), cadre(2950,'cadre'),
    cadre(3200,'thug'), cadre(3500,'heavy'), cadre(4050,'cadre')
  ];
}
export const enemies=makeEnemies();

/* ---- Boss — 3 phases, 18 HP ---- */
export const boss={x:4760,y:GROUND-96,w:60,h:96,hp:18,maxHp:18,dir:-1,state:'wait',
  timer:60,hitT:0,alive:true,active:false,phase:1,vx:0,vy:0,summoned:0,
  spinT:0,rageT:0,enrageFlash:0,stomp:0,anim:0,lastAtkId:-1};
export const cage={x:5040,y:GROUND-70};
// cs.i = index of the dialogue line currently on screen (player-advanced)
export const cs={t:0,i:0,muna:{x:4980,y:GROUND-52},raju:{x:5260,y:GROUND-52},hari:{x:4760},rajuIn:false};

export const shots=[], pthrows=[], ethrows=[], drops=[], shocks=[], healDrops=[];

// arrays reassigned on reset — mutate in place so importers keep the same reference
export function resetEnemies(){ enemies.length=0; enemies.push(...makeEnemies()); }
export function resetMomos(){ momos.length=0; momos.push(...makeMomo()); }
