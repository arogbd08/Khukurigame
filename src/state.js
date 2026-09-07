import {SUB_MIN_FRAMES, SUB_PER_CHAR, SUB_MAX_FRAMES, DIFF} from './config.js';

/* Mutable cross-module game state. Kept as one object so ES module
   consumers all observe the same live values. */
export const state = {
  scene: 'intro',
  t: 0,
  hitstop: 0,
  won: false,
  lost: false,
  introLine: -1,
  muted: false,
  cam: 0,
  shake: 0,          // screen-shake energy, decays each frame
  flash: 0,          // full-screen white flash (parry / ult), decays each frame
  difficulty: 'casual'   // 'casual' | 'warrior', chosen on the intro screen
};

// Active difficulty row (see DIFF in config.js). Read live so a mid-run change
// would take effect immediately; in practice it's locked at intro.
export function diff(){ return DIFF[state.difficulty] || DIFF.casual; }

/* ================= SUBTITLES ================= */
// Romanized Nepali only — the English translation line was removed.
export const sub = {text:'', t:0, color:'#fff'};

// Duration scales with text length, floored at SUB_MIN_FRAMES so even short
// lines stay readable. An explicit `frames` argument acts as a minimum, never
// a maximum, so the sticky 9999 prompts still behave as before.
export function say(text,frames,color){
  const auto = Math.min(SUB_MAX_FRAMES,
    SUB_MIN_FRAMES + text.length * SUB_PER_CHAR);
  sub.text=text;
  sub.t=Math.max(Number(frames)||0, auto);
  sub.color=color||'#fff';
}

/* ================= TOASTS =================
   Minimal right-side notices for moment-to-moment feedback (pickups, parries,
   kills). Deliberately NOT the subtitle bar — that sits over the play area and
   reading it mid-fight costs you the fight. Subtitles are for story only. */
export const toasts = [];
const TOAST_LIFE = 105;
export function toast(text,color){
  toasts.unshift({text, color:color||'#e8d9b5', t:TOAST_LIFE, max:TOAST_LIFE});
  if(toasts.length>5) toasts.pop();   // keep the stack short; oldest falls off
}
export function updateToasts(){
  for(const n of toasts) n.t--;
  for(let i=toasts.length-1;i>=0;i--) if(toasts[i].t<=0) toasts.splice(i,1);
}

/* ================= SCREEN FEEDBACK ================= */
export function shakeScreen(amount){ state.shake=Math.max(state.shake, amount); }
export function flashScreen(amount){ state.flash=Math.max(state.flash, amount); }

// spark bursts — parry clangs, hits, landings
export const sparks = [];
export function burst(x,y,count,opts){
  const o=opts||{};
  for(let i=0;i<count;i++){
    const a=(o.angle!==undefined? o.angle : Math.random()*6.283) + (Math.random()-0.5)*(o.spread||6.283);
    const sp=(o.speed||4)*(0.4+Math.random());
    sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp - (o.lift||0),
      life:(o.life||24)*(0.6+Math.random()*0.6), max:(o.life||24),
      col:o.col||'#ffe9a8', size:o.size||2.2, grav:o.grav===undefined?0.16:o.grav});
  }
}
export function updateSparks(){
  for(const s of sparks){ s.x+=s.vx; s.y+=s.vy; s.vy+=s.grav; s.vx*=0.97; s.life--; }
  for(let i=sparks.length-1;i>=0;i--) if(sparks[i].life<=0) sparks.splice(i,1);
}

/* ================= INPUT ================= */
export const keys = {};
// lightQ / heavyQ replace the old single atkQ — the two combo buttons.
// Left mouse = light attack, Right mouse = parry, E = ult (iai). No heavy/throw.
export const input = {jumpQ:false, lightQ:false, dodgeQ:false, parryQ:false, ultQ:false, freeQ:false};
export function clearQueued(){
  input.jumpQ=input.lightQ=input.dodgeQ=input.parryQ=input.ultQ=false;
}
