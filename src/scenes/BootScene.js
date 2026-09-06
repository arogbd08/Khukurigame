import {ctx} from '../canvas.js';
import {W, H, GROUND, introLines, INTRO_LINE_FRAMES} from '../config.js';
import {state} from '../state.js';
import {drawSky} from '../render.js';

// Story lines reveal purely on the frame counter; drawIntro derives how many
// are visible from state.t.
export function updateIntro(){ state.t++; }

export function drawIntro(){
  const t=state.t;
  drawSky();
  ctx.save();
  for(let i=0;i<10;i++){ const mx=i*420-50; ctx.fillStyle='#5c6076';
    ctx.beginPath(); ctx.moveTo(mx,GROUND-40); ctx.lineTo(mx+210,GROUND-200); ctx.lineTo(mx+420,GROUND-40); ctx.fill();
    ctx.fillStyle='#eef1f6'; ctx.beginPath(); ctx.moveTo(mx+178,GROUND-168); ctx.lineTo(mx+210,GROUND-200); ctx.lineTo(mx+242,GROUND-168); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle='rgba(0,0,0,.45)'; ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';
  ctx.fillStyle='#ffd24a'; ctx.font='bold 38px "Segoe UI",system-ui'; ctx.fillText('KHUKURI',W/2,64);

  const last=introLines.length-1;
  const shown=Math.min(introLines.length, Math.floor(t/INTRO_LINE_FRAMES)+1);
  for(let i=0;i<shown;i++){
    const a=Math.min(1,(t-i*INTRO_LINE_FRAMES)/40);
    ctx.globalAlpha=a;
    // closing question lands in gold; the rest is parchment white
    ctx.fillStyle = i===last ? '#ffd24a' : '#f0e6cc';
    ctx.font = i===last ? 'bold 16px "Segoe UI",system-ui' : '15px "Segoe UI",system-ui';
    ctx.fillText(introLines[i], W/2, 112+i*27);
    ctx.globalAlpha=1;
  }
  // difficulty choice + start prompt (always available — you can skip ahead)
  ctx.fillStyle='#e8d9b5'; ctx.font='13px "Segoe UI",system-ui';
  ctx.fillText('1 — Casual        2 — Warrior', W/2, H-46);
  ctx.fillStyle=Math.floor(t/30)%2?'#9fe06a':'#5f8a3a';
  ctx.font='bold 15px system-ui';
  ctx.fillText('1 / 2 rojnuhos  ·  Enter / click — suru (Casual)', W/2, H-24);
  ctx.textAlign='left';
}
