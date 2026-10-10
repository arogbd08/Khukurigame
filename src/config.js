/* ================= GAME CONFIG / CONSTANTS ================= */
export const W = 820;
export const H = 420;
export const GROUND = H - 40;
export const WORLD = 8500;

/* ---- text pacing (frames @ 60fps) ---- */
// Subtitles auto-size to their text length; these are the floor/ceiling.
export const SUB_MIN_FRAMES = 200;      // ~3.3s even for a two-word line
export const SUB_PER_CHAR   = 5;        // +5 frames (~83ms) per character
export const SUB_MAX_FRAMES = 700;      // ~11.6s cap for non-sticky lines
export const INTRO_LINE_FRAMES = 118;   // gap between intro story lines

/* ---- guard / timed parry ----
   A tap creates a short deflect window; continuing to hold blocks frontal hits.
   Deflects answer enemy attacks, boss attacks, projectiles and shockwaves. */
export const PARRY_DURATION = 14;   // short press window; holding continues as a normal guard
export const PARRY_ACTIVE   = 6;    // reference value; difficulty sets the exact active cutoff
export const PARRY_COOLDOWN = 16;   // short lockout after a guard press
export const PARRY_HITSTOP  = 13;   // freeze on a successful deflect
export const PARRY_SHAKE    = 9;

/* ---- ultimate ---- */
// One charge is available at the start; spent charges return on a timed cooldown.
export const ULT_COST = 1;
export const ULT_MAX_CHARGES = 3;
export const ULT_RECHARGE_FRAMES = 480; // one charge every 8 seconds of play
export const ULT_DMG_NORMAL = 4;   // was 9
export const ULT_DMG_HEAVY  = 3;   // was 6
export const ULT_DMG_BOSS   = 2;   // was 3

/* ---- COMBO SYSTEM (ground string + aerial down slash) ----
   Square/left-click attack chains the ground string; the same attack input in
   the air starts AIR_DOWN. Ground presses chain inside the current move's
   `cancel` window. Frame counts @60Hz. The three ground hits are visually
   distinct — a poke, a side swing, then a rising finisher — not one canned swing.
     dur total frames   a0,a1 active hitbox window   dmg/kb   hitstop freeze on hit
     cancel frame after which you may chain   reach hitbox length
     kind  'poke'|'side'|'rise' — drives the pose/arc in render.js
   String: L1(poke) -> L2(side swing) -> L3(rising finisher). */
export const MOVES = {
  L1: {dur:12, a0:2, a1:6,  dmg:1, kb:5,  hitstop:3, reach:66, cancel:6,  next:{L:'L2'}, kind:'poke'},
  L2: {dur:13, a0:3, a1:8,  dmg:1, kb:7,  hitstop:3, reach:60, cancel:6,  next:{L:'L3'}, kind:'side'},
  L3: {dur:18, a0:5, a1:11, dmg:2, kb:13, hitstop:5, reach:66, cancel:12, finisher:true, kind:'rise'},
  AIR_DOWN: {dur:17, a0:2, a1:9, dmg:2, kb:8, hitstop:4, reach:58, cancel:17, airDown:true, kind:'down'}
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
   Chosen in the pre-intro menu (1 = Casual, 2 = Warrior). `diff()` in state.js
   returns the active row. dmgMul scales every hit the player TAKES; parryThresh
   is the `parry>` cutoff for the active deflect window (lower = wider/more forgiving);
   enemySpeed scales enemy + boss movement/approach; momoHeal is momos-per-heart;
   orbHeal is HP from a heal orb. */
export const DIFF = {
  casual:  {label:'Casual',  maxHp:13, dmgMul:0.6, parryThresh:5, enemySpeed:0.82, momoHeal:4, orbHeal:4},
  warrior: {label:'Warrior', maxHp:8,  dmgMul:1.4, parryThresh:9, enemySpeed:1.15, momoHeal:6, orbHeal:2}
};

// Mustang-style stone terrace steps and the descending entrance to the final cave.
// House roofs are generated from the actual house dimensions in entities.js.
export const PLATFORM_LAYOUT = [
  {x:1510,y:342,w:84,kind:'terrace'}, {x:2390,y:340,w:86,kind:'terrace'},
  {x:3910,y:339,w:82,kind:'terrace'}
];

// Compact clusters of mud-brick houses; flat roofs are real climbable surfaces.
export const VILLAGE_HOUSES = [
  [340,1.15],[850,1.1],[1280,1.2],[2200,1.2],[2730,1.15],[3750,1.2],[4120,1.05]
];
// Keep all seven houses visible, but only four are solid/climbable route obstacles.
export const VILLAGE_COLLISION_HOUSES = [[340,1.15],[1280,1.2],[2730,1.15],[3750,1.2]];
export const STUPA_X=2600, STUPA_SCALE=1.05;
export const DUNGEON_ENTRY_X=4360, DUNGEON_ENTRY_END=4590;
export const DUNGEON_FLOOR=GROUND+168, DUNGEON_BOSS_ROOM_START=7380, DUNGEON_BOSS_TRIGGER=7460;
export const DUNGEON_STEPS=[
  {x:4350,y:398,w:72,kind:'dungeonStep'}, {x:4435,y:438,w:72,kind:'dungeonStep'},
  {x:4515,y:480,w:72,kind:'dungeonStep'}
];
export const DUNGEON_ALCOVES=[];
export const DUNGEON_PITS=[[5360,5560]];
export const GROUND_GAPS=[[1790,1910],[DUNGEON_ENTRY_X,DUNGEON_ENTRY_END],...DUNGEON_PITS];

export const MOMO_X = [330,790,1270,1740,2270,2750,3270,3790,4300,4800,5100,5740,6120,6350,6850,7100,7280,7520,7800];

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
