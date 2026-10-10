import {ctx} from '../canvas.js?v=20261010-4';
import {W,H,GROUND,introLines,STUPA_X,STUPA_SCALE} from '../config.js?v=20261010-4';
import {introLinesEn} from '../i18n.js?v=20261010-4';
import {state} from '../state.js?v=20261010-4';
import {player,cadre} from '../entities.js?v=20261010-4';
import {drawBackground,drawGround,drawHari,drawEnemy,drawMuna,drawVillager,drawHouse,drawDaraj,drawBoudha,drawHomeCutaway,drawSceneGrade,drawControlBadge} from '../render.js?v=20261010-4';

const MENU={title:'title',controls:'controls',language:'language',difficulty:'difficulty',story:'story',launch:'launch'};
const SHOT_COUNT=introLines.length, FADE=14;
const introRaider=cadre(0,'cadre');
const titleArt=new Image();
titleArt.src='assets/khukuri-title.jpg';
let menu=MENU.title,storyIndex=0,shotT=0,launchT=0,mouse={x:-1,y:-1},padFocus=0;
const startButton={x:W/2-100,y:30,w:200,h:46};
const keyboardChoice={x:W/2-144,y:166,w:136,h:48};
const controllerChoice={x:W/2+8,y:166,w:136,h:48};
const continueButton={x:W/2-100,y:285,w:200,h:42};
const casualButton={x:W/2-190,y:246,w:170,h:58};
const warriorButton={x:W/2+20,y:246,w:170,h:58};
const englishButton={x:W/2-190,y:246,w:170,h:58};
const nepaliButton={x:W/2+20,y:246,w:170,h:58};

export function updateIntro(){
  state.t++;
  if(menu===MENU.story)shotT++;
  if(menu===MENU.launch){launchT++;return launchT>=40;}
  return false;
}
function startStory(){menu=MENU.story;storyIndex=0;shotT=0;}
function chooseLanguage(value){state.language=value;document.documentElement.lang=value==='en'?'en':'ne';menu=MENU.difficulty;}
function chooseDifficulty(value){state.difficulty=value;startStory();}
export function handleIntroGamepad(action){
  if(menu===MENU.title){
    if(action==='confirm')menu=MENU.controls;return;
  }
  if(menu===MENU.controls){
    if(action==='left')padFocus=0;
    if(action==='right')padFocus=1;
    if(action==='confirm'){
      if(!state.controlModeChosen){state.controlMode=padFocus===0?'keyboard':'controller';state.controlModeChosen=true;}
      else menu=MENU.language;
    }
    return;
  }
  if(menu===MENU.language||menu===MENU.difficulty){
    if(action==='left')padFocus=0;
    if(action==='right')padFocus=1;
    if(action==='confirm')handleIntroKey(padFocus===0?'Digit1':'Digit2');
    return;
  }
  if(menu===MENU.story&&action==='confirm')handleIntroKey('Enter');
}
export function handleIntroKey(code){
  if(menu===MENU.title&&(code==='Enter'||code==='Space')){menu=MENU.controls;return;}
  if(menu===MENU.controls){
    if(code==='ArrowLeft')padFocus=0;if(code==='ArrowRight')padFocus=1;
    if(code==='Digit1'||code==='Numpad1'){padFocus=0;state.controlMode='keyboard';state.controlModeChosen=true;return;}
    if(code==='Digit2'||code==='Numpad2'){padFocus=1;state.controlMode='controller';state.controlModeChosen=true;return;}
    if(code==='Enter'||code==='Space'){
      if(!state.controlModeChosen){state.controlMode=padFocus===0?'keyboard':'controller';state.controlModeChosen=true;}
      else menu=MENU.language;
    }
    return;
  }
  if(menu===MENU.language){
    if(code==='ArrowLeft')padFocus=0;if(code==='ArrowRight')padFocus=1;
    if(code==='Enter'||code==='Space')code=padFocus===0?'Digit1':'Digit2';
    if(code==='Digit1'||code==='Numpad1')chooseLanguage('en');
    if(code==='Digit2'||code==='Numpad2')chooseLanguage('ne');
    return;
  }
  if(menu===MENU.story&&code==='Enter'){
    if(storyIndex<SHOT_COUNT-1){storyIndex++;shotT=0;}
    else{menu=MENU.launch;launchT=0;}
    return;
  }
  if(menu===MENU.difficulty){
    if(code==='ArrowLeft')padFocus=0;if(code==='ArrowRight')padFocus=1;
    if(code==='Enter'||code==='Space')code=padFocus===0?'Digit1':'Digit2';
    if(code==='Digit1'||code==='Numpad1')chooseDifficulty('casual');
    if(code==='Digit2'||code==='Numpad2')chooseDifficulty('warrior');
  }
}
export function setIntroPointer(x,y){mouse={x,y};}
export function handleIntroClick(x,y){
  if(menu===MENU.title&&inside(startButton,x,y)){menu=MENU.controls;return;}
  if(menu===MENU.controls&&inside(keyboardChoice,x,y)){state.controlMode='keyboard';state.controlModeChosen=true;padFocus=0;return;}
  if(menu===MENU.controls&&inside(controllerChoice,x,y)){state.controlMode='controller';state.controlModeChosen=true;padFocus=1;return;}
  if(menu===MENU.controls&&inside(continueButton,x,y)&&state.controlModeChosen){menu=MENU.language;return;}
  if(menu===MENU.language){if(inside(englishButton,x,y))chooseLanguage('en');if(inside(nepaliButton,x,y))chooseLanguage('ne');return;}
  if(menu===MENU.difficulty){
    if(inside(casualButton,x,y))chooseDifficulty('casual');
    if(inside(warriorButton,x,y))chooseDifficulty('warrior');
  }
}
function inside(b,x,y){return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;}

function drawBoundMuna(x,y){
  drawMuna(x,y);ctx.save();ctx.strokeStyle='#a78a65';ctx.lineWidth=3;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(x-9,y+25);ctx.lineTo(x+9,y+25);ctx.moveTo(x-9,y+39);ctx.lineTo(x+9,y+39);ctx.stroke();ctx.restore();
}
function drawStage(index,local,departure=false){
  const heartbeat=index===7?0.5+0.5*Math.sin(local*Math.PI*2/38):0;
  const zoom=1+heartbeat*.018;
  ctx.save();ctx.translate(W/2,H/2);ctx.scale(zoom,zoom);ctx.translate(-W/2,-H/2);
  const cam=departure?0:index===SHOT_COUNT-1?Math.min(140,local*.45):index>=6?Math.max(0,index*390-230):Math.max(0,index*180-80);
  const oldCam=state.cam;state.cam=cam;
  drawBackground();
  ctx.save();ctx.translate(-cam,0);
  if(index===3){
    // A distant city skyline pushes into the village valley: the source of the greed in the story.
    ctx.fillStyle='#171c25';
    for(let i=0;i<13;i++){const x=cam-100+i*76,h=44+(i*37%90);ctx.fillRect(x,GROUND-h,55,h);ctx.fillRect(x+17,GROUND-h-10,19,10);
      ctx.fillStyle='rgba(205,166,92,.42)';for(let wy=GROUND-h+12;wy<GROUND-8;wy+=18)ctx.fillRect(x+10,wy,5,7);ctx.fillStyle='#171c25';}
    ctx.strokeStyle='rgba(176,143,91,.5)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cam-20,GROUND-4);ctx.quadraticCurveTo(cam+W*.45,GROUND-38,cam+W+30,GROUND-6);ctx.stroke();
  }
  drawGround({platforms:false,gaps:false});
  const old={x:player.x,y:player.y,facing:player.facing,vx:player.vx,vy:player.vy,onGround:player.onGround,
    walkPhase:player.walkPhase,breathe:player.breathe,move:player.move,mv:player.mv,atkT:player.atkT,
    atkLean:player.atkLean,dodge:player.dodge,ult:player.ult,hurt:player.hurt,parry:player.parry,
    deathblow:player.deathblow,squash:player.squash,cinematicPose:player.cinematicPose,cinematicUnarmed:player.cinematicUnarmed};
  const leaving=departure||index===SHOT_COUNT-1;
  player.x=departure?60:index===2?cam+W*.49-14:leaving?cam+W*.32-14:index>=7?cam+W*.39-14:cam+W*.28-14;
  player.y=GROUND-58;player.facing=1;player.vx=leaving?1.4:0;player.vy=0;player.onGround=true;
  player.walkPhase=local/12;player.breathe=state.t/18;player.move=null;player.mv=null;player.atkT=0;player.atkLean=0;
  player.dodge=0;player.ult=0;player.hurt=0;player.parry=0;player.deathblow=0;player.squash=0;
  player.cinematicPose=index===2||index===6?'meditate':null;
  player.cinematicUnarmed=index<8||(index===8&&local<75);

  // A small cluster of the game's own village houses gives the opening depth.
  if(index<=1||departure||index===SHOT_COUNT-1){
    const row=[-60,85,225,410,600,800,965];
    for(let j=0;j<row.length;j++)drawHouse(row[j],GROUND);
  }
  if(index===6)drawHomeCutaway(cam+W*.30,GROUND);
  drawHari();
  if(index===4){introRaider.x=cam+W*.72;introRaider.y=GROUND-46;introRaider.dir=-1;introRaider.state='patrol';introRaider.anim=state.t/10;drawEnemy(introRaider);}
  if(index===5)drawMuna(cam+W*.68,GROUND-52);
  if(index===6){
    introRaider.x=cam+W*.61;introRaider.y=GROUND-46;introRaider.dir=-1;introRaider.state='lunge';introRaider.anim=state.t/10;drawEnemy(introRaider);
    drawBoundMuna(introRaider.x+42,GROUND-52);
  }
  if(index===7){
    // A distinct villager messenger hurries in; Hari's realization pulses.
    const vx=cam+W+20-Math.min(local*2.2,W*.32);drawVillager(vx,GROUND-52,local/8);
    if(vx-cam<W-45)text(state.language==='en'?'They took Muna!':'Muna lai lage!',vx-cam,GROUND-104,12,'#f4ead6','bold');
    const g=ctx.createRadialGradient(W/2,H/2,85,W/2,H/2,Math.max(W,H)*.68);
    g.addColorStop(0,'rgba(126,14,22,0)');g.addColorStop(1,`rgba(126,14,22,${heartbeat*.58})`);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  if(index===8){
    drawHouse(cam+W*.7,GROUND-10);drawDaraj(cam+W*.68,GROUND-3,Math.min(1,local/75));
  }
  if(index===5||index===6)drawBoudha(cam+W*.84,GROUND,STUPA_SCALE*.68);
  Object.assign(player,old);ctx.restore();state.cam=oldCam;ctx.restore();drawSceneGrade();
  ctx.fillStyle='#090b10';ctx.fillRect(0,0,W,22);ctx.fillRect(0,H-22,W,22);
}
function text(s,x,y,size=16,color='#f0e6cc',weight='normal',alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.font=`${weight} ${size}px "Segoe UI",system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,x,y);ctx.restore();
}
function caption(s){
  ctx.save();ctx.shadowColor='#000';ctx.shadowBlur=6;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f4ead6';ctx.font='17px "Segoe UI",system-ui';
  if(ctx.measureText(s).width<=W-100)ctx.fillText(s,W/2,H-53);
  else{let cut=Math.floor(s.length/2);while(cut<s.length-1&&s[cut]!==' ')cut++;ctx.fillText(s.slice(0,cut),W/2,H-64);ctx.fillText(s.slice(cut+1),W/2,H-42);}
  ctx.restore();
}
function button(b,label,subline){
  const hover=inside(b,mouse.x,mouse.y);ctx.save();ctx.fillStyle=hover?'rgba(218,177,94,.34)':'rgba(12,17,23,.78)';
  ctx.strokeStyle=hover?'#f1cf83':'rgba(230,220,197,.72)';ctx.lineWidth=hover?2.5:1.5;
  ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,6);ctx.fill();ctx.stroke();
  text(label,b.x+b.w/2,b.y+20,17,'#f5ead4','bold');if(subline)text(subline,b.x+b.w/2,b.y+42,11,'#d5c6aa');ctx.restore();
}
function modeChoice(b,label,selected){
  const hover=inside(b,mouse.x,mouse.y);ctx.save();
  ctx.fillStyle=selected?'rgba(218,177,94,.29)':hover?'rgba(218,177,94,.16)':'rgba(10,14,20,.72)';
  ctx.strokeStyle=selected?'#efc66d':'rgba(224,215,194,.55)';ctx.lineWidth=selected?2:1;
  ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,6);ctx.fill();ctx.stroke();
  text(label,b.x+b.w/2,b.y+b.h/2,12,selected?'#ffe3a1':'#e8ddc8','bold');ctx.restore();
}
function controlBadge(key,x,y,controller){
  const glyphColors={'✕':'#86b9ef','□':'#e4a0cf','○':'#ed827c','△':'#89cf9a'};
  const face=controller&&glyphColors[key];
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  if(face){
    ctx.fillStyle='rgba(7,12,20,.96)';ctx.strokeStyle=glyphColors[key];ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=glyphColors[key];ctx.font='bold 12px "Segoe UI Symbol","Segoe UI",system-ui';ctx.fillText(key,x,y+.5);
    ctx.restore();return 22;
  }
  ctx.font='bold 9px "Segoe UI",system-ui';
  const w=Math.max(24,ctx.measureText(key).width+10),h=17;
  ctx.fillStyle='rgba(7,12,20,.96)';ctx.strokeStyle=controller?'rgba(216,187,129,.82)':'rgba(191,204,216,.66)';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,4);ctx.fill();ctx.stroke();
  ctx.fillStyle='#f1e8d8';ctx.fillText(key,x,y+.5);ctx.restore();return w;
}
function controlEntry(key,label,x,y,controller){
  const width=controlBadge(key,x+10,y,controller);
  ctx.save();ctx.font='11px "Segoe UI",system-ui';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#f1e8d8';
  ctx.fillText(label,x+width+8,y);ctx.restore();
}
function controlsCard(){
  ctx.save();ctx.fillStyle='rgba(5,9,15,.9)';ctx.strokeStyle='rgba(207,173,112,.72)';ctx.lineWidth=1.2;
  ctx.beginPath();ctx.roundRect(92,194,W-184,110,8);ctx.fill();ctx.stroke();
  const controller=state.controlMode==='controller';
  text(controller?'CONTROLS  ·  CONTROLLER':'CONTROLS  ·  KEYBOARD',W/2,208,10,'#e6bf70','bold');
  const ne=state.language!=='en';
  const rows=controller?[
    [['LS / D-pad',ne?'hidne':'Move'],['✕',ne?'Jump / Action':'Jump / Action']],
    [['○',ne?'dodge':'Dodge'],['△','Ultimate']],
    [['□',ne?'prahar':'Attack'],['L1',ne?'rokne / parry':'Block / Parry']]
  ]:[
    [['A / D',ne?'hidne':'Move'],['W / Space',ne?'chhalne':'Jump']],
    [['Shift',ne?'dodge':'Dodge'],['E','Ultimate']],
    [['Enter','Action'],['Right-click',ne?'rokne / parry':'Block / Parry']],
    [['Click',ne?'prahar':'Attack']]
  ];
  for(let i=0;i<rows.length;i++){
    const y=229+i*18;controlEntry(rows[i][0][0],rows[i][0][1],112,y,controller);
    if(rows[i][1])controlEntry(rows[i][1][0],rows[i][1][1],420,y,controller);
  }
  ctx.restore();
}
function titleMenu(){
  ctx.fillStyle='#101a2a';ctx.fillRect(0,0,W,H);
  if(titleArt.complete&&titleArt.naturalWidth){
    const scale=Math.max(W/titleArt.naturalWidth,H/titleArt.naturalHeight);
    const dw=titleArt.naturalWidth*scale,dh=titleArt.naturalHeight*scale;
    ctx.drawImage(titleArt,(W-dw)/2,(H-dh)/2,dw,dh);
  }else{drawStage(0,state.t);}
  const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(5,12,20,.08)');shade.addColorStop(.58,'rgba(5,12,20,.08)');shade.addColorStop(1,'rgba(5,12,20,.82)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  button(startButton,'Start','');
  drawControlBadge('Enter',W/2-26,88,false,.9);text('or press a button',W/2+42,88,10,'#e8ddc8');
}
function controlsMenu(){
  drawStage(0,state.t);ctx.fillStyle='rgba(5,9,15,.7)';ctx.fillRect(0,22,W,H-44);
  text('CHOOSE HOW TO PLAY',W/2,105,23,'#f0c866','bold');
  text('Select an input method to see its controls below.',W/2,133,12,'#d5c6aa');
  modeChoice(keyboardChoice,'Keyboard & Mouse',state.controlModeChosen?state.controlMode==='keyboard':padFocus===0);
  modeChoice(controllerChoice,'Controller',state.controlModeChosen?state.controlMode==='controller':padFocus===1);
  if(state.controlModeChosen){
    button(continueButton,'Continue','');
    drawControlBadge(state.controlMode==='controller'?'✕':'Enter',W/2-27,354,state.controlMode==='controller',.9);
    text('Continue',W/2+12,354,11,'#d6c9b2');
  }else text('← / → choose · Enter to select',W/2,275,11,'#d5c6aa');
}
function languageMenu(){
  drawStage(0,state.t);ctx.fillStyle='rgba(5,9,15,.58)';ctx.fillRect(0,22,W,H-44);
  text(state.language==='en'?'Choose subtitle language':'Subtitles ko bhasa chhannuhos',W/2,190,20,'#f4ead6','bold');
  button(englishButton,'English','');button(nepaliButton,'Nepali · Romanized','');
  if(padFocus===0||padFocus===1){const b=padFocus===0?englishButton:nepaliButton;ctx.strokeStyle='#f0c866';ctx.lineWidth=2.5;ctx.strokeRect(b.x-3,b.y-3,b.w+6,b.h+6);}
  drawMenuActionHint(state.controlMode==='controller'
    ?(state.language==='en'?'D-pad ← / → choose ·':'D-pad ← / → chhannuhos ·')
    :(state.language==='en'?'← / → choose ·':'← / → chhannuhos ·'),331);
}
function difficultyMenu(){
  drawStage(SHOT_COUNT-1,0,true);ctx.fillStyle='rgba(5,9,15,.58)';ctx.fillRect(0,22,W,H-44);
  text(state.language==='en'?'Choose difficulty':'Yuddha ko kathinai chhannuhos',W/2,185,20,'#f4ead6','bold');
  button(casualButton,'Casual',state.language==='en'?'Forgiving parries · more health':'Sajilo parry · dherai swasthya');
  button(warriorButton,'Warrior',state.language==='en'?'Harder fights · less health':'Kada ladai · kam swasthya');
  {const b=padFocus===0?casualButton:warriorButton;ctx.strokeStyle='#f0c866';ctx.lineWidth=2.5;ctx.strokeRect(b.x-3,b.y-3,b.w+6,b.h+6);}
  drawMenuActionHint(state.language==='en'?(state.controlMode==='controller'?'D-pad ← / → choose ·':'← / → choose ·'):(state.controlMode==='controller'?'D-pad ← / → chhannuhos ·':'← / → chhannuhos ·'),331);
}
function drawMenuActionHint(prefix,y){
  const controller=state.controlMode==='controller',key=controller?'✕':'Enter';
  ctx.save();ctx.font='12px "Segoe UI",system-ui';
  const prefixWidth=ctx.measureText(prefix).width;
  const badgeWidth=controller?20:Math.max(24,ctx.measureText(key).width+10),labelWidth=ctx.measureText('Action').width;
  const total=prefixWidth+8+badgeWidth+6+labelWidth,left=(W-total)/2;
  ctx.fillStyle='#d5c6aa';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(prefix,left,y);
  drawControlBadge(key,left+prefixWidth+8+badgeWidth/2,y,controller,.9);
  ctx.fillStyle='#d5c6aa';ctx.fillText('Action',left+prefixWidth+8+badgeWidth+6,y);ctx.restore();
}
export function drawIntro(){
  if(menu===MENU.title){titleMenu();return;}
  if(menu===MENU.controls){controlsMenu();return;}
  if(menu===MENU.language){languageMenu();return;}
  if(menu===MENU.difficulty){difficultyMenu();return;}
  if(menu===MENU.launch){
    drawStage(SHOT_COUNT-1,0,true);ctx.fillStyle=`rgba(0,0,0,${Math.min(1,launchT/40)})`;ctx.fillRect(0,0,W,H);return;
  }
  const index=storyIndex,local=shotT;
  drawStage(index,local);
  if(local<FADE){ctx.fillStyle=`rgba(0,0,0,${1-local/FADE})`;ctx.fillRect(0,0,W,H);}
  caption(state.language==='en'?introLinesEn[index]:introLines[index]);
  const controller=state.controlMode==='controller',promptX=W-72,promptY=H-37;
  ctx.save();ctx.globalAlpha=.55+.45*Math.abs(Math.sin(state.t/12));
  drawControlBadge(controller?'✕':'Enter',promptX-28,promptY,controller,.9);
  text('Action',promptX+12,promptY,11,'#f0c866','bold');ctx.restore();
}
