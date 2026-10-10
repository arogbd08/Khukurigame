import {ctx} from './canvas.js?v=20261010-4';
import {W, H, GROUND, WORLD, PARRY_ACTIVE, ULT_MAX_CHARGES, ULT_RECHARGE_FRAMES, MOVES, COMBO_GAP, DEATHBLOW_FRAMES, GROUND_GAPS, DUNGEON_PITS, VILLAGE_HOUSES, STUPA_X, STUPA_SCALE, DUNGEON_ENTRY_X, DUNGEON_ENTRY_END, DUNGEON_FLOOR, DUNGEON_BOSS_ROOM_START, DUNGEON_STEPS, DUNGEON_ALCOVES} from './config.js?v=20261010-4';
import {state, sub, sparks, toasts, diff, input} from './state.js?v=20261010-4';
import {player, plats, boss, cage, cs} from './entities.js?v=20261010-4';

/* ================= SKY & PARALLAX BACKGROUND =================
   Layers, far to near. Each layer scrolls at its own fraction of the camera,
   and everything past the mid-range is washed toward the horizon haze colour
   so depth reads even though it is all flat-shaded shapes. */

export function drawSky(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#101522');
  g.addColorStop(0.34,'#2b3440');
  g.addColorStop(0.62,'#62564d');
  g.addColorStop(0.84,'#76614e');
  g.addColorStop(1,'#302b28');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}
function drawSun(cam){
  const sx=170-cam*0.012, sy=74;
  // outer bloom
  let rg=ctx.createRadialGradient(sx,sy,10,sx,sy,150);
  rg.addColorStop(0,'rgba(255,205,137,0.46)');
  rg.addColorStop(0.45,'rgba(221,147,94,0.18)');
  rg.addColorStop(1,'rgba(255,176,112,0)');
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(sx,sy,150,0,7); ctx.fill();
  // god rays — slow lazy rotation
  ctx.save(); ctx.translate(sx,sy); ctx.rotate(state.t*0.0016);
  for(let i=0;i<12;i++){
    ctx.rotate(Math.PI/6);
    ctx.fillStyle=`rgba(255,207,150,${0.035+0.025*Math.sin(state.t/40+i)})`;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(150,-16); ctx.lineTo(150,16); ctx.fill();
  }
  ctx.restore();
  // core
  rg=ctx.createRadialGradient(sx,sy,4,sx,sy,30);
  rg.addColorStop(0,'#ffe4b3'); rg.addColorStop(1,'#d99159');
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(sx,sy,25,0,7); ctx.fill();
}

function cloud(x,y,s,alpha){
  ctx.fillStyle=`rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x,y,34*s,13*s,0,0,7);
  ctx.ellipse(x-26*s,y+5*s,22*s,9*s,0,0,7);
  ctx.ellipse(x+28*s,y+4*s,25*s,10*s,0,0,7);
  ctx.ellipse(x+6*s,y-9*s,20*s,11*s,0,0,7);
  ctx.fill();
}

function drawClouds(cam){
  // two bands at different depths, drifting on their own slow timers
  for(let i=0;i<7;i++){
    const x=((i*340 + state.t*0.14 - cam*0.03) % (W+520)) - 200;
    cloud(x, 46+((i*37)%40), 0.9+((i*13)%5)/10, 0.42);
  }
  for(let i=0;i<5;i++){
    const x=((i*430 + state.t*0.3 - cam*0.07) % (W+620)) - 240;
    cloud(x, 106+((i*53)%34), 0.62+((i*17)%4)/10, 0.28);
  }
}

function ridge(cam, par, baseY, height, spacing, seed, fill, snow){
  // Distinct angular summits read as a mountain range at a glance. Fixed
  // world-space peaks keep the silhouette steady as each parallax layer moves.
  const off=cam*par;
  const first=Math.floor((off-W)/spacing)-1;
  const last=Math.ceil((off+W)/spacing)+1;
  const peaks=[];
  const noise=(i,salt)=>{
    const n=Math.sin((i+seed*0.013)*127.1+salt*311.7)*43758.5453;
    return n-Math.floor(n);
  };
  for(let i=first;i<=last;i++){
    const cx=i*spacing-off;
    const h=height*(.78+noise(i,1)*.22);
    const width=spacing*(.82+noise(i,2)*.38);
    peaks.push({i,cx,h,width,top:baseY-h,valley:baseY-height*(.025+noise(i,3)*.045)});
  }

  ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(-80,GROUND);
  for(const p of peaks){
    ctx.lineTo(p.cx-spacing*.5,p.valley);
    ctx.lineTo(p.cx-p.width*.34,baseY-p.h*.22);
    ctx.lineTo(p.cx-p.width*.15,baseY-p.h*.66);
    ctx.lineTo(p.cx-p.width*.075,baseY-p.h*.58);
    ctx.lineTo(p.cx,p.top);
    ctx.lineTo(p.cx+p.width*.11,baseY-p.h*.52);
    ctx.lineTo(p.cx+p.width*.19,baseY-p.h*.61);
    ctx.lineTo(p.cx+p.width*.34,baseY-p.h*.24);
    ctx.lineTo(p.cx+spacing*.5,p.valley);
  }
  ctx.lineTo(W+80,GROUND);ctx.closePath();ctx.fill();

  // Broad shadow and light planes make the sharp silhouettes feel like rocky
  // faces instead of saw teeth; keep the contrast quiet in the existing style.
  for(const p of peaks){
    ctx.fillStyle='rgba(220,228,231,.075)';ctx.beginPath();
    ctx.moveTo(p.cx,p.top);ctx.lineTo(p.cx-p.width*.34,baseY-p.h*.22);ctx.lineTo(p.cx,p.valley);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(12,17,25,.16)';ctx.beginPath();
    ctx.moveTo(p.cx,p.top);ctx.lineTo(p.cx+p.width*.34,baseY-p.h*.24);ctx.lineTo(p.cx,p.valley);ctx.closePath();ctx.fill();
    if(snow){
      const cap=p.h*.31;
      ctx.fillStyle='rgba(245,247,244,.86)';ctx.beginPath();ctx.moveTo(p.cx,p.top+1);
      ctx.lineTo(p.cx-p.width*.18,p.top+cap*.57);
      ctx.lineTo(p.cx-p.width*.105,p.top+cap*.48);
      ctx.lineTo(p.cx-p.width*.035,p.top+cap*.72);
      ctx.lineTo(p.cx+p.width*.035,p.top+cap*.54);
      ctx.lineTo(p.cx+p.width*.105,p.top+cap*.78);
      ctx.lineTo(p.cx+p.width*.18,p.top+cap*.58);
      ctx.lineTo(p.cx+p.width*.29,p.top+cap*.9);
      ctx.closePath();ctx.fill();
    }
  }
}

function hazeBand(y,h,alpha){
  const g=ctx.createLinearGradient(0,y,0,y+h);
  g.addColorStop(0,`rgba(200,220,234,0)`);
  g.addColorStop(0.5,`rgba(200,220,234,${alpha})`);
  g.addColorStop(1,`rgba(200,220,234,0)`);
  ctx.fillStyle=g; ctx.fillRect(0,y,W,h);
}

function drawBirds(cam){
  for(let i=0;i<6;i++){
    const bx=((i*310 + state.t*0.9 - cam*0.22) % (W+400)) - 200;
    const by=92+((i*61)%56)+Math.sin(state.t/26+i*2)*7;
    const flap=Math.sin(state.t/6+i*1.7)*0.55;
    ctx.strokeStyle='rgba(40,50,66,0.5)'; ctx.lineWidth=1.6;
    ctx.beginPath();
    ctx.moveTo(bx-6,by+flap*4); ctx.quadraticCurveTo(bx-3,by-2,bx,by);
    ctx.quadraticCurveTo(bx+3,by-2,bx+6,by+flap*4);
    ctx.stroke();
  }
}

function pine(x,baseY,s,col){
  ctx.fillStyle=col;
  ctx.fillRect(x-1.5*s,baseY-8*s,3*s,8*s);
  for(let i=0;i<3;i++){
    const w=(13-i*3)*s, y=baseY-(7+i*8)*s;
    ctx.beginPath(); ctx.moveTo(x-w,y); ctx.lineTo(x,y-13*s); ctx.lineTo(x+w,y); ctx.closePath(); ctx.fill();
  }
}

function badlands(cam,par,baseY){
  const colors=['#6e4b42','#785347','#674940','#805b49'];
  for(let i=-2;i<8;i++){
    const x=i*250-cam*par, h=72+(Math.abs(i*47)%58), w=248;
    ctx.fillStyle=colors[(i+8)%colors.length];ctx.beginPath();
    ctx.moveTo(x,GROUND+4);ctx.lineTo(x,baseY-22);
    ctx.lineTo(x+22,baseY-35);ctx.lineTo(x+43,baseY-h);
    ctx.lineTo(x+68,baseY-h-8);ctx.lineTo(x+89,baseY-h+1);
    ctx.lineTo(x+120,baseY-48);ctx.lineTo(x+154,baseY-54);
    ctx.lineTo(x+180,baseY-30);ctx.lineTo(x+208,baseY-39);
    ctx.lineTo(x+w,baseY-17);ctx.lineTo(x+w,GROUND+4);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(202,147,105,.26)';ctx.lineWidth=1;
    for(let layer=0;layer<4;layer++){
      const yy=baseY-22-layer*12;
      ctx.beginPath();ctx.moveTo(x+8,yy);ctx.lineTo(x+55,yy-7);ctx.lineTo(x+99,yy-2);
      ctx.lineTo(x+145,yy+5);ctx.lineTo(x+206,yy-2);ctx.stroke();
    }
    ctx.strokeStyle='rgba(40,29,29,.2)';ctx.beginPath();ctx.moveTo(x+66,baseY-h+2);ctx.lineTo(x+59,baseY-19);ctx.moveTo(x+73,baseY-h+5);ctx.lineTo(x+82,baseY-12);ctx.stroke();
  }
}

function drawPrayerFlagLine(x,y,span,sag){
  ctx.strokeStyle='#342b24';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,GROUND);ctx.moveTo(x+span,y);ctx.lineTo(x+span,GROUND);ctx.stroke();
  ctx.strokeStyle='rgba(90,80,60,0.45)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(x,y); ctx.quadraticCurveTo(x+span/2,y+sag,x+span,y); ctx.stroke();
  const fc=['#c0392b','#2980b9','#27ae60','#f1c40f','#ecf0f1'];
  for(let i=1;i<12;i++){
    const u=i/12, ix=x+span*u;
    const iy=y+2*sag*u*(1-u)+Math.sin(state.t/16+i)*1.2;
    ctx.fillStyle=fc[i%5];
    ctx.fillRect(ix-2.5,iy,5,7);
  }
}

export function drawBackground(){
  const cam=state.cam;
  drawSun(cam);
  drawClouds(cam);

  // ---- far snow range ----
  ridge(cam, 0.05, GROUND-46, 196, 244, 0,    '#78818a', true);
  hazeBand(GROUND-150, 120, 0.24);

  // ---- mid range ----
  ridge(cam, 0.13, GROUND-30, 150, 220, 1400, '#626b72', false);
  badlands(cam,0.20,GROUND-4);
  hazeBand(GROUND-104, 96, 0.24);
  drawBirds(cam);

  // ---- near range ----
  ridge(cam, 0.26, GROUND-16, 104, 194, 3100, '#534a49', false);
  hazeBand(GROUND-70, 74, 0.16);

  // ---- distant village band: houses sit on the same valley floor ----
  for(const hx of [430,1300,2200,3300,3900]) drawHouse(hx-cam*0.62, GROUND);
  drawPrayerFlagLine(300-cam*0.62, GROUND-118, 260, 40);
  drawPrayerFlagLine(1900-cam*0.62, GROUND-108, 230, 36);
  drawPrayerFlagLine(3500-cam*0.62, GROUND-124, 280, 44);

  // ---- terraced foothills ----
  ctx.fillStyle='#544b3d';
  for(let i=0;i<13;i++){ const hx=i*440-cam*0.5;
    ctx.beginPath();ctx.moveTo(hx,GROUND);ctx.lineTo(hx+220,GROUND-110);ctx.lineTo(hx+440,GROUND);ctx.fill(); }
  // terrace contour lines cut into the hills
  ctx.strokeStyle='rgba(164,126,84,0.35)'; ctx.lineWidth=1;
  for(let i=0;i<13;i++){ const hx=i*440-cam*0.5;
    for(let k=1;k<=5;k++){
      const f=k/6;
      ctx.beginPath();
      ctx.moveTo(hx+220*f, GROUND-110*f);
      ctx.lineTo(hx+440-220*f, GROUND-110*f);
      ctx.stroke();
    }
  }

  // ---- pine treeline ----
  for(let i=0;i<26;i++){
    const px=((i*173)%2600)*1.0-cam*0.72;
    const wrapped=((px%(W+300))+(W+300))%(W+300)-150;
    if(i%4===0)pine(wrapped, GROUND-4, 0.44+((i*7)%4)/15, '#3b3b2f');
  }

  ctx.fillStyle='#382f2a';
  for(let i=0;i<13;i++){ const hx=i*440-cam*0.86;
    ctx.beginPath();ctx.moveTo(hx,GROUND+6);ctx.lineTo(hx+200,GROUND-56);ctx.lineTo(hx+400,GROUND+6);ctx.fill(); }

  // ---- drifting dust motes catching the light ----
  for(let i=0;i<22;i++){
    const dx=((i*211 + state.t*0.5 - cam*0.9) % (W+200)) - 100;
    const dy=(GROUND-140) + ((i*97)%130) + Math.sin(state.t/34+i*1.3)*11;
    ctx.fillStyle=`rgba(255,244,208,${0.1+0.16*Math.abs(Math.sin(state.t/48+i))})`;
    ctx.fillRect(dx,dy,2,2);
  }
}

export function drawGround({platforms=true,gaps=true,surface=true}={}){
  if(!surface)return;
  const cam=state.cam, t=state.t;
  ctx.fillStyle='#40332c'; ctx.fillRect(0,GROUND,WORLD,H-GROUND);
  if(gaps)for(const [a,b] of GROUND_GAPS){
    const bottom=a===DUNGEON_ENTRY_X?DUNGEON_FLOOR+18:H+24;
    ctx.fillStyle='#08090d';ctx.fillRect(a,GROUND,b-a,bottom-GROUND);
    ctx.fillStyle='#24272a';ctx.fillRect(a-5,GROUND,b-a+10,5);
    ctx.fillStyle='#15191d';ctx.fillRect(a,GROUND+5,5,H-GROUND);
    ctx.fillRect(b-5,GROUND+5,5,H-GROUND);
  }
  // soil striation so the ground isn't a flat slab
  ctx.fillStyle='#352b27';
  for(let gx=Math.floor(cam/40)*40-40; gx<cam+W+40; gx+=40){
    if(gaps&&GROUND_GAPS.some(([a,b])=>gx>=a-40&&gx<b))continue;
    ctx.fillRect(gx, GROUND+14+((gx*7)%9), 26, 3);
    ctx.fillRect(gx+18, GROUND+26+((gx*11)%7), 18, 3);
  }
  ctx.fillStyle='#695345'; ctx.fillRect(0,GROUND,WORLD,3);
  // Recut the open chasm after the continuous ground trim is drawn.
  if(gaps)for(const [a,b] of GROUND_GAPS){ctx.fillStyle='#080b11';ctx.fillRect(a,GROUND,b-a,H-GROUND+24);ctx.fillStyle='#24272a';ctx.fillRect(a-5,GROUND,b-a+10,5);}
  ctx.strokeStyle='#7a624d';ctx.lineWidth=1.2;
  for(let gx=Math.floor(cam/36)*36-36;gx<cam+W+36;gx+=36){
    if(gaps&&GROUND_GAPS.some(([a,b])=>gx>=a-18&&gx<b))continue;
    const sprout=(gx%5===0)?7:3;
    ctx.beginPath();ctx.moveTo(gx,GROUND);ctx.lineTo(gx+Math.sin(t/24+gx)*.7,GROUND-sprout);ctx.stroke();
  }
  if(platforms)for(const p of plats){
    if(p.kind==='terrace'){
      ctx.fillStyle='#514136';ctx.beginPath();ctx.moveTo(p.x+7,p.y);ctx.lineTo(p.x+p.w-5,p.y);ctx.lineTo(p.x+p.w-13,GROUND);ctx.lineTo(p.x+4,GROUND);ctx.closePath();ctx.fill();
      ctx.fillStyle='#78614b';ctx.beginPath();ctx.moveTo(p.x+2,p.y);ctx.lineTo(p.x+p.w-2,p.y);ctx.lineTo(p.x+p.w-6,p.y+5);ctx.lineTo(p.x+5,p.y+5);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(29,25,23,.66)';ctx.lineWidth=1;
      for(let yy=p.y+15;yy<GROUND;yy+=13){ctx.beginPath();ctx.moveTo(p.x+6,yy);ctx.lineTo(p.x+p.w-10,yy);ctx.stroke();}
      for(let yy=p.y+6,row=0;yy<GROUND;yy+=13,row++){for(let xx=p.x+11+(row%2)*13;xx<p.x+p.w-12;xx+=26){ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx-4,yy+9);ctx.stroke();}}
    } else if(p.kind==='dungeonStep'){
      const h=Math.min(22,DUNGEON_FLOOR-p.y);
      ctx.fillStyle='#55483c';ctx.beginPath();ctx.moveTo(p.x+5,p.y+h);ctx.lineTo(p.x+5,p.y+7);ctx.lineTo(p.x+14,p.y);ctx.lineTo(p.x+p.w-7,p.y);ctx.lineTo(p.x+p.w,p.y+8);ctx.lineTo(p.x+p.w,p.y+h);ctx.closePath();ctx.fill();
      ctx.fillStyle='#92806a';ctx.fillRect(p.x+10,p.y-2,p.w-18,4);
      ctx.strokeStyle='#302b28';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x+8,p.y+10);ctx.lineTo(p.x+p.w-8,p.y+10);ctx.stroke();
    } else if(p.kind==='roof'){
      // The walkable collision surface is the house's actual parapet roof.
      continue;
    } else {
      continue;
    }
  }
}

/* ================= SPARKS / IMPACT FX ================= */
export function drawSparks(){
  for(const s of sparks){
    const a=Math.max(0,Math.min(1,s.life/s.max));
    ctx.globalAlpha=a;
    ctx.fillStyle=s.col;
    // streak along travel direction — reads as a spark, not a dot
    const len=Math.min(9, Math.hypot(s.vx,s.vy)*1.5);
    ctx.save(); ctx.translate(s.x,s.y); ctx.rotate(Math.atan2(s.vy,s.vx));
    ctx.fillRect(-len, -s.size/2, len+s.size, s.size);
    ctx.restore();
  }
  ctx.globalAlpha=1;
}

/* ================= ANIMATION HELPERS ================= */

/* Two-bone IK: draw a limb from root→(elbow/knee)→end so arms and legs bend at a
   real joint instead of being a single curved stroke. `bend` picks which side the
   joint pops out. Returns the joint + clamped end so callers can attach hands/feet. */
function limb2(rx,ry,tx,ty,l1,l2,bend,w,col,capCol,capR){
  let dx=tx-rx, dy=ty-ry, d=Math.hypot(dx,dy)||0.0001;
  const maxd=l1+l2-0.01, mind=Math.abs(l1-l2)+0.01;
  d=Math.max(mind,Math.min(maxd,d));
  const ux=dx/d, uy=dy/d;
  const a=(l1*l1-l2*l2+d*d)/(2*d);
  const h=Math.sqrt(Math.max(0,l1*l1-a*a));
  const mx=rx+ux*a, my=ry+uy*a;
  const jx=mx-uy*h*bend, jy=my+ux*h*bend;   // joint off the root→end line
  const ex=rx+ux*d, ey=ry+uy*d;
  ctx.strokeStyle=col; ctx.lineWidth=w; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(jx,jy); ctx.lineTo(ex,ey); ctx.stroke();
  if(capCol){ ctx.fillStyle=capCol; ctx.beginPath(); ctx.arc(ex,ey,capR||3,0,7); ctx.fill(); }
  return {jx,jy,ex,ey};
}

/* KATANA, drawn in local space: tsuka (wrapped handle) behind the origin, tsuba
   guard, then a single gently-curved blade (sori) running out along +x to an
   angled kissaki tip, with a yokote line and a hamon. A real katana silhouette —
   one uniform curve, no belly. Blade tip sits at ~(BLADE_LEN, 0). */
const BLADE_LEN=42;
function katanaBlade(s){
  s=s||1; const L=BLADE_LEN*s;
  // tsuka (handle): black with RED diamond ito wrap + gold fittings (ref image)
  ctx.fillStyle='#141619'; ctx.fillRect(-16*s,-2.3*s,14*s,4.6*s);
  ctx.fillStyle='#b8302a';
  for(let i=0;i<4;i++){ const cx=-14.5*s+i*3.4*s;   // red wrap diamonds
    ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx+1.5*s,-1.6*s); ctx.lineTo(cx+3*s,0); ctx.lineTo(cx+1.5*s,1.6*s); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle='#caa84e'; ctx.fillRect(-17*s,-2.6*s,2.2*s,5.2*s);    // kashira (gold pommel)
  ctx.fillStyle='#caa84e'; ctx.fillRect(-3*s,-2.7*s,2*s,5.4*s);       // fuchi (gold collar)
  // tsuba (gold oval guard)
  ctx.fillStyle='#caa84e'; ctx.beginPath(); ctx.ellipse(-0.6*s,0,2.4*s,4.8*s,0,0,7); ctx.fill();
  ctx.fillStyle='#8a6f28'; ctx.beginPath(); ctx.ellipse(-0.6*s,0,1.2*s,3.2*s,0,0,7); ctx.fill();
  ctx.fillStyle='#e6c869'; ctx.fillRect(1*s,-1.6*s,2*s,3.2*s);        // habaki (gold blade collar)
  // blade — one gentle sori curve, chisel kissaki
  const g=ctx.createLinearGradient(0,-3*s,0,3*s);
  g.addColorStop(0,'#f6f9fd'); g.addColorStop(0.5,'#d7dee8'); g.addColorStop(1,'#a9b3c1');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(3*s,-2.1*s);
  ctx.quadraticCurveTo(L*0.55,-2.9*s, L*0.95,-1.5*s);
  ctx.lineTo(L,-0.1*s); ctx.lineTo(L*0.9, 1.1*s);
  ctx.quadraticCurveTo(L*0.55, 1.9*s, 3*s, 1.9*s);
  ctx.closePath(); ctx.fill();
  // hamon (wavy temper line)
  ctx.strokeStyle='rgba(255,255,255,0.55)'; ctx.lineWidth=0.8*s;
  ctx.beginPath(); ctx.moveTo(5*s,0.9*s);
  for(let x=0.1;x<=0.9;x+=0.2) ctx.quadraticCurveTo(L*(x+0.05),1.6*s,L*(x+0.1),0.6*s);
  ctx.stroke();
  // yokote + spine glint
  ctx.strokeStyle='rgba(120,130,145,0.85)'; ctx.lineWidth=0.7*s;
  ctx.beginPath(); ctx.moveTo(L*0.86,-1.4*s); ctx.lineTo(L*0.88,1.0*s); ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=0.6*s;
  ctx.beginPath(); ctx.moveTo(L*0.1,-1.3*s); ctx.lineTo(L*0.84,-1.15*s); ctx.stroke();
}

/* KHUKURI (Hari's main blade — ref image): brown wooden handle behind the origin,
   a metal bolster, then a forward-DROOPING blade with the signature heavy belly
   that widens toward a down-curved tip, an inner edge bevel line, and the cho notch. */
const KH_LEN=34;
function khukuriBlade(s){
  s=s||1; const L=KH_LEN*s;
  // wooden handle
  ctx.fillStyle='#6b4526'; ctx.fillRect(-14*s,-2.6*s,11*s,5.2*s);
  ctx.fillStyle='#7d5430'; ctx.fillRect(-14*s,-2.6*s,11*s,1.4*s);        // top highlight
  ctx.fillStyle='#3a2414'; ctx.beginPath(); ctx.arc(-14*s,0,1.6*s,0,7); ctx.fill();   // butt cap
  ctx.fillStyle='#c9cdd4'; ctx.fillRect(-3.5*s,-2.8*s,2.4*s,5.6*s);      // metal bolster/collar
  // blade — drooping forward, heavy belly (edge on the lower/concave side)
  const g=ctx.createLinearGradient(0,-4*s,0,10*s);
  g.addColorStop(0,'#eef2f7'); g.addColorStop(0.55,'#cdd4de'); g.addColorStop(1,'#aab3bf');
  ctx.fillStyle=g;
  ctx.beginPath();
  ctx.moveTo(-1*s,-2.6*s);                                  // spine at bolster
  ctx.quadraticCurveTo(L*0.5,-4.4*s, L*0.86,-1.0*s);        // spine rises then curves down
  ctx.quadraticCurveTo(L*1.02, 1.8*s, L*0.9, 4.6*s);        // down-curved tip
  ctx.quadraticCurveTo(L*0.66,10.2*s, L*0.4,7.6*s);         // heavy belly (edge)
  ctx.quadraticCurveTo(L*0.16,5.0*s, -1*s,2.6*s);           // edge back to bolster
  ctx.closePath(); ctx.fill();
  // inner edge bevel line (parallel to the edge)
  ctx.strokeStyle='rgba(255,255,255,0.7)'; ctx.lineWidth=0.9*s;
  ctx.beginPath(); ctx.moveTo(2*s,2.2*s);
  ctx.quadraticCurveTo(L*0.5,7.0*s,L*0.85,3.2*s); ctx.stroke();
  // spine glint
  ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=0.7*s;
  ctx.beginPath(); ctx.moveTo(2*s,-1.6*s); ctx.quadraticCurveTo(L*0.5,-3.0*s,L*0.82,-0.4*s); ctx.stroke();
  // cho notch near the bolster
  ctx.fillStyle='#8a929e'; ctx.beginPath(); ctx.arc(2.5*s,3.2*s,1.1*s,0,7); ctx.fill();
}

/* Saya (scabbard) at the left hip. Extends BACK (-x) from a koiguchi mouth near
   the hip; `withBlade` shows the katana seated inside with its tsuka protruding
   forward for the draw, and `drawn` (0..1) slides a bright sliver of blade out of
   the mouth as the iai begins. Drawn empty the rest of the time — Hari always
   wears it. */
function drawSaya(withBlade, drawn){
  ctx.save();
  ctx.translate(-4,42); ctx.rotate(0.5);          // left hip, angled down-back
  const L=32;
  ctx.fillStyle='#101216'; ctx.fillRect(-L,-2.4,L,4.8);         // black lacquered body
  ctx.fillStyle='#20242c'; ctx.fillRect(-L,-2.4,L,1.3);         // sheen
  ctx.fillStyle='#caa84e'; ctx.fillRect(-L*0.62,-2.4,5,4.8);    // gold panel
  ctx.fillStyle='#caa84e'; ctx.fillRect(-L*0.42,-2.4,3,4.8);    // gold band
  ctx.fillStyle='#caa84e'; ctx.fillRect(-L-1.5,-2.4,2,4.8);     // kojiri (gold end cap)
  ctx.fillStyle='#2a2f38'; ctx.fillRect(-2,-2.9,4,5.8);         // koiguchi (mouth)
  // red sageo tassel tied near the mouth
  ctx.strokeStyle='#b8302a'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.moveTo(-4,2); ctx.quadraticCurveTo(-7,7,-3,10); ctx.stroke();
  ctx.fillStyle='#c8352d'; ctx.beginPath(); ctx.arc(-3,11,1.8,0,7); ctx.fill();
  if(withBlade){
    // katana tsuka protruding forward from the mouth (blade seated inside)
    ctx.fillStyle='#141619'; ctx.fillRect(1,-2.1,12,4.2);
    ctx.fillStyle='#b8302a'; for(let i=0;i<3;i++){ const cx=2.5+i*3.4;
      ctx.beginPath(); ctx.moveTo(cx,0); ctx.lineTo(cx+1.2,-1.3); ctx.lineTo(cx+2.4,0); ctx.lineTo(cx+1.2,1.3); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle='#caa84e'; ctx.beginPath(); ctx.ellipse(13,0,1.5,3.4,0,0,7); ctx.fill();   // gold tsuba
    if(drawn>0.02){ ctx.fillStyle='#eef3f9'; ctx.fillRect(14, -1.0, drawn*24, 2.0); }
  }
  ctx.restore();
}

/* Choreographed hand pose per move — each hit is a different, mostly-horizontal
   motion: a forward POKE, a SIDE swing, then a RISING finisher (no canned
   top-down chop). Returns hand target {hx,hy}, blade rotation and the phase. */
const REST_POSE={hx:14,hy:30,rot:-0.6};
const POSE={
  L1:{wind:{hx:-2,hy:30,rot:-0.5}, hit:{hx:38,hy:31,rot:0.05}, rec:{hx:18,hy:31,rot:-0.2}}, // straight poke/thrust
  L2:{wind:{hx:-9,hy:20,rot:-1.5}, hit:{hx:32,hy:35,rot:0.8},  rec:{hx:16,hy:31,rot:0.0}},  // side swing (horizontal)
  L3:{wind:{hx:-6,hy:42,rot:2.0},  hit:{hx:34,hy:16,rot:-1.0}, rec:{hx:18,hy:26,rot:-0.4}}, // rising finisher
  AIR_DOWN:{wind:{hx:-5,hy:13,rot:-1.85},hit:{hx:25,hy:52,rot:1.25},rec:{hx:18,hy:37,rot:0.25}} // airborne downward slash
};
function attackPose(p,mv){
  if(!mv) return null;
  const P=POSE[p.move]; if(!P) return null;
  const {a0,a1,dur}=mv, tt=p.atkT;
  let from,to,f,phase;
  if(tt<a0){ from=REST_POSE; to=P.wind; f=tt/a0; phase='wind'; f=f*f*(3-2*f); }        // ease in
  else if(tt<=a1){ from=P.wind; to=P.hit; f=(tt-a0)/Math.max(1,a1-a0); phase='hit'; f=1-Math.pow(1-f,3); } // snap out
  else { from=P.hit; to=P.rec; f=(tt-a1)/Math.max(1,dur-a1); phase='rec'; }
  return {
    hx: from.hx+(to.hx-from.hx)*f,
    hy: from.hy+(to.hy-from.hy)*f,
    rot: from.rot+(to.rot-from.rot)*f,
    phase
  };
}

/* Blade smear ribbon (Phantom Blade-style): sample the blade base+tip each frame
   during the active window and connect the samples into a fading ribbon. Kept in a
   module ring so only the live swing draws a trail. */
let hariTrail=[];
function pushTrail(hx,hy,rot,kind){
  const len = kind==='iai'?BLADE_LEN:KH_LEN;              // katana longer than khukuri
  const tx=hx+Math.cos(rot)*len, ty=hy+Math.sin(rot)*len; // blade tip
  const mx=hx+Math.cos(rot)*len*0.55, my=hy+Math.sin(rot)*len*0.55;
  hariTrail.push({bx:mx,by:my,tx,ty,life:6,max:6,kind});
  if(hariTrail.length>6) hariTrail.shift();               // shorter, tighter smear
}
function stepTrail(){ for(const s of hariTrail) s.life--; hariTrail=hariTrail.filter(s=>s.life>0); }
function drawTrail(){
  if(hariTrail.length<2) return;
  for(let i=1;i<hariTrail.length;i++){
    const a=hariTrail[i-1], b=hariTrail[i];
    const al=Math.max(0,Math.min(1,b.life/b.max));
    const col = b.kind==='iai' ? `rgba(210,240,255,${0.55*al})`
              : b.kind==='down' ? `rgba(255,190,112,${0.58*al})`
              : b.kind==='heavy' ? `rgba(255,225,150,${0.5*al})`
                                  : `rgba(255,252,225,${0.45*al})`;
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.moveTo(a.bx,a.by); ctx.lineTo(a.tx,a.ty); ctx.lineTo(b.tx,b.ty); ctx.lineTo(b.bx,b.by);
    ctx.closePath(); ctx.fill();
  }
  // bright leading edge
  const b=hariTrail[hariTrail.length-1];
  ctx.strokeStyle='rgba(255,255,255,0.8)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(b.bx,b.by); ctx.lineTo(b.tx,b.ty); ctx.stroke();
}

/* ================= HARI — FULLY ARTICULATED ================= */
export function drawHari(){
  const p=player, t=state.t;
  const meditating=p.cinematicPose==='meditate';
  const PT=diff().parryThresh;
  const mv=p.move?MOVES[p.move]:null;
  const atkActive = mv && p.atkT>=mv.a0 && p.atkT<=mv.a1;
  if(p.hurt>0 && Math.floor(p.hurt/4)%2===0) return;

  const moving   = p.onGround && Math.abs(p.vx)>0.4;
  const airborne = !p.onGround;
  const parrying = p.parry>0;
  const guarding = parrying||input.guardMouse||input.guardPad;
  const wp       = p.walkPhase;
  const cpose    = attackPose(p, mv);
  // ULT = iai-jutsu: a down→up rising KATANA draw-cut, driven by p.ult (24→0)
  let ultPose=null;
  if(p.ult>0){
    const q=(24-p.ult)/24; let a,b,f;
    if(q<0.28){ a={hx:8,hy:37,rot:-0.1}; b={hx:-3,hy:41,rot:0.15}; f=q/0.28; }               // low ready crouch, blade held horizontal at hip
    else if(q<0.7){ a={hx:-3,hy:41,rot:0.15}; b={hx:42,hy:9,rot:-1.2}; f=(q-0.28)/0.42; f=1-Math.pow(1-f,3); } // explosive down→up draw-cut
    else { a={hx:42,hy:9,rot:-1.2}; b={hx:22,hy:24,rot:-0.4}; f=(q-0.7)/0.3; }               // recover
    ultPose={hx:a.hx+(b.hx-a.hx)*f, hy:a.hy+(b.hy-a.hy)*f, rot:a.rot+(b.rot-a.rot)*f, phase:q<0.7?'hit':'rec'};
  }
  let pose = ultPose || cpose;               // whichever is driving the arm/body
  const ulting = p.ult>0;
  // DEATHBLOW: a deep khukuri thrust finisher — overrides the pose
  const dbActive = p.deathblow>0;
  if(dbActive){
    const q=1-p.deathblow/DEATHBLOW_FRAMES;
    const hx = q<0.35 ? 8+(q/0.35)*36 : 44;   // stab out fast, then hold buried
    pose = {hx, hy:29, rot:0.03, phase:'hit'};
  }
  const crouch = (ulting && (24-p.ult)<8) ? 4 : 0;   // low iai ready-stance dip

  // feed the smear while a blade is live
  if(dbActive) pushTrail(pose.hx,pose.hy,pose.rot,'iai');
  else if(ultPose){ if((24-p.ult)>=5) pushTrail(ultPose.hx,ultPose.hy,ultPose.rot,'iai'); }
  else if(cpose && (cpose.phase==='hit' || (cpose.phase==='rec' && p.atkT<=mv.a1+2)))
    pushTrail(cpose.hx,cpose.hy,cpose.rot,mv.airDown?'down':'light');
  stepTrail();

  const sq=p.squash, scX=1+sq*0.22, scY=1-sq*0.26;
  const bob=moving?Math.abs(Math.sin(wp))*2.2:Math.sin(p.breathe)*0.9;

  ctx.save();
  ctx.translate(p.x+p.w/2, p.y + bob + crouch);
  ctx.scale(p.facing,1);

  // full-body afterimages on fast, flashy moves + dodge/ult
  const flashy = (mv && (mv.iai||mv.finisher||mv.airDown||p.move==='L3')) && atkActive;
  if(flashy || p.dodge>0 || p.ult>0){
    const ghostCol = (mv&&mv.iai)?'rgba(180,225,255,0.28)':(p.ult>0?'rgba(255,210,120,0.22)':'rgba(230,217,181,0.22)');
    for(let gi=1;gi<=2;gi++){ ctx.save(); ctx.globalAlpha=0.5/gi;
      ctx.translate(-gi*8,0); ctx.fillStyle=ghostCol;
      ctx.beginPath(); ctx.roundRect?ctx.roundRect(-9,4,18,50,6):ctx.rect(-9,4,18,50); ctx.fill(); ctx.restore(); }
  }

  ctx.scale(scX, scY);
  ctx.rotate(p.turnLean + (p.atkLean||0));
  if(p.dodge>4||p.ult>4) ctx.globalAlpha=0.6;

  const SKIN='#c98a5e', SKIN_D='#b0764e', ROBE='#e6dcc0', ROBE_D='#cfc3a2', SASH='#7a1f1f';

  /* ---- LEGS (two-bone, behind torso) ---- */
  let fA,fB;
  if(airborne){ if(p.vy<0){ fA={x:-8,y:50}; fB={x:8,y:45}; } else { fA={x:-10,y:57}; fB={x:10,y:53}; } }
  else if(pose && pose.phase!=='rec'){ fA={x:-11,y:58}; fB={x:12,y:57}; }   // wide fighting stance
  else if(guarding){ fA={x:-9,y:58}; fB={x:9,y:58}; }
  else if(moving){ const s1=Math.sin(wp),s2=Math.sin(wp+Math.PI);
    fA={x:s1*9,y:58-Math.max(0,s1)*6}; fB={x:s2*9,y:58-Math.max(0,s2)*6}; }
  else if(meditating){ fA={x:-15,y:47}; fB={x:15,y:47}; }
  else { fA={x:-4,y:58}; fB={x:4,y:58}; }
  const foot=(f,col)=>{ limb2(f.x<0?-3:3,44,f.x,f.y,9,10,1,6.5,col); ctx.fillStyle='#241a14'; ctx.fillRect(f.x-4,f.y-2,10,3); };
  foot(fA,'#b0a685');   // far leg (shaded)
  foot(fB,ROBE_D);      // near leg

  /* ---- katana saya on the hip: holds the katana normally; empty while the ult
     (iai draw) has it in hand ---- */
  if(!p.cinematicUnarmed) drawSaya(!ulting, 0);

  /* ---- OFF ARM (two-bone) ---- */
  {
    let ox,oy;
    if(pose){ ox=pose.phase==='hit'?-16:-13; oy=pose.phase==='hit'?24:34; }        // counterbalance
    else if(airborne){ ox=-13; oy=p.vy<0?18:34; }
    else if(guarding){ ox=6; oy=30; }
    else if(moving){ ox=-8+Math.sin(wp+Math.PI)*6; oy=34+Math.abs(Math.sin(wp))*3; }
    else if(meditating){ ox=-5; oy=38+Math.sin(p.breathe)*0.4; }
    else { ox=-11; oy=38+Math.sin(p.breathe)*1.2; }
    limb2(-6,27,ox,oy,10,10,-1,4.5,'#d8cdb0',SKIN,3);
  }

  /* ---- TORSO / ROBE ---- */
  ctx.fillStyle=ROBE;
  ctx.beginPath(); ctx.moveTo(-11,20); ctx.lineTo(11,20); ctx.lineTo(10,46); ctx.lineTo(-10,46); ctx.closePath(); ctx.fill();
  const flare = moving?Math.sin(wp)*3 : airborne?4 : pose?Math.max(0,pose.hx)*0.12 : 0;
  ctx.fillStyle=ROBE_D;
  ctx.beginPath(); ctx.moveTo(-10,44); ctx.lineTo(10,44); ctx.lineTo(11+flare,57); ctx.lineTo(-11+flare,57); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-9,22); ctx.lineTo(8,46); ctx.stroke();
  ctx.strokeStyle='rgba(93,76,58,.54)';ctx.lineWidth=1.2;ctx.beginPath();
  ctx.moveTo(-7,25);ctx.quadraticCurveTo(-3,34,-7+flare,45);ctx.moveTo(6,29);ctx.lineTo(8+flare,39);
  ctx.moveTo(-9,49);ctx.quadraticCurveTo(0,52,10+flare,49);ctx.stroke();
  ctx.fillStyle='#c3a46b';ctx.beginPath();ctx.arc(0,36,1.6,0,7);ctx.arc(0,41,1.6,0,7);ctx.fill();
  ctx.strokeStyle='rgba(247,227,188,.52)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-9,57);ctx.lineTo(-10+flare,59);ctx.moveTo(10+flare,57);ctx.lineTo(11+flare,59);ctx.stroke();
  ctx.fillStyle=SASH; ctx.fillRect(-10,42,20,3);

  /* ---- PARRY: no shield arc — just a small orange spark flash at the blade when a
     deflect lands (the spark burst itself comes from parrySuccess) ---- */
  if(parrying && p.parryFlash>0){
    ctx.fillStyle=`rgba(255,176,56,${0.6*p.parryFlash/10})`;
    ctx.beginPath(); ctx.arc(16,26,5,0,7); ctx.fill();
  }
  if(p.blockFlash>0){
    ctx.strokeStyle=`rgba(169,217,237,${p.blockFlash/12})`;ctx.lineWidth=2.2;
    ctx.beginPath();ctx.arc(16,27,9,-1.2,1.2);ctx.stroke();
  }

  /* ---- smear ribbon behind the blade ---- */
  drawTrail();

  /* ---- SWORD ARM (two-bone) + BLADE (khukuri; katana during the ult iai) ---- */
  {
    // hand target: attack/ult pose, else guard / airborne / walk / idle drift
    let hx,hy,rot;
    if(pose){ hx=pose.hx; hy=pose.hy; rot=pose.rot; }
    else if(guarding){ hx=16; hy=24; rot=p.parry>PT?-1.7:-1.4; }   // blade raised to guard
    else if(airborne){ hx=16; hy=30; rot=p.vy<0?-1.2:-0.7; }
    else if(moving){ hx=15; hy=31+Math.sin(wp)*1.5; rot=-0.7+Math.sin(wp)*0.16; }
    else if(meditating){ hx=9; hy=40+Math.sin(p.breathe)*0.4; rot=-0.2; }
    else { hx=15; hy=31+Math.sin(p.breathe)*0.6; rot=-0.6+Math.sin(p.breathe)*0.05; }
    limb2(4,27,hx,hy,12,13,1,5,SKIN,SKIN_D,3.2);
    ctx.save(); ctx.translate(hx,hy); ctx.rotate(rot);
    if(ulting) katanaBlade(1); else if(!p.cinematicUnarmed) khukuriBlade(1);
    ctx.restore();
  }

  /* ---- HEAD ---- */
  const headTilt = pose ? (pose.phase==='wind'?-0.15:0.12) : moving?Math.sin(wp)*0.05 : airborne?(p.vy<0?-0.12:0.08):0;
  ctx.save(); ctx.translate(0,8); ctx.rotate(headTilt);
  // Hari's tied hair sits behind the skull, with its knot at the rear crown.
  const ponySway=pose?1.5:moving?Math.sin(wp)*2.4:airborne?-1:Math.sin(p.breathe)*0.6;
  ctx.fillStyle='#241a14';ctx.beginPath();
  ctx.moveTo(-6,-10);ctx.quadraticCurveTo(-14,-8,-13+ponySway,-1);
  ctx.quadraticCurveTo(-12+ponySway,5,-16+ponySway,9);ctx.quadraticCurveTo(-8,7,-8,-1);
  ctx.lineTo(-3,-8);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.ellipse(-7,-13,4.8,5.1,-.42,0,7);ctx.fill();
  ctx.fillStyle=SASH;ctx.beginPath();ctx.ellipse(-6,-9,2.3,1.45,-.25,0,7);ctx.fill();
  ctx.fillStyle=SKIN; ctx.beginPath(); ctx.arc(0,0,11,0,7); ctx.fill();
  // Give Hari a clear, readable profile instead of the old pin-sized nose.
  ctx.fillStyle=SKIN_D;ctx.beginPath();ctx.moveTo(7,-2);ctx.quadraticCurveTo(10,-1,12,0);ctx.lineTo(16,2);ctx.quadraticCurveTo(13,4,9,4);ctx.lineTo(7,5);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(238,190,145,.78)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(9,-1);ctx.quadraticCurveTo(12,0,14,2);ctx.stroke();
  ctx.fillStyle='#4d3026';ctx.fillRect(12,3,2,1);
  // Shaved scalp: the tied ponytail is the only hair on Hari's head.
  const blink=state.scene!=='cutscene'&&(t%210)<6;
  if(blink){ctx.strokeStyle='#38241b';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(1,-.6);ctx.quadraticCurveTo(3,-1.8,6,-.5);ctx.stroke();}
  else{
    ctx.fillStyle='#fff4df';ctx.beginPath();ctx.ellipse(3.8,-.7,2.9,2.45,-.08,0,7);ctx.fill();
    ctx.fillStyle='#24170f';ctx.beginPath();ctx.ellipse(4.7,-.45,1.15,1.9,0,0,7);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.9)';ctx.beginPath();ctx.arc(4.1,-1.4,.55,0,7);ctx.fill();
  }
  ctx.strokeStyle='rgba(57,39,28,.9)';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(1,-4);ctx.quadraticCurveTo(3,-5,6,-4.4);ctx.stroke();
  // Three distinct white marks sit on the exposed front of Hari's forehead.
  ctx.strokeStyle='#f0e6cf';ctx.lineWidth=1.5;ctx.lineCap='round';
  for(const yy of [-8,-5.5,-3]){ctx.beginPath();ctx.moveTo(2.5,yy);ctx.quadraticCurveTo(4.7,yy-0.5,7,yy);ctx.stroke();}
  ctx.restore();

  ctx.restore();
}

/* --- draw enemy with type styling --- */
export function drawEnemy(e){
  if(!e.alive)return;
  if(e.type==='heavy') drawHeavy(e);
  else if(e.type==='thug') drawThug(e);
  else drawCadre(e);
  // block clash arc (grey) when an attack was blocked
  if(e.blockFlash>0){
    ctx.strokeStyle=`rgba(205,213,223,${e.blockFlash/8})`; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(e.x+e.w/2+e.dir*14, e.y+24, 12, -1.2, 1.2); ctx.stroke();
  }
  // HP bar for heavies
  if(e.type==='heavy'){
    const bw=40, bx=e.x-3, by=e.y-10;
    ctx.fillStyle='#3a0000'; ctx.fillRect(bx,by,bw,5);
    ctx.fillStyle='#cc3030'; ctx.fillRect(bx,by,bw*(e.hp/e.maxHp),5);
  }
  // posture bar (yellow→orange; white when broken) sits just above the enemy
  if(e.posture>0.05 || e.stagger>0){
    const bw=34, bx=e.x+e.w/2-bw/2, by=e.y-16;
    ctx.fillStyle='rgba(20,15,5,0.6)'; ctx.fillRect(bx-1,by-1,bw+2,5);
    const pct=Math.min(1,e.posture/e.maxPosture);
    ctx.fillStyle = e.stagger>0 ? '#ffffff' : pct>0.75?'#ff7a30':'#ffd24a';
    ctx.fillRect(bx,by,bw*pct,3);
  }
  // staggered → pulsing red marker: hit now for a deathblow
  if(e.stagger>0){
    ctx.fillStyle=`rgba(255,70,70,${0.5+0.5*Math.sin(state.t/4)})`;
    ctx.font='bold 15px system-ui'; ctx.textAlign='center';
    ctx.fillText('▼', e.x+e.w/2, e.y-20); ctx.textAlign='left';
  }
}

/* Whole-body lean that sells intent: rock BACK on the wind-up (anticipation),
   drive FORWARD through the attack (follow-through), and a slow idle sway the
   rest of the time so nobody stands perfectly rigid. */
function enemyLean(e){
  if(e.state==='windup') return -0.16;
  if(e.state==='lunge'||e.state==='leap') return 0.18;
  if(e.state==='slam') return 0.12;
  return Math.sin(e.anim*0.5)*0.035;
}

/* Enemies get an articulated walk cycle too (two-bone legs, knees bend forward).
   `e.anim` is advanced in GameScene. */
function enemyLegs(e, hipY, footY, spread, col){
  const moving = e.state==='patrol' || e.state==='lunge';
  const s1 = moving ? Math.sin(e.anim) : 0.15;
  const s2 = moving ? Math.sin(e.anim+Math.PI) : -0.15;
  const seg=(footY-hipY)*0.55+1;
  for(const s of [s1,s2]){
    const fx=s*spread, fy=footY-Math.max(0,s)*4;
    limb2(0,hipY,fx,fy,seg,seg,1,5,col);
    ctx.fillStyle='#241a14'; ctx.fillRect(fx-3,fy-1,8,2.5);
  }
}

/* Articulated weapon arm for mooks: cocks BACK on the wind-up, thrusts FORWARD
   through a lunge/leap/slam (with a slash smear), else rests. `weapon` draws the
   blade/club in the hand's local frame (blade points +x). */
function enemyArm(e, sx, sy, reach, col, weapon){
  const st=e.state;
  let hx,hy,rot;
  if(st==='windup'){ hx=-7; hy=sy-12; rot=-2.2; }
  else if(st==='lunge'||st==='leap'){ hx=reach; hy=sy-1; rot=-0.1; }
  else if(st==='slam'){ hx=reach*0.55; hy=sy+16; rot=1.1; }
  else { hx=reach*0.5; hy=sy+5; rot=-0.3+Math.sin(e.anim)*0.12; }
  // smear first, behind the arm
  if(st==='lunge'||st==='leap'){
    ctx.fillStyle='rgba(255,240,205,0.30)';
    ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(hx,hy-6); ctx.lineTo(hx+12,hy); ctx.lineTo(hx,hy+6); ctx.closePath(); ctx.fill();
  }
  limb2(sx,sy,hx,hy,reach*0.55+2,reach*0.55+2,1,4.4,col,'#c0895a',2.6);
  ctx.save(); ctx.translate(hx,hy); ctx.rotate(rot); weapon(); ctx.restore();
}

function drawCadre(e){
  const t=state.t;
  const skin='#c98a5e'; const coat=e.hitT>0?'#ff6644':'#16161d';
  const bob=(e.state==='patrol'||e.state==='lunge')?Math.abs(Math.sin(e.anim))*1.6:Math.sin(e.anim*0.5)*0.6;
  ctx.save(); ctx.translate(e.x+e.w/2,e.y+bob); ctx.scale(e.dir,1); ctx.rotate(enemyLean(e));
  if(e.state==='windup'){ ctx.fillStyle=`rgba(235,150,40,${0.25+0.3*Math.abs(Math.sin(t/4))})`;
    ctx.beginPath(); ctx.ellipse(0,22,20,30,0,0,7); ctx.fill(); }
  enemyLegs(e,32,46,6,'#e7e1cf');
  // sword arm (articulated, posed by state)
  enemyArm(e, 6, 20, 24, skin, ()=>{
    ctx.fillStyle='#bfc6d2'; ctx.beginPath(); ctx.moveTo(0,-1.4);
    ctx.quadraticCurveTo(16,-2,24,-0.2); ctx.quadraticCurveTo(16,2.4,0,1.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#5a3a20'; ctx.fillRect(-5,-2,6,4);
  });
  ctx.fillStyle=coat; ctx.fillRect(-12,17,5,16); ctx.fillRect(7,17,5,16);
  ctx.fillStyle=skin; ctx.fillRect(-12,31,5,4); ctx.fillRect(7,31,5,4);
  ctx.fillStyle='#ece3cc'; ctx.fillRect(-4,16,8,17);
  ctx.fillStyle=coat; ctx.fillRect(-9,16,6,18); ctx.fillRect(3,16,6,18);
  ctx.beginPath(); ctx.moveTo(-3,16); ctx.lineTo(-3,26); ctx.lineTo(0,17); ctx.fill();
  ctx.beginPath(); ctx.moveTo(3,16); ctx.lineTo(3,26); ctx.lineTo(0,17); ctx.fill();
  ctx.fillStyle='#7a1f1f'; ctx.fillRect(-1,17,2,7);
  ctx.fillStyle='#4d3028';ctx.fillRect(-12,31,24,4);ctx.fillStyle='#c19a5e';ctx.fillRect(5,31,4,4);
  ctx.strokeStyle='rgba(183,153,112,.62)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-8,22);ctx.lineTo(-5,29);ctx.moveTo(8,22);ctx.lineTo(5,29);ctx.stroke();
  ctx.fillStyle='#8f302a';ctx.beginPath();ctx.moveTo(-10,18);ctx.lineTo(0,22);ctx.lineTo(10,18);ctx.lineTo(7,25);ctx.lineTo(0,28);ctx.lineTo(-7,25);ctx.closePath();ctx.fill();
  ctx.fillStyle=skin; ctx.fillRect(-3,9,6,5); ctx.beginPath(); ctx.arc(0,4,8,0,7); ctx.fill();
  ctx.fillStyle='#fff'; ctx.fillRect(2,2,4,3); ctx.fillStyle='#201810'; ctx.fillRect(4,2,2,3);
  ctx.fillRect(1,-1,7,1.4); ctx.fillStyle='#2e2218'; ctx.fillRect(-1,7,7,2);
  ctx.strokeStyle='#51352a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(6,5);ctx.lineTo(9,7);ctx.moveTo(1,11);ctx.lineTo(6,11);ctx.stroke();
  drawTopi(0,-2,9,'#161620');
  ctx.restore();
}

function drawThug(e){
  const t=state.t;
  // Faster, leaner, darker jacket
  const skin='#c08060'; const coat=e.hitT>0?'#ff6644':'#1a2a1a';
  const bob=(e.state==='patrol'||e.state==='lunge')?Math.abs(Math.sin(e.anim))*1.9:Math.sin(e.anim*0.5)*0.7;
  ctx.save(); ctx.translate(e.x+17,e.y+4+bob); ctx.scale(e.dir,1); ctx.rotate(enemyLean(e));
  if(e.dodgeCd>30){ ctx.globalAlpha=0.5; } // translucent when dodging
  if(e.state==='windup'){ ctx.fillStyle=`rgba(80,235,100,${0.2+0.25*Math.abs(Math.sin(t/4))})`;
    ctx.beginPath(); ctx.ellipse(0,18,16,26,0,0,7); ctx.fill(); }
  enemyLegs(e,28,40,5,'#e0d4b8');
  // knife arm (articulated)
  enemyArm(e, 4, 16, 18, skin, ()=>{
    ctx.fillStyle='#cfd5df'; ctx.beginPath(); ctx.moveTo(0,-1.2);
    ctx.quadraticCurveTo(11,-2,16,0); ctx.quadraticCurveTo(10,2,0,1.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#3a2010'; ctx.fillRect(-4,-1.6,5,3.2);
  });
  ctx.fillStyle=coat; ctx.fillRect(-10,14,4,14); ctx.fillRect(6,14,4,14);
  ctx.fillStyle=skin; ctx.fillRect(-10,26,4,4); ctx.fillRect(6,26,4,4);
  ctx.fillStyle='#ddd8c0'; ctx.fillRect(-3,14,6,15);
  ctx.fillStyle=coat; ctx.fillRect(-8,14,5,16); ctx.fillRect(3,14,5,16);
  ctx.fillStyle='#3a7a3a'; ctx.fillRect(-1,14,2,6); // green belt
  ctx.fillStyle='#574332';ctx.fillRect(-10,27,20,3);ctx.fillStyle='#a68a58';ctx.fillRect(-9,29,7,7);
  ctx.strokeStyle='rgba(193,163,122,.62)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-7,18);ctx.lineTo(-3,25);ctx.moveTo(7,18);ctx.lineTo(3,25);ctx.stroke();
  ctx.fillStyle=skin; ctx.fillRect(-2,7,4,5); ctx.beginPath(); ctx.arc(0,3,7,0,7); ctx.fill();
  ctx.fillStyle='#101008';ctx.beginPath();ctx.moveTo(-7,5);ctx.quadraticCurveTo(-7,-5,1,-5);ctx.quadraticCurveTo(8,-3,7,5);ctx.lineTo(4,2);ctx.lineTo(-4,4);ctx.closePath();ctx.fill(); // dark hood and hair
  ctx.fillStyle='#eee0c0';ctx.fillRect(3,4,3,2);ctx.fillStyle='#19120e';ctx.fillRect(4,4,1.4,2);
  ctx.fillStyle='#201810'; ctx.fillRect(-2,5,7,2); // brow
  ctx.strokeStyle='#963e32';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-5,10);ctx.lineTo(4,10);ctx.stroke();
  ctx.restore();
}

function drawHeavy(e){
  const t=state.t;
  // Big, wide, slow — wears red band
  const skin='#c89070'; const coat=e.hitT>0?'#ff6644':'#1c1420';
  const bob=(e.state==='patrol'||e.state==='lunge')?Math.abs(Math.sin(e.anim))*2.4:Math.sin(e.anim*0.5)*0.9;
  ctx.save(); ctx.translate(e.x+17,e.y-8+bob); ctx.scale(e.dir,1); ctx.rotate(enemyLean(e)*0.8);
  if(e.state==='windup'&&e.move==='slam'){ ctx.fillStyle=`rgba(235,60,40,${0.3+0.3*Math.abs(Math.sin(t/3))})`;
    ctx.beginPath(); ctx.ellipse(0,32,32,42,0,0,7); ctx.fill(); }
  // wide legs
  enemyLegs(e,46,64,8,'#e0d8c4');
  // club arm (articulated, heavier)
  enemyArm(e, 8, 22, 26, skin, ()=>{
    ctx.fillStyle='#6a5030'; ctx.fillRect(0,-2.5,26,5);   // handle
    ctx.fillStyle='#8a8a9a'; ctx.fillRect(24,-6,14,13);   // head
    ctx.fillStyle='#6d6d7a'; ctx.fillRect(24,-6,14,3);
  });
  // big coat
  ctx.fillStyle=coat; ctx.fillRect(-16,18,32,32);
  ctx.beginPath(); ctx.ellipse(0,42,18,14,0,0,7); ctx.fill(); // belly
  ctx.fillStyle='#eee0c0'; ctx.fillRect(-5,20,10,22); // shirt
  ctx.fillStyle='#9a1a1a'; ctx.fillRect(-14,18,28,4); // red band
  ctx.fillStyle='#463427';ctx.fillRect(-14,44,28,5);ctx.fillStyle='#c3a25f';ctx.fillRect(-2,44,5,5);
  ctx.strokeStyle='rgba(209,180,133,.6)';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(-12,24);ctx.lineTo(-7,35);ctx.moveTo(12,24);ctx.lineTo(7,35);ctx.moveTo(-8,39);ctx.lineTo(-5,45);ctx.stroke();
  // wide arms
  ctx.fillStyle=coat; ctx.fillRect(-18,20,5,16); ctx.fillRect(13,20,5,16);
  ctx.fillStyle=skin; ctx.fillRect(-18,32,5,6); ctx.fillRect(13,32,5,6);
  // big head
  ctx.fillStyle=skin; ctx.fillRect(-5,12,10,8); ctx.beginPath(); ctx.arc(0,6,13,0,7); ctx.fill();
  // jowls
  ctx.beginPath(); ctx.arc(-8,11,5,0,7); ctx.arc(8,11,5,0,7); ctx.fill();
  ctx.fillStyle='#2a1a10'; ctx.fillRect(-8,-1,16,3); // brow
  ctx.fillStyle='#fff'; ctx.fillRect(-6,2,4,3); ctx.fillRect(2,2,4,3);
  ctx.fillStyle='#201810'; ctx.fillRect(-4,2,2,3); ctx.fillRect(4,2,2,3);
  drawTopi(0,-3,12,'#161620');
  ctx.restore();
}

export function drawBoss(){
  const t=state.t;
  const {x,y,dir,state:bstate,hitT,phase,spinT,enrageFlash}=boss;
  const skin='#c98a5e';
  const coat=hitT>0?'#ff6644':enrageFlash>0?'#74372f':(phase===3?'#42221f':phase===2?'#302b39':'#29313d');
  const bob=bstate==='wait'?Math.sin(boss.anim)*1.8:0;
  ctx.save(); ctx.translate(x+36,y+bob);ctx.scale(1.12,1.18);
  if(spinT>0){ ctx.rotate((1-spinT/52)*dir*Math.PI*2); } // spin visual
  ctx.scale(dir,1);
  // Keep the minister's silhouette grounded and unmistakable as a suited man.
  const blean = bstate&&bstate.endsWith('_tel') ? -0.12
              : (bstate==='slash'||bstate==='leap'||bstate==='spin'||bstate==='stomp') ? 0.13
              : Math.sin(boss.anim*0.5)*0.025;
  ctx.rotate(blean);
  if(bstate&&bstate.endsWith('_tel')){ ctx.fillStyle=`rgba(235,80,60,${0.25+0.3*Math.abs(Math.sin(t/4))})`;
    ctx.beginPath(); ctx.ellipse(0,48,30,46,0,0,7); ctx.fill(); }
  if(bstate==='spin'){ ctx.fillStyle=`rgba(255,150,50,${0.4+0.2*Math.sin(t/2)})`;
    ctx.beginPath(); ctx.arc(0,48,46,0,7); ctx.fill(); }
  // Separate trouser legs and shoes; stride reads as two legs instead of one stick.
  {
    const moving=bstate==='wait'||bstate==='slash'||bstate==='leap';
    const s1=moving?Math.sin(boss.anim)*5:0, s2=moving?Math.sin(boss.anim+Math.PI)*5:0;
    const trouser=(hip,step,shade)=>{
      const knee=hip+step*.48, ankle=hip+step;
      ctx.fillStyle=shade;ctx.beginPath();ctx.moveTo(hip-7,63);ctx.lineTo(hip+6,63);ctx.lineTo(knee+6,78);ctx.lineTo(ankle+5,90);ctx.lineTo(ankle-6,90);ctx.lineTo(knee-6,79);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(76,68,59,.65)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(knee+3,80);ctx.lineTo(ankle+2,88);ctx.stroke();
      ctx.fillStyle='#17191e';ctx.beginPath();ctx.moveTo(ankle-7,89);ctx.lineTo(ankle+5,89);ctx.quadraticCurveTo(ankle+11,92,ankle+10,95);ctx.lineTo(ankle-8,95);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(220,213,194,.38)';ctx.fillRect(ankle-5,91,8,1);
    };
    trouser(-11,s1,'#dfd8c7');trouser(11,s2,'#c8c1b2');
  }
  // Arms telegraph attacks with body language; the minister carries no weapon.
  const tel=bstate&&bstate.endsWith('_tel'), striking=['slash','leap','spin','stomp'].includes(bstate);
  const raised=bstate==='wait'||bstate==='taunt';
  const leadElbow=raised?{x:24,y:8}:tel?{x:28,y:32}:striking?{x:27,y:38}:{x:23,y:40};
  const leadHand=raised?{x:25,y:-5}:tel?{x:36,y:40}:striking?{x:32,y:44}:{x:24,y:48};
  ctx.strokeStyle='#10141c';ctx.lineWidth=13;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(-19,27);ctx.lineTo(-27,40);ctx.lineTo(-24,53);ctx.stroke();
  ctx.beginPath();ctx.moveTo(18,27);ctx.lineTo(leadElbow.x,leadElbow.y);ctx.lineTo(leadHand.x,leadHand.y);ctx.stroke();
  ctx.strokeStyle=coat;ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(-19,27);ctx.lineTo(-27,40);ctx.lineTo(-24,53);ctx.stroke();
  ctx.beginPath();ctx.moveTo(18,27);ctx.lineTo(leadElbow.x,leadElbow.y);ctx.lineTo(leadHand.x,leadHand.y);ctx.stroke();
  ctx.fillStyle=skin;ctx.beginPath();ctx.arc(-24,55,5,0,7);ctx.arc(leadHand.x+1,leadHand.y+1,raised?6:5.5,0,7);ctx.fill();
  if(raised){ctx.strokeStyle='#8d5a3c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(leadHand.x-2,leadHand.y-3);ctx.lineTo(leadHand.x-1,leadHand.y);ctx.moveTo(leadHand.x+1,leadHand.y-3);ctx.lineTo(leadHand.x+2,leadHand.y);ctx.stroke();}
  // Simple dark jacket over a white open-collar shirt, with no tie.
  ctx.fillStyle='#10141c';ctx.beginPath();ctx.moveTo(-23,20);ctx.lineTo(-17,17);ctx.lineTo(17,17);ctx.lineTo(24,21);ctx.lineTo(22,67);ctx.quadraticCurveTo(0,73,-22,67);ctx.closePath();ctx.fill();
  ctx.fillStyle=coat;ctx.beginPath();ctx.moveTo(-20,21);ctx.lineTo(-15,19);ctx.lineTo(15,19);ctx.lineTo(21,22);ctx.lineTo(19,65);ctx.quadraticCurveTo(0,70,-19,65);ctx.closePath();ctx.fill();
  ctx.fillStyle='#eee9db';ctx.beginPath();ctx.moveTo(-7,22);ctx.lineTo(7,22);ctx.lineTo(8,62);ctx.quadraticCurveTo(0,65,-8,62);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(126,113,97,.2)';ctx.beginPath();ctx.moveTo(4,29);ctx.lineTo(6,58);ctx.lineTo(3,60);ctx.closePath();ctx.fill();
  ctx.fillStyle='#e9e3d5';ctx.beginPath();ctx.moveTo(-8,18);ctx.lineTo(0,25);ctx.lineTo(-3,31);ctx.lineTo(-12,22);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(8,18);ctx.lineTo(0,25);ctx.lineTo(3,31);ctx.lineTo(12,22);ctx.closePath();ctx.fill();
  ctx.fillStyle='#171c25';ctx.beginPath();ctx.moveTo(-17,20);ctx.lineTo(-7,21);ctx.lineTo(-1,29);ctx.lineTo(-10,38);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(17,20);ctx.lineTo(7,21);ctx.lineTo(1,29);ctx.lineTo(10,38);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(214,218,218,.24)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-18,30);ctx.lineTo(-17,61);ctx.moveTo(18,30);ctx.lineTo(17,61);ctx.stroke();
  ctx.fillStyle=skin;ctx.fillRect(-8,12,16,12);ctx.beginPath();ctx.ellipse(0,4,18,20,0,0,7);ctx.fill();
  // Broad cheeks, swept hair, small dark glasses and a thick curled moustache form a bold caricature.
  ctx.fillStyle='rgba(234,171,126,.38)';ctx.beginPath();ctx.ellipse(-12,10,5,8,-.2,0,7);ctx.ellipse(12,10,5,8,.2,0,7);ctx.fill();
  ctx.fillStyle='#211b19';ctx.beginPath();ctx.moveTo(-17,0);ctx.quadraticCurveTo(-20,-14,-10,-19);ctx.quadraticCurveTo(-3,-24,5,-19);ctx.quadraticCurveTo(15,-19,18,-9);ctx.lineTo(12,-11);ctx.quadraticCurveTo(4,-8,-2,-12);ctx.quadraticCurveTo(-8,-7,-15,1);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(193,193,181,.78)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-14,-11);ctx.quadraticCurveTo(-10,-17,-5,-18);ctx.moveTo(1,-19);ctx.quadraticCurveTo(8,-18,12,-14);ctx.stroke();
  ctx.fillStyle='#211810';ctx.beginPath();ctx.ellipse(-17,7,2.6,5,0,0,7);ctx.ellipse(17,7,2.6,5,0,0,7);ctx.fill();
  ctx.fillStyle='#b77954';ctx.beginPath();ctx.ellipse(0,8,5.4,7.5,0,0,7);ctx.fill();
  ctx.fillStyle='#29282b';ctx.beginPath();ctx.ellipse(-7,1,7.4,5.4,-.06,0,7);ctx.ellipse(7,1,7.4,5.4,.06,0,7);ctx.fill();
  ctx.strokeStyle='#151619';ctx.lineWidth=1.8;ctx.beginPath();ctx.ellipse(-7,1,7.4,5.4,-.06,0,7);ctx.ellipse(7,1,7.4,5.4,.06,0,7);ctx.moveTo(-.2,1);ctx.lineTo(.2,1);ctx.moveTo(-14,-1);ctx.lineTo(-18,-3);ctx.moveTo(14,-1);ctx.lineTo(18,-3);ctx.stroke();
  ctx.strokeStyle='rgba(238,235,220,.52)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-12,-1);ctx.lineTo(-8,-3);ctx.moveTo(2,-2);ctx.lineTo(6,-4);ctx.stroke();
  ctx.fillStyle='#211711';ctx.beginPath();ctx.moveTo(-3,10);ctx.quadraticCurveTo(-10,6,-14,12);ctx.quadraticCurveTo(-12,18,-6,16);ctx.quadraticCurveTo(0,21,6,16);ctx.quadraticCurveTo(13,19,15,12);ctx.quadraticCurveTo(10,6,3,10);ctx.quadraticCurveTo(0,13,-3,10);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(146,112,83,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-11,12);ctx.quadraticCurveTo(-8,15,-5,14);ctx.moveTo(5,14);ctx.quadraticCurveTo(9,16,12,12);ctx.stroke();
  ctx.restore();
}

function drawTopi(cx,cy,w,col){
  ctx.fillStyle=col; ctx.beginPath();
  ctx.moveTo(cx-w,cy); ctx.lineTo(cx+w,cy); ctx.lineTo(cx+w*0.78,cy-w*1.35); ctx.lineTo(cx-w*0.78,cy-w*1.35); ctx.fill();
  ctx.fillStyle='#3a3a48'; ctx.fillRect(cx-w,cy-2,w*2,2);
  ctx.fillStyle='#55556a'; ctx.fillRect(cx-w*0.6,cy-w*0.9,3,4); ctx.fillRect(cx+w*0.3,cy-w*0.9,3,4);
}

export function drawHealOrb(x,y){
  // glowing green orb = HP pickup
  const grd=ctx.createRadialGradient(x,y,2,x,y,12);
  grd.addColorStop(0,'rgba(100,255,120,0.95)');
  grd.addColorStop(1,'rgba(40,180,60,0)');
  ctx.fillStyle=grd; ctx.beginPath(); ctx.arc(x,y,12,0,7); ctx.fill();
  ctx.fillStyle='#80ff90'; ctx.beginPath(); ctx.arc(x,y,5,0,7); ctx.fill();
  ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
  ctx.fillText('+2',x,y+3); ctx.textAlign='left';
}

export function drawMuna(x,y,run=0){ ctx.save(); ctx.translate(x,y+Math.sin(state.t/38)*0.8);
  // Layered village dress and shawl, drawn with the same warm, inked shapes as Hari.
  ctx.fillStyle='rgba(4,5,7,.26)';ctx.beginPath();ctx.ellipse(0,51,14,3,0,0,7);ctx.fill();
  if(run){const step=Math.sin(run)*3;ctx.strokeStyle='#33231d';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();
    ctx.moveTo(-4,45);ctx.lineTo(-5+step,53);ctx.moveTo(4,45);ctx.lineTo(5-step,53);ctx.stroke();}
  ctx.fillStyle='#2a1717';ctx.beginPath();ctx.moveTo(-8,19);ctx.lineTo(8,19);ctx.lineTo(13,49);ctx.quadraticCurveTo(0,54,-13,49);ctx.closePath();ctx.fill();
  ctx.fillStyle='#80352f';ctx.beginPath();ctx.moveTo(-7,19);ctx.lineTo(7,19);ctx.lineTo(10,46);ctx.lineTo(-10,46);ctx.closePath();ctx.fill();
  ctx.fillStyle='#285642';ctx.beginPath();ctx.moveTo(-9,38);ctx.lineTo(9,38);ctx.lineTo(12,49);ctx.quadraticCurveTo(0,53,-12,49);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(220,184,121,.68)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-8,43);ctx.lineTo(8,43);ctx.moveTo(-5,47);ctx.lineTo(-4,50);ctx.moveTo(2,47);ctx.lineTo(3,50);ctx.stroke();
  ctx.fillStyle='#d8c8a9';ctx.beginPath();ctx.moveTo(-10,20);ctx.lineTo(-5,17);ctx.lineTo(1,32);ctx.lineTo(9,21);ctx.lineTo(13,24);ctx.lineTo(4,39);ctx.lineTo(-4,32);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#8d594a';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-5,23);ctx.lineTo(-1,31);ctx.lineTo(5,25);ctx.stroke();
  // Dark hair is gathered into a high pony, echoing the supplied silhouette;
  // the village dress and shawl above remain unchanged.
  ctx.fillStyle='#21140f';ctx.beginPath();ctx.moveTo(-8,9);ctx.quadraticCurveTo(-13,-4,-3,-5);ctx.quadraticCurveTo(4,-8,9,-3);ctx.lineTo(8,13);ctx.lineTo(4,19);ctx.lineTo(-7,18);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-7,1);ctx.quadraticCurveTo(-14,3,-13,12);ctx.lineTo(-11,21);ctx.quadraticCurveTo(-8,18,-8,13);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(137,89,55,.75)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-11,7);ctx.quadraticCurveTo(-10,13,-10,18);ctx.stroke();
  ctx.fillStyle='#c98a5e';ctx.beginPath();ctx.ellipse(0,9,8.7,10.5,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(234,171,126,.45)';ctx.beginPath();ctx.ellipse(-5,11,2.1,3.8,-.3,0,7);ctx.fill();
  ctx.fillStyle='#21140f';ctx.beginPath();ctx.moveTo(-8,7);ctx.quadraticCurveTo(-11,-3,-2,-5);ctx.quadraticCurveTo(4,-6,8,-1);ctx.lineTo(4,3);ctx.quadraticCurveTo(-2,0,-8,7);ctx.closePath();ctx.fill();
  ctx.fillStyle='#21140f';ctx.beginPath();ctx.moveTo(-5,-3);ctx.quadraticCurveTo(-14,-11,-9,-16);ctx.quadraticCurveTo(-2,-18,1,-9);ctx.quadraticCurveTo(-1,-4,-5,-3);ctx.closePath();ctx.fill();
  ctx.fillStyle='#963d32';ctx.beginPath();ctx.ellipse(-5,-5,2.1,1.4,-.4,0,7);ctx.fill();
  ctx.fillStyle='#fff0dc';ctx.beginPath();ctx.ellipse(-3,7,1.8,1.25,0,0,7);ctx.ellipse(3,7,1.8,1.25,0,0,7);ctx.fill();
  ctx.fillStyle='#24170f';ctx.beginPath();ctx.arc(-2.5,7,0.8,0,7);ctx.arc(3.5,7,0.8,0,7);ctx.fill();
  ctx.strokeStyle='#573528';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-5,4);ctx.lineTo(-2,3);ctx.moveTo(2,3);ctx.lineTo(5,4);ctx.moveTo(0,8);ctx.lineTo(-1,12);ctx.lineTo(1,12);ctx.moveTo(-2,15);ctx.quadraticCurveTo(0,16.5,2.5,14.8);ctx.stroke();
  ctx.fillStyle='rgba(177,87,67,.42)';ctx.beginPath();ctx.arc(-6,12,1.5,0,7);ctx.arc(6,12,1.5,0,7);ctx.fill();
  ctx.fillStyle='#d8b879';ctx.beginPath();ctx.arc(-8,11,1.3,0,7);ctx.arc(8,11,1.3,0,7);ctx.fill();
  ctx.restore(); }
export function drawRaju(x,y,run=0){ ctx.save(); ctx.translate(x,y+Math.sin(state.t/30)*1.1);
  const stride=run?Math.sin(run)*3:0;
  ctx.fillStyle='rgba(4,5,7,.24)';ctx.beginPath();ctx.ellipse(0,51,13,3,0,0,7);ctx.fill();
  ctx.fillStyle='#d8d1c0';ctx.beginPath();ctx.moveTo(-8,42);ctx.lineTo(-1,42);ctx.lineTo(-2+stride,51);ctx.lineTo(-8+stride,51);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(1,42);ctx.lineTo(8,42);ctx.lineTo(8-stride,51);ctx.lineTo(2-stride,51);ctx.closePath();ctx.fill();
  ctx.fillStyle='#17191d';ctx.beginPath();ctx.moveTo(-9+stride,50);ctx.lineTo(-2+stride,50);ctx.lineTo(-2+stride,53);ctx.lineTo(-10+stride,53);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(2-stride,50);ctx.lineTo(9-stride,50);ctx.lineTo(11-stride,53);ctx.lineTo(2-stride,53);ctx.closePath();ctx.fill();
  ctx.fillStyle='#1e2a3a';ctx.beginPath();ctx.moveTo(-9,18);ctx.lineTo(9,18);ctx.lineTo(12,46);ctx.lineTo(-12,46);ctx.closePath();ctx.fill();
  ctx.fillStyle='#40536c';ctx.beginPath();ctx.moveTo(-8,20);ctx.lineTo(0,23);ctx.lineTo(7,20);ctx.lineTo(9,43);ctx.lineTo(-9,43);ctx.closePath();ctx.fill();
  ctx.fillStyle='#d9cdb6';ctx.beginPath();ctx.moveTo(-5,18);ctx.lineTo(0,24);ctx.lineTo(5,18);ctx.lineTo(3,37);ctx.lineTo(-3,37);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(174,153,117,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-8,40);ctx.lineTo(8,40);ctx.moveTo(0,27);ctx.lineTo(0,38);ctx.stroke();
  ctx.fillStyle='#a27650';ctx.fillRect(-10,16,20,4);ctx.fillStyle='#caa84e';ctx.fillRect(-2,17,4,3);
  // A small Dhaka topi gives Raju a silhouette distinct from Muna's ponytail.
  ctx.fillStyle='#b87a56';ctx.beginPath();ctx.ellipse(0,9,8.6,10.2,0,0,7);ctx.fill();
  ctx.fillStyle='rgba(225,158,115,.4)';ctx.beginPath();ctx.ellipse(-5,11,1.8,3,-.3,0,7);ctx.fill();
  ctx.fillStyle='#38241b';ctx.beginPath();ctx.ellipse(-8,9,1.6,3,0,0,7);ctx.ellipse(8,9,1.6,3,0,0,7);ctx.fill();
  drawTopi(0,1,9,'#252c38');
  ctx.strokeStyle='rgba(181,151,112,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-6,-4);ctx.quadraticCurveTo(0,-6,6,-4);ctx.stroke();
  ctx.fillStyle='#fff0dc';ctx.beginPath();ctx.ellipse(-3,7,1.8,1.25,0,0,7);ctx.ellipse(3,7,1.8,1.25,0,0,7);ctx.fill();
  ctx.fillStyle='#24170f';ctx.beginPath();ctx.arc(-2.5,7,0.8,0,7);ctx.arc(3.5,7,0.8,0,7);ctx.fill();
  ctx.strokeStyle='#422c20';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-5,5);ctx.lineTo(-2,4);ctx.moveTo(2,4);ctx.lineTo(5,5);ctx.moveTo(0,8);ctx.lineTo(-1,12);ctx.lineTo(1,12);ctx.stroke();
  ctx.fillStyle='#493025';ctx.beginPath();ctx.moveTo(-2,14);ctx.quadraticCurveTo(-5,12,-6,15);ctx.quadraticCurveTo(-3,17,0,16);ctx.quadraticCurveTo(4,17,6,15);ctx.quadraticCurveTo(4,12,2,14);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#422c20';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-2,18);ctx.quadraticCurveTo(0,19,2,18);ctx.stroke();
  ctx.restore(); }

// A village messenger, with a wrapped shawl and warm earth-tone clothing so
// the silhouette is distinct from Raju's blue jacket and topi.
export function drawVillager(x,y,run=0){
  const step=Math.sin(run)*3;
  ctx.save();ctx.translate(x,y+Math.sin(state.t/24)*0.7);
  ctx.strokeStyle='#34251d';ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-4,43);ctx.lineTo(-6+step,52);ctx.moveTo(4,43);ctx.lineTo(7-step,52);ctx.stroke();
  ctx.fillStyle='#985b3f';ctx.beginPath();ctx.moveTo(-10,17);ctx.lineTo(10,17);ctx.lineTo(13,45);ctx.lineTo(-13,45);ctx.closePath();ctx.fill();
  ctx.fillStyle='#c7a66d';ctx.beginPath();ctx.moveTo(-9,19);ctx.lineTo(9,19);ctx.lineTo(4,33);ctx.lineTo(-11,29);ctx.closePath();ctx.fill();
  ctx.fillStyle='#c98a5e';ctx.beginPath();ctx.arc(0,9,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#574038';ctx.beginPath();ctx.arc(0,7,10,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-10,6,20,4);
  ctx.fillStyle='#2b201b';ctx.fillRect(3,8,3,2);
  ctx.strokeStyle='#c7a66d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-7,23);ctx.lineTo(-16,33+step);ctx.moveTo(7,23);ctx.lineTo(15,20);ctx.stroke();
  ctx.restore();
}

// A small obstacle rooted in the village's everyday life: woolly coat, curved
// horns, pack blanket and a readable lowered-head charge tell the player to jump.
export function drawYak(yak){
  const t=yak.anim||0, charging=yak.state==='charge', warning=yak.state==='warn';
  const bob=yak.state==='graze'?Math.sin(t)*1.2:charging?Math.abs(Math.sin(t*1.5))*2:0;
  ctx.save();ctx.translate(yak.x+yak.w/2,yak.y+4+bob);ctx.scale(yak.dir||1,1);
  ctx.fillStyle='rgba(3,4,6,.32)';ctx.beginPath();ctx.ellipse(0,45,36,5,0,0,7);ctx.fill();
  if(charging){ctx.fillStyle='rgba(205,103,62,.16)';ctx.beginPath();ctx.ellipse(-8,26,42,25,0,0,7);ctx.fill();}
  // shaggy body layered in the game's muted brown and parchment palette
  ctx.fillStyle='#30251f';ctx.beginPath();ctx.ellipse(-2,25,32,19,0,0,7);ctx.fill();
  ctx.fillStyle='#65503d';ctx.beginPath();ctx.ellipse(-4,20,28,15,0,0,7);ctx.fill();
  for(let i=0;i<9;i++){const xx=-27+i*6.5, yy=27+Math.sin(i*1.8)*4;
    ctx.fillStyle=i%2?'#4b3a2e':'#786047';ctx.beginPath();ctx.ellipse(xx,yy,7,11,0.25,0,7);ctx.fill();}
  // long fringe and mantle break the body into clear, drawable planes
  ctx.fillStyle='#33251e';ctx.beginPath();ctx.moveTo(-25,12);ctx.quadraticCurveTo(-7,-3,11,12);ctx.lineTo(23,37);ctx.lineTo(13,35);ctx.lineTo(5,42);ctx.lineTo(-4,35);ctx.lineTo(-14,40);ctx.lineTo(-24,30);ctx.closePath();ctx.fill();
  ctx.fillStyle='#8e704d';ctx.beginPath();ctx.moveTo(-16,9);ctx.lineTo(5,7);ctx.lineTo(17,15);ctx.lineTo(8,20);ctx.lineTo(-8,17);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#b29a70';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-12,11);ctx.lineTo(5,12);ctx.lineTo(12,17);ctx.stroke();
  // pack blanket and tied bundles; a small village cargo animal, not a fantasy beast
  ctx.fillStyle='#713a32';ctx.beginPath();ctx.moveTo(-20,7);ctx.lineTo(7,5);ctx.lineTo(12,17);ctx.lineTo(-16,19);ctx.closePath();ctx.fill();
  ctx.fillStyle='#b38b58';ctx.fillRect(-15,10,22,2);ctx.fillRect(-11,15,17,2);
  ctx.fillStyle='#49372a';ctx.beginPath();ctx.moveTo(20,15);ctx.quadraticCurveTo(34,12,36,25);ctx.lineTo(29,34);ctx.lineTo(18,30);ctx.closePath();ctx.fill();
  ctx.fillStyle='#a17b54';ctx.beginPath();ctx.ellipse(31,25,7,8,0.25,0,7);ctx.fill();
  ctx.fillStyle='#211913';ctx.beginPath();ctx.ellipse(35,28,5,4,0,0,7);ctx.fill();
  ctx.strokeStyle='#d1bc91';ctx.lineWidth=2.3;ctx.lineCap='round';ctx.beginPath();
  ctx.moveTo(25,18);ctx.quadraticCurveTo(25,8,18,8);ctx.moveTo(27,18);ctx.quadraticCurveTo(32,8,37,12);ctx.stroke();
  ctx.fillStyle='#eee0c0';ctx.beginPath();ctx.arc(23,12,1.8,0,7);ctx.arc(32,13,1.8,0,7);ctx.fill();
  ctx.fillStyle='#171311';ctx.beginPath();ctx.arc(32,24,1.3,0,7);ctx.fill();
  ctx.strokeStyle='#231a14';ctx.lineWidth=5;ctx.lineCap='round';
  for(let i=0;i<4;i++){const lx=-22+i*14, phase=Math.sin(t+i*Math.PI)*2.5;
    ctx.beginPath();ctx.moveTo(lx,31);ctx.lineTo(lx+phase,43);ctx.lineTo(lx+phase+(charging?3:0),46);ctx.stroke();}
  if(warning){ctx.strokeStyle=`rgba(223,161,92,${.4+.3*Math.sin(state.t/3)})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(3,23,39,26,0,0,7);ctx.stroke();}
  ctx.restore();
}

export function drawCage(){
  const x=cage.x,y=cage.y??GROUND-52,floorY=y+52;
  if(state.scene==='play'){
    ctx.fillStyle='#594334';ctx.fillRect(x-4,floorY-66,8,63);
    ctx.fillStyle='#79583c';ctx.fillRect(x-13,floorY-66,26,5);
    drawMuna(x,y);
    ctx.strokeStyle='#a78a65';ctx.lineWidth=3;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x-10,y+25);ctx.lineTo(x+10,y+25);ctx.moveTo(x-10,y+39);ctx.lineTo(x+10,y+39);ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,y+25,7,3,0,0,Math.PI*2);ctx.ellipse(x,y+39,7,3,0,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+9,y+25);ctx.quadraticCurveTo(x+24,y+32,x+4,floorY-40);ctx.stroke();
  }
}

export function drawCutsceneActors(){
  const runPhase=cs.action==='run'?state.t/3:0;
  drawHari();
  drawMuna(cs.muna.x,cs.muna.y,runPhase);
  if(cs.rajuIn){
    const t=cs.actionT;
    const recoil=cs.action==='punch'&&t>=14&&t<38?Math.sin((t-14)/24*Math.PI)*11:0;
    drawRaju(cs.raju.x+recoil,cs.raju.y,runPhase);
    if(cs.action==='punch'&&t<32){
      const reach=t<8?8+t*6:t<15?56:Math.max(8,56-(t-15)*3.2);
      ctx.save();ctx.translate(player.x+player.w/2,player.y+28);ctx.scale(player.facing,1);
      ctx.lineCap='round';ctx.strokeStyle='#c98a5e';ctx.lineWidth=7;
      ctx.beginPath();ctx.moveTo(1,0);ctx.quadraticCurveTo(reach*.48,-7,reach,-3);ctx.stroke();
      ctx.fillStyle='#d79a6b';ctx.beginPath();ctx.arc(reach,-3,5.5,0,Math.PI*2);ctx.fill();ctx.restore();
      if(t>=14&&t<24){
        const x=cs.raju.x-6,y=cs.raju.y+11;ctx.save();ctx.strokeStyle=`rgba(255,225,153,${1-(t-14)/10})`;ctx.lineWidth=2;
        for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*4,y+Math.sin(a)*4);ctx.lineTo(x+Math.cos(a)*13,y+Math.sin(a)*13);ctx.stroke();}ctx.restore();
      }
    }
  }
  if(cs.action==='slap'&&cs.actionT<28){
    const t=cs.actionT,reach=t<7?7+t*4.5:t<13?38:Math.max(8,38-(t-13)*3);
    ctx.save();ctx.translate(cs.muna.x,cs.muna.y+27);ctx.scale(-1,1);
    ctx.lineCap='round';ctx.strokeStyle='#c98a5e';ctx.lineWidth=6;
    ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(reach*.48,-8,reach,-4);ctx.stroke();
    ctx.fillStyle='#d79a6b';ctx.beginPath();ctx.arc(reach,-4,5.5,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.save();ctx.strokeStyle='#38241b';ctx.lineWidth=1.7;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(cs.muna.x-6,cs.muna.y+5);ctx.lineTo(cs.muna.x-2,cs.muna.y+3);
    ctx.moveTo(cs.muna.x+2,cs.muna.y+3);ctx.lineTo(cs.muna.x+6,cs.muna.y+5);ctx.stroke();ctx.restore();
    if(t>=11&&t<21){
      const x=player.x+player.w/2-5,y=player.y+15;ctx.save();ctx.strokeStyle=`rgba(255,198,152,${1-(t-11)/10})`;ctx.lineWidth=2;
      for(let k=0;k<6;k++){const a=k*Math.PI/3;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*4,y+Math.sin(a)*4);ctx.lineTo(x+Math.cos(a)*12,y+Math.sin(a)*12);ctx.stroke();}ctx.restore();
    }
  }
}

/* ---- props ---- */
export function drawMomo(x,y,s){ ctx.save(); ctx.translate(x,y); ctx.scale(s,s);
  ctx.strokeStyle='rgba(235,235,215,0.4)'; ctx.lineWidth=1; ctx.beginPath();
  ctx.moveTo(-2,-7); ctx.quadraticCurveTo(-5,-11,-1,-15); ctx.moveTo(3,-7); ctx.quadraticCurveTo(0,-11,4,-16); ctx.stroke();
  ctx.fillStyle='#efe7cf'; ctx.beginPath(); ctx.ellipse(0,1,9,7,0,0,7); ctx.fill();
  ctx.fillStyle='#e0d4b4'; ctx.beginPath(); ctx.ellipse(0,4,9,3.4,0,0,Math.PI); ctx.fill();
  ctx.fillStyle='#f6efda'; ctx.beginPath(); ctx.ellipse(-3,-1,3.5,2.5,-0.4,0,7); ctx.fill();
  ctx.strokeStyle='#cbbd97'; ctx.lineWidth=1;
  for(let i=-3;i<=3;i++){ ctx.beginPath(); ctx.moveTo(0,-5); ctx.quadraticCurveTo(i*2.2,-1,i*3,5.5); ctx.stroke(); }
  ctx.fillStyle='#f6efda'; ctx.beginPath(); ctx.arc(0,-5,2.4,0,7); ctx.fill();
  ctx.restore(); }

export function drawBlade(x,y,spin,col){ ctx.save(); ctx.translate(x,y); ctx.rotate(spin);
  // compact katana/khukuri hybrid
  ctx.fillStyle='#33251a'; ctx.fillRect(-11,-1.6,7,3.2);      // handle
  ctx.fillStyle='#caa84e'; ctx.fillRect(-5,-2.4,1.6,4.8);     // guard
  ctx.fillStyle=col||'#dfe3ea';
  ctx.beginPath(); ctx.moveTo(-4,-1.6);
  ctx.quadraticCurveTo(9,-2.2,15,-0.2);
  ctx.quadraticCurveTo(10,3.4,4,2.2);
  ctx.quadraticCurveTo(-1,1.5,-4,1.8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=0.6;
  ctx.beginPath(); ctx.moveTo(-2,-0.8); ctx.lineTo(13,-0.4); ctx.stroke();
  ctx.restore(); }

export function drawPaper(x,y){ ctx.save(); ctx.translate(x,y+Math.sin(state.t/14)*2);
  ctx.fillStyle='#efe7cd'; ctx.fillRect(-9,-12,18,24); ctx.strokeStyle='#c9bd97'; ctx.strokeRect(-9,-12,18,24);
  ctx.strokeStyle='#9a8f6a'; ctx.lineWidth=1;
  for(let i=-2;i<=2;i++){ ctx.beginPath(); ctx.moveTo(-6,i*4); ctx.lineTo(6,i*4); ctx.stroke(); }
  ctx.restore(); }

export function drawHouse(x,baseY,s=1){
  ctx.save();ctx.translate(x,baseY);ctx.scale(s,s);
  // Compact Upper Mustang mud-brick home: whitewashed walls, timber lintels,
  // flat roof/parapet, and winter firewood stored along the roof edge.
  ctx.fillStyle='rgba(10,9,9,.28)';ctx.beginPath();ctx.ellipse(0,-1,39,5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4b4038';ctx.fillRect(-32,-46,64,46);
  ctx.fillStyle='#9d8b75';ctx.fillRect(-29,-44,58,40);
  ctx.fillStyle='#c0ad91';ctx.fillRect(-29,-44,4,40);ctx.fillRect(25,-44,4,40);
  ctx.fillStyle='#796451';ctx.fillRect(-35,-50,70,7);
  ctx.fillStyle='#52483e';ctx.fillRect(-35,-47,70,3);
  // low mud parapet leaves a believable continuous walking surface behind it
  ctx.fillStyle='#a18b70';ctx.fillRect(-34,-56,6,8);ctx.fillRect(28,-56,6,8);
  ctx.fillRect(-34,-56,10,4);ctx.fillRect(24,-56,10,4);
  // stacked juniper/firewood, kept in one short roof-end bundle
  ctx.fillStyle='#392f29';ctx.fillRect(-18,-55,35,4);
  ctx.strokeStyle='#8a7058';ctx.lineWidth=1.3;
  for(let i=0;i<6;i++){const xx=-17+i*6;ctx.beginPath();ctx.moveTo(xx,-55);ctx.lineTo(xx,-51);ctx.stroke();}
  // deeply set windows with simple timber lintels
  ctx.fillStyle='#342f2b';ctx.fillRect(-23,-37,12,11);ctx.fillRect(11,-37,12,11);
  ctx.fillStyle='#81725f';ctx.fillRect(-21,-35,8,7);ctx.fillRect(13,-35,8,7);
  ctx.fillStyle='#46372c';ctx.fillRect(-8,-25,16,25);
  ctx.fillStyle='#725039';ctx.fillRect(-6,-23,12,23);ctx.fillStyle='#b89a6a';ctx.fillRect(3,-13,2,2);
  // small ochre lintel, no tall chimney: roofs are used for storage and drying.
  ctx.fillStyle='#735845';ctx.fillRect(-25,-41,16,3);ctx.fillRect(9,-41,16,3);
  ctx.restore();
}

export function drawDaraj(x,baseY,open=0){
  ctx.save();ctx.translate(x,baseY);
  ctx.fillStyle='#493126';ctx.fillRect(-32,-51,64,51);
  ctx.fillStyle='#80583b';ctx.fillRect(-35,-55,70,7);ctx.fillRect(-28,-47,5,42);ctx.fillRect(23,-47,5,42);
  ctx.fillStyle='#68452f';ctx.fillRect(-23,-42,46,25);
  ctx.fillStyle='#b87849';ctx.fillRect(-21,-40,42,21);ctx.fillStyle='#c9955c';ctx.fillRect(-3,-31,6,3);
  if(open>0){
    ctx.fillStyle='#80583b';ctx.fillRect(-27,-46-open*13,54,9);
    ctx.fillStyle='#2a211c';ctx.fillRect(-22,-43-open*13,44,18);
    if(open>.55)drawBlade(-4,-34-open*13,0,'#e3e6e9');
  }
  ctx.restore();
}

export function drawBoudha(cx,baseY,s=1){
  ctx.save();ctx.translate(cx,baseY);ctx.scale(s,s);
  // A small valley chorten silhouette, unlike Kathmandu's great hemispherical stupa.
  ctx.fillStyle='rgba(8,7,7,.3)';ctx.beginPath();ctx.ellipse(0,-1,37,5,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#a2927b';ctx.fillRect(-34,-12,68,12);
  ctx.fillStyle='#ddd1b7';ctx.fillRect(-29,-23,58,12);
  ctx.fillStyle='#d7c8ab';ctx.beginPath();ctx.moveTo(-25,-23);ctx.lineTo(-20,-39);ctx.quadraticCurveTo(0,-53,20,-39);ctx.lineTo(25,-23);ctx.closePath();ctx.fill();
  ctx.fillStyle='#f0e4ca';ctx.fillRect(-15,-49,30,11);
  ctx.fillStyle='#8c3930';ctx.fillRect(-12,-47,24,2);ctx.fillRect(-12,-42,24,2);
  ctx.fillStyle='#b49b76';ctx.beginPath();ctx.moveTo(-8,-49);ctx.lineTo(8,-49);ctx.lineTo(4,-68);ctx.lineTo(-4,-68);ctx.closePath();ctx.fill();
  ctx.fillStyle='#d5b56d';ctx.fillRect(-2,-77,4,10);ctx.fillRect(-5,-69,10,2);
  ctx.fillStyle='#806c54';ctx.fillRect(-39,-13,78,3);
  ctx.restore();
}

export function drawHomeCutaway(x,baseY){
  ctx.save();ctx.translate(x,baseY);
  ctx.fillStyle='#51473c';ctx.fillRect(-82,-94,164,94);
  ctx.fillStyle='#b19c7d';ctx.fillRect(-78,-90,156,86);
  ctx.fillStyle='#433b34';ctx.fillRect(-71,-79,142,75);
  ctx.fillStyle='#6b5945';ctx.fillRect(-86,-98,172,8);
  ctx.fillStyle='#8e785b';ctx.fillRect(-81,-104,12,8);ctx.fillRect(69,-104,12,8);
  ctx.fillStyle='#4a3326';ctx.fillRect(-65,-70,31,34);ctx.fillStyle='#77583a';ctx.fillRect(-61,-66,23,26);
  ctx.fillStyle='#806044';ctx.fillRect(43,-69,22,69);ctx.fillStyle='#bd9660';ctx.fillRect(46,-65,16,62);
  ctx.fillStyle='#d6b776';ctx.fillRect(-51,-32,17,3);ctx.fillRect(-47,-29,3,13);
  ctx.restore();
}

export function drawForegroundVillage(){
  for(const [x,s] of VILLAGE_HOUSES) drawHouse(x,GROUND,s);
  drawBoudha(STUPA_X,GROUND,STUPA_SCALE);
}

export function drawDungeonBackdrop(alpha=1){
  if(alpha<=0)return;
  ctx.save();ctx.globalAlpha=Math.min(1,alpha);
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#090b10');g.addColorStop(.5,'#171516');g.addColorStop(1,'#211914');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // broken cave roof silhouettes frame the room without obscuring actors
  ctx.fillStyle='#08090d';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W,0);ctx.lineTo(W,40);
  for(let x=W;x>=0;x-=42)ctx.lineTo(x,38+Math.sin(x*.035)*13+((x*17)%11));
  ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(104,55,35,.1)';
  for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse((i*211+70)%W,95+(i%3)*67,90,38,0,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

export function drawDungeonArchitecture(underground=true){
  if(!underground){
    // From the surface the descent reads as a narrow carved stair-mouth, not a
    // giant underground room bleeding through the village.
    ctx.fillStyle='#514238';ctx.beginPath();ctx.moveTo(DUNGEON_ENTRY_X-20,GROUND+10);
    ctx.lineTo(DUNGEON_ENTRY_X-12,GROUND-25);ctx.lineTo(DUNGEON_ENTRY_X+8,GROUND-44);
    ctx.lineTo(DUNGEON_ENTRY_END-8,GROUND-44);ctx.lineTo(DUNGEON_ENTRY_END+12,GROUND-25);
    ctx.lineTo(DUNGEON_ENTRY_END+20,GROUND+10);ctx.lineTo(DUNGEON_ENTRY_END-4,GROUND+10);
    ctx.lineTo(DUNGEON_ENTRY_END-12,GROUND-8);ctx.lineTo(DUNGEON_ENTRY_X+12,GROUND-8);
    ctx.lineTo(DUNGEON_ENTRY_X+4,GROUND+10);ctx.closePath();ctx.fill();
    ctx.fillStyle='#201a18';ctx.fillRect(DUNGEON_ENTRY_X+12,GROUND-6,DUNGEON_ENTRY_END-DUNGEON_ENTRY_X-24,12);
    for(const x of [DUNGEON_ENTRY_X+30,DUNGEON_ENTRY_END-30]){
      ctx.fillStyle='#332923';ctx.fillRect(x-3,GROUND-25,6,20);ctx.fillStyle='#f0ad59';ctx.fillRect(x-2,GROUND-22,4,5);
    }
    return;
  }
  const x0=DUNGEON_ENTRY_X-72;
  // The tunnel and boss room are cut into a continuous rock chamber below the village.
  ctx.fillStyle='#171514';ctx.fillRect(x0,GROUND-44,WORLD-x0,DUNGEON_FLOOR-GROUND+84);
  ctx.fillStyle='#211c19';ctx.beginPath();ctx.moveTo(x0,GROUND-44);ctx.lineTo(x0+40,GROUND-72);
  for(let x=x0+40;x<=WORLD;x+=80)ctx.lineTo(x,GROUND-63+Math.sin(x*.013)*11);
  ctx.lineTo(WORLD,DUNGEON_FLOOR);ctx.lineTo(x0,DUNGEON_FLOOR);ctx.closePath();ctx.fill();
  // Rock bands and joints bring the chamber walls into the same layered geology.
  ctx.strokeStyle='rgba(151,111,79,.2)';ctx.lineWidth=2;
  for(let y=GROUND-24;y<DUNGEON_FLOOR-12;y+=26){
    ctx.beginPath();ctx.moveTo(x0+8,y+Math.sin(y)*4);ctx.lineTo(WORLD,y+Math.sin(y*.7)*5);ctx.stroke();
  }
  // Descending masonry steps are part of the cave stair, not floating blocks.
  for(const s of DUNGEON_STEPS){
    ctx.fillStyle='#332d28';ctx.fillRect(s.x,s.y+12,s.w,DUNGEON_FLOOR-s.y-12);
    ctx.fillStyle='#92806a';ctx.fillRect(s.x+10,s.y-2,s.w-18,4);
    ctx.strokeStyle='rgba(139,112,87,.38)';ctx.lineWidth=1;
    for(let yy=s.y+25;yy<DUNGEON_FLOOR;yy+=18){ctx.beginPath();ctx.moveTo(s.x+4,yy);ctx.lineTo(s.x+s.w-5,yy);ctx.stroke();}
  }
  for(const shelf of DUNGEON_ALCOVES){
    ctx.fillStyle='#39312c';ctx.fillRect(shelf.x,shelf.y+8,shelf.w,14);
    ctx.fillStyle='#77644e';ctx.fillRect(shelf.x-5,shelf.y,shelf.w+10,9);
  }
  // Stone chamber floor and a worn circular seal where the minister waits.
  ctx.fillStyle='#4a3c31';ctx.fillRect(DUNGEON_ENTRY_X-10,DUNGEON_FLOOR,WORLD-DUNGEON_ENTRY_X+10,40);
  ctx.fillStyle='#78614a';ctx.fillRect(DUNGEON_ENTRY_X-10,DUNGEON_FLOOR,WORLD-DUNGEON_ENTRY_X+10,4);
  ctx.strokeStyle='rgba(177,137,91,.35)';ctx.lineWidth=1.5;
  for(let x=DUNGEON_ENTRY_X;x<WORLD;x+=46){ctx.beginPath();ctx.moveTo(x,DUNGEON_FLOOR+7);ctx.lineTo(x+28,DUNGEON_FLOOR+7);ctx.lineTo(x+34,DUNGEON_FLOOR+22);ctx.stroke();}
  ctx.strokeStyle='rgba(185,124,69,.48)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(DUNGEON_BOSS_ROOM_START+330,DUNGEON_FLOOR-2,96,20,0,0,Math.PI*2);ctx.stroke();
  // The two long gaps are collapsed sections of the old drainage walk. They are
  // dark shafts, not floating blocks; their lips remain visible from either side.
  for(const [a,b] of DUNGEON_PITS){
    ctx.fillStyle='#090a0d';ctx.fillRect(a,DUNGEON_FLOOR,b-a,150);
    ctx.fillStyle='#211a17';ctx.fillRect(a-7,DUNGEON_FLOOR-3,12,8);ctx.fillRect(b-5,DUNGEON_FLOOR-3,12,8);
    ctx.strokeStyle='rgba(146,110,78,.35)';ctx.lineWidth=2;
    for(let x=a+10;x<b;x+=27){ctx.beginPath();ctx.moveTo(x,DUNGEON_FLOOR+15);ctx.lineTo(x-4,DUNGEON_FLOOR+92);ctx.stroke();}
    const mist=ctx.createLinearGradient(0,DUNGEON_FLOOR+26,0,DUNGEON_FLOOR+148);
    mist.addColorStop(0,'rgba(142,98,75,.13)');mist.addColorStop(1,'rgba(142,98,75,0)');
    ctx.fillStyle=mist;ctx.fillRect(a,DUNGEON_FLOOR+26,b-a,122);
  }
  // A wider carved arch marks the transition from the old service tunnel into
  // the minister's sealed chamber. It is architectural framing, not a platform.
  for(const x of [DUNGEON_BOSS_ROOM_START,DUNGEON_BOSS_ROOM_START+1040]){
    ctx.fillStyle='#302720';ctx.fillRect(x-16,GROUND-38,32,DUNGEON_FLOOR-GROUND+38);
    ctx.fillStyle='#68513d';ctx.fillRect(x-21,GROUND-42,42,8);
    ctx.strokeStyle='rgba(190,148,99,.36)';ctx.lineWidth=2;
    for(let y=GROUND-22;y<DUNGEON_FLOOR-2;y+=23){ctx.beginPath();ctx.moveTo(x-15,y);ctx.lineTo(x+15,y+5);ctx.stroke();}
    ctx.fillStyle='rgba(135,75,45,.18)';ctx.fillRect(x-34,GROUND-34,68,13);
  }
  for(const tx of [4780,6100,7000,7660]){
    const ty=DUNGEON_FLOOR+10;
    const glow=ctx.createRadialGradient(tx,ty,3,tx,ty,86+Math.sin(state.t/8+tx)*6);
    glow.addColorStop(0,'rgba(255,177,92,.28)');glow.addColorStop(1,'rgba(219,105,47,0)');ctx.fillStyle=glow;ctx.fillRect(tx-90,ty-90,180,180);
    ctx.fillStyle='#4d392c';ctx.fillRect(tx-5,ty-4,10,18);ctx.fillStyle='#f4b35e';
    ctx.beginPath();ctx.ellipse(tx,ty-8,4,7,0,0,Math.PI*2);ctx.fill();
  }
  // Recessed ancestor niches along the wall imply older chambers beyond the boss room.
  for(const nx of [4930,5850,6920,8020]){
    ctx.fillStyle='#100f11';ctx.beginPath();ctx.arc(nx,DUNGEON_FLOOR-37,14,Math.PI,0);ctx.lineTo(nx+14,DUNGEON_FLOOR-1);ctx.lineTo(nx-14,DUNGEON_FLOOR-1);ctx.closePath();ctx.fill();
    ctx.fillStyle='#6d4d39';ctx.fillRect(nx-3,DUNGEON_FLOOR-23,6,15);
  }
}

export function drawSceneGrade(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgba(5,10,19,.38)');g.addColorStop(.55,'rgba(8,11,16,.32)');g.addColorStop(1,'rgba(4,5,8,.48)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}

/* ---- HUD ---- */
// One consistent visual language for every on-screen input hint: PS face
// buttons are colored circles; keyboard keys are outlined keycaps.
export function drawControlBadge(key,cx,cy,controller=state.controlMode==='controller',scale=1){
  const colors={'✕':'#86b9ef','□':'#e4a0cf','○':'#ed827c','△':'#89cf9a'};
  const face=controller&&colors[key];
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  let w;
  if(face){
    const r=10*scale;w=r*2;ctx.fillStyle='rgba(7,12,20,.96)';ctx.strokeStyle=colors[key];ctx.lineWidth=1.5*scale;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=colors[key];ctx.font=`bold ${12*scale}px "Segoe UI Symbol","Segoe UI",system-ui`;ctx.fillText(key,cx,cy+.5*scale);
  }else{
    ctx.font=`bold ${9*scale}px "Segoe UI",system-ui`;w=Math.max(24*scale,ctx.measureText(key).width+10*scale);
    const h=17*scale;ctx.fillStyle='rgba(7,12,20,.96)';ctx.strokeStyle=controller?'rgba(216,187,129,.82)':'rgba(191,204,216,.78)';ctx.lineWidth=scale;
    ctx.beginPath();ctx.roundRect(cx-w/2,cy-h/2,w,h,4*scale);ctx.fill();ctx.stroke();
    ctx.fillStyle='#f1e8d8';ctx.fillText(key,cx,cy+.5*scale);
  }
  ctx.restore();return w;
}

export function drawHUD(){
  // HP hearts — 10 max, two rows if needed
  for(let i=0;i<player.maxHp;i++){
    const row=Math.floor(i/10), col=i%10;
    ctx.fillStyle=i<player.hp?'#e04040':'#552222';
    ctx.fillRect(14+col*17,14+row*18,13,13);
  }
  drawMomo(26,50,0.95); ctx.fillStyle='#e8d9b5'; ctx.font='bold 15px system-ui'; ctx.fillText('× '+player.coins,40,55);
  // Ultimate charge pips
  ctx.fillStyle='#e8d9b5'; ctx.font='bold 12px system-ui'; ctx.fillText('ULTIMATE:',14,77);
  for(let i=0;i<3;i++){
    const lit=i<player.charges;
    ctx.fillStyle=lit?'#ffd24a':'#3a3a3a';
    ctx.beginPath(); ctx.arc(86+i*16,72,6,0,7); ctx.fill();
    if(lit){ ctx.strokeStyle=`rgba(255,210,74,${0.35+0.35*Math.sin(state.t/9+i)})`;
      ctx.lineWidth=2; ctx.beginPath(); ctx.arc(86+i*16,72,9,0,7); ctx.stroke(); }
  }
  if(player.charges<ULT_MAX_CHARGES){
    const pct=Math.min(1,player.ultRecharge/ULT_RECHARGE_FRAMES);
    ctx.strokeStyle='rgba(255,210,74,.95)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(86+player.charges*16,72,9,-Math.PI/2,-Math.PI/2+Math.PI*2*pct);ctx.stroke();
  }
  ctx.save();ctx.globalAlpha=player.charges>=1?1:.42;
  drawControlBadge(state.controlMode==='controller'?'△':'E',151,72,state.controlMode==='controller',.9);
  ctx.restore();

  // difficulty label
  ctx.fillStyle='rgba(232,217,181,0.6)'; ctx.font='11px system-ui';
  ctx.fillText(diff().label, 14, 96);

  // ---- combo counter ---- big, right side, pops on each fresh hit
  if(player.comboCount>=2){
    const fresh=Math.max(0,Math.min(1,player.comboTimer/COMBO_GAP));
    const pop=1+0.35*fresh*fresh;                        // recent hits punch the number up
    const c=player.comboCount;
    const col=c>=20?'#ff5050':c>=10?'#ff9a6a':'#ffd24a';
    ctx.save();
    ctx.textAlign='right';
    ctx.translate(W-22,150);
    ctx.globalAlpha=0.35+0.65*fresh;                     // fades as the window runs out
    ctx.font='bold '+Math.round(34*pop)+'px "Segoe UI",system-ui';
    ctx.lineWidth=4; ctx.lineJoin='round'; ctx.strokeStyle='rgba(0,0,0,0.7)';
    ctx.strokeText(c+'', 0, 0); ctx.fillStyle=col; ctx.fillText(c+'', 0, 0);
    ctx.font='bold 13px "Segoe UI",system-ui';
    ctx.strokeText('COMBO', 0, 16); ctx.fillStyle=col; ctx.fillText('COMBO', 0, 16);
    ctx.restore();
    ctx.textAlign='left';
  }

  // Boss HP bar — 3 phase segments
  if(boss.active&&boss.alive){
    const bw=320, bx=W/2-160, by=16;
    ctx.fillStyle='#400'; ctx.fillRect(bx,by,bw,12);
    const pct=boss.hp/boss.maxHp;
    const barCol=boss.phase===3?'#ff3030':boss.phase===2?'#d83090':'#d83030';
    ctx.fillStyle=barCol; ctx.fillRect(bx,by,bw*pct,12);
    // phase markers
    ctx.strokeStyle='#fff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(bx+bw*0.33,by); ctx.lineTo(bx+bw*0.33,by+12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx+bw*0.66,by); ctx.lineTo(bx+bw*0.66,by+12); ctx.stroke();
    // posture bar under the HP bar
    const ppct=Math.min(1,boss.posture/boss.maxPosture);
    ctx.fillStyle='rgba(20,15,5,0.6)'; ctx.fillRect(bx,by+13,bw,4);
    ctx.fillStyle=boss.stagger>0?'#ffffff':ppct>0.75?'#ff7a30':'#ffd24a';
    ctx.fillRect(bx,by+13,bw*ppct,4);
    ctx.fillStyle='#e8d9b5'; ctx.font='13px system-ui'; ctx.textAlign='center';
    ctx.fillText('Prachanda · Phase '+boss.phase,W/2,44);
    if(boss.stagger>0){ ctx.fillStyle=`rgba(255,80,80,${0.6+0.4*Math.sin(state.t/4)})`;
      ctx.font='bold 13px system-ui'; ctx.fillText('SUSTAYO — prahar gara!',W/2,58); }
    ctx.textAlign='left';
  }
  if(state.muted){ ctx.fillStyle='#e8d9b5'; ctx.font='12px system-ui'; ctx.fillText('muted (M)',W-90,22); }
  if(state.won && boss && !boss.alive && Math.abs(player.x-cage.x)<90 && state.scene==='play'){
    const cx=W/2,cy=H-104;
    ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(cx-90,cy-17,180,34);
    ctx.strokeStyle='rgba(190,148,99,.68)';ctx.lineWidth=1;ctx.strokeRect(cx-90,cy-17,180,34);
    drawControlBadge(state.controlMode==='controller'?'✕':'Enter',cx-28,cy,state.controlMode==='controller');
    ctx.fillStyle='#9fe06a';ctx.font='bold 13px system-ui';ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText('Action',cx+2,cy);ctx.textAlign='left';ctx.textBaseline='alphabetic'; }
}

/* Right-side feedback stack. No boxes or panels — just shadowed text so it
   stays legible over bright sky without occluding anything. */
export function drawToasts(){
  if(!toasts.length) return;
  ctx.save();
  ctx.textAlign='right';
  ctx.font='bold 13px "Segoe UI",system-ui';
  for(let i=0;i<toasts.length;i++){
    const n=toasts[i];
    const age=n.max-n.t;
    const fadeIn=Math.min(1, age/5);
    const fadeOut=Math.min(1, n.t/22);
    const slide=(1-fadeIn)*12;              // eases in from the right edge
    const x=W-16+slide, y=106+i*19;
    ctx.globalAlpha=Math.min(fadeIn,fadeOut)*0.96;
    // dark outline first — the sky behind is bright and varies, so a plain
    // shadow isn't enough to keep light text legible
    ctx.lineWidth=3.5; ctx.lineJoin='round';
    ctx.strokeStyle='rgba(0,0,0,0.72)';
    ctx.strokeText(n.text, x, y);
    ctx.fillStyle=n.color;
    ctx.fillText(n.text, x, y);
  }
  ctx.restore();
}

export function drawSubtitle(){
  // Keep the boss arena free of dialogue text once Enter has started combat.
  if(state.scene==='play'&&boss.active&&boss.started&&boss.alive) return;
  if(sub.t<=0) return;
  const a=Math.min(1,sub.t/20);
  ctx.save(); ctx.globalAlpha=a;
  ctx.font='bold 18px "Segoe UI",system-ui';
  if(state.scene==='cutscene'){
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=4;ctx.lineJoin='round';
    ctx.strokeStyle='rgba(0,0,0,.88)';ctx.shadowColor='#000';ctx.shadowBlur=5;
    const max=W-76,lines=[''];
    for(const word of sub.text.split(/\s+/)){
      const n=lines.length-1,trial=lines[n]?lines[n]+' '+word:word;
      if(ctx.measureText(trial).width>max&&lines[n])lines.push(word);else lines[n]=trial;
    }
    const shown=lines.slice(-2),firstY=shown.length===1?H-40:H-55;
    shown.forEach((line,i)=>{const y=firstY+i*21;ctx.strokeText(line,W/2,y,max);ctx.fillStyle=sub.color;ctx.fillText(line,W/2,y,max);});
    ctx.restore();return;
  }
  // box hugs the text — cutscene lines are hand-written and vary a lot in
  // length, so a fixed 620px box either overflows or looks empty
  const tw=ctx.measureText(sub.text).width;
  const bw=Math.min(W-24, Math.max(360, tw+40));
  ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(W/2-bw/2,H-56,bw,34);
  ctx.textAlign='center';
  ctx.fillStyle=sub.color; ctx.fillText(sub.text,W/2,H-33);
  ctx.textAlign='left'; ctx.restore();
}
