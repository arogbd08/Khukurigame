import {ctx} from '../canvas.js?v=20261002-23';
import {W, H, GROUND, WORLD, GROUND_GAPS, DUNGEON_PITS, DUNGEON_ENTRY_X, DUNGEON_ENTRY_END, DUNGEON_FLOOR, DUNGEON_BOSS_ROOM_START, DUNGEON_BOSS_TRIGGER,
        PARRY_DURATION, PARRY_ACTIVE, PARRY_COOLDOWN, PARRY_HITSTOP, PARRY_SHAKE,
        ULT_COST, ULT_MAX_CHARGES, ULT_DMG_NORMAL, ULT_DMG_HEAVY, ULT_DMG_BOSS,
        MOVES, COMBO_GAP,
        STAGGER_FRAMES, POSTURE_REGEN, POSTURE_HIT, POSTURE_BLOCK, POSTURE_PARRY, DEATHBLOW_FRAMES} from '../config.js?v=20261002-23';
import {state, sub, say, toast, keys, pad, input, clearQueued, diff,
        shakeScreen, flashScreen, burst, updateSparks, updateToasts, toasts} from '../state.js?v=20261002-23';
import {sfx, resumeBgm} from '../audio.js?v=20261002-23';
import {over} from '../utils.js?v=20261002-23';
import {player, plats, structures, momos, paper, enemies, boss, cage, cadre, cs, yak,
        shots, pthrows, ethrows, drops, shocks, healDrops,
        resetEnemies, resetMomos} from '../entities.js?v=20261002-23';
import {drawSky, drawBackground, drawGround, drawMomo, drawBlade, drawHealOrb,
        drawPaper, drawCage, drawEnemy, drawBoss, drawHari, drawCutsceneActors, drawForegroundVillage, drawSceneGrade, drawDungeonBackdrop, drawDungeonArchitecture,
        drawSparks, drawYak, drawControlBadge} from '../render.js?v=20261002-23';
import {enterCutscene} from './CutsceneScene.js?v=20261002-23';

/* ================= HELPERS ================= */
function invuln(){return player.hurt>0||player.dodge>4||player.ult>4;}   // ult (=iai) dashes with i-frames
function gainCharge(){ player.charges=Math.min(ULT_MAX_CHARGES,player.charges+1); }

function hurtPlayer(dir,dmg){
  dmg=Math.max(1, Math.round(dmg*diff().dmgMul));   // difficulty scales damage taken
  // getting hit breaks your combo and drops any pending attack
  player.comboCount=0; player.comboTimer=0; player.move=null; player.mv=null; player.buffer=null;
  player.hp-=dmg; player.hurt=52; player.vx=dir*5; player.x+=dir*12;
  state.hitstop=5; shakeScreen(5); sfx('hurt');
  burst(player.x+player.w/2, player.y+26, 8,
    {col:'#e05050', speed:3.4, life:20, angle:dir>0?0:Math.PI, spread:2.2});
  if(player.hp<=0){
    player.hp=0; state.lost=true;
    say('Hari dhalyo... (R)',9999,'#e08070');
  }
}

function spawnHealDrop(x,y){
  healDrops.push({x,y,got:false,bob:Math.random()*6.28});
}

function bossFloor(){return DUNGEON_FLOOR;}

/* Deflect: a small, sharp ORANGE spark burst at the clash point (no big arc),
   plus freeze + shake for weight. Reads as a crisp "ting", not a shield. */
function parrySuccess(srcX, srcY, target, isBoss){
  gainCharge();
  state.hitstop=PARRY_HITSTOP;
  shakeScreen(PARRY_SHAKE*0.7);
  flashScreen(3);
  player.parryFlash=10;
  sfx('parry');
  const px = srcX===undefined ? player.x+player.w/2+player.facing*18 : srcX;
  const py = srcY===undefined ? player.y+28 : srcY;
  // tight hot orange spark cluster — small and punchy
  burst(px,py,10,{col:'#ffb038', speed:5.5, life:12, spread:6.283, grav:0.05});
  burst(px,py,6, {col:'#ffe0a0', speed:3.0, life:16, spread:6.283, grav:0.12});
  // deflecting an attack is the fast route to breaking posture
  if(target) addPosture(target, POSTURE_PARRY, isBoss);
  toast('Pari!  +1','#ffb038');
}

function killEnemy(en){
  en.alive=false; player.coins+=en.type==='heavy'?4:2; sfx('hit');
  shakeScreen(4);
  burst(en.x+en.w/2, en.y+en.h/2, 16, {col:'#d8c8a0', speed:4.5, life:26});
  const floorY=en.floorY||GROUND;
  for(let i=0;i<(en.type==='heavy'?5:3);i++) momos.push({x:en.x+i*9,y:floorY-30,got:false});
  if(Math.random()<0.4) toast('Ek bhrasta kam bhayo.','#cfe0a0');
}

/* ================= COMBO ENGINE =================
   Left-mouse attacks feed the light string (MOVES in config.js). Presses buffer
   and chain at each move's cancel window, so a mistimed-early click still lands
   the next hit. A move plays out to `dur` then drops back to idle. */
function startMove(key){
  const mv=MOVES[key];
  if(!mv) return;
  player.move=key; player.mv=mv; player.atkT=0; player.buffer=null;
  player.atkId++;   // new swing → can hit each target once again
  sfx(mv.sfx||'slash');
}
function updateCombo(){
  // combo counter decays when you stop connecting hits
  if(player.comboTimer>0){ player.comboTimer--; if(player.comboTimer<=0) player.comboCount=0; }

  const L=input.lightQ; input.lightQ=false;
  const canAct = player.dodge<=0 && player.ult<=0 && player.hurt<=0;

  if(player.move){
    const mv=player.mv;
    player.atkT++;
    if(L&&!player.onGround&&!mv.airDown&&canAct){startMove('AIR_DOWN');return;}
    if(L&&player.onGround) player.buffer='L';   // buffer the ground-string follow-up
    if(player.atkT>=mv.cancel && player.buffer && mv.next && mv.next[player.buffer] && canAct){
      startMove(mv.next[player.buffer]); return;
    }
    if(player.atkT>=mv.dur){ player.move=null; player.mv=null; player.buffer=null; }
    return;
  }
  if(canAct && L) startMove(player.onGround?'L1':'AIR_DOWN');
}
function cancelCombo(){ player.move=null; player.mv=null; player.buffer=null; }

/* ---- posture / deathblow ---- */
function breakPosture(e, isBoss){
  e.stagger=STAGGER_FRAMES; e.posture=e.maxPosture;
  shakeScreen(6); sfx('boss'); flashScreen(4);
  toast(isBoss?'Mantri sustayo! (Ghatak!)':'Santulan tutyo!','#ffd24a');
  burst(e.x+(e.w||60)/2, e.y+12, 14, {col:'#ffd24a', speed:4.5, life:24, spread:6.283});
}
function addPosture(e, amt, isBoss){
  if(e.stagger>0) return;
  e.posture += amt;
  if(e.posture>=e.maxPosture) breakPosture(e, isBoss);
}
function triggerDeathblow(e){
  player.deathblow=DEATHBLOW_FRAMES; player.dbTarget=e; e.dying=true;
  player.facing = e.x>=player.x ? 1 : -1;
  player.x = e.x - player.facing*26;          // step in for the finisher
  state.hitstop=18; flashScreen(12); shakeScreen(10);
  sfx('hit'); sfx('boss_roar');
  burst(e.x+e.w/2, e.y+e.h/2, 10, {col:'#ffffff', speed:5, life:14, spread:6.283});
  toast('Ghatak prahar!','#ff5050');
}
function registerComboHit(){
  player.comboCount++; player.comboTimer=COMBO_GAP;
  const c=player.comboCount;
  if(c===5)      toast('Combo ×5!','#ffd24a');
  else if(c===10) toast('Combo ×10!!','#ff9a6a');
  else if(c>10 && c%10===0) toast('Combo ×'+c+'!!!','#ff5050');
}

export function reset(){
  const D=diff();
  Object.assign(player,{x:60,y:GROUND-58,vx:0,vy:0,onGround:false,facing:1,jumps:2,
    hp:D.maxHp,maxHp:D.maxHp,coins:0,ammo:3,atk:0,throwCd:0,dodge:0,dodgeCd:0,dodgeDir:1,
    hurt:0,parry:0,parryCd:0,charges:0,ult:0,wasOnGround:false,
    move:null,mv:null,atkT:0,atkId:0,deathblow:0,dbTarget:null,buffer:null,comboCount:0,comboTimer:0,
    walkPhase:0,breathe:0,squash:0,parryFlash:0,throwAnim:0,turnLean:0,atkLean:0});
  resetEnemies(); resetMomos(); paper.got=false;
  Object.assign(boss,{x:7800,y:DUNGEON_FLOOR-112,w:72,h:112,hp:18,maxHp:18,dir:-1,state:'wait',timer:60,hitT:0,
    alive:true,active:false,started:false,phase:1,vx:0,vy:0,summoned:0,barkTimer:0,spinT:0,rageT:0,enrageFlash:0,stomp:0,anim:0,lastAtkId:-1,
    posture:0,maxPosture:12,stagger:0,blockFlash:0});
  Object.assign(yak,{x:1180,y:GROUND-48,w:66,h:48,dir:-1,min:1125,max:1260,speed:0.7,state:'graze',charge:0,cooldown:0,anim:0,hitCooldown:0});
  shots.length=pthrows.length=ethrows.length=drops.length=shocks.length=healDrops.length=0;
  healDrops.push({x:4700,y:DUNGEON_FLOOR-96,got:false,bob:0});
  toasts.length=0;
  state.won=false; state.lost=false; state.hitstop=0; state.t=0; state.scene='play';state.cam=0;state.camY=0;
  state.introLine=-1; state.shake=0; state.flash=0; state.tutorialT=0;
  resumeBgm();   // in case R was pressed during the (silent) cutscene
  say('Hari hindyo — Munako khojima.',0,'#e0d090');
}

/* ================= UPDATE ================= */
export function updatePlay(){
  if(sub.t>0) sub.t--;
  // fx keep animating during hitstop so the freeze still reads as alive
  if(state.shake>0) state.shake*=0.86;
  if(state.flash>0) state.flash--;
  updateSparks();
  updateToasts();
  // deathblow plays out even through hitstop so the finisher reads
  if(player.deathblow>0){
    player.deathblow--;
    if(player.deathblow===0 && player.dbTarget){
      const e=player.dbTarget; player.dbTarget=null;
      burst(e.x+e.w/2,e.y+e.h/2,26,{col:'#c83030',speed:6,life:30,spread:6.283});
      burst(e.x+e.w/2,e.y+e.h/2,16,{col:'#ffd24a',speed:5,life:26,spread:6.283});
      shakeScreen(8); killEnemy(e);
    }
  }
  if(state.lost){ clearQueued(); return; }
  if(boss.active&&!boss.started){
    player.vx=0;
    if(input.actionQ){
      boss.started=true;boss.timer=78;boss.barkTimer=360;sub.t=0;
      say('Mantri: "Aaja, gaunko rakshak. Aau timro bhagya heraun!"',210,'#ffcf9b');
      sfx('boss_roar');shakeScreen(8);flashScreen(4);
    }
    clearQueued();return;
  }
  if(state.hitstop>0){ state.hitstop--; clearQueued(); return; }
  state.t++;
  const t=state.t;

  /* ---- dodge / ultimate / movement ---- */
  const sp=3.3;
  if(player.dodgeCd>0)player.dodgeCd--;
  if(player.parryCd>0)player.parryCd--;
  if(player.parry>0)player.parry--;
  if(player.parryFlash>0)player.parryFlash--;
  if(player.throwAnim>0)player.throwAnim--;
  if(player.squash>0)player.squash=Math.max(0,player.squash-0.09);
  player.breathe+=0.06;

  // Ultimate (E / Triangle): one-charge katana draw, dashes forward, down→up cut.
  if(input.ultQ && player.ult<=0 && player.charges>=ULT_COST){
    player.ult=24; player.charges-=ULT_COST; cancelCombo();
    sfx('spin_attack'); sfx('ult');
    shakeScreen(7); flashScreen(6);
    burst(player.x+player.w/2, player.y+28, 20,
      {col:'#ffe6a0', speed:6, life:26, angle:player.facing>0?0:Math.PI, spread:1.8});
    toast('Ultimate!','#ffe6a0');
  }
  input.ultQ=false;

  if(input.dodgeQ && player.dodge===0 && player.dodgeCd===0 && player.ult<=0){
    player.dodge=16; player.dodgeCd=42; cancelCombo();   // dodge cancels the current attack (flow)
    player.dodgeDir=(keys['KeyA']||pad.left)?-1:(keys['KeyD']||pad.right)?1:player.facing;
    player.facing=player.dodgeDir;
  }
  input.dodgeQ=false;

  if(player.ult>0){ player.vx=player.facing*(player.ult>8?12:4); player.ult--; }
  else if(player.dodge>0){ player.vx=player.dodgeDir*6.8; player.dodge--; }
  else { if(keys['KeyA']||pad.left){player.vx=-sp;player.facing=-1;}
    else if(keys['KeyD']||pad.right){player.vx=sp;player.facing=1;} else player.vx=0; }

  if(input.jumpQ && player.jumps>0){
    player.vy=-10.6;player.jumps--;player.onGround=false;sfx('jump');
    player.squash=-0.35;  // negative squash = stretch on take-off
    burst(player.x+player.w/2, player.y+player.h, 6,
      {col:'#c8bb98', speed:2.2, life:16, angle:Math.PI/2, spread:2.4, grav:0.1});
  }
  input.jumpQ=false;

  player.wasOnGround=player.onGround;
  player.vy+=0.55; const ob=player.y+player.h, oldX=player.x;
  player.x+=player.vx; player.y+=player.vy;
  player.x=Math.max(0,Math.min(WORLD-player.w,player.x));
  for(const s of structures){
    const overlap=player.x+player.w>s.x&&player.x<s.x+s.w;
    if(overlap&&player.y+player.h>s.top+5&&player.y<(s.bottom??GROUND)){
      if(oldX+player.w<=s.x){player.x=s.x-player.w;player.vx=0;}
      else if(oldX>=s.x+s.w){player.x=s.x+s.w;player.vx=0;}
    }
  }
  player.onGround=false;
  const center=player.x+player.w/2, overGap=GROUND_GAPS.some(([a,b])=>center>a&&center<b);
  const dungeonSide=center>=DUNGEON_ENTRY_X;
  if(center<DUNGEON_ENTRY_X&&player.y+player.h>=GROUND&&!overGap){player.y=GROUND-player.h;player.vy=0;player.onGround=true;}
  const dungeonPit=DUNGEON_PITS.some(([a,b])=>center>a&&center<b);
  if(dungeonSide&&!dungeonPit&&player.y+player.h>=DUNGEON_FLOOR){player.y=DUNGEON_FLOOR-player.h;player.vy=0;player.onGround=true;}
  for(const pl of plats){ const nb=player.y+player.h;
    if(player.vy>=0&&ob<=pl.y&&nb>=pl.y&&player.x+player.w>pl.x&&player.x<pl.x+pl.w){
      player.y=pl.y-player.h;player.vy=0;player.onGround=true;} }
  if(player.onGround && !player.wasOnGround){
    sfx('land');
    // landing impact scales with fall speed
    const impact=Math.min(1, Math.abs(player.vy0||0)/12);
    player.squash=0.35+impact*0.35;
    burst(player.x+player.w/2, player.y+player.h, 5+Math.round(impact*7),
      {col:'#c8bb98', speed:2.6+impact*2, life:18, angle:0, spread:6.283, grav:0.2});
  }
  player.vy0=player.vy;
  if(player.onGround)player.jumps=2;
  const fellIntoDungeonPit=dungeonSide&&dungeonPit&&player.y>DUNGEON_FLOOR+100;
  const fellIntoSurfaceGap=!dungeonSide&&player.y>H+28;
  if(fellIntoDungeonPit||fellIntoSurfaceGap){
    const gap= fellIntoDungeonPit
      ? DUNGEON_PITS.find(([a,b])=>center>a&&center<b)
      : GROUND_GAPS.find(([a,b])=>center>a&&center<b);
    const edge=gap?.[0]??(fellIntoDungeonPit?5360:1790);
    const floorY=fellIntoDungeonPit?DUNGEON_FLOOR:GROUND;
    // Falling costs health, but always leaves Hari alive and returns him to the
    // near side of the gap so he can try the jump again.
    player.hp=Math.max(1,player.hp-2);
    player.x=Math.max(0,edge-player.w-22);player.y=floorY-player.h;
    player.vx=0;player.vy=0;player.vy0=0;player.onGround=true;player.wasOnGround=false;player.jumps=2;
    player.hurt=70;player.parry=0;player.dodge=0;player.ult=0;cancelCombo();
    player.facing=1;state.camY=fellIntoDungeonPit?Math.max(0,DUNGEON_FLOOR-H*.78):0;
    state.hitstop=6;shakeScreen(8);sfx('hurt');clearQueued();
    burst(player.x+player.w/2,player.y+player.h,12,{col:'#c8bb98',speed:3.2,life:20,angle:-Math.PI/2,spread:2.6,grav:.16});
    toast(state.language==='en'?'Fell in the pit!  -2 HP':'Khaddama khasyo!  -2 HP','#e3c493');
    return;
  }
  const targetCamY=dungeonSide&&player.y>GROUND+12?Math.max(0,Math.min(DUNGEON_FLOOR-H*.78,player.y+player.h-H*.78)):0;
  state.camY+=(targetCamY-state.camY)*0.16;
  if(Math.abs(targetCamY-state.camY)<0.5)state.camY=targetCamY;

  // A yak herd animal blocks the narrow village path. Its lowered head and
  // hoof scrape telegraph a short, bounded charge before it recovers.
  yak.anim+=yak.state==='charge'?0.22:0.06;
  if(yak.cooldown>0)yak.cooldown--;
  if(yak.hitCooldown>0)yak.hitCooldown--;
  if(yak.state==='graze'){
    yak.x+=yak.dir*yak.speed;
    if(yak.x<yak.min||yak.x>yak.max){yak.dir*=-1;yak.x=Math.max(yak.min,Math.min(yak.max,yak.x));}
    if(yak.cooldown===0&&Math.abs(player.x-yak.x)<155){yak.dir=player.x<yak.x?-1:1;yak.state='warn';yak.charge=36;sfx('yak_snort');}
  }else if(yak.state==='warn'){
    if(--yak.charge<=0){yak.state='charge';yak.charge=40;shakeScreen(2);}
  }else if(yak.state==='charge'){
    yak.x+=yak.dir*4.4;
    if(--yak.charge<=0||yak.x<yak.min-50||yak.x>yak.max+50){yak.state='recover';yak.charge=45;yak.cooldown=150;}
  }else if(--yak.charge<=0)yak.state='graze';
  if(over(player,yak)&&yak.hitCooldown===0){
    hurtPlayer(yak.dir,1);player.vx=yak.dir*8;yak.hitCooldown=60;
    if(yak.state==='charge'){yak.state='recover';yak.charge=45;yak.cooldown=150;}
  }

  /* ---- animation drivers ---- */
  if(player.onGround && Math.abs(player.vx)>0.4) player.walkPhase += Math.abs(player.vx)*0.17;
  else if(!player.onGround) player.walkPhase = 0;
  // body leans into travel / dodge, smoothed so it never snaps
  const leanTarget = (player.dodge>0||player.ult>0) ? 0.22
                   : player.onGround ? Math.abs(player.vx)*0.016 : 0.05;
  player.turnLean += (leanTarget-player.turnLean)*0.18;
  // extra forward lean through an attack's active frames — smoothed so the
  // wind-up rocks back and the strike drives in
  const atkLeanTarget = player.mv
    ? (player.atkT<player.mv.a0 ? (player.mv.heavy?-0.14:-0.08)                  // wind-up: rock back
       : player.atkT<=player.mv.a1 ? (player.mv.heavy?0.24:0.15) : 0.04)         // strike: drive forward
    : 0;
  player.atkLean += (atkLeanTarget-player.atkLean)*0.3;

  /* ---- parry ----
     Longer stance, longer active window and a short cooldown: mistiming costs
     you tempo rather than locking you out. `parrying` is the deflect window. */
  if(input.parryQ && player.parryCd===0 && player.ult<=0){
    player.parry=PARRY_DURATION; player.parryCd=PARRY_COOLDOWN; cancelCombo();  // parry cancels attacks
    burst(player.x+player.w/2+player.facing*14, player.y+30, 5,
      {col:'#9fe0ff', speed:2, life:14, grav:0.02});
  }
  input.parryQ=false;
  // difficulty widens/narrows the active deflect window (Casual is more forgiving)
  const parrying=player.parry>diff().parryThresh;

  /* ---- combo attacks: ground string or downward aerial slash ---- */
  updateCombo();
  // build the live hitbox + its stats from the current move's active window
  let hb=null, hbDmg=1, hbKb=6, hbStop=3, hbHeavy=false;
  if(player.move){
    const mv=player.mv;
    if(player.atkT>=mv.a0 && player.atkT<=mv.a1){
      const r=mv.reach;
      if(mv.airDown){
        const x=player.x+player.w/2-r/2;
        hb={x:x+(player.facing===1?8:-8),y:player.y+player.h-12,w:r,h:48};
      }else hb={x: player.facing===1 ? player.x+player.w-6 : player.x+player.w-6-r, y:player.y-6, w:r, h:62};
      hbDmg=mv.dmg; hbKb=mv.kb; hbStop=mv.hitstop; hbHeavy=!!mv.finisher;
    }
  }
  if(player.ult>4){ const u=player.facing===1?player.x+player.w-10:player.x-66;
    hb={x:u,y:player.y-10,w:76,h:74}; }
  if(player.hurt>0)player.hurt--;

  /* ---- momo / paper / drops / heals ---- */
  for(const m of momos){ if(!m.got && Math.abs(player.x+player.w/2-m.x)<24 && Math.abs(player.y+30-m.y)<42){
    m.got=true; player.coins++; sfx('pickup');
    if(player.coins%diff().momoHeal===0 && player.hp<player.maxHp){ player.hp++; sfx('heal');
      toast('Momo khaen  +1 HP','#9fe06a'); }
  } }
  if(!paper.got && Math.abs(player.x+player.w/2-paper.x)<26 && Math.abs(player.y+24-paper.y)<46){
    paper.got=true; sfx('paper');
    say('Gaunko rakshaklai pahadka devataharule pahilai chinisakeka chhan.',360,'#f0e0a0');
  }
  for(const d of drops){ if(!d.got && Math.abs(player.x+player.w/2-d.x)<24 && Math.abs(player.y+30-d.y)<46){
    d.got=true; player.ammo=Math.min(player.maxAmmo,player.ammo+1); sfx('pickup');
    toast('Khukuri tipen  +1','#cfe0a0'); } }
  // heal drops from boss
  for(const h of healDrops){ if(!h.got && Math.abs(player.x+player.w/2-h.x)<22 && Math.abs(player.y+30-h.y)<46){
    h.got=true; sfx('heal');
    if(player.hp<player.maxHp){ const o=diff().orbHeal; player.hp=Math.min(player.maxHp,player.hp+o);
      toast('Jyan bancheko  +'+o+' HP','#9fe06a'); }
  } }

  /* ---- ENEMIES (with type variety) ---- */
  for(const e of enemies){
    if(!e.alive)continue;
    if(e.hitT>0)e.hitT--;
    if(e.dodgeCd>0)e.dodgeCd--;
    if(e.blockFlash>0)e.blockFlash--;
    const dx=player.x-e.x, dist=Math.abs(dx), near=dist<200 && Math.abs(player.y-e.y)<80;
    const floorY=e.floorY||GROUND;

    // posture: bleeds off when not pressured; a broken enemy is frozen & open
    if(e.stagger>0){ e.stagger--; }
    else if(e.posture>0){ e.posture=Math.max(0, e.posture-POSTURE_REGEN); }

    // THUG: fast, can dodge away when hit
    // HEAVY: slow, big slam radius
    // difficulty scales patrol/approach speed (Warrior enemies press harder)
    const spd = (e.type==='thug'?1.4 : e.type==='heavy'?0.6 : 0.9) * diff().enemySpeed;
    // walk-cycle phase, driven by however fast this one is actually moving
    if(e.state==='patrol') e.anim += spd*0.16;
    else if(e.state==='lunge') e.anim += Math.abs(e.vx)*0.14;

    if(e.stagger>0){ /* staggered: no AI, stands open for a deathblow */ }
    else if(e.state==='patrol'){
      e.x+=e.dir*spd; if(e.x<e.min)e.dir=1; if(e.x>e.max)e.dir=-1;
      if(near){
        e.dir=dx>0?1:-1;
        const r=Math.random();
        if(e.type==='thug'){
          e.move=dist<80?'lunge': r<0.3?'throw':'lunge'; e.state='windup'; e.timer=16;
        } else if(e.type==='heavy'){
          e.move=dist<100?'slam':'lunge'; e.state='windup'; e.timer=44;
          if(e.move==='slam') toast('Bhari aant!','#ffa070');
        } else {
          e.move=dist>190?'throw':dist<70?(r<0.5?'lunge':'leap'):(r<0.4?'throw':r<0.7?'lunge':'leap');
          e.state='windup'; e.timer=e.move==='throw'?24:28;
        }
      }
    } else if(e.state==='windup'){ if(--e.timer<=0){
        if(e.move==='lunge'){
          e.state='lunge'; e.timer=e.type==='thug'?14:22;
          e.vx=e.dir*(e.type==='thug'?7:5.6); sfx('slash');
        } else if(e.move==='leap'){
          e.state='leap'; e.vy=-7.2; e.vx=e.dir*3.7;
        } else if(e.move==='slam'){
          e.state='slam'; e.timer=18; e.vx=e.dir*3; sfx('stomp');
        } else {
          ethrows.push({x:e.x+e.w/2,y:e.y+16,vx:e.dir*5,vy:-1.4,spin:0});
          sfx('throw'); e.state='recover'; e.timer=46;
        }
    } } else if(e.state==='lunge'){
      e.x+=e.vx; if(--e.timer<=0){e.state='recover';e.timer=38;}
    } else if(e.state==='slam'){
      // heavy ground slam — big hitbox
      e.x+=e.vx; if(--e.timer<=0){
        sfx('stomp'); shocks.push({x:e.x,y:floorY-14,vx:-7,life:28,big:true});
        shocks.push({x:e.x,y:floorY-14,vx:7,life:28,big:true});
        e.state='recover'; e.timer=55;
      }
    } else if(e.state==='leap'){
      e.vy+=0.5; e.x+=e.vx; e.y+=e.vy;
      if(e.y>=floorY-e.h&&!DUNGEON_PITS.some(([a,b])=>e.x+e.w/2>a&&e.x+e.w/2<b)){
        e.y=floorY-e.h;e.vy=0;e.state='recover';e.timer=34;
      }
    } else { if(--e.timer<=0)e.state='patrol'; }
    e.x=Math.max(40,Math.min(WORLD-40,e.x));
    const enemyInPit=DUNGEON_PITS.some(([a,b])=>e.x+e.w/2>a&&e.x+e.w/2<b);
    if(enemyInPit){
      if(e.state!=='leap'){e.vy=(e.vy||0)+0.48;e.y+=e.vy;}
      if(e.y>floorY+100){e.alive=false;burst(e.x+e.w/2,floorY+26,8,{col:'#8b7864',speed:2.2,life:18});continue;}
    }else if(e.state!=='leap'){e.y=floorY-e.h;e.vy=0;}

    // combo swings gate per-swing (each connects once); ult gates on time
    const eGate = player.ult>4 ? e.hitT===0 : e.lastAtkId!==player.atkId;
    if(hb && eGate && !player.deathblow && over(hb,e)){
      if(player.ult<=4) e.lastAtkId=player.atkId;
      if(e.stagger>0){
        triggerDeathblow(e);                              // finisher on a broken enemy
      } else {
        const playerSide = player.x<e.x ? -1 : 1;         // dir from enemy toward the player
        // enemies BLOCK frontal hits while not attacking → chip posture, no HP
        const blocking = player.ult<=4 && e.dir===playerSide && (e.state==='patrol'||e.state==='recover');
        if(blocking){
          e.blockFlash=8; addPosture(e,POSTURE_BLOCK);
          e.hitT=10; state.hitstop=Math.max(state.hitstop,2); e.x+=player.facing*3;
          sfx('parry'); shakeScreen(2);
          burst(e.x+(playerSide<0?e.w:0), e.y+24, 7, {col:'#cbd3dd', speed:4, life:12, spread:6.283});
          registerComboHit();
        } else {
          // clean hit (enemy attacking / caught open / ult): HP + posture
          const d=player.ult>4?(e.type==='heavy'?ULT_DMG_HEAVY:ULT_DMG_NORMAL):hbDmg;
          e.hp-=d; addPosture(e,POSTURE_HIT); e.hitT=14;
          state.hitstop=Math.max(state.hitstop, player.ult>4?3:hbStop);
          e.x+=player.facing*(player.ult>4?12:hbKb);
          sfx('hit'); shakeScreen(hbHeavy?5:3);
          burst(e.x+e.w/2, e.y+e.h/2, hbHeavy?14:9,
            {col:'#ffd9a0', speed:hbHeavy?5.5:4, life:hbHeavy?24:18, angle:player.facing>0?0:Math.PI, spread:2.6});
          registerComboHit();
          if(e.type==='thug' && e.hp>0 && e.dodgeCd===0 && Math.random()<0.45){
            e.x+=e.dir*-40; e.dodgeCd=40; e.state='recover'; e.timer=28;
          }
          if(e.hp<=0) killEnemy(e);
        }
      }
    }
    for(const k of pthrows){ if(!k.dead && e.hitT===0 && k.x<e.x+e.w&&k.x>e.x&&k.y>e.y&&k.y<e.y+e.h){
      e.hp--; e.hitT=14; state.hitstop=3; k.dead=true; sfx('hit'); if(e.hp<=0) killEnemy(e); } }

    const attacking=(e.state==='lunge'||e.state==='leap'||e.state==='slam');
    if(attacking && over(player,e)){
      if(parrying){
        parrySuccess((player.x+e.x+e.w/2)/2, player.y+28, e);
        // deflect staggers the attacker hard and knocks it back — the reward
        // for a read, and what makes parry preferable to dodging
        e.state='recover'; e.timer=70; e.hitT=14; e.vx=0;
        e.x += (dx>0?1:-1)*22;
      }
      else if(!invuln()) hurtPlayer(dx>0?-1:1, e.type==='heavy'?2 : e.state==='lunge'?1:2);
    }
  }

  /* ====== BOSS — 3 PHASES, 18 HP ====== */
  if(player.x>DUNGEON_BOSS_TRIGGER&&boss.alive&&!boss.active){
    boss.active=true;boss.started=false;boss.x=Math.max(boss.x,DUNGEON_BOSS_ROOM_START+160);
    say('Mantri: "Yo gaun ra pahad aba saharko sampatti ho."',9999,'#ffcf9b');
    shakeScreen(5);sfx('boss_roar');
  }
  if(boss.alive && boss.active && boss.started){
    if(boss.hitT>0)boss.hitT--;
    if(boss.enrageFlash>0)boss.enrageFlash--;
    if(boss.blockFlash>0)boss.blockFlash--;
    if(boss.stagger>0){ boss.stagger--; } else if(boss.posture>0){ boss.posture=Math.max(0,boss.posture-POSTURE_REGEN*0.7); }

    // Phase transitions
    const hpPct=boss.hp/boss.maxHp;
    if(boss.phase===1 && hpPct<0.66){
      boss.phase=2; boss.enrageFlash=40; sfx('boss_roar'); shakeScreen(10);
      say('Mantri: "Bajet khaeko manchhelai marchhas?!"',0,'#ff9a6a');
      spawnHealDrop(boss.x-80, bossFloor()-26); // reward for reaching phase 2
    }
    if(boss.phase===2 && hpPct<0.33){
      boss.phase=3; boss.enrageFlash=60; sfx('boss_roar'); shakeScreen(13);
      say('Mantri: "Ta marchhas! Ma sadhain banchhu!!!"',0,'#ff5050');
      spawnHealDrop(boss.x+80, bossFloor()-26);
    }

    const dx=player.x-boss.x; boss.dir=dx>0?1:-1;
    const spd = (boss.phase===3?2.2:boss.phase===2?1.7:1.3) * diff().enemySpeed;
    // approach speed — frozen and open while posture-broken
    if(boss.stagger<=0){
    if(boss.state==='wait'){
      if(Math.abs(dx)>120){ boss.x+=boss.dir*spd; boss.anim+=spd*0.13; }
      if(--boss.timer<=0){
        // choose attack based on phase
        const r=Math.random();
        if(boss.phase===3){
          // rage: more aggressive mix
          if(r<0.2) boss.state='spin_tel';
          else if(r<0.45) boss.state='slash_tel';
          else if(r<0.65) boss.state='leap_tel';
          else if(r<0.80) boss.state='throw_tel';
          else boss.state='stomp_tel';
        } else if(boss.phase===2){
          if(r<0.25) boss.state='slash_tel';
          else if(r<0.5) boss.state='throw_tel';
          else if(r<0.7) boss.state='leap_tel';
          else boss.state='stomp_tel';
        } else {
          if(Math.abs(dx)<240) boss.state=r<0.5?'slash_tel':'leap_tel';
          else boss.state='throw_tel';
        }
        boss.timer=42; sfx('boss');
        if(boss.barkTimer<=0){
          const line=boss.phase===3?'Mantri: "Aba yo pahad nai mero ayudh ho!"':boss.phase===2?'Mantri: "Timro gaunle malai rokna sakdaina!"':'Mantri: "Farkera jaau. Yo timro yuddha hoina!"';
          say(line,0,boss.phase===3?'#ff8b70':'#ffcf9b');boss.barkTimer=420;
        }
      }
    }

    // SLASH — quick dash slash
    else if(boss.state==='slash_tel'){ if(--boss.timer<=0){boss.state='slash';boss.timer=boss.phase===3?18:24;sfx('slash');} }
    else if(boss.state==='slash'){
      const dspd=boss.phase===3?8:boss.phase===2?6.5:5.2;
      boss.x+=boss.dir*dspd; boss.anim+=dspd*0.12;
      if(over(player,boss)){
        if(parrying){
          parrySuccess((player.x+boss.x+boss.w/2)/2, player.y+28, boss, true);
          boss.state='wait';boss.timer=60; boss.x-=boss.dir*20;
        }
        else if(!invuln()) hurtPlayer(boss.dir,1);
      }
      if(--boss.timer<=0){boss.state='wait';boss.timer=72;}
    }

    // THROW
    else if(boss.state==='throw_tel'){ if(--boss.timer<=0){
        sfx('throw');
        const count=boss.phase===3?3:boss.phase===2?2:1;
        for(let i=0;i<count;i++){
          const vy=-2-i*1.5;
          shots.push({x:boss.x+boss.w/2,y:boss.y+34,vx:boss.dir*4.4,vy});
        }
        boss.state='wait'; boss.timer=85;
    } }

    // LEAP
    else if(boss.state==='leap_tel'){ if(--boss.timer<=0){boss.state='leap';boss.vy=-9.5;boss.vx=boss.dir*3.2;boss.leapParried=false;} }
    else if(boss.state==='leap'){
      boss.vy+=0.5; boss.x+=boss.vx; boss.y+=boss.vy;
      if(over(player,boss)){
        // leap is now deflectable too, so every boss move answers to parry
        if(parrying && !boss.leapParried){
          boss.leapParried=true;
          parrySuccess((player.x+boss.x+boss.w/2)/2, player.y+28, boss, true);
          boss.vx=-boss.dir*3;
        }
        else if(!invuln()&&!parrying) hurtPlayer(boss.dir,1);
      }
      if(boss.y>=bossFloor()-boss.h){
        boss.y=bossFloor()-boss.h; sfx('stomp'); shakeScreen(9);
        burst(boss.x+boss.w/2, bossFloor(), 18, {col:'#c8b088', speed:5, life:24, angle:0, spread:6.283});
        const range=boss.phase===3?3:boss.phase===2?2:1;
        for(let i=0;i<range;i++){
          shocks.push({x:boss.x,y:bossFloor()-14,vx:-(6+i*2),life:38+i*8});
          shocks.push({x:boss.x,y:bossFloor()-14,vx:6+i*2,life:38+i*8});
        }
        boss.state='wait'; boss.timer=80;
      }
    }

    // SPIN ATTACK — phase 3 only, rotates and charges
    else if(boss.state==='spin_tel'){
      if(--boss.timer<=0){ boss.state='spin'; boss.spinT=boss.phase===3?52:36; sfx('spin_attack'); }
    }
    else if(boss.state==='spin'){
      // boss charges in dir, wide hitbox
      boss.x+=boss.dir*(boss.phase===3?6.5:5);
      boss.spinT--;
      // reverse midway
      if(boss.spinT===26) boss.dir*=-1;
      const spinHb={x:boss.x-16,y:boss.y-8,w:boss.w+32,h:boss.h+8};
      if(over(player,spinHb)){
        if(parrying){
          parrySuccess((player.x+boss.x+boss.w/2)/2, player.y+28, boss, true);
          boss.state='wait';boss.timer=70;boss.spinT=0; boss.x-=boss.dir*24;
        }
        else if(!invuln()) hurtPlayer(boss.dir,2);
      }
      if(boss.spinT<=0){boss.state='wait';boss.timer=90;}
    }

    // STOMP — ground slam sending shockwaves from position
    else if(boss.state==='stomp_tel'){ if(--boss.timer<=0){
        boss.state='stomp'; boss.vy=-6; sfx('boss');
    } }
    else if(boss.state==='stomp'){
      boss.vy+=0.7; boss.y+=boss.vy;
      if(boss.y>=bossFloor()-boss.h){
        boss.y=bossFloor()-boss.h; sfx('shockwave');
        const n=boss.phase===3?5:boss.phase===2?3:2;
        for(let i=1;i<=n;i++){
          shocks.push({x:boss.x,y:bossFloor()-14,vx:-(4+i*2),life:50+i*5});
          shocks.push({x:boss.x,y:bossFloor()-14,vx:4+i*2,life:50+i*5});
        }
        boss.state='wait'; boss.timer=85;
      }
    }
    }  // end boss.stagger<=0 gate

    if(boss.barkTimer>0)boss.barkTimer--;
    boss.x=Math.max(DUNGEON_BOSS_ROOM_START+60,Math.min(WORLD-100,boss.x));

    const bGate = player.ult>4 ? boss.hitT===0 : boss.lastAtkId!==player.atkId;
    if(hb && bGate && over(hb,boss)){
      if(player.ult<=4) boss.lastAtkId=player.atkId;
      // staggered boss takes DOUBLE damage (the deathblow window); posture builds otherwise
      const base=player.ult>4?ULT_DMG_BOSS:hbDmg;
      const d=boss.stagger>0?base*2:base;
      if(boss.stagger<=0) addPosture(boss, POSTURE_HIT, true);
      boss.hp-=d; boss.hitT=16; state.hitstop=Math.max(6,hbStop);
      boss.x+=player.facing*(hbHeavy?4:2); sfx('hit');
      registerComboHit();
      shakeScreen(hbHeavy?7:5);
      burst(boss.x+boss.w/2, boss.y+40, 11,
        {col:'#ffd9a0', speed:4.5, life:20, angle:player.facing>0?0:Math.PI, spread:2.6});
      if(boss.hp<=0){
        boss.alive=false; state.won=true; sfx('boss_roar');
        shakeScreen(16); flashScreen(14);
        burst(boss.x+boss.w/2, boss.y+40, 40, {col:'#ffd24a', speed:7, life:44});
        for(let i=0;i<8;i++) momos.push({x:boss.x-30+i*10,y:bossFloor()-30,got:false});
        player.hp=Math.min(player.maxHp,player.hp+3); player.ammo=player.maxAmmo;
        spawnHealDrop(boss.x, bossFloor()-26);
        say('Mantri parasta! Munalai fukau.',9999,'#9fe06a');
      }
    }
    if(!boss.alive) {} else {
      for(const k of pthrows){ if(!k.dead&&boss.hitT===0&&over({x:k.x-6,y:k.y-6,w:12,h:12},boss)){
        boss.hp--; boss.hitT=16; k.dead=true; state.hitstop=5; sfx('hit'); if(boss.hp<=0){
          boss.alive=false; state.won=true; sfx('boss_roar');
          shakeScreen(16); flashScreen(14);
          player.hp=Math.min(player.maxHp,player.hp+3);
          say('Mantri parasta!',9999,'#9fe06a');
        } } }
    }
    // phase 3 — boss summons helper
    if(boss.phase===3 && boss.alive && t%480===0 && enemies.filter(e=>e.alive).length<2){
      const c=cadre(boss.x-120,'cadre',DUNGEON_FLOOR); c.min=c.x-60;c.max=c.x+90; enemies.push(c);
      toast('Mantri: "Karyakarta ho, aau!"','#ff9a6a');
    }
  }

  // shockwaves — parryable like everything else; a deflect shatters the wave
  for(const s of shocks){
    s.x+=s.vx; s.life--;
    const sz=s.big?20:16;
    if(!s.dead && Math.abs(player.x+player.w/2-s.x)<sz && player.onGround){
      if(parrying){
        parrySuccess(s.x, s.y);
        s.dead=true;
      }
      else if(!invuln()) hurtPlayer(s.vx>0?1:-1,1);
    }
  }
  for(let i=shocks.length-1;i>=0;i--) if(shocks[i].life<=0||shocks[i].dead)shocks.splice(i,1);

  /* ---- projectiles ---- */
  for(const s of shots){ s.x+=s.vx; s.vy+=0.18; s.y+=s.vy;
    if(over({x:s.x,y:s.y,w:12,h:10},player)){
      // deflected shots become YOUR projectile, fired back faster
      if(parrying){ parrySuccess(s.x,s.y); pthrows.push({x:s.x,y:s.y,vx:-s.vx*1.3,spin:0,life:70}); s.dead=true; }
      else if(!invuln()){ hurtPlayer(s.vx>0?1:-1,1); s.dead=true; } } }
  for(let i=shots.length-1;i>=0;i--){const s=shots[i]; if(s.dead||s.y>DUNGEON_FLOOR+H||s.x<0||s.x>WORLD)shots.splice(i,1);}

  for(const k of pthrows){ k.x+=k.vx; k.spin+=0.5; k.life--;
    if(boss.alive&&boss.active&&!k.dead&&boss.hitT===0&&over({x:k.x-6,y:k.y-6,w:12,h:12},boss)){
      boss.hp--; boss.hitT=16; k.dead=true; state.hitstop=4; sfx('hit');
      if(boss.hp<=0){boss.alive=false;state.won=true;sfx('boss_roar');
        shakeScreen(16); flashScreen(14);
        say('Mantri parasta!',9999,'#9fe06a');} } }
  for(let i=pthrows.length-1;i>=0;i--){const k=pthrows[i]; if(k.dead||k.life<=0||k.x<0||k.x>WORLD)pthrows.splice(i,1);}

  for(const s of ethrows){ s.x+=s.vx; s.vy+=0.16; s.y+=s.vy; s.spin+=0.4;
    if(over({x:s.x-6,y:s.y-6,w:12,h:12},player)){
      if(parrying){ parrySuccess(s.x,s.y); pthrows.push({x:s.x,y:s.y,vx:-s.vx*1.3,spin:0,life:70}); s.dead=true; }
      else if(!invuln()){ hurtPlayer(s.vx>0?1:-1,1); s.dead=true; } } }
  for(let i=ethrows.length-1;i>=0;i--){const s=ethrows[i]; if(s.dead||s.y>DUNGEON_FLOOR+H||s.x<0||s.x>WORLD)ethrows.splice(i,1);}

  /* ---- free Muna -> cutscene ---- */
  if(state.won && !boss.alive && input.actionQ && Math.abs(player.x-cage.x)<90){
    enterCutscene();
  }
  input.actionQ=false;
}

/* ================= RENDER ================= */
export function drawWorld(){
  const t=state.t;
  state.cam = state.scene==='cutscene' ? WORLD-W-12
    : Math.max(0,Math.min(WORLD-W,player.x+player.w/2-W/2));
  if(state.scene==='cutscene')state.camY=DUNGEON_FLOOR-H*.78;
  const underground=state.camY>34;

  // screen shake — offsets the whole world layer, HUD stays anchored
  const sh=state.shake;
  const shx = sh>0.2 ? (Math.random()-0.5)*sh*2 : 0;
  const shy = sh>0.2 ? (Math.random()-0.5)*sh*2 : 0;
  ctx.save(); ctx.translate(shx,shy);

  drawSky(); drawBackground();
  if(underground)drawDungeonBackdrop(Math.min(1,state.camY/90));
  ctx.save(); ctx.translate(-state.cam,-state.camY);
  if(underground){drawDungeonArchitecture(true);drawGround({platforms:false,gaps:false,surface:false});}
  else {drawGround();drawDungeonArchitecture(false);}
  if(!underground)drawForegroundVillage();
  if(!underground)drawYak(yak);
  for(const m of momos) if(!m.got) drawMomo(m.x,m.y+Math.sin(t/12+m.x)*3,1.1);
  for(const d of drops) if(!d.got) drawBlade(d.x,d.y+Math.sin(t/9+d.x)*2,t/8,'#d9d2c4');
  for(const h of healDrops) if(!h.got) drawHealOrb(h.x,h.y+Math.sin(t/10+h.bob)*3);
  if(!paper.got) drawPaper(paper.x,paper.y);
  drawCage();
  for(const e of enemies) drawEnemy(e);
  if(boss.alive) drawBoss();
  for(const s of shocks){
    const w=s.big?16:10;
    const alpha=s.life/(s.big?28:40);
    ctx.fillStyle=`rgba(255,200,80,${alpha*0.8})`;
    ctx.fillRect(s.x-w/2,s.y,w,10);
  }
  for(const s of shots){ctx.fillStyle='#d8d0c0';ctx.fillRect(s.x,s.y,12,9);}
  for(const k of pthrows) drawBlade(k.x,k.y,k.spin,'#eef0f4');
  for(const s of ethrows) drawBlade(s.x,s.y,s.spin||0,'#9fb0c0');
  if(state.scene==='cutscene') drawCutsceneActors(); else drawHari();
  drawSparks();
  ctx.restore();   // camera
  ctx.restore();   // shake

  if(state.scene==='cutscene'&&cs.shock>0){
    const age=78-cs.shock,cx=player.x+player.w/2-state.cam,cy=player.y+22-state.camY;
    if(age<5){ctx.fillStyle=`rgba(244,235,218,${0.26*(1-age/5)})`;ctx.fillRect(0,0,W,H);}
    const radius=10+Math.min(age,48)*4;
    ctx.strokeStyle=`rgba(224,204,168,${Math.max(0,.42-age/190)})`;ctx.lineWidth=2.2;
    ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=`rgba(210,115,87,${Math.max(0,.24-age/300)})`;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.arc(cx,cy,radius*.62,0,Math.PI*2);ctx.stroke();
    const pulse=.5+.5*Math.sin(age*.62);
    const vignette=ctx.createRadialGradient(cx,cy,60,cx,cy,Math.max(W,H)*.72);
    vignette.addColorStop(0,'rgba(20,12,15,0)');vignette.addColorStop(1,`rgba(48,16,19,${.18*pulse*(1-age/78)})`);
    ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  }

  drawSceneGrade();

  // impact flash, above the world but under the HUD
  if(state.flash>0){
    ctx.fillStyle=`rgba(255,255,255,${Math.min(0.5, state.flash/34)})`;
    ctx.fillRect(0,0,W,H);
  }
  if(state.scene==='cutscene'){
    ctx.fillStyle='#090b10';ctx.fillRect(0,0,W,22);ctx.fillRect(0,H-22,W,22);
    const vg=ctx.createRadialGradient(W/2,H/2,90,W/2,H/2,Math.max(W,H)*.72);
    vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.42)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  }
  if(boss.active&&!boss.started){
    const px=W/2,py=H-92;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(8,9,12,.82)';ctx.fillRect(px-170,py-18,340,38);
    ctx.strokeStyle='rgba(190,148,99,.78)';ctx.lineWidth=1;ctx.strokeRect(px-170,py-18,340,38);
    const controller=state.controlMode==='controller',key=controller?'✕':'Enter';
    drawControlBadge(key,px-31,py+1,controller,.9);
    ctx.fillStyle='#f1d5a4';ctx.font='bold 13px "Segoe UI",system-ui';ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText('Action',px-9,py+1);
    ctx.restore();
  }
}
