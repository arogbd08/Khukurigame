import {ctx} from '../canvas.js';
import {W, H, GROUND, WORLD,
        PARRY_DURATION, PARRY_ACTIVE, PARRY_COOLDOWN, PARRY_HITSTOP, PARRY_SHAKE,
        ULT_COST, ULT_MAX_CHARGES, ULT_DMG_NORMAL, ULT_DMG_HEAVY, ULT_DMG_BOSS,
        MOVES, COMBO_GAP, IAI_COOLDOWN} from '../config.js';
import {state, sub, say, toast, keys, input, clearQueued, diff,
        shakeScreen, flashScreen, burst, updateSparks, updateToasts, toasts} from '../state.js';
import {sfx, resumeBgm} from '../audio.js';
import {over} from '../utils.js';
import {player, plats, momos, paper, enemies, boss, cage, cadre,
        shots, pthrows, ethrows, drops, shocks, healDrops,
        resetEnemies, resetMomos} from '../entities.js';
import {drawSky, drawBackground, drawGround, drawMomo, drawBlade, drawHealOrb,
        drawPaper, drawCage, drawEnemy, drawBoss, drawHari, drawCutsceneActors,
        drawSparks} from '../render.js';
import {enterCutscene} from './CutsceneScene.js';

/* ================= HELPERS ================= */
function invuln(){return player.hurt>0||player.dodge>4||player.ult>4||player.move==='IAI';}
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

/* Nine Sols-flavoured deflect: freeze, shake, white flash, spark shower and a
   steel clang. Reads as a hard "stop" rather than a soft block. */
function parrySuccess(srcX, srcY){
  gainCharge();
  state.hitstop=PARRY_HITSTOP;
  shakeScreen(PARRY_SHAKE);
  flashScreen(9);
  player.parryFlash=10;
  sfx('parry');
  const px = srcX===undefined ? player.x+player.w/2+player.facing*18 : srcX;
  const py = srcY===undefined ? player.y+28 : srcY;
  // tight hot core + wide cool shower
  burst(px,py,14,{col:'#ffffff', speed:6.5, life:16, spread:6.283, grav:0.06});
  burst(px,py,20,{col:'#9fe0ff', speed:4.2, life:30, spread:6.283, grav:0.22});
  burst(px,py,8, {col:'#ffe9a8', speed:8.0, life:22, angle:player.facing>0?0:Math.PI, spread:1.5, grav:0.1});
  toast('TWAANG!  Pari  +1','#9fe0ff');
}

function killEnemy(en){
  en.alive=false; player.coins+=en.type==='heavy'?4:2; sfx('hit');
  shakeScreen(4);
  burst(en.x+en.w/2, en.y+en.h/2, 16, {col:'#d8c8a0', speed:4.5, life:26});
  for(let i=0;i<(en.type==='heavy'?5:3);i++) momos.push({x:en.x+i*9,y:GROUND-30,got:false});
  drops.push({x:en.x+en.w/2,y:GROUND-28,got:false});
  if(Math.random()<0.4) toast('Ek bhrasta kam bhayo.','#cfe0a0');
}

/* ================= COMBO ENGINE =================
   Light (J) and Heavy (K) feed a small move graph (MOVES in config.js). Inputs
   are buffered and chain at each move's cancel window, so a mistimed-early press
   still lands the next hit. A move plays out to `dur` then drops back to idle. */
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

  const L=input.lightQ, Hv=input.heavyQ, I=input.iaiQ;
  input.lightQ=input.heavyQ=input.iaiQ=false;
  const canAct = player.dodge<=0 && player.ult<=0 && player.hurt<=0;

  if(player.move){
    const mv=player.mv;
    player.atkT++;
    // iai draw whoosh right as the blade leaves the sheath
    if(mv.iai && player.atkT===mv.a0) sfx('spin_attack');
    // latest press wins as the buffered follow-up
    if(Hv) player.buffer='H'; else if(L) player.buffer='L';
    // chain once we're past the cancel window and the graph allows it
    if(player.atkT>=mv.cancel && player.buffer && mv.next && mv.next[player.buffer] && canAct){
      startMove(mv.next[player.buffer]); return;
    }
    if(player.atkT>=mv.dur){ player.move=null; player.mv=null; player.buffer=null; }
    return;
  }
  // idle → iai-jutsu (cooldown-gated) or open a string
  if(canAct){
    if(I && player.iaiCd<=0){ startMove('IAI'); player.iaiCd=IAI_COOLDOWN; toast('Iai-jutsu!','#cfe7ff'); }
    else if(Hv) startMove('H1');
    else if(L) startMove('L1');
  }
}
function cancelCombo(){ player.move=null; player.mv=null; player.buffer=null; }
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
    move:null,mv:null,atkT:0,atkId:0,iaiCd:0,buffer:null,comboCount:0,comboTimer:0,
    walkPhase:0,breathe:0,squash:0,parryFlash:0,throwAnim:0,turnLean:0,atkLean:0});
  resetEnemies(); resetMomos(); paper.got=false;
  Object.assign(boss,{x:4760,hp:18,maxHp:18,dir:-1,state:'wait',timer:60,hitT:0,
    alive:true,active:false,phase:1,vx:0,vy:0,summoned:0,spinT:0,rageT:0,enrageFlash:0,stomp:0,anim:0,lastAtkId:-1});
  shots.length=pthrows.length=ethrows.length=drops.length=shocks.length=healDrops.length=0;
  toasts.length=0;
  state.won=false; state.lost=false; state.hitstop=0; state.t=0; state.scene='play';
  state.introLine=-1; state.shake=0; state.flash=0;
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
  if(state.lost){ clearQueued(); return; }
  if(state.hitstop>0){ state.hitstop--; clearQueued(); return; }
  state.t++;
  const t=state.t;

  /* ---- dodge / ultimate / movement ---- */
  const sp=3.3;
  if(player.dodgeCd>0)player.dodgeCd--;
  if(player.parryCd>0)player.parryCd--;
  if(player.throwCd>0)player.throwCd--;
  if(player.iaiCd>0)player.iaiCd--;
  if(player.parry>0)player.parry--;
  if(player.parryFlash>0)player.parryFlash--;
  if(player.throwAnim>0)player.throwAnim--;
  if(player.squash>0)player.squash=Math.max(0,player.squash-0.09);
  player.breathe+=0.06;

  // ULT — now a one-charge special. Cheaper to fire, so it hits softer.
  if(input.ultQ && player.ult<=0 && player.charges>=ULT_COST){
    player.ult=24; player.charges-=ULT_COST; sfx('ult');
    shakeScreen(7); flashScreen(6);
    burst(player.x+player.w/2, player.y+28, 22,
      {col:'#ffd24a', speed:6, life:28, angle:player.facing>0?0:Math.PI, spread:2.4});
    toast('Khukuri prahar!','#ffd24a');
  }
  input.ultQ=false;

  if(input.dodgeQ && player.dodge===0 && player.dodgeCd===0 && player.ult<=0){
    player.dodge=16; player.dodgeCd=42; cancelCombo();   // dodge cancels the current attack (flow)
    player.dodgeDir=keys['KeyA']?-1:keys['KeyD']?1:player.facing;
    player.facing=player.dodgeDir;
  }
  input.dodgeQ=false;

  if(player.ult>0){ player.vx=player.facing*(player.ult>8?12:4); player.ult--; }
  else if(player.dodge>0){ player.vx=player.dodgeDir*6.8; player.dodge--; }
  else { if(keys['KeyA']){player.vx=-sp;player.facing=-1;}
    else if(keys['KeyD']){player.vx=sp;player.facing=1;} else player.vx=0; }

  if(input.jumpQ && player.jumps>0){
    player.vy=-10.6;player.jumps--;player.onGround=false;sfx('jump');
    player.squash=-0.35;  // negative squash = stretch on take-off
    burst(player.x+player.w/2, player.y+player.h, 6,
      {col:'#c8bb98', speed:2.2, life:16, angle:Math.PI/2, spread:2.4, grav:0.1});
  }
  input.jumpQ=false;

  player.wasOnGround=player.onGround;
  player.vy+=0.55; const ob=player.y+player.h;
  player.x+=player.vx; player.y+=player.vy;
  player.x=Math.max(0,Math.min(WORLD-player.w,player.x));
  player.onGround=false;
  if(player.y+player.h>=GROUND){player.y=GROUND-player.h;player.vy=0;player.onGround=true;}
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

  /* ---- combo attacks (Light J / Heavy K) + throw (I) ---- */
  updateCombo();
  // build the live hitbox + its stats from the current move's active window
  let hb=null, hbDmg=1, hbKb=6, hbStop=3, hbHeavy=false;
  if(player.move){
    const mv=player.mv;
    // forward drift on heavy swings so they feel like they step into the blow
    if(mv.lunge && player.atkT>=mv.a0 && player.atkT<=mv.a1) player.x+=player.facing*mv.lunge;
    if(player.atkT>=mv.a0 && player.atkT<=mv.a1){
      const r=mv.reach;
      hb={x: player.facing===1 ? player.x+player.w-6 : player.x+player.w-6-r, y:player.y-6, w:r, h:62};
      hbDmg=mv.dmg; hbKb=mv.kb; hbStop=mv.hitstop; hbHeavy=!!mv.heavy;
    }
  }
  if(player.ult>4){ const u=player.facing===1?player.x+player.w-10:player.x-66;
    hb={x:u,y:player.y-10,w:76,h:74}; }
  if(input.throwQ && player.throwCd===0 && player.ammo>0){
    player.throwCd=18; player.ammo--; sfx('throw'); player.throwAnim=10;
    pthrows.push({x:player.x+player.w/2,y:player.y+22,vx:player.facing*9,spin:0,life:80}); }
  input.throwQ=false;
  if(player.hurt>0)player.hurt--;

  /* ---- momo / paper / drops / heals ---- */
  for(const m of momos){ if(!m.got && Math.abs(player.x+player.w/2-m.x)<24 && Math.abs(player.y+30-m.y)<42){
    m.got=true; player.coins++; sfx('pickup');
    if(player.coins%diff().momoHeal===0 && player.hp<player.maxHp){ player.hp++; sfx('heal');
      toast('Momo khaen  +1 HP','#9fe06a'); }
  } }
  if(!paper.got && Math.abs(player.x+player.w/2-paper.x)<26 && Math.abs(player.y+24-paper.y)<46){
    paper.got=true; sfx('paper');
    say('Kagajma eutai shabda lekheko cha:  "rabindra winner"',260,'#f0e0a0');
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
    const dx=player.x-e.x, dist=Math.abs(dx), near=dist<200 && Math.abs(player.y-e.y)<80;

    // THUG: fast, can dodge away when hit
    // HEAVY: slow, big slam radius
    // difficulty scales patrol/approach speed (Warrior enemies press harder)
    const spd = (e.type==='thug'?1.4 : e.type==='heavy'?0.6 : 0.9) * diff().enemySpeed;
    // walk-cycle phase, driven by however fast this one is actually moving
    if(e.state==='patrol') e.anim += spd*0.16;
    else if(e.state==='lunge') e.anim += Math.abs(e.vx)*0.14;

    if(e.state==='patrol'){
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
        sfx('stomp'); shocks.push({x:e.x,y:GROUND-14,vx:-7,life:28,big:true});
        shocks.push({x:e.x,y:GROUND-14,vx:7,life:28,big:true});
        e.state='recover'; e.timer=55;
      }
    } else if(e.state==='leap'){
      e.vy+=0.5; e.x+=e.vx; e.y+=e.vy;
      if(e.y>=GROUND-e.h){e.y=GROUND-e.h;e.vy=0;e.state='recover';e.timer=34;}
    } else { if(--e.timer<=0)e.state='patrol'; }
    e.x=Math.max(40,Math.min(WORLD-40,e.x));

    // combo swings gate per-swing (each connects once); ult gates on time
    const eGate = player.ult>4 ? e.hitT===0 : e.lastAtkId!==player.atkId;
    if(hb && eGate && over(hb,e)){
      if(player.ult<=4) e.lastAtkId=player.atkId;
      const d=player.ult>4?(e.type==='heavy'?ULT_DMG_HEAVY:ULT_DMG_NORMAL):hbDmg;
      e.hp-=d; e.hitT=14; state.hitstop=Math.max(state.hitstop, player.ult>4?3:hbStop);
      e.x+=player.facing*(player.ult>4?12:hbKb);
      sfx('hit'); shakeScreen(hbHeavy?5:3);
      burst(e.x+e.w/2, e.y+e.h/2, hbHeavy?14:9,
        {col:'#ffd9a0', speed:hbHeavy?5.5:4, life:hbHeavy?24:18, angle:player.facing>0?0:Math.PI, spread:2.6});
      registerComboHit();
      // THUG tries to dodge when hit
      if(e.type==='thug' && e.hp>0 && e.dodgeCd===0 && Math.random()<0.45){
        e.x+=e.dir*-40; e.dodgeCd=40; e.state='recover'; e.timer=28;
      }
      if(e.hp<=0) killEnemy(e);
    }
    for(const k of pthrows){ if(!k.dead && e.hitT===0 && k.x<e.x+e.w&&k.x>e.x&&k.y>e.y&&k.y<e.y+e.h){
      e.hp--; e.hitT=14; state.hitstop=3; k.dead=true; sfx('hit'); if(e.hp<=0) killEnemy(e); } }

    const attacking=(e.state==='lunge'||e.state==='leap'||e.state==='slam');
    if(attacking && over(player,e)){
      if(parrying){
        parrySuccess((player.x+e.x+e.w/2)/2, player.y+28);
        // deflect staggers the attacker hard and knocks it back — the reward
        // for a read, and what makes parry preferable to dodging
        e.state='recover'; e.timer=70; e.hitT=14; e.vx=0;
        e.x += (dx>0?1:-1)*22;
      }
      else if(!invuln()) hurtPlayer(dx>0?-1:1, e.type==='heavy'?2 : e.state==='lunge'?1:2);
    }
  }

  /* ====== BOSS — 3 PHASES, 18 HP ====== */
  if(player.x>4500) boss.active=true;
  if(boss.alive && boss.active){
    if(boss.hitT>0)boss.hitT--;
    if(boss.enrageFlash>0)boss.enrageFlash--;

    // Phase transitions
    const hpPct=boss.hp/boss.maxHp;
    if(boss.phase===1 && hpPct<0.66){
      boss.phase=2; boss.enrageFlash=40; sfx('boss_roar'); shakeScreen(10);
      say('Mantri: "Bajet khaeko manchhelai marchhas?!"',0,'#ff9a6a');
      spawnHealDrop(boss.x-80, GROUND-26); // reward for reaching phase 2
    }
    if(boss.phase===2 && hpPct<0.33){
      boss.phase=3; boss.enrageFlash=60; sfx('boss_roar'); shakeScreen(13);
      say('Mantri: "Ta marchhas! Ma sadhain banchhu!!!"',0,'#ff5050');
      spawnHealDrop(boss.x+80, GROUND-26);
    }

    const dx=player.x-boss.x; boss.dir=dx>0?1:-1;
    const spd = (boss.phase===3?2.2:boss.phase===2?1.7:1.3) * diff().enemySpeed;
    // approach speed
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
      }
    }

    // SLASH — quick dash slash
    else if(boss.state==='slash_tel'){ if(--boss.timer<=0){boss.state='slash';boss.timer=boss.phase===3?18:24;sfx('slash');} }
    else if(boss.state==='slash'){
      const dspd=boss.phase===3?8:boss.phase===2?6.5:5.2;
      boss.x+=boss.dir*dspd; boss.anim+=dspd*0.12;
      if(over(player,boss)){
        if(parrying){
          parrySuccess((player.x+boss.x+boss.w/2)/2, player.y+28);
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
          parrySuccess((player.x+boss.x+boss.w/2)/2, player.y+28);
          boss.vx=-boss.dir*3;
        }
        else if(!invuln()&&!parrying) hurtPlayer(boss.dir,1);
      }
      if(boss.y>=GROUND-boss.h){
        boss.y=GROUND-boss.h; sfx('stomp'); shakeScreen(9);
        burst(boss.x+boss.w/2, GROUND, 18, {col:'#c8b088', speed:5, life:24, angle:0, spread:6.283});
        const range=boss.phase===3?3:boss.phase===2?2:1;
        for(let i=0;i<range;i++){
          shocks.push({x:boss.x,y:GROUND-14,vx:-(6+i*2),life:38+i*8});
          shocks.push({x:boss.x,y:GROUND-14,vx:6+i*2,life:38+i*8});
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
          parrySuccess((player.x+boss.x+boss.w/2)/2, player.y+28);
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
      if(boss.y>=GROUND-boss.h){
        boss.y=GROUND-boss.h; sfx('shockwave');
        const n=boss.phase===3?5:boss.phase===2?3:2;
        for(let i=1;i<=n;i++){
          shocks.push({x:boss.x,y:GROUND-14,vx:-(4+i*2),life:50+i*5});
          shocks.push({x:boss.x,y:GROUND-14,vx:4+i*2,life:50+i*5});
        }
        boss.state='wait'; boss.timer=85;
      }
    }

    boss.x=Math.max(4520,Math.min(WORLD-80,boss.x));

    const bGate = player.ult>4 ? boss.hitT===0 : boss.lastAtkId!==player.atkId;
    if(hb && bGate && over(hb,boss)){
      if(player.ult<=4) boss.lastAtkId=player.atkId;
      const d=player.ult>4?ULT_DMG_BOSS:hbDmg;
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
        for(let i=0;i<8;i++) momos.push({x:boss.x-30+i*10,y:GROUND-30,got:false});
        player.hp=Math.min(player.maxHp,player.hp+3); player.ammo=player.maxAmmo;
        spawnHealDrop(boss.x, GROUND-26);
        say('Mantri parasta! Munalai fukau. (F)',9999,'#9fe06a');
      }
    }
    if(!boss.alive) {} else {
      for(const k of pthrows){ if(!k.dead&&boss.hitT===0&&over({x:k.x-6,y:k.y-6,w:12,h:12},boss)){
        boss.hp--; boss.hitT=16; k.dead=true; state.hitstop=5; sfx('hit'); if(boss.hp<=0){
          boss.alive=false; state.won=true; sfx('boss_roar');
          shakeScreen(16); flashScreen(14);
          player.hp=Math.min(player.maxHp,player.hp+3);
          say('Mantri parasta! (F)',9999,'#9fe06a');
        } } }
    }
    // phase 3 — boss summons helper
    if(boss.phase===3 && boss.alive && t%480===0 && enemies.filter(e=>e.alive).length<2){
      const c=cadre(boss.x-120,'cadre'); c.min=c.x-60;c.max=c.x+90; enemies.push(c);
      toast('Mantri: "Karyakarta ho, aau!"','#ff9a6a');
    }
  }

  // shockwaves — parryable like everything else; a deflect shatters the wave
  for(const s of shocks){
    s.x+=s.vx; s.life--;
    const sz=s.big?20:16;
    if(!s.dead && Math.abs(player.x+player.w/2-s.x)<sz && player.onGround){
      if(parrying){
        parrySuccess(s.x, GROUND-16);
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
  for(let i=shots.length-1;i>=0;i--){const s=shots[i]; if(s.dead||s.y>GROUND||s.x<0||s.x>WORLD)shots.splice(i,1);}

  for(const k of pthrows){ k.x+=k.vx; k.spin+=0.5; k.life--;
    if(boss.alive&&boss.active&&!k.dead&&boss.hitT===0&&over({x:k.x-6,y:k.y-6,w:12,h:12},boss)){
      boss.hp--; boss.hitT=16; k.dead=true; state.hitstop=4; sfx('hit');
      if(boss.hp<=0){boss.alive=false;state.won=true;sfx('boss_roar');
        shakeScreen(16); flashScreen(14);
        say('Mantri parasta! (F)',9999,'#9fe06a');} } }
  for(let i=pthrows.length-1;i>=0;i--){const k=pthrows[i]; if(k.dead||k.life<=0||k.x<0||k.x>WORLD)pthrows.splice(i,1);}

  for(const s of ethrows){ s.x+=s.vx; s.vy+=0.16; s.y+=s.vy; s.spin+=0.4;
    if(over({x:s.x-6,y:s.y-6,w:12,h:12},player)){
      if(parrying){ parrySuccess(s.x,s.y); pthrows.push({x:s.x,y:s.y,vx:-s.vx*1.3,spin:0,life:70}); s.dead=true; }
      else if(!invuln()){ hurtPlayer(s.vx>0?1:-1,1); s.dead=true; } } }
  for(let i=ethrows.length-1;i>=0;i--){const s=ethrows[i]; if(s.dead||s.y>GROUND||s.x<0||s.x>WORLD)ethrows.splice(i,1);}

  /* ---- free Muna -> cutscene ---- */
  if(state.won && !boss.alive && input.freeQ && Math.abs(player.x-cage.x)<90){
    enterCutscene();
  }
  input.freeQ=false;
}

/* ================= RENDER ================= */
export function drawWorld(){
  const t=state.t;
  state.cam = state.scene==='cutscene' ? WORLD-W
    : Math.max(0,Math.min(WORLD-W,player.x+player.w/2-W/2));

  // screen shake — offsets the whole world layer, HUD stays anchored
  const sh=state.shake;
  const shx = sh>0.2 ? (Math.random()-0.5)*sh*2 : 0;
  const shy = sh>0.2 ? (Math.random()-0.5)*sh*2 : 0;
  ctx.save(); ctx.translate(shx,shy);

  drawSky(); drawBackground();
  ctx.save(); ctx.translate(-state.cam,0);
  drawGround();
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

  // impact flash, above the world but under the HUD
  if(state.flash>0){
    ctx.fillStyle=`rgba(255,255,255,${Math.min(0.5, state.flash/34)})`;
    ctx.fillRect(0,0,W,H);
  }
}
