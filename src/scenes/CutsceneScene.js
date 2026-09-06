import {ctx} from '../canvas.js';
import {W, H, GROUND} from '../config.js';
import {state, say, sub} from '../state.js';
import {sfx, stopBgm, resumeBgm} from '../audio.js';
import {cs, cage, player} from '../entities.js';

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
  say(L.t, 9999, L.c);   // sticky — only Enter clears it
  if(L.onShow) L.onShow();
}

export function enterCutscene(){
  state.scene='cutscene'; cs.t=0; cs.i=0;
  cs.hari.x=player.x; cs.muna.x=cage.x; cs.muna.y=GROUND-52;
  cs.raju.x=cage.x+240; cs.raju.y=GROUND-52; cs.rajuIn=false; sfx('sad');
  stopBgm();   // the rejection plays out in silence
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

  // Raju saunters in and stops beside Muna
  if(cs.rajuIn && cs.i<LEAVE_FROM){
    const target=cage.x+RAJU_STOP;
    if(cs.raju.x>target) cs.raju.x=Math.max(target, cs.raju.x-RAJU_SPEED);
    // Failsafe: the player can mash Enter faster than he can walk. He must not
    // deliver his line from off-camera, so snap him in once it's his turn.
    if(cs.i>=RAJU_SPEAKS && cs.raju.x>target) cs.raju.x=target;
  }
  // once Hari is left with his one word, the two of them stroll off
  if(cs.i>=LEAVE_FROM){ cs.muna.x+=1.7; cs.raju.x+=1.7; }
}

/* Blinking "press Enter" affordance, pinned to the right edge of the
   subtitle bar so it reads as part of the dialogue box. */
export function drawCutscenePrompt(){
  if(state.scene!=='cutscene') return;
  const a=0.45+0.55*Math.abs(Math.sin(cs.t/16));
  ctx.save();
  ctx.globalAlpha=a;
  ctx.textAlign='right';
  ctx.fillStyle='#9fe06a';
  ctx.font='bold 12px system-ui';
  const label = cs.i>=LINES.length-1 ? 'Enter ▸ credits' : 'Enter ▸';
  ctx.fillText(label, W/2+300, H-12);
  ctx.restore();
  ctx.textAlign='left';
}
