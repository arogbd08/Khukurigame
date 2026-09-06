import {state} from './state.js';

/* ================= AUDIO — REALISTIC SOUNDS ================= */
let AC = null;
export function audio(){ if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}} return AC; }
export function resumeAudio(){ const ac=audio(); if(ac && ac.state==='suspended') ac.resume(); }

/* ---- noise generator ---- */
function makeNoise(ac, dur, col){ // col = lowpass cutoff
  const n=Math.floor(ac.sampleRate*dur), b=ac.createBuffer(1,n,ac.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
  const s=ac.createBufferSource(); s.buffer=b;
  if(col){ const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value=col;
    s.connect(f); return {src:s, out:f}; }
  return {src:s, out:s};
}

/* ---- envelope helper ---- */
function env(ac, gain, atk, sus, rel, peak){
  const now=ac.currentTime;
  gain.setValueAtTime(0,now);
  gain.linearRampToValueAtTime(peak||0.4,now+atk);
  gain.setValueAtTime(peak||0.4,now+atk+sus);
  gain.exponentialRampToValueAtTime(0.0001,now+atk+sus+rel);
}

function osc(ac, freq, type, dur, slideTo){
  const o=ac.createOscillator(); o.type=type; o.frequency.setValueAtTime(freq,ac.currentTime);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo,ac.currentTime+dur);
  o.start(); o.stop(ac.currentTime+dur); return o;
}

export function sfx(k){
  const ac=audio(); if(!ac||state.muted)return;
  try{ if(ac.state==='suspended') ac.resume(); } catch(e){}
  const now=ac.currentTime;
  const out=ac.destination;

  switch(k){
    case 'slash': {
      // whoosh — pink noise + resonant sweep
      const {src:ns,out:flt}=makeNoise(ac,0.18,3200);
      const f2=ac.createBiquadFilter(); f2.type='bandpass'; f2.frequency.setValueAtTime(800,now);
      f2.frequency.linearRampToValueAtTime(4000,now+0.12); f2.Q.value=2.2;
      const g=ac.createGain(); env(ac,g.gain,0.005,0.04,0.13,0.35);
      flt.connect(f2); f2.connect(g); g.connect(out); ns.start(); ns.stop(now+0.2);
      // metallic ting at end
      const o=osc(ac,2800,'sine',0.09); const g2=ac.createGain(); env(ac,g2.gain,0.001,0,0.09,0.12);
      o.connect(g2); g2.connect(out);
      break; }

    case 'hit': {
      // meaty thud — low thump + crunch
      const o1=osc(ac,160,'sine',0.08,60); const g1=ac.createGain(); env(ac,g1.gain,0.001,0.01,0.07,0.5);
      o1.connect(g1); g1.connect(out);
      const {src:ns}=makeNoise(ac,0.06,200); const g2=ac.createGain(); env(ac,g2.gain,0.001,0,0.05,0.3);
      ns.connect(g2); g2.connect(out); ns.start(); ns.stop(now+0.08);
      const o2=osc(ac,80,'sawtooth',0.05,30); const g3=ac.createGain(); env(ac,g3.gain,0.001,0,0.05,0.45);
      o2.connect(g3); g3.connect(out);
      break; }

    case 'jump': {
      // cloth whoosh + light footstep
      const {src:ns,out:flt}=makeNoise(ac,0.1,1200);
      const g=ac.createGain(); env(ac,g.gain,0.01,0.02,0.07,0.14);
      flt.connect(g); g.connect(out); ns.start(); ns.stop(now+0.12);
      const o=osc(ac,220,'sine',0.06,440); const g2=ac.createGain(); env(ac,g2.gain,0.005,0,0.06,0.1);
      o.connect(g2); g2.connect(out);
      break; }

    case 'land': {
      const o=osc(ac,90,'sine',0.06,40); const g=ac.createGain(); env(ac,g.gain,0.001,0.01,0.05,0.35);
      o.connect(g); g.connect(out);
      const {src:ns}=makeNoise(ac,0.07,400); const g2=ac.createGain(); env(ac,g2.gain,0.001,0,0.06,0.22);
      ns.connect(g2); g2.connect(out); ns.start(); ns.stop(now+0.08);
      break; }

    case 'throw': {
      // spinning blade — descending whistle
      const o=osc(ac,800,'sawtooth',0.15,280); const g=ac.createGain(); env(ac,g.gain,0.002,0.04,0.1,0.2);
      o.connect(g); g.connect(out);
      const {src:ns,out:flt}=makeNoise(ac,0.12,2000); const g2=ac.createGain(); env(ac,g2.gain,0.005,0.03,0.08,0.1);
      flt.connect(g2); g2.connect(out); ns.start(); ns.stop(now+0.14);
      break; }

    case 'parry': {
      /* CLANG — steel on steel. Inharmonic partials (not integer multiples)
         are what make it read as struck metal rather than a musical tone;
         the long shimmering tail is the Nine Sols-style deflect signature. */
      const parts=[
        [1046, 0.30, 1.25], [1523, 0.22, 1.10], [2489, 0.16, 0.95],
        [3271, 0.11, 0.80], [4703, 0.07, 0.62], [6217, 0.05, 0.45]
      ];
      parts.forEach(([f,amp,dur])=>{
        const o=ac.createOscillator(); o.type='sine';
        o.frequency.setValueAtTime(f*1.02,now);
        // slight downward detune as the metal settles
        o.frequency.exponentialRampToValueAtTime(f,now+0.09);
        const g=ac.createGain();
        g.gain.setValueAtTime(0,now);
        g.gain.linearRampToValueAtTime(amp,now+0.002);
        g.gain.exponentialRampToValueAtTime(0.0001,now+dur);
        o.connect(g); g.connect(out); o.start(); o.stop(now+dur+0.02);
      });
      // bright transient — the actual "tk" of the impact
      const {src:ns,out:flt}=makeNoise(ac,0.05,9000);
      const bp=ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=4200; bp.Q.value=1.4;
      const g1=ac.createGain(); env(ac,g1.gain,0.001,0.004,0.05,0.42);
      flt.connect(bp); bp.connect(g1); g1.connect(out); ns.start(); ns.stop(now+0.06);
      // low body thunk so the deflect has weight behind the ring
      const ob=osc(ac,220,'triangle',0.14,90); const g2=ac.createGain();
      env(ac,g2.gain,0.001,0.01,0.12,0.3);
      ob.connect(g2); g2.connect(out);
      break; }

    case 'pickup': {
      [520,780,1040].forEach((f,i)=>{
        const o=osc(ac,f,'sine',0.1); const g=ac.createGain();
        env(ac,g.gain,0.005,0,0.08,0.15);
        o.connect(g); g.connect(out);
        o.frequency.setValueAtTime(f,now+i*0.07);
      });
      break; }

    case 'heal': {
      [440,550,660,880].forEach((f,i)=>{
        const o=osc(ac,f,'sine',0.3); const g=ac.createGain();
        g.gain.setValueAtTime(0,now+i*0.07);
        g.gain.linearRampToValueAtTime(0.14,now+i*0.07+0.04);
        g.gain.exponentialRampToValueAtTime(0.001,now+i*0.07+0.28);
        o.connect(g); g.connect(out);
      });
      break; }

    case 'ult': {
      // massive pulse + roar
      const {src:ns,out:flt}=makeNoise(ac,0.5,600);
      const g=ac.createGain(); env(ac,g.gain,0.01,0.1,0.35,0.7);
      flt.connect(g); g.connect(out); ns.start(); ns.stop(now+0.55);
      [80,120,160].forEach((f,i)=>{
        const o=osc(ac,f,'sawtooth',0.45); const g2=ac.createGain(); env(ac,g2.gain,0.01,0.1,0.3,0.25);
        o.connect(g2); g2.connect(out);
      });
      break; }

    case 'hurt': {
      const o=osc(ac,180,'sawtooth',0.18,55); const g=ac.createGain(); env(ac,g.gain,0.001,0.02,0.14,0.35);
      o.connect(g); g.connect(out);
      const {src:ns}=makeNoise(ac,0.1,500); const g2=ac.createGain(); env(ac,g2.gain,0.001,0,0.09,0.25);
      ns.connect(g2); g2.connect(out); ns.start(); ns.stop(now+0.12);
      break; }

    case 'boss': {
      // heavy footstep / impact
      const o=osc(ac,55,'sine',0.22,28); const g=ac.createGain(); env(ac,g.gain,0.001,0.02,0.18,0.6);
      o.connect(g); g.connect(out);
      const {src:ns}=makeNoise(ac,0.16,300); const g2=ac.createGain(); env(ac,g2.gain,0.001,0.01,0.12,0.45);
      ns.connect(g2); g2.connect(out); ns.start(); ns.stop(now+0.18);
      break; }

    case 'boss_roar': {
      // distorted roar
      const o1=osc(ac,60,'sawtooth',0.6,80); const o2=osc(ac,63,'sawtooth',0.6,85);
      const wv=ac.createWaveShaper(); const curve=new Float32Array(256);
      for(let i=0;i<256;i++) curve[i]=Math.tanh((i/128-1)*8);
      wv.curve=curve;
      const g=ac.createGain(); env(ac,g.gain,0.02,0.2,0.34,0.5);
      o1.connect(wv); o2.connect(wv); wv.connect(g); g.connect(out);
      const {src:ns}=makeNoise(ac,0.55,800); const g2=ac.createGain(); env(ac,g2.gain,0.02,0.1,0.38,0.25);
      ns.connect(g2); g2.connect(out); ns.start(); ns.stop(now+0.6);
      break; }

    case 'shockwave': {
      const o=osc(ac,40,'sine',0.3,15); const g=ac.createGain(); env(ac,g.gain,0.001,0.03,0.24,0.7);
      o.connect(g); g.connect(out);
      const {src:ns}=makeNoise(ac,0.25,200); const g2=ac.createGain(); env(ac,g2.gain,0.001,0.02,0.2,0.4);
      ns.connect(g2); g2.connect(out); ns.start(); ns.stop(now+0.28);
      break; }

    case 'paper': {
      const {src:ns,out:flt}=makeNoise(ac,0.2,3000);
      const g=ac.createGain(); env(ac,g.gain,0.005,0.06,0.1,0.12);
      flt.connect(g); g.connect(out); ns.start(); ns.stop(now+0.22);
      break; }

    case 'sad': {
      [330,370,392].forEach((f,i)=>{
        const o=osc(ac,f,'sine',0.8); const g=ac.createGain();
        g.gain.setValueAtTime(0,now+i*0.08); g.gain.linearRampToValueAtTime(0.13,now+i*0.08+0.12);
        g.gain.exponentialRampToValueAtTime(0.001,now+i*0.08+0.78);
        o.connect(g); g.connect(out);
      });
      break; }

    case 'rizz': {
      [440,554,659].forEach((f,i)=>{
        const o=osc(ac,f,'triangle',0.28); const g=ac.createGain();
        g.gain.setValueAtTime(0,now+i*0.06); g.gain.linearRampToValueAtTime(0.12,now+i*0.06+0.05);
        g.gain.exponentialRampToValueAtTime(0.001,now+i*0.06+0.26);
        o.connect(g); g.connect(out);
      });
      break; }

    case 'grunt': {
      const o=osc(ac,200,'sawtooth',0.1,100); const g=ac.createGain(); env(ac,g.gain,0.002,0.02,0.07,0.25);
      const wv=ac.createWaveShaper(); const c=new Float32Array(128);
      for(let i=0;i<128;i++) c[i]=Math.tanh((i/64-1)*5);
      wv.curve=c; o.connect(wv); wv.connect(g); g.connect(out);
      break; }

    case 'spin_attack': {
      // heavy spinning whoosh
      const {src:ns,out:flt}=makeNoise(ac,0.4,2500);
      const g=ac.createGain(); env(ac,g.gain,0.02,0.1,0.24,0.5);
      flt.connect(g); g.connect(out); ns.start(); ns.stop(now+0.44);
      const o=osc(ac,200,'sine',0.4,80); const g2=ac.createGain(); env(ac,g2.gain,0.01,0.05,0.3,0.3);
      o.connect(g2); g2.connect(out);
      break; }

    case 'stomp': {
      const o=osc(ac,45,'sine',0.25,18); const g=ac.createGain(); env(ac,g.gain,0.001,0.02,0.2,0.8);
      o.connect(g); g.connect(out);
      const {src:ns}=makeNoise(ac,0.2,400); const g2=ac.createGain(); env(ac,g2.gain,0.001,0.02,0.15,0.55);
      ns.connect(g2); g2.connect(out); ns.start(); ns.stop(now+0.22);
      break; }
  }
}

/* Voiceover removed — the story is told through subtitles only.
   (Was speechSynthesis-based TTS narration.) */

/* ================= BACKGROUND MUSIC =================
   One looping track for the entire game, sitting well under the SFX so it
   never competes with the parry clang. Browsers block audio until a user
   gesture, so startBgm() is called from the first keypress/click and is
   safe to call repeatedly. */
const BGM_VOLUME = 0.16;
let bgm = null;
// Set while the cutscene is playing — that scene runs in silence. Kept separate
// from state.muted so the mute key and the cutscene can't clobber each other,
// and so stray keypresses (which call startBgm) can't restart the music mid-scene.
let bgmSuspended = false;
let fadeTimer = null;

function bgmShouldPlay(){ return !state.muted && !bgmSuspended; }

// Ramp volume over `ms`, optionally pausing once silent.
function fadeBgm(target, ms, pauseAtEnd){
  if(!bgm) return;
  clearInterval(fadeTimer);
  const steps = 24, from = bgm.volume, delta = (target-from)/steps;
  let i = 0;
  fadeTimer = setInterval(()=>{
    if(!bgm){ clearInterval(fadeTimer); return; }
    i++;
    bgm.volume = Math.max(0, Math.min(1, from + delta*i));
    if(i >= steps){
      clearInterval(fadeTimer); fadeTimer = null;
      if(pauseAtEnd) bgm.pause();
    }
  }, ms/steps);
}

function applyBgm(){
  if(!bgm) return;
  if(bgmShouldPlay()){
    if(bgm.paused){ bgm.volume = 0; bgm.play().catch(()=>{}); }
    fadeBgm(BGM_VOLUME, 900, false);
  } else {
    fadeBgm(0, 500, true);
  }
}

export function startBgm(){
  if(!bgm){
    if(bgmSuspended) return;      // don't spin it up mid-cutscene
    bgm = document.createElement('audio');
    bgm.id = 'bgm';               // in the DOM so it's inspectable in devtools
    bgm.src = 'assets/background.mp3';
    bgm.loop = true;
    bgm.volume = BGM_VOLUME;
    bgm.addEventListener('error', ()=>{ bgm=null; });  // missing file = silence, not a crash
    document.body.appendChild(bgm);
    if(bgmShouldPlay()) bgm.play().catch(()=>{});
    return;
  }
  applyBgm();
}

// Cutscene plays in silence; resumeBgm() brings it back for the credits.
export function stopBgm(){ bgmSuspended = true; applyBgm(); }
export function resumeBgm(){ bgmSuspended = false; if(!bgm) startBgm(); else applyBgm(); }

// Called after the mute key toggles state.muted.
export function syncBgmMute(){ applyBgm(); }
