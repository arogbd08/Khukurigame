import {ctx} from '../canvas.js?v=20261002-23';
import {W, H, GROUND} from '../config.js?v=20261002-23';
import {state, say, sub, shakeScreen, flashScreen} from '../state.js?v=20261002-23';
import {sfx, cutBgm, resumeBgm} from '../audio.js?v=20261002-23';
import {cs, cage, player} from '../entities.js?v=20261002-23';
import {drawControlBadge} from '../render.js?v=20261002-23';

/* Dialogue is player-paced: each line stays up until Enter is pressed.
   `onShow` fires once, when that line first appears. */
const LINES = [
  {t:'Hari: "Muna! Ma aye! Maile mantri ko Satyanas gare Aba Hamro maya lai kosaile rokna sakdaina"', c:'#e8d9b5'},
  {t:'Muna: "Hari Dhanyabad ... tara... timilai euta kura bhannu cha."', c:'#ffd0e0'},
  {t:'Muna: "Timro maya ma suikarna sakdina — mero mutu arkaisanga cha."', c:'#ffd0e0'},
  {t:'Hari: "Ke?! Arko... ko?!"', c:'#e8d9b5'},
  {t:'Muna: "Raju!"', c:'#ffd0e0', onShow(){ cs.rajuIn=true; sfx('rizz'); }},
  {t:'Raju: "Ke chaaaa mero baaby — hinda na, Kathmandu jaaun kina late garira"', c:'#bfe0ff'},
  {t:'Muna: "La hus Hari! Bheti rakhumla! Au Raju Jum"', c:'#ffd0e0'},
  {t:'Hari: "...muji."', c:'#f0e0a0', onShow(){ sfx('sad'); }}
];

// from this line on, Muna and Raju walk off together
const LEAVE_FROM = 7;
// the line where Raju speaks — he must be on screen and beside Muna by then
const RAJU_SPEAKS = 5;
// where Raju stops once he's sauntered in, and how fast he gets there.
// Speed is tuned for manual pacing: the player can advance faster than any
// timed walk-in, so he arrives in well under a second.
const RAJU_STOP = 52;
const RAJU_SPEED = 3.2;

function showLine(i){
  const L=LINES[i];
  if(!L) return;
  if(i===2){
    cutBgm();cs.shock=78;shakeScreen(8);flashScreen(8);sfx('shock');
  }
  say(L.t, 9999, L.c);   // sticky — only Enter clears it
  if(L.onShow) L.onShow();
}

export function enterCutscene(){
  state.scene='cutscene'; cs.t=0; cs.i=0;cs.shock=0;
  cs.hari.x=player.x; cs.muna.x=cage.x; cs.muna.y=cage.y;
  cs.raju.x=cage.x+240; cs.raju.y=cage.y; cs.rajuIn=false;cs.rajuArrived=false;sfx('scene_whoosh');
  showLine(0);
}

// Called from the Enter key handler in main.js.
export function advanceCutscene(){
  cs.i++;
  if(cs.i>=LINES.length){
    state.scene='credits'; state.t=0; resumeBgm();
    sub.t=0;
    return;
  }
  showLine(cs.i);
}

export function updateCutscene(){
  cs.t++;   // still ticks, for idle animation and the prompt blink
  if(cs.shock>0)cs.shock--;
  if(state.flash>0)state.flash--;
  if(state.shake>0)state.shake*=0.78;

  // Raju saunters in and stops beside Muna
  if(cs.rajuIn && cs.i<LEAVE_FROM){
    const target=cage.x+RAJU_STOP;
    if(cs.raju.x>target) cs.raju.x=Math.max(target, cs.raju.x-RAJU_SPEED);
    // Failsafe: the player can mash Enter faster than he can walk. He must not
    // deliver his line from off-camera, so snap him in once it's his turn.
    if(cs.i>=RAJU_SPEAKS && cs.raju.x>target) cs.raju.x=target;
    if(cs.raju.x<=target&&!cs.rajuArrived){cs.rajuArrived=true;sfx('paper');}
  }
  // once Hari is left with his one word, the two of them stroll off
  if(cs.i>=LEAVE_FROM){ cs.muna.x+=1.7; cs.raju.x+=1.7; }
}

/* Blinking Action affordance, pinned to the right edge of the subtitle bar. */
export function drawCutscenePrompt(){
  if(state.scene!=='cutscene') return;
  const a=0.45+0.55*Math.abs(Math.sin(cs.t/16));
  ctx.save();
  ctx.globalAlpha=a;
  const controller=state.controlMode==='controller',key=controller?'✕':'Enter';
  drawControlBadge(key,W-86,39,controller,.9);
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#9fe06a';ctx.font='bold 11px system-ui';
  ctx.fillText('Action',W-66,39);
  ctx.restore();
  ctx.textAlign='left';
}
