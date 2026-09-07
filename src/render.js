import {ctx} from './canvas.js';
import {W, H, GROUND, WORLD, PARRY_ACTIVE, MOVES, COMBO_GAP, DEATHBLOW_FRAMES} from './config.js';
import {state, sub, sparks, toasts, diff} from './state.js';
import {player, plats, boss, cage, cs} from './entities.js';

/* ================= SKY & PARALLAX BACKGROUND =================
   Layers, far to near. Each layer scrolls at its own fraction of the camera,
   and everything past the mid-range is washed toward the horizon haze colour
   so depth reads even though it is all flat-shaded shapes. */

export function drawSky(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#2f6ea8');
  g.addColorStop(0.34,'#67a8d8');
  g.addColorStop(0.62,'#a8cfe4');
  g.addColorStop(0.84,'#d8e6dc');
  g.addColorStop(1,'#e6e2c4');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
}

function drawSun(cam){
  const sx=170-cam*0.012, sy=74;
  // outer bloom
  let rg=ctx.createRadialGradient(sx,sy,10,sx,sy,150);
  rg.addColorStop(0,'rgba(255,238,180,0.55)');
  rg.addColorStop(0.45,'rgba(255,220,140,0.18)');
  rg.addColorStop(1,'rgba(255,210,120,0)');
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(sx,sy,150,0,7); ctx.fill();
  // god rays — slow lazy rotation
  ctx.save(); ctx.translate(sx,sy); ctx.rotate(state.t*0.0016);
  for(let i=0;i<12;i++){
    ctx.rotate(Math.PI/6);
    ctx.fillStyle=`rgba(255,240,190,${0.05+0.03*Math.sin(state.t/40+i)})`;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(150,-16); ctx.lineTo(150,16); ctx.fill();
  }
  ctx.restore();
  // core
  rg=ctx.createRadialGradient(sx,sy,4,sx,sy,30);
  rg.addColorStop(0,'#fffdf0'); rg.addColorStop(1,'#ffe08a');
  ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(sx,sy,28,0,7); ctx.fill();
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

function ridge(cam, par, baseY, height, step, seed, fill, snow){
  // deterministic jagged ridgeline; `seed` shifts the noise per layer
  ctx.fillStyle=fill;
  ctx.beginPath();
  ctx.moveTo(-60, GROUND);
  const off=-cam*par;
  for(let x=-60; x<=W+60; x+=step){
    const n=Math.sin((x+off+seed)*0.0071)*0.55
           +Math.sin((x+off+seed)*0.0173)*0.3
           +Math.sin((x+off+seed)*0.0339)*0.15;
    ctx.lineTo(x, baseY - height*(0.45+0.55*Math.abs(n)));
  }
  ctx.lineTo(W+60, GROUND); ctx.closePath(); ctx.fill();

  if(snow){
    // snowcaps: re-walk the same ridge, fill only the high points
    ctx.fillStyle='rgba(255,255,255,0.88)';
    for(let x=-60; x<=W+60; x+=step){
      const n=Math.sin((x+off+seed)*0.0071)*0.55
             +Math.sin((x+off+seed)*0.0173)*0.3
             +Math.sin((x+off+seed)*0.0339)*0.15;
      const h=height*(0.45+0.55*Math.abs(n));
      const peakY=baseY-h;
      if(h > height*0.86){
        ctx.beginPath();
        ctx.moveTo(x-13,peakY+15); ctx.lineTo(x,peakY-1); ctx.lineTo(x+13,peakY+15);
        ctx.lineTo(x+6,peakY+12); ctx.lineTo(x,peakY+6); ctx.lineTo(x-6,peakY+12);
        ctx.closePath(); ctx.fill();
      }
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

function drawPrayerFlagLine(x,y,span,sag){
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
  ridge(cam, 0.05, GROUND-46, 210, 14, 0,    '#9fb4cc', true);
  hazeBand(GROUND-150, 120, 0.5);

  // ---- mid range ----
  ridge(cam, 0.13, GROUND-30, 165, 12, 1400, '#7d8fab', true);
  hazeBand(GROUND-104, 96, 0.42);
  drawBirds(cam);

  // ---- near range ----
  ridge(cam, 0.26, GROUND-16, 118, 10, 3100, '#5e6b83', false);
  hazeBand(GROUND-70, 74, 0.3);

  // ---- village band: stupa, houses, prayer flags ----
  drawBoudha(900-cam*0.5, GROUND-30);
  for(const hx of [430,1300,2200,3300,3900]) drawHouse(hx-cam*0.62, GROUND-30);
  drawPrayerFlagLine(300-cam*0.62, GROUND-118, 260, 40);
  drawPrayerFlagLine(1900-cam*0.62, GROUND-108, 230, 36);
  drawPrayerFlagLine(3500-cam*0.62, GROUND-124, 280, 44);

  // ---- terraced foothills ----
  ctx.fillStyle='#4a5c34';
  for(let i=0;i<13;i++){ const hx=i*440-cam*0.5;
    ctx.beginPath();ctx.moveTo(hx,GROUND);ctx.lineTo(hx+220,GROUND-110);ctx.lineTo(hx+440,GROUND);ctx.fill(); }
  // terrace contour lines cut into the hills
  ctx.strokeStyle='rgba(120,150,88,0.4)'; ctx.lineWidth=1;
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
    pine(wrapped, GROUND-4, 0.62+((i*7)%4)/10, '#2f4326');
  }

  ctx.fillStyle='#3a4a2b';
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

export function drawGround(){
  const cam=state.cam, t=state.t;
  ctx.fillStyle='#473526'; ctx.fillRect(0,GROUND,WORLD,H-GROUND);
  // soil striation so the ground isn't a flat slab
  ctx.fillStyle='#3d2c1f';
  for(let gx=Math.floor(cam/40)*40-40; gx<cam+W+40; gx+=40){
    ctx.fillRect(gx, GROUND+14+((gx*7)%9), 26, 3);
    ctx.fillRect(gx+18, GROUND+26+((gx*11)%7), 18, 3);
  }
  ctx.fillStyle='#4d6a30'; ctx.fillRect(0,GROUND,WORLD,5);
  ctx.strokeStyle='#5f7a36'; ctx.lineWidth=2;
  for(let gx=Math.floor(cam/18)*18-18;gx<cam+W+18;gx+=18){
    const h0=6+4*Math.sin(gx*0.7), sway=Math.sin(t/20+gx)*1.6;
    ctx.beginPath();
    ctx.moveTo(gx,GROUND);ctx.lineTo(gx+sway,GROUND-h0);
    ctx.moveTo(gx+5,GROUND);ctx.lineTo(gx+5+sway,GROUND-h0*0.7);
    ctx.moveTo(gx-4,GROUND);ctx.lineTo(gx-4+sway,GROUND-h0*0.85); ctx.stroke();
  }
  for(const p of plats){
    ctx.fillStyle='#6b5236'; ctx.fillRect(p.x,p.y,p.w,p.h);
    ctx.fillStyle='#3c2c1c'; ctx.fillRect(p.x,p.y+p.h-4,p.w,4);
    ctx.fillStyle='#4d6a30'; ctx.fillRect(p.x,p.y-2,p.w,3);
    // grass fringe hanging off the platform lip
    ctx.strokeStyle='#5f7a36'; ctx.lineWidth=1.5;
    for(let gx=p.x+3; gx<p.x+p.w; gx+=9){
      const sway=Math.sin(t/22+gx)*1.3;
      ctx.beginPath(); ctx.moveTo(gx,p.y-1); ctx.lineTo(gx+sway,p.y-6); ctx.stroke();
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
  L3:{wind:{hx:-6,hy:42,rot:2.0},  hit:{hx:34,hy:16,rot:-1.0}, rec:{hx:18,hy:26,rot:-0.4}}  // rising finisher
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
  const PT=diff().parryThresh;
  const mv=p.move?MOVES[p.move]:null;
  const atkActive = mv && p.atkT>=mv.a0 && p.atkT<=mv.a1;
  if(p.hurt>0 && Math.floor(p.hurt/4)%2===0) return;

  const moving   = p.onGround && Math.abs(p.vx)>0.4;
  const airborne = !p.onGround;
  const parrying = p.parry>0;
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
    pushTrail(cpose.hx,cpose.hy,cpose.rot,'light');
  stepTrail();

  const sq=p.squash, scX=1+sq*0.22, scY=1-sq*0.26;
  const bob=moving?Math.abs(Math.sin(wp))*2.2:Math.sin(p.breathe)*0.9;

  ctx.save();
  ctx.translate(p.x+p.w/2, p.y + bob + crouch);
  ctx.scale(p.facing,1);

  // full-body afterimages on fast, flashy moves + dodge/ult
  const flashy = (mv && (mv.iai||mv.finisher||p.move==='L3')) && atkActive;
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
  else if(parrying){ fA={x:-9,y:58}; fB={x:9,y:58}; }
  else if(moving){ const s1=Math.sin(wp),s2=Math.sin(wp+Math.PI);
    fA={x:s1*9,y:58-Math.max(0,s1)*6}; fB={x:s2*9,y:58-Math.max(0,s2)*6}; }
  else { fA={x:-4,y:58}; fB={x:4,y:58}; }
  const foot=(f,col)=>{ limb2(f.x<0?-3:3,44,f.x,f.y,9,10,1,6.5,col); ctx.fillStyle='#241a14'; ctx.fillRect(f.x-4,f.y-2,10,3); };
  foot(fA,'#b0a685');   // far leg (shaded)
  foot(fB,ROBE_D);      // near leg

  /* ---- katana saya on the hip: holds the katana normally; empty while the ult
     (iai draw) has it in hand ---- */
  drawSaya(!ulting, 0);

  /* ---- OFF ARM (two-bone) ---- */
  {
    let ox,oy;
    if(pose){ ox=pose.phase==='hit'?-16:-13; oy=pose.phase==='hit'?24:34; }        // counterbalance
    else if(airborne){ ox=-13; oy=p.vy<0?18:34; }
    else if(parrying){ ox=6; oy=30; }
    else if(moving){ ox=-8+Math.sin(wp+Math.PI)*6; oy=34+Math.abs(Math.sin(wp))*3; }
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
  ctx.fillStyle=SASH; ctx.fillRect(-10,42,20,3);

  /* ---- PARRY: no shield arc — just a small orange spark flash at the blade when a
     deflect lands (the spark burst itself comes from parrySuccess) ---- */
  if(parrying && p.parryFlash>0){
    ctx.fillStyle=`rgba(255,176,56,${0.6*p.parryFlash/10})`;
    ctx.beginPath(); ctx.arc(16,26,5,0,7); ctx.fill();
  }

  /* ---- smear ribbon behind the blade ---- */
  drawTrail();

  /* ---- SWORD ARM (two-bone) + BLADE (khukuri; katana during the ult iai) ---- */
  {
    // hand target: attack/ult pose, else guard / airborne / walk / idle drift
    let hx,hy,rot;
    if(pose){ hx=pose.hx; hy=pose.hy; rot=pose.rot; }
    else if(parrying){ hx=16; hy=24; rot=p.parry>PT?-1.7:-1.4; }   // blade raised to guard
    else if(airborne){ hx=16; hy=30; rot=p.vy<0?-1.2:-0.7; }
    else if(moving){ hx=15; hy=31+Math.sin(wp)*1.5; rot=-0.7+Math.sin(wp)*0.16; }
    else { hx=15; hy=31+Math.sin(p.breathe)*0.6; rot=-0.6+Math.sin(p.breathe)*0.05; }
    limb2(4,27,hx,hy,12,13,1,5,SKIN,SKIN_D,3.2);
    ctx.save(); ctx.translate(hx,hy); ctx.rotate(rot);
    if(ulting) katanaBlade(1); else khukuriBlade(1);
    ctx.restore();
  }

  /* ---- HEAD ---- */
  const headTilt = pose ? (pose.phase==='wind'?-0.15:0.12) : moving?Math.sin(wp)*0.05 : airborne?(p.vy<0?-0.12:0.08):0;
  ctx.save(); ctx.translate(0,8); ctx.rotate(headTilt);
  ctx.fillStyle=SKIN; ctx.beginPath(); ctx.arc(0,0,11,0,7); ctx.fill();
  ctx.fillStyle=SASH; ctx.fillRect(-6,-3,12,3);
  ctx.fillStyle='#e02020'; ctx.beginPath(); ctx.arc(0,-4,2,0,7); ctx.fill();
  ctx.fillStyle='#fff'; const blink=(t%210)<6;
  if(!blink) ctx.fillRect(3,-2,4,parrying?1.6:3);
  ctx.fillStyle='#201810'; if(!blink) ctx.fillRect(5,-2,2,parrying?1.6:3);
  ctx.fillStyle='#241a14'; ctx.fillRect(-3,-15,6,16);
  const tupiSway = pose?-4 : moving?-Math.sin(wp)*3 : airborne?-3 : Math.sin(p.breathe)*0.8;
  ctx.beginPath(); ctx.arc(tupiSway,4,4,0,7); ctx.fill();
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
  ctx.fillStyle=skin; ctx.fillRect(-3,9,6,5); ctx.beginPath(); ctx.arc(0,4,8,0,7); ctx.fill();
  ctx.fillStyle='#fff'; ctx.fillRect(2,2,4,3); ctx.fillStyle='#201810'; ctx.fillRect(4,2,2,3);
  ctx.fillRect(1,-1,7,1.4); ctx.fillStyle='#2e2218'; ctx.fillRect(-1,7,7,2);
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
  ctx.fillStyle=skin; ctx.fillRect(-2,7,4,5); ctx.beginPath(); ctx.arc(0,3,7,0,7); ctx.fill();
  ctx.fillStyle='#101008'; ctx.fillRect(-6,-1,12,8); // dark hair
  ctx.fillStyle='#201810'; ctx.fillRect(-2,5,7,2); // brow
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
  const coat=hitT>0?'#ff6644':enrageFlash>0?`hsl(${t*15%360},80%,40%)`:(phase===3?'#3a0a0a':phase===2?'#1a0a22':'#1a1a22');
  const bob=bstate==='wait'?Math.sin(boss.anim)*1.8:0;
  ctx.save(); ctx.translate(x+30,y+bob);
  if(spinT>0){ ctx.rotate((1-spinT/52)*dir*Math.PI*2); } // spin visual
  ctx.scale(dir,1);
  // anticipation/follow-through lean, like the mooks but heavier and slower
  const blean = bstate&&bstate.endsWith('_tel') ? -0.12
              : (bstate==='slash'||bstate==='leap'||bstate==='spin'||bstate==='stomp') ? 0.13
              : Math.sin(boss.anim*0.5)*0.025;
  ctx.rotate(blean);
  if(bstate&&bstate.endsWith('_tel')){ ctx.fillStyle=`rgba(235,80,60,${0.25+0.3*Math.abs(Math.sin(t/4))})`;
    ctx.beginPath(); ctx.ellipse(0,48,30,46,0,0,7); ctx.fill(); }
  if(bstate==='spin'){ ctx.fillStyle=`rgba(255,150,50,${0.4+0.2*Math.sin(t/2)})`;
    ctx.beginPath(); ctx.arc(0,48,46,0,7); ctx.fill(); }
  // big sword
  ctx.save(); ctx.translate(16,40); ctx.rotate(bstate==='slash_tel'||bstate==='leap_tel'?-1.2:-0.3);
  ctx.fillStyle='#cfd5df'; ctx.fillRect(0,-2,40,5); ctx.fillStyle='#5a3a20'; ctx.fillRect(-7,-3,8,7); ctx.restore();
  // legs with a lumbering cycle
  {
    const moving=bstate==='wait'||bstate==='slash';
    const s1=moving?Math.sin(boss.anim):0, s2=moving?Math.sin(boss.anim+Math.PI):0;
    ctx.strokeStyle='#e7e1cf'; ctx.lineWidth=11; ctx.lineCap='round';
    for(const s of [s1,s2]){
      const fx=s*9, fy=90-Math.max(0,s)*5;
      ctx.beginPath(); ctx.moveTo(0,72); ctx.quadraticCurveTo(fx*0.5,81,fx,fy); ctx.stroke();
      ctx.fillStyle='#15161f'; ctx.fillRect(fx-7,fy-2,15,3);
    }
  }
  ctx.fillStyle=coat; ctx.fillRect(-26,20,52,56);
  ctx.beginPath(); ctx.ellipse(0,54,27,24,0,0,7); ctx.fill();
  ctx.fillStyle='#ece3cc'; ctx.fillRect(-7,22,14,38);
  ctx.fillStyle='#9a1f2a'; ctx.beginPath(); ctx.moveTo(-4,22); ctx.lineTo(4,22); ctx.lineTo(2,54); ctx.lineTo(-2,54); ctx.fill();
  ctx.fillStyle='#caa84e'; ctx.save(); ctx.rotate(0.5); ctx.fillRect(-6,18,10,46); ctx.restore();
  ctx.fillStyle=skin; ctx.fillRect(-6,12,12,9); ctx.beginPath(); ctx.arc(0,6,15,0,7); ctx.fill();
  ctx.beginPath(); ctx.arc(-10,13,5,0,7); ctx.arc(10,13,5,0,7); ctx.fill();
  ctx.strokeStyle='#222'; ctx.lineWidth=1.6; ctx.strokeRect(-12,1,9,7); ctx.strokeRect(3,1,9,7);
  ctx.beginPath(); ctx.moveTo(-3,4); ctx.lineTo(3,4); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.fillRect(-9,3,4,3); ctx.fillRect(5,3,4,3);
  ctx.fillStyle='#201810'; ctx.fillRect(-6,3,2,3); ctx.fillRect(8,3,2,3);
  ctx.fillStyle='#4a3a2a'; ctx.fillRect(-7,11,14,3);
  drawTopi(0,-4,13,'#161620');
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

function drawMuna(x,y){ ctx.save(); ctx.translate(x,y+Math.sin(state.t/38)*0.8);
  ctx.fillStyle='#c0392b'; ctx.fillRect(-9,18,18,34);
  ctx.fillStyle='#1f7a4d'; ctx.fillRect(-9,40,18,12);
  ctx.fillStyle='#c98a5e'; ctx.beginPath(); ctx.arc(0,10,9,0,7); ctx.fill();
  ctx.fillStyle='#1a120a'; ctx.fillRect(-9,2,18,9);
  ctx.fillStyle='#e02020'; ctx.beginPath(); ctx.arc(0,7,1.6,0,7); ctx.fill();
  ctx.restore(); }
function drawRaju(x,y){ ctx.save(); ctx.translate(x,y+Math.sin(state.t/30)*1.1);
  ctx.fillStyle='#2b3a55'; ctx.fillRect(-9,18,18,34);
  ctx.fillStyle='#d8d0c0'; ctx.fillRect(-5,18,10,16);
  ctx.fillStyle='#c98a5e'; ctx.beginPath(); ctx.arc(0,10,9,0,7); ctx.fill();
  ctx.fillStyle='#15110b'; ctx.fillRect(-9,1,18,8);
  ctx.fillStyle='#111'; ctx.fillRect(-7,7,14,3);
  ctx.restore(); }

export function drawCage(){
  ctx.fillStyle='#5a4632'; ctx.fillRect(cage.x-34,cage.y-44,68,6);
  ctx.fillStyle='#3c2c1c'; ctx.fillRect(cage.x-40,cage.y-50,80,8);
  ctx.fillStyle='#6b5236'; ctx.fillRect(cage.x-34,cage.y+18,8,8); ctx.fillRect(cage.x+26,cage.y+18,8,8);
  if(boss.alive){ ctx.strokeStyle='#8a8a8a'; ctx.lineWidth=2;
    for(let i=-3;i<=3;i++){ ctx.beginPath(); ctx.moveTo(cage.x+i*10,cage.y-44); ctx.lineTo(cage.x+i*10,cage.y+24); ctx.stroke(); } }
  if(state.scene==='play') drawMuna(cage.x, GROUND-52);
}

export function drawCutsceneActors(){
  drawHari();
  drawMuna(cs.muna.x, cs.muna.y);
  if(cs.rajuIn) drawRaju(cs.raju.x, cs.raju.y);
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

function drawHouse(x,baseY){ ctx.save(); ctx.translate(x,baseY);
  ctx.fillStyle='#a85f37'; ctx.fillRect(-22,-34,44,34);
  ctx.fillStyle='#7a4426'; ctx.fillRect(-22,-12,44,12);
  ctx.fillStyle='#42474f'; ctx.beginPath(); ctx.moveTo(-28,-34); ctx.lineTo(0,-52); ctx.lineTo(28,-34); ctx.fill();
  ctx.fillStyle='#2a64b0'; ctx.fillRect(-15,-28,8,9); ctx.fillRect(7,-28,8,9);
  ctx.fillStyle='#3a2418'; ctx.fillRect(-5,-18,10,18);
  // chimney smoke
  for(let i=0;i<4;i++){
    const p=(state.t/22+i*1.6)%6;
    ctx.fillStyle=`rgba(220,220,220,${0.22*(1-p/6)})`;
    ctx.beginPath(); ctx.arc(14+Math.sin(p*1.4)*5, -52-p*9, 3+p*1.6, 0, 7); ctx.fill();
  }
  ctx.restore(); }

function drawBoudha(cx,baseY){ ctx.save(); ctx.translate(cx,baseY);
  ctx.fillStyle='#e9e6df'; ctx.fillRect(-46,-6,92,8);
  ctx.fillStyle='#f2efe9'; ctx.beginPath(); ctx.arc(0,-4,42,Math.PI,0); ctx.fill();
  ctx.fillStyle='#efe9da'; ctx.fillRect(-15,-58,30,22); ctx.fillStyle='#d9b23a'; ctx.fillRect(-15,-58,30,3);
  ctx.fillStyle='#1c3a6e'; ctx.fillRect(-11,-52,7,4); ctx.fillRect(4,-52,7,4);
  ctx.fillStyle='#2a64b0'; ctx.fillRect(-9,-51,3,2); ctx.fillRect(6,-51,3,2);
  ctx.fillStyle='#d9b23a'; ctx.beginPath(); ctx.moveTo(-9,-58); ctx.lineTo(9,-58); ctx.lineTo(4,-80); ctx.lineTo(-4,-80); ctx.fill();
  ctx.fillStyle='#f0d050'; ctx.fillRect(-2,-88,4,8);
  ctx.strokeStyle='rgba(200,180,120,0.5)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(0,-84); ctx.lineTo(-60,-30); ctx.moveTo(0,-84); ctx.lineTo(60,-30); ctx.stroke();
  const fc=['#c0392b','#2980b9','#27ae60','#f1c40f'];
  for(let i=1;i<8;i++){ ctx.fillStyle=fc[i%4];
    const fl=Math.sin(state.t/18+i)*1.2;
    ctx.fillRect(-60+i*7.5,-30+i*6.7+fl,5,4); ctx.fillRect(55-i*7.5,-30+i*6.7+fl,5,4); }
  ctx.restore(); }

/* ---- HUD ---- */
export function drawHUD(){
  // HP hearts — 10 max, two rows if needed
  for(let i=0;i<player.maxHp;i++){
    const row=Math.floor(i/10), col=i%10;
    ctx.fillStyle=i<player.hp?'#e04040':'#552222';
    ctx.fillRect(14+col*17,14+row*18,13,13);
  }
  drawMomo(26,50,0.95); ctx.fillStyle='#e8d9b5'; ctx.font='bold 15px system-ui'; ctx.fillText('× '+player.coins,40,55);
  // ult (iai) charges
  ctx.fillStyle='#e8d9b5'; ctx.font='bold 15px system-ui'; ctx.fillText('iai:',14,77);
  for(let i=0;i<3;i++){
    const lit=i<player.charges;
    ctx.fillStyle=lit?'#ffd24a':'#3a3a3a';
    ctx.beginPath(); ctx.arc(50+i*16,72,6,0,7); ctx.fill();
    if(lit){ ctx.strokeStyle=`rgba(255,210,74,${0.35+0.35*Math.sin(state.t/9+i)})`;
      ctx.lineWidth=2; ctx.beginPath(); ctx.arc(50+i*16,72,9,0,7); ctx.stroke(); }
  }
  if(player.charges>=1){ ctx.fillStyle='#ffd24a'; ctx.font='11px system-ui'; ctx.fillText('E!',100,76); }

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
    ctx.fillText('Bhrasta Mantri · Phase '+boss.phase,W/2,44);
    if(boss.stagger>0){ ctx.fillStyle=`rgba(255,80,80,${0.6+0.4*Math.sin(state.t/4)})`;
      ctx.font='bold 13px system-ui'; ctx.fillText('SUSTAYO — prahar gara!',W/2,58); }
    ctx.textAlign='left';
  }
  if(state.muted){ ctx.fillStyle='#e8d9b5'; ctx.font='12px system-ui'; ctx.fillText('muted (M)',W-90,22); }
  if(state.won && boss && !boss.alive && Math.abs(player.x-cage.x)<90 && state.scene==='play'){
    ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(W/2-130,H-118,260,28);
    ctx.fillStyle='#9fe06a'; ctx.font='bold 15px system-ui'; ctx.textAlign='center';
    ctx.fillText('Press F — Munalai fukau',W/2,H-99); ctx.textAlign='left'; }
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
  if(sub.t<=0) return;
  const a=Math.min(1,sub.t/20);
  ctx.save(); ctx.globalAlpha=a;
  ctx.font='bold 18px "Segoe UI",system-ui';
  // box hugs the text — cutscene lines are hand-written and vary a lot in
  // length, so a fixed 620px box either overflows or looks empty
  const tw=ctx.measureText(sub.text).width;
  const bw=Math.min(W-24, Math.max(360, tw+40));
  ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(W/2-bw/2,H-56,bw,34);
  ctx.textAlign='center';
  ctx.fillStyle=sub.color; ctx.fillText(sub.text,W/2,H-33);
  ctx.textAlign='left'; ctx.restore();
}
