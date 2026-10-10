import {ctx} from '../canvas.js?v=20261010-4';
import {W, H} from '../config.js?v=20261010-4';
import {state, say, sub, shakeScreen, flashScreen} from '../state.js?v=20261010-4';
import {sfx, cutBgm, resumeBgm} from '../audio.js?v=20261010-4';
import {cs, cage, player} from '../entities.js?v=20261010-4';
import {drawControlBadge} from '../render.js?v=20261010-4';

/* Dialogue stays player-paced. The final beat branches after Muna says goodbye. */
const LINES = [
  {t:'Hari: "Muna! Ma aye! Maile mantri ko Satyanas gare Aba Hamro maya lai kosaile rokna sakdaina"', c:'#e8d9b5'},
  {t:'Muna: "Hari Dhanyabad ... tara... timilai euta kura bhannu cha."', c:'#ffd0e0'},
  {t:'Muna: "Timro maya ma suikarna sakdina — mero mutu arkaisanga cha."', c:'#ffd0e0'},
  {t:'Hari: "Ke?! Arko... ko?!"', c:'#e8d9b5'},
  {t:'Muna: "Raju!"', c:'#ffd0e0', onShow(){ cs.rajuIn=true; sfx('rizz'); }},
  {t:'Raju: "Ke chaaaa mero baaby — hinda na, Kathmandu jaaun kina late garira"', c:'#bfe0ff'},
  {t:'Muna: "La hus Hari! Bheti rakhumla! Au Raju Jum"', c:'#ffd0e0'}
];
const LEAVE_LINE={t:'Hari: "...muji."',c:'#f0e0a0',onShow(){cs.action='leave';cs.actionT=0;sfx('sad');}};
const PUNCH_LINES=[
  {t:'Hari: "Ko hos ta? Ma bata Muna chorne? Feri?!"',c:'#e8d9b5',onShow(){cs.action='punch';cs.actionT=0;}},
  {t:'Raju: "Ae! Ke gareko?!"',c:'#bfe0ff',onShow(){cs.action='recoil';cs.actionT=0;}},
  {t:'Muna: "Hari! Timile Raju lai kina hanyo?!"',c:'#ffd0e0',onShow(){cs.action='slap';cs.actionT=0;}},
  {t:'Muna: "Ma timisanga jadina! Raju, jau!"',c:'#ffd0e0',onShow(){cs.action='run';cs.actionT=0;}}
];
const RAJU_SPEAKS=5, RAJU_STOP=28, RAJU_SPEED=3.2;
const choiceButtons=[{x:W/2-190,y:H-142,w:180,h:48},{x:W/2+10,y:H-142,w:180,h:48}];

function showLine(i){
  const L=cs.endingChoice==='punch'?PUNCH_LINES[i-7]:i===7?LEAVE_LINE:LINES[i];
  if(!L)return;
  if(i===2){cutBgm();cs.shock=78;shakeScreen(8);flashScreen(8);sfx('shock');}
  say(L.t,9999,L.c);
  if(L.onShow)L.onShow();
}

export function enterCutscene(){
  state.scene='cutscene';cs.t=0;cs.i=0;cs.shock=0;
  player.x=cage.x-50;player.y=cage.y-6;player.vx=0;player.vy=0;player.facing=1;player.onGround=true;
  player.move=null;player.mv=null;player.ult=0;player.parry=0;player.dodge=0;player.atkT=0;player.cinematicPose=null;
  cs.muna.x=cage.x;cs.muna.y=cage.y;
  cs.raju.x=cage.x+240;cs.raju.y=cage.y;cs.rajuIn=false;cs.rajuArrived=false;
  cs.choiceActive=false;cs.choiceFocus=0;cs.endingChoice=null;cs.action='';cs.actionT=0;
  sfx('scene_whoosh');showLine(0);
}

function chooseEnding(choice){
  if(!cs.choiceActive)return;
  cs.choiceActive=false;cs.endingChoice=choice;cs.i=7;cs.actionT=0;
  showLine(cs.i);
}

function finishCutscene(){
  state.scene='credits';state.t=0;resumeBgm();sub.t=0;
}

export function advanceCutscene(){
  if(cs.choiceActive){chooseEnding(cs.choiceFocus===0?'leave':'punch');return;}
  if(cs.i===6){
    cs.choiceActive=true;cs.choiceFocus=0;
    say(state.language==='en'?'Hari, what will you do?':'Hari, ke garne?',9999,'#f0e0a0');
    return;
  }
  // Let the key animated beats read before advancing their dialogue.
  if(cs.endingChoice==='punch'&&((cs.i===7&&cs.actionT<34)||(cs.i===8&&cs.actionT<18)||(cs.i===9&&cs.actionT<32)))return;
  if((cs.endingChoice==='leave'&&cs.i===7)||(cs.endingChoice==='punch'&&cs.i===10)){
    if(cs.actionT<(cs.endingChoice==='leave'?160:92))return;
    finishCutscene();return;
  }
  cs.i++;showLine(cs.i);
}

export function moveCutsceneChoice(direction){
  if(cs.choiceActive)cs.choiceFocus=direction==='left'?0:1;
}
export function handleCutsceneClick(x,y){
  if(!cs.choiceActive)return;
  if(inside(choiceButtons[0],x,y))chooseEnding('leave');
  else if(inside(choiceButtons[1],x,y))chooseEnding('punch');
}
function inside(b,x,y){return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;}

export function updateCutscene(){
  cs.t++;
  if(cs.shock>0)cs.shock--;
  if(state.flash>0)state.flash--;
  if(state.shake>0)state.shake*=0.78;
  if(cs.rajuIn&&cs.i<=6){
    const target=cage.x+RAJU_STOP;
    if(cs.raju.x>target)cs.raju.x=Math.max(target,cs.raju.x-RAJU_SPEED);
    if(cs.i>=RAJU_SPEAKS&&cs.raju.x>target)cs.raju.x=target;
    if(cs.raju.x<=target&&!cs.rajuArrived){cs.rajuArrived=true;sfx('paper');}
  }
  if(cs.action==='punch'&&cs.actionT===14){sfx('hit');shakeScreen(7);}
  if(cs.action==='slap'&&cs.actionT===11){sfx('hit');shakeScreen(9);flashScreen(7);}
  if(cs.action==='leave'||cs.action==='run'){
    const speed=cs.action==='run'?2.7:1.7;
    cs.muna.x+=speed;cs.raju.x+=speed;
  }
  cs.actionT++;
}

function drawChoice(){
  if(!cs.choiceActive)return;
  const en=state.language==='en';
  ctx.save();ctx.fillStyle='rgba(5,9,15,.88)';ctx.strokeStyle='rgba(207,173,112,.8)';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.roundRect(W/2-205,H-158,410,78,8);ctx.fill();ctx.stroke();
  for(let i=0;i<choiceButtons.length;i++){
    const b=choiceButtons[i],active=cs.choiceFocus===i;
    ctx.fillStyle=active?'rgba(218,177,94,.32)':'rgba(10,14,20,.82)';
    ctx.strokeStyle=active?'#efc66d':'rgba(224,215,194,.55)';ctx.lineWidth=active?2:1;
    ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,5);ctx.fill();ctx.stroke();
    ctx.fillStyle='#f4ead6';ctx.font='bold 13px "Segoe UI",system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(i===0?(en?'Let them leave':'Jana deu'):(en?'Punch Raju':'Raju lai hanna'),b.x+b.w/2,b.y+b.h/2);
  }
  ctx.restore();
}

export function drawCutscenePrompt(){
  if(state.scene!=='cutscene')return;
  drawChoice();
  const a=0.45+0.55*Math.abs(Math.sin(cs.t/16));
  ctx.save();ctx.globalAlpha=a;
  const controller=state.controlMode==='controller',key=controller?'✕':'Enter';
  drawControlBadge(key,W-86,39,controller,.9);
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#9fe06a';ctx.font='bold 11px system-ui';
  ctx.fillText(cs.choiceActive?(state.language==='en'?'Choose':'Chhannuhos'):'Action',W-66,39);
  if(cs.choiceActive){ctx.fillStyle='#d5c6aa';ctx.fillText(controller?'D-pad ← / →':'← / →',W-112,58);}
  ctx.restore();ctx.textAlign='left';
}
