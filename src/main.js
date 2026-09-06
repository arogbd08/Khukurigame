/* ================= PHASER BOOTSTRAP =================
   The game was ported onto Phaser 3 as its shell:
     - Phaser owns the game loop, the scene lifecycle and the display surface.
     - Logic still runs on a FIXED 60Hz step (accumulator below) so every
       frame-counter tuning value (atk=18, parry windows, boss timers, ...) is
       preserved byte-for-byte — Phaser's variable rAF never touches game feel.
     - All rendering stays procedural Canvas 2D in render.js / the scenes. Those
       draw into the offscreen `cv` (canvas.js); Phaser shows `cv` as a live
       texture and re-uploads it each frame via texture.refresh().
   Input stays on DOM listeners: the edge-trigger (`!e.repeat`) timing and the
   first-gesture audio unlock are exact and browser-correct as-is. */
import {cv} from './canvas.js';
import {W, H} from './config.js';
import {state, keys, input} from './state.js';
import {audio, resumeAudio, startBgm, syncBgmMute} from './audio.js';
import {updateIntro, drawIntro} from './scenes/BootScene.js';
import {updatePlay, drawWorld, reset} from './scenes/GameScene.js';
import {updateCutscene, advanceCutscene, drawCutscenePrompt} from './scenes/CutsceneScene.js';
import {drawCredits} from './scenes/CreditsScene.js';
import {drawHUD, drawSubtitle, drawToasts} from './render.js';

const STEP = 1000/60;          // fixed logic tick (ms)
const MAX_STEPS = 5;           // clamp catch-up so a stall can't spiral

function startGame(){
  audio(); resumeAudio(); startBgm();
  state.scene='play'; reset();
}

/* ---- fixed-step logic dispatch (identical to the old setInterval loop) ---- */
function step(){
  if(state.scene==='intro'){ updateIntro(); return; }
  // cutscene lines are sticky until Enter — no sub.t decay here
  if(state.scene==='cutscene'){ updateCutscene(); return; }
  if(state.scene==='credits'){ return; }
  updatePlay();
}

/* ---- per-frame render dispatch (identical draw calls to the old rAF loop) ---- */
function draw(){
  if(state.scene==='intro'){ drawIntro(); return; }
  if(state.scene==='credits'){ drawCredits(); return; }
  drawWorld();
  drawHUD();
  drawToasts();
  drawSubtitle();
  drawCutscenePrompt();
}

/* ================= INPUT (DOM — preserved verbatim from the pre-Phaser build) ================= */
function wireInput(scene){
  addEventListener('keydown',e=>{
    if(['Space','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
    startBgm();   // first gesture unblocks autoplay; no-op afterwards
    // intro: pick difficulty (1 Casual / 2 Warrior) or start on the default
    if(state.scene==='intro'){
      if(e.code==='Digit1'||e.code==='Numpad1'){ state.difficulty='casual';  return startGame(); }
      if(e.code==='Digit2'||e.code==='Numpad2'){ state.difficulty='warrior'; return startGame(); }
      if(e.code==='Enter'||e.code==='Space') return startGame();
    }
    // cutscene dialogue is player-paced — Enter steps to the next line
    if(state.scene==='cutscene'){
      if(e.code==='Enter' && !e.repeat) advanceCutscene();
      if(e.code!=='KeyR' && e.code!=='KeyM') return;
    }
    if((e.code==='KeyW'||e.code==='Space') && !e.repeat) input.jumpQ=true;
    if(e.code==='KeyJ' && !e.repeat) input.lightQ=true;    // Light attack
    if(e.code==='KeyK' && !e.repeat) input.heavyQ=true;    // Heavy attack
    if(e.code==='KeyI' && !e.repeat) input.throwQ=true;    // khukuri throw (moved off K)
    if(e.code==='KeyO' && !e.repeat) input.iaiQ=true;      // iai-jutsu
    if(e.code==='KeyL' && !e.repeat) input.parryQ=true;
    if(e.code==='KeyU' && !e.repeat) input.ultQ=true;
    if(e.code==='KeyF' && !e.repeat) input.freeQ=true;
    if((e.code==='ShiftLeft'||e.code==='ShiftRight') && !e.repeat) input.dodgeQ=true;
    if(e.code==='KeyR') reset();
    if(e.code==='KeyM' && !e.repeat){ state.muted=!state.muted; syncBgmMute(); }
    keys[e.code]=true;
  });
  addEventListener('keyup',e=>keys[e.code]=false);
  scene.game.canvas.addEventListener('mousedown',()=>{ startBgm(); if(state.scene==='intro') startGame(); });
}

/* ================= PHASER SCENE ================= */
class MainScene extends Phaser.Scene {
  constructor(){ super('main'); this.acc=0; }
  create(){
    // register the offscreen render buffer as a texture and blit it to the screen
    this.textures.addCanvas('frame', cv);
    this.add.image(0,0,'frame').setOrigin(0,0);
    this.frameTex = this.textures.get('frame');
    wireInput(this);
  }
  update(time, delta){
    this.acc += delta;
    let n=0;
    while(this.acc >= STEP && n < MAX_STEPS){ step(); this.acc -= STEP; n++; }
    if(this.acc > STEP*MAX_STEPS) this.acc = 0;   // dropped frames: resync rather than spiral
    draw();
    this.frameTex.refresh();   // re-upload the freshly drawn canvas
  }
}

/* ================= GAME ================= */
new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game',
  backgroundColor: '#211810',
  banner: false,
  scene: MainScene
});
