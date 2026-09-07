/* ================= GAME CONFIG / CONSTANTS ================= */
export const W = 820;
export const H = 420;
export const GROUND = H - 40;
export const WORLD = 5200;

/* ---- text pacing (frames @ 60fps) ---- */
// Subtitles auto-size to their text length; these are the floor/ceiling.
export const SUB_MIN_FRAMES = 200;      // ~3.3s even for a two-word line
export const SUB_PER_CHAR   = 5;        // +5 frames (~83ms) per character
export const SUB_MAX_FRAMES = 700;      // ~11.6s cap for non-sticky lines
export const INTRO_LINE_FRAMES = 118;   // gap between intro story lines

/* ---- parry (Nine Sols style: generous window, huge feedback) ----
   EVERY damage source in the game is parryable: enemy lunge/leap/slam, thrown
   knives, boss slash/leap/spin, boss projectiles, and ground shockwaves. */
export const PARRY_DURATION = 24;   // total stance length
export const PARRY_ACTIVE   = 8;    // deflect succeeds while parry > this  => 16 active frames (~267ms)
export const PARRY_COOLDOWN = 16;   // short — parry is meant to be spammable-but-punishing
export const PARRY_HITSTOP  = 13;   // freeze on a successful deflect
export const PARRY_SHAKE    = 9;

/* ---- ultimate ---- */
// Now costs a single parry point, so its damage is toned down accordingly.
export const ULT_COST = 1;
export const ULT_MAX_CHARGES = 3;
export const ULT_DMG_NORMAL = 4;   // was 9
export const ULT_DMG_HEAVY  = 3;   // was 6
export const ULT_DMG_BOSS   = 2;   // was 3

/* ---- COMBO SYSTEM (light-only khukuri strings) ----
   One attack button (Left mouse). Each press chains to the next move inside the
   current move's `cancel` window. Frame counts @60Hz. The three hits are visually
   distinct — a poke, a side swing, then a rising finisher — not one canned swing.
     dur total frames   a0,a1 active hitbox window   dmg/kb   hitstop freeze on hit
     cancel frame after which you may chain   reach hitbox length
     kind  'poke'|'side'|'rise' — drives the pose/arc in render.js
   String: L1(poke) -> L2(side swing) -> L3(rising finisher). */
export const MOVES = {
  L1: {dur:12, a0:2, a1:6,  dmg:1, kb:5,  hitstop:3, reach:66, cancel:6,  next:{L:'L2'}, kind:'poke'},
  L2: {dur:13, a0:3, a1:8,  dmg:1, kb:7,  hitstop:3, reach:60, cancel:6,  next:{L:'L3'}, kind:'side'},
  L3: {dur:18, a0:5, a1:11, dmg:2, kb:13, hitstop:5, reach:66, cancel:12, finisher:true, kind:'rise'}
};
export const COMBO_GAP = 42;   // frames of no hits before the combo counter resets

/* ---- POSTURE / DEATHBLOW (Sekiro-flavoured) ----
   Enemies block your attacks (chip posture, little HP). Parrying THEIR attacks
   deals big posture damage. When posture fills they STAGGER (vulnerable) — a hit
   then is a DEATHBLOW (instant kill for mooks; big damage window for the boss). */
export const STAGGER_FRAMES = 130;   // how long a broken enemy stays open
export const POSTURE_REGEN   = 0.03;  // posture bled off per frame when not pressured
export const POSTURE_HIT      = 0.8;   // posture from a clean (unblocked) hit
export const POSTURE_BLOCK    = 1.3;   // posture from a blocked hit (no HP)
export const POSTURE_PARRY    = 2.6;   // posture from deflecting their attack (the fast route)
export const DEATHBLOW_FRAMES = 24;    // player deathblow animation length

/* ---- DIFFICULTY (two modes, numbers only — combat depth is identical) ----
   Chosen on the intro screen (1 = Casual, 2 = Warrior). `diff()` in state.js
   returns the active row. dmgMul scales every hit the player TAKES; parryThresh
   is the `parry>` cutoff for the active deflect window (lower = wider/more forgiving);
   enemySpeed scales enemy + boss movement/approach; momoHeal is momos-per-heart;
   orbHeal is HP from a heal orb. */
export const DIFF = {
  casual:  {label:'Casual',  maxHp:12, dmgMul:0.7, parryThresh:4,  enemySpeed:0.85, momoHeal:4, orbHeal:3},
  warrior: {label:'Warrior', maxHp:8,  dmgMul:1.4, parryThresh:10, enemySpeed:1.15, momoHeal:6, orbHeal:2}
};

// platform layout: flat [x,y, x,y, ...] pairs, each 130x14
export const PLATFORM_LAYOUT = [
  300,300, 520,250, 760,300, 1000,235, 1240,290, 1480,240, 1720,300, 1980,250,
  2240,300, 2480,235, 2720,290, 2980,250, 3240,300, 3500,240, 3760,300, 4020,250
];

export const MOMO_X = [330,560,790,1010,1270,1300,1510,1740,1760,2010,2270,2300,2510,2750,3010,3270,3300,3530,3790,4040,4070,4300,4350,4400];

export const introLines = [
  'Euta dukhad katha.',
  'Hiunle chapakka dhakeko euta sano gaun thiyo.',
  'Tyaha ek Hari namak tupi bahun basdathyo.',
  'Sunsan gaun ma sahar ko lobh lagyo.',
  'Maobadi haru gaun ma aaune halla le sabai gaule haru darayeka thiye.',
  'Gaun ma Hari ko crush, Muna pani basthin.',
  'Ek din Hari dhyan gareko bela Maobadi aaye — ani Muna lai lage.',
  'Hari le pachi yo thaha payo. Ris le usko ragat khalbaliyo.',
  'U ghar gayo, daraj bata hajurbau ko khukuri nikalyo, ra niskyo.',
  'Ke u Muna lai bachauna sakcha ra?'
];
