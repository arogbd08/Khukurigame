/* ================= PHASER BOOTSTRAP =================
   The game was ported onto Phaser 3 as its shell:
     - Phaser owns the game loop, the scene lifecycle and the display surface.
     - Logic still runs on a FIXED 60Hz step (accumulator below) so every
       frame-counter tuning value (atk=18, parry windows, boss timers, ...) is
       preserved byte-for-byte — Phaser's variable rAF never touches game feel.
     - All rendering stays procedural Canvas 2D in render.js / the scenes. Those
       draw into the offscreen `cv` (canvas.js); Phaser shows `cv` as a live
       texture and re-uploads it each frame via texture.refresh().
   Keyboard/mouse input stays on DOM listeners; gamepads are polled once per
   rendered frame and their action buttons are edge-triggered. */
import {cv,ctx} from './canvas.js?v=20261010-4';
import {W, H} from './config.js?v=20261010-4';
import {state, keys, pad, input, clearQueued} from './state.js?v=20261010-4';
import {audio, resumeAudio, startBgm, syncBgmMute} from './audio.js?v=20261010-4';
import {updateIntro, drawIntro, handleIntroKey, handleIntroGamepad, handleIntroClick, setIntroPointer} from './scenes/BootScene.js?v=20261010-4';
import {updatePlay, drawWorld, reset} from './scenes/GameScene.js?v=20261010-4';
import {updateCutscene, advanceCutscene, drawCutscenePrompt, moveCutsceneChoice, handleCutsceneClick} from './scenes/CutsceneScene.js?v=20261010-4';
import {drawCredits} from './scenes/CreditsScene.js?v=20261010-4';
import {drawHUD, drawSubtitle, drawToasts} from './render.js?v=20261010-4';

const STEP = 1000/60;          // fixed logic tick (ms)
const MAX_STEPS = 5;           // clamp catch-up so a stall can't spiral
let lastControlsMarkup='';
function syncControlsStrip(){
  const strip=document.getElementById('controls-strip');
  if(strip)strip.hidden=!state.controlModeChosen;
  const row=document.getElementById('controls-items');
  const title=document.getElementById('controls-title');
  if(!row)return;
  const controller=state.controlMode==='controller';
  const ne=state.language!=='en';
  const label=(en,np)=>ne?np:en;
  const rows=controller?[
    [['LS / D-pad',label('Move','hidne')],['✕','Jump / Action']],
    [['○',label('Dodge','dodge')],['△','Ultimate']],
    [['□',label('Attack','prahar')],['L1',label('Block / Parry','rokne / parry')]]
  ]:[
    [['A / D',label('Move','hidne')],['W / Space',label('Jump','chhalne')]],
    [['Shift',label('Dodge','dodge')],['E','Ultimate']],
    [['Enter','Action'],['Right-click',label('Block / Parry','rokne / parry')]],
    [['Click',label('Attack','prahar')]]
  ];
  const faces={'✕':'cross','□':'square','○':'circle','△':'triangle'};
  const markup=rows.map(pair=>`<div class="controls-pair">${pair.map(([key,name])=>{
    const badge=controller&&faces[key]
      ?`<span class="control-key face ${faces[key]}">${key}</span>`
      :`<kbd class="control-key ${controller?'pad-key':''}">${key}</kbd>`;
    return `<span class="control-entry">${badge}<span>${name}</span></span>`;
  }).join('')}</div>`).join('');
  if(title)title.textContent=controller?'CONTROLS  ·  CONTROLLER':'CONTROLS  ·  KEYBOARD';
  if(markup!==lastControlsMarkup){row.innerHTML=markup;lastControlsMarkup=markup;}
}

function startGame(){
  audio(); resumeAudio(); startBgm();
  state.openingFade=30;
  state.scene='play'; reset();
}

/* ---- fixed-step logic dispatch (identical to the old setInterval loop) ---- */
function step(){
  if(state.scene==='intro'){ if(updateIntro())startGame(); return; }
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
  if(state.scene==='cutscene'){
    drawSubtitle();drawCutscenePrompt();return;
  }
  drawHUD();drawToasts();
  drawSubtitle();
  if(state.openingFade>0){ctx.fillStyle=`rgba(0,0,0,${state.openingFade/30})`;ctx.fillRect(0,0,W,H);state.openingFade--;}
}

/* ================= INPUT (DOM — preserved verbatim from the pre-Phaser build) ================= */
function wireInput(scene){
  addEventListener('keydown',e=>{
    if(['Space','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
    startBgm();   // first gesture unblocks autoplay; no-op afterwards
    // Start and input menus → language → difficulty → player-paced cinematic.
    if(state.scene==='intro'){
      if(!e.repeat)handleIntroKey(e.code);
      return;
    }
    // cutscene dialogue is player-paced — Enter steps to the next line
    if(state.scene==='cutscene'){
      if(!e.repeat&&(e.code==='ArrowLeft'||e.code==='ArrowRight'))moveCutsceneChoice(e.code==='ArrowLeft'?'left':'right');
      if(e.code==='Enter' && !e.repeat) advanceCutscene();
      if(e.code!=='KeyR' && e.code!=='KeyM') return;
    }
    if(state.scene==='play'&&e.code==='Enter'&&!e.repeat) input.actionQ=true;
    if((e.code==='KeyW'||e.code==='Space') && !e.repeat) input.jumpQ=true;
    if(e.code==='KeyE' && !e.repeat) input.ultQ=true;      // ult = iai-jutsu draw
    if((e.code==='ShiftLeft'||e.code==='ShiftRight') && !e.repeat) input.dodgeQ=true;
    if(e.code==='KeyR') reset();
    if(e.code==='KeyM' && !e.repeat){ state.muted=!state.muted; syncBgmMute(); }
    keys[e.code]=true;
  });
  addEventListener('keyup',e=>keys[e.code]=false);
  const releaseControls=()=>{
    for(const code in keys)keys[code]=false;
    pad.left=pad.right=false;
    input.guardMouse=false;input.guardPad=false;
    previousPadButtons.fill(false);previousPadLeft=previousPadRight=false;
    clearQueued();
  };
  addEventListener('blur',releaseControls);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseControls();});
  // Mouse combat: Left = attack, Right = hold guard / time a parry.
  const cvEl = scene.game.canvas;
  cvEl.addEventListener('contextmenu', e=>e.preventDefault());   // right-click parries, no menu
  const introPoint=e=>{
    const r=cvEl.getBoundingClientRect();
    return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};
  };
  cvEl.addEventListener('mousemove',e=>{const p=introPoint(e);setIntroPointer(p.x,p.y);});
  cvEl.addEventListener('mousedown', e=>{
    startBgm();
    if(state.scene==='intro'){
      if(e.button===0){const p=introPoint(e);handleIntroClick(p.x,p.y);}
      return;
    }
    if(state.scene==='cutscene'){
      if(e.button===0){const p=introPoint(e);handleCutsceneClick(p.x,p.y);}
      return;
    }
    if(state.scene==='credits')return;
    if(e.button===0) input.lightQ=true;
    else if(e.button===2){e.preventDefault();if(!input.guardMouse)input.parryQ=true;input.guardMouse=true;}
  });
  addEventListener('mouseup',e=>{if(e.button===2)input.guardMouse=false;});
}

// Standard Gamepad mapping uses PS button labels in the UI on every controller.
// Movement and L1 guard are held; combat/menu actions use press edges.
const previousPadButtons=[];
let previousPadLeft=false,previousPadRight=false,activePadIndex=null;
function pollGamepad(){
  let pads=null;
  try{pads=typeof navigator!=='undefined'&&navigator.getGamepads?navigator.getGamepads():null;}catch(_){pads=null;}
  const connected=pads?Array.from(pads).filter(p=>p&&p.connected):[];
  const isActive=p=>{
    const axes=p.axes||[];
    return Array.from(axes).some(v=>Math.abs(v||0)>.2)||Array.from(p.buttons||[]).some(b=>b&&(b.pressed||b.value>.25));
  };
  const controller=connected.find(p=>p.index===activePadIndex&&isActive(p))
    ||connected.find(isActive)
    ||connected.find(p=>p.index===activePadIndex)
    ||connected[0];
  if(!controller){
    pad.left=pad.right=false;input.guardPad=false;previousPadButtons.length=0;previousPadLeft=previousPadRight=false;activePadIndex=null;return;
  }
  if(controller.index!==activePadIndex){
    activePadIndex=controller.index;previousPadButtons.length=0;previousPadLeft=previousPadRight=false;
  }
  const down=i=>!!(controller.buttons[i]&&(controller.buttons[i].pressed||controller.buttons[i].value>0.5));
  const pressed=i=>{const now=down(i),was=!!previousPadButtons[i];previousPadButtons[i]=now;return now&&!was;};
  const axis=controller.axes&&Number.isFinite(controller.axes[0])?controller.axes[0]:0;
  const left=axis<-.25||down(14),right=axis>.25||down(15);
  const leftEdge=left&&!previousPadLeft,rightEdge=right&&!previousPadRight;
  previousPadLeft=left;previousPadRight=right;pad.left=left;pad.right=right;

  const cross=pressed(0),circle=pressed(1),square=pressed(2),triangle=pressed(3);
  const l1=pressed(4);
  input.guardPad=down(4);
  const usedController=cross||circle||square||triangle||l1||leftEdge||rightEdge;
  if(usedController){
    startBgm();
  }
  if(state.scene==='intro'){
    if(leftEdge)handleIntroGamepad('left');
    if(rightEdge)handleIntroGamepad('right');
    if(cross)handleIntroGamepad('confirm');
    return;
  }
  if(state.scene==='cutscene'){
    if(leftEdge)moveCutsceneChoice('left');
    if(rightEdge)moveCutsceneChoice('right');
    if(cross)advanceCutscene();
    return;
  }
  if(state.scene!=='play')return;
  if(cross){input.jumpQ=true;input.actionQ=true;}
  if(square)input.lightQ=true;
  if(circle)input.dodgeQ=true;
  if(l1)input.parryQ=true;
  if(triangle)input.ultQ=true;
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
    pollGamepad();
    syncControlsStrip();
    this.acc += delta;
    let n=0;
    while(this.acc >= STEP && n < MAX_STEPS){ step(); this.acc -= STEP; n++; }
    if(this.acc > STEP*MAX_STEPS) this.acc = 0;   // dropped frames: resync rather than spiral
    draw();
    this.frameTex.refresh();   // re-upload the freshly drawn canvas
  }
}

/* ================= GAME ================= */
syncControlsStrip();
new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game',
  backgroundColor: '#211810',
  banner: false,
  scene: MainScene
});
