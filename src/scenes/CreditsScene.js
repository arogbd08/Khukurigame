import {ctx} from '../canvas.js';
import {W, H} from '../config.js';
import {state} from '../state.js';

export function drawCredits(){
  const t=state.t;
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#070a18'); g.addColorStop(1,'#141022');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  for(let i=0;i<70;i++){ const sx=(i*149)%W, sy=(i*97)%240;
    ctx.fillStyle=`rgba(255,255,255,${0.25+0.55*Math.abs(Math.sin(t/30+i))})`; ctx.fillRect(sx,sy,2,2); }
  const fx=((t*3)%(W+240))-120, fy=46+fx*0.16;
  ctx.strokeStyle='rgba(255,240,200,0.9)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(fx,fy); ctx.lineTo(fx-34,fy-13); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(fx,fy,3,0,7); ctx.fill();

  ctx.textAlign='center';
  ctx.fillStyle='#ffd24a'; ctx.font='bold 30px "Segoe UI",system-ui';
  ctx.fillText('KHUKURI',W/2,124);

  ctx.fillStyle='#8a9bb0'; ctx.font='13px system-ui'; ctx.fillText('—  credits  —',W/2,178);
  ctx.fillStyle='#e8d9b5'; ctx.font='16px "Segoe UI",system-ui';
  ctx.fillText('Arogya Badal',W/2,212);
  ctx.fillText('Claude Code',W/2,240);

  // closing thought — fades in after the credits have settled
  {
    const a=Math.min(1,Math.max(0,(t-90)/70));
    ctx.globalAlpha=a*0.9;
    ctx.fillStyle='#9fb0c8'; ctx.font='italic 13px "Segoe UI",system-ui';
    ctx.fillText('Muna gai. Hari eklo thiyo.',W/2,290);
    ctx.fillText('Tara hajurbubako khukuri ajhai thiyo. Tyahi kaafi cha.',W/2,310);
    ctx.globalAlpha=1;
  }

  // thank-you fades in last
  {
    const a=Math.min(1,Math.max(0,(t-190)/70));
    ctx.globalAlpha=a;
    ctx.fillStyle='#ffd24a'; ctx.font='bold 17px "Segoe UI",system-ui';
    ctx.fillText('Thank you for playing',W/2,348);
    ctx.globalAlpha=1;
  }

  ctx.fillStyle=Math.floor(t/30)%2?'#9fe06a':'#5f8a3a'; ctx.font='bold 14px system-ui';
  ctx.fillText('R — feri khelnuhos',W/2,388);
  ctx.textAlign='left'; state.t++;
}
