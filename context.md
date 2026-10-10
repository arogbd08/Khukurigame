# context.md

Read this at session start. Update it as the LAST step of every session, without being asked.
Keep it scannable — facts, not prose. This file exists to avoid re-explaining the project.

---

## What this is
`Khukuri` — 2D side-scrolling action-platformer, browser, vanilla JS + Canvas 2D.
Nepali setting/story. Hari fights across a 5200px level to rescue Muna; the ending is a joke
rejection cutscene. Subtitle language is chosen before the intro: English or romanized Nepali.
No Devanagari or voiceover: story is told through on-screen subtitles.

Story (intro, set by user — don't rewrite without asking): Maobadi raid the village while Hari
is meditating and take Muna; he pulls his grandfather's khukuri from the daraj and goes after her.
Note the in-game boss is still the "Bhrasta Mantri" — the intro says Maobadi. Mismatch is known
and user has not asked to reconcile it.

## Run it
ES modules + Phaser CDN-style global → needs a static server, `file://` will NOT work.
`python -m http.server 8000` then open `http://localhost:8000/index.html`.
(`.claude/launch.json` runs exactly this on port 8000.)

## Engine: Phaser 3 (migration DONE, step 1)
Game now runs ON Phaser 3.80.1, vendored at `vendor/phaser.min.js` (local, no build step,
no runtime CDN). Phaser owns: game loop, scene lifecycle, display surface.
- **Fixed 60Hz kept.** `src/main.js` runs an accumulator in the Phaser Scene `update()`;
  all frame-counter tuning (atk=18, parry windows, boss timers) is preserved byte-for-byte.
  Phaser's variable rAF never touches game feel.
- **Rendering unchanged.** All procedural Canvas 2D in render.js/scenes draws into the
  offscreen `cv` (canvas.js now creates it via createElement, not the DOM). Phaser registers
  `cv` as a texture (`addCanvas('frame',cv)`) and `refresh()`es it each frame. Zero art rewrite.
- **Input stays DOM.** keydown/keyup/mousedown wired in main.js `wireInput()`, verbatim from
  the pre-Phaser build (edge-trigger `!e.repeat` + first-gesture audio unlock are exact).
- index.html: `<div id="game">` is the Phaser parent; `<script src="vendor/phaser.min.js">`
  loads before the module. The old `<canvas id="c">` is gone.
- Verified via headless Edge (scratchpad `verify.js`): Phaser loads, 60Hz loop alive, movement/
  jump/attack/parry all work, cutscene+credits+play render clean. Only 404s are favicon (known).

## File structure
```
index.html              markup only; <link> css + <script type="module" src="src/main.js">
khukuri.html            ORIGINAL pre-split single file. Reference/rollback only. Do not edit.
context.md              this file
styles/style.css        page + canvas chrome
assets/README.md        notes on what lives here (all art + SFX are procedural, not files)
assets/background.mp3   looping BGM for the whole game, 3.55MB / 5:10. User-supplied.
src/
  main.js               entry: keyboard wiring, startGame(), setInterval(update,1000/60) + rAF render
  config.js             W/H/GROUND/WORLD, platform+momo layouts, text-pacing consts, PARRY_*/ULT_* tunables
  state.js              cross-module mutable state, say(), screen shake/flash, spark particle system, input
  entities.js           player, plats, momos, paper, cadre() factory, enemies, boss, cage, projectile arrays
  audio.js              ~19 Web Audio SFX synths + looping BGM (NO TTS — removed)
  render.js             ALL canvas drawing: parallax bg, animated characters, props, HUD, subtitles
  canvas.js             canvas + 2d ctx singleton
  utils.js              over() AABB test
  scenes/
    BootScene.js        intro title + staged story lines
    GameScene.js        play scene: full update() logic + drawWorld(). The big one (~600 lines).
    CutsceneScene.js    Muna/Raju rejection. Player-paced: LINES[] array, Enter advances
    CreditsScene.js     starfield, credits, outro narration
```

## Implemented
- Full split from single-file → modules (behavior verified identical vs `khukuri.html`).
- **Runs on Phaser 3** (see "Engine" section above).
- **Two difficulty modes** (numbers only, same depth): Casual / Warrior. Chosen on intro
  (keys 1/2; Enter/click = Casual). `DIFF` table in config.js, `diff()` in state.js. Scales
  player maxHp, damage taken (dmgMul), parry active window (parryThresh), enemy+boss speed,
  momo-per-heart, heal-orb amount. HUD shows the label under the ult pips.
- **Combo system (ground strings, DMC-lite):** Light (J) + Heavy (K). Move graph `MOVES` in
  config.js: light string L1→L2→L3, any light cancels into a Heavy finisher (HF); Heavy opener
  H1 can cancel into light. Inputs buffer and chain at each move's `cancel` window. Per-swing
  hit gating (`player.atkId` vs enemy/boss `lastAtkId`) so EVERY hit of a string connects once.
  Dodge and parry cancel attacks (flow). Combo counter with milestone toasts + big HUD number.
  Throw MOVED off K → **I**. (Legacy `player.atk` field is now unused but left in place.)
- **Iai-jutsu** (key O): sheathed coil → lightning draw-cut. Long reach (120), dashes forward
  with i-frames (`invuln()` treats move==='IAI' as invulnerable), 4 dmg, big knockback, on a
  cooldown (`IAI_COOLDOWN 100`, `player.iaiCd`). MOVES.IAI in config.js.
- **Articulated character rendering** (render.js): 2-bone IK limbs (`limb2()`) for Hari's arms +
  legs AND enemy weapon arms/legs — real elbows/knees/hands/feet, not single strokes.
- **KATANA blade** (`katanaBlade()` for Hari): single sori curve, kissaki tip, yokote, hamon,
  ito-wrapped tsuka, oval tsuba — a real katana (the earlier khukuri-hybrid was dropped on
  request 2026-08-30). Thrown khukuri (`drawBlade()`) + enemy weapons unchanged; boss keeps its
  big sword. `BLADE_LEN=42` (used for the smear tip).
- **Saya (scabbard)** (`drawSaya()`): lacquered scabbard + red obi tie worn on Hari's left hip at
  ALL times (empty while the katana is in hand). For the iai, `iaiSheathed` (atkT<a0) draws the
  blade seated inside with the tsuka protruding to grip, and a bright blade sliver slides out of
  the koiguchi as `atkT→a0`; at a0 the blade is "drawn" into the hand for the cut. POSE.IAI.wind
  now grips the saya handle (hx8,hy47) → hit at full forward extension.
- **Directional attack choreography** (`POSE` table + `attackPose()` in render.js): each move
  sweeps a different arc — L1 diagonal downslash, L2 rising slash, L3 flat cleave, H1 overhead
  chop, HF wide cleave, IAI draw-cut — with wind-up→strike→recovery keyframes (eased).
- **Phantom-Blade-style FX**: blade-smear ribbon (`hariTrail`/`pushTrail`/`drawTrail`) sampled
  during active frames, plus full-body afterimage ghosts on iai/finisher/L3.
- **Enemy attack animations** (`enemyArm()`): weapon arm cocks back on wind-up, thrusts forward
  through lunge/leap/slam with a slash smear; posed by `e.state`.
- Movement, double jump, dodge-roll, khukuri throw (ammo), parry, ultimate.
- 3 enemy types: `cadre` (balanced), `thug` (fast/dodges when hit), `heavy` (tanky/slam).
- Boss: 3 phases @ 18 HP, 5 attacks (slash/throw/leap/spin/stomp), summons cadres in phase 3.
- Pickups: momo (5 = +1 HP), khukuri drops (+1 ammo), heal orbs (+2 HP), lore paper.
- 4 scenes: intro → play → cutscene → credits.
- Story captions/subtitles support English or romanized Nepali, selected before the intro.
  No Devanagari or voiceover.
- Subtitles auto-size duration to text length (`say()` in state.js) — floor 200 frames.
- Full character animation: walk cycle w/ leg IK-ish bend, jump/fall poses, landing squash,
  parry guard stance, idle breathing + blink, tupi sway, body lean, robe flare. Enemies+boss too.
- Parry reworked Nine Sols-style + metallic CLANG sfx (inharmonic partials).
- **Every damage source is parryable** — enemy lunge/leap/slam, thrown knives, boss
  slash/leap/spin, boss projectiles, AND ground shockwaves. No unparryable attacks remain.
- Screen shake, white flash, directional spark particle bursts on hits/parries/deaths.
- **Toast system** (state.js `toast()` / render.js `drawToasts()`): minimal right-side stack
  for moment-to-moment feedback. Max 5, ~1.75s each, outlined text (no panel).
- Looping background music for the whole game at volume 0.16 (`BGM_VOLUME` in audio.js),
  suspended (faded out) for the cutscene and faded back in on the credits.
- Cutscene is **player-paced**: `LINES[]` in CutsceneScene.js, `cs.i` is the current index,
  Enter calls `advanceCutscene()`. Lines are sticky (`say(..., 9999, ...)`), no auto-advance.
- Subtitle box auto-sizes to the text width (min 360, max W-24).
- Layered parallax background: sun w/ god rays, 2 cloud bands, 3 ridgelines w/ snowcaps,
  haze bands, birds, stupa, houses w/ chimney smoke, prayer flags, terraced hills, pines, dust motes.

## Controls (current — 2026-10-02)
Move A/D · jump W/Space · dodge Shift · **Left-click = attack** (light combo string) ·
**Right-click = parry** · **E = ult (iai-jutsu)** · F free Muna · R restart · M mute · 1/2 difficulty on intro.
Title screen and opening gameplay show controls, then fade. Intro menu order: title → language →
difficulty → Enter-paced cinematic → game. Mouse handling is in main.js `wireInput` (contextmenu
prevented; button0=light, button2=parry).

## Weapons (2026-09-07, from user reference images)
- **Khukuri** = Hari's normal blade (`khukuriBlade()` in render.js): forward-drooping heavy belly,
  down-curved tip, inner edge bevel, brown wooden handle + metal bolster, cho notch. `KH_LEN=34`.
- **Katana** = the ult/iai only (`katanaBlade()`): silver sori blade, wavy hamon, gold fittings
  (kashira/fuchi/tsuba/habaki), black tsuka with RED diamond ito wrap. `BLADE_LEN=42`.
- **Saya** (`drawSaya()`): katana scabbard worn on the left hip always — black lacquer, gold
  panels, red sageo tassel. Holds the katana normally; empty during the ult (blade in hand).
- Combos are LIGHT-ONLY now (heavy removed) and choreographed as poke → side-swing → rising
  finisher (POSE table), mostly horizontal. Khukuri THROW + its ammo/drops REMOVED (pthrows array
  kept only for parry-deflected enemy projectiles). HUD shows "iai:" charges, no ammo row.
- Ult = **iai-jutsu** (E, costs 1 charge): katana down→up rising draw-cut, dashes forward with
  i-frames, same damage as the old ult (ULT_DMG_*). Down→up pose computed in drawHari from p.ult.
- Parry FX = small ORANGE spark burst (parrySuccess), NO shield semicircle arc anymore.

## Posture / deathblow (Wave 2 DONE 2026-09-07)
Sekiro-style, config consts STAGGER_FRAMES/POSTURE_* /DEATHBLOW_FRAMES.
- Enemy + boss have `posture`,`maxPosture`,`stagger`,`blockFlash` (entities.js). Player has
  `deathblow`,`dbTarget`.
- Enemies BLOCK frontal hits while patrol/recover (e.dir===playerSide) → no HP, +POSTURE_BLOCK,
  grey clash arc. Hitting an attacking/behind/exposed enemy = clean HP + POSTURE_HIT. Parrying
  their attack = +POSTURE_PARRY (fast route) — parrySuccess now takes (x,y,target,isBoss).
- Posture bleeds off (POSTURE_REGEN) when not pressured. Fill → breakPosture() → e.stagger set,
  enemy AI frozen (gated by `if(e.stagger<=0)`). Hitting a staggered MOOK → triggerDeathblow()
  → player.deathblow anim (khukuri lunge thrust) → killEnemy at end. Boss does NOT instakill:
  staggered boss takes DOUBLE damage + can't act (boss AI wrapped in `if(boss.stagger<=0)`).
- Render: per-enemy posture bar + red ▼ stagger marker (drawEnemy); boss posture bar under HP bar
  + "SUSTAYO — prahar gara!" prompt; deathblow thrust pose + iai crouch (render.js drawHari:
  `dbActive`, `crouch`). Verified headless: hit→posture→stagger→deathblow kills; parry 0→2.6.

## TODO / not done (this multi-part request, in waves)
- Wave 1 DONE: controls remap, khukuri+katana, ult=iai, FX, horizontal combos.
- Wave 2 DONE: posture bar + block + deathblow (above) + iai crouch stance from ref image.
- Wave 3 NOT DONE: action-gated **tutorial** phase with **on-screen control prompts** (teach each
  mechanic incl. parry/deathblow; advance when the player performs it); practice dummies.
- Wave 4 NOT DONE: **Aunty NPC** after tutorial before boss ("babu muna lai ta mantri le jungle ma
  lageko cha re, abui k garne hola"), then a **village→jungle** transition via gate-climb platforming.
- Level 2 plan delivered verbally (jungle "Ban": archer/spearman/beast enemies, rope-bridge
  setpiece, Maobadi commander mini-boss, reconciles Mantri/Maobadi naming).
- Feel-work pass (2026-08-29/30) is DONE: Phaser migration, 2 difficulties, combo system,
  parry+attack animation polish, de-stiffened enemies/boss. All verified headless (see below).
- Scope chosen by user: combos = **ground strings only** (no aerial juggle / no style meter);
  difficulty = **Casual vs Warrior, numbers only** (no smarter AI on Warrior).
- Possible future asks (NOT requested): aerial juggle / launcher, DmC style meter, Warrior AI
  changes, sprite-bake to real Phaser textures (would need per-frame bakes — deferred).

## Key architecture decisions (and why)
- **Vanilla Canvas 2D, no framework (currently).** It's what the game was written in; Phaser is
  a planned migration, not the current state.
- **All art is procedural canvas paths; all SFX are synthesized Web Audio.** There are ZERO image
  or audio asset files. `/assets` is empty by design — don't go looking for sprites.
- **Fixed 60Hz `setInterval` for logic, rAF for render.** All combat timing is FRAME COUNTERS
  (`atk=18`, `parry=22`, `hurt=52`, boss `timer`), not milliseconds. Converting to delta-time
  would change game feel. This is the main friction point for the Phaser migration.
- **`state.js` holds mutable globals in one exported object**, not `export let`, so every module
  observes the same live values across ES module boundaries.
- **Arrays in `entities.js` are mutated in place** (`resetEnemies()`/`resetMomos()`), never
  reassigned, so importers keep a valid reference after a restart.
- **`say(text, frames, color)` — 3 args.** `src/i18n.js` translates mapped subtitles according to
  `state.language`; `sub` is `{text,t,color}`.
  `frames` is a MINIMUM, not exact — auto-duration from text length wins if longer, which is
  why sticky `9999` prompts still work.
- **`hitstop` early-returns from `updatePlay()`** to freeze the world, but shake/flash/sparks are
  updated BEFORE that return so the freeze still looks alive.

## Gameplay tuning (current values, in config.js)
- Parry: `PARRY_DURATION 24`, active while `parry > PARRY_ACTIVE(8)` → **16 active frames
  (~267ms)**, `PARRY_COOLDOWN 16`. Deliberately generous — mistiming costs tempo, not a lockout.
- Parry rewards: +1 ult charge, 13f hitstop, screen shake, flash, sparks, staggers+knocks back
  the attacker, and deflected projectiles become YOUR projectile fired back at 1.3x speed.
- Shockwave parry destroys the wave (`s.dead`, filtered in the same cleanup as `life<=0`).
- Boss leap parry is guarded by `boss.leapParried` so one leap can't be parried twice.
- To re-audit parry coverage: grep `hurtPlayer(` — every callsite must sit behind an
  `if(parrying)` branch. That's how the shockwave gap was found.
- Ult: costs **1** charge (was 3), max 3 banked. Damage reduced to compensate:
  `ULT_DMG_NORMAL 4` (was 9), `ULT_DMG_HEAVY 3` (was 6), `ULT_DMG_BOSS 2` (was 3).
- Combos (`MOVES` in config.js): Light L1/L2/L3 dmg 1/1/2, Heavy H1/HF dmg 3. `cancel` frame
  gates chaining; `COMBO_GAP 42` frames before the counter resets. To tune string feel, edit
  dur/a0/a1/cancel/kb per move. Damage is intentionally low-per-hit — the DPS comes from chaining.
- Difficulty (`DIFF` in config.js): casual maxHp12/dmgMul0.7/parryThresh4/enemySpeed0.85/
  momoHeal4/orbHeal3; warrior maxHp8/dmgMul1.4/parryThresh10/enemySpeed1.15/momoHeal6/orbHeal2.
  parryThresh is the `parry>` cutoff for the active deflect window (LOWER = wider/more forgiving).
  Both GameScene (gameplay) and render.js (guard visuals) read `diff().parryThresh` — keep them
  in sync if you change how it's read.

## Known issues / do not touch
- `khukuri.html` is the untouched original. Leave it — it's the rollback + behavior reference.
- **Voiceover was removed on request. Do not re-add TTS.** `speechSynthesis` is gone everywhere.
- English subtitles are available by menu selection; Nepali subtitles remain romanized.
  Functional HUD labels remain English.
- **Subtitles are for STORY ONLY.** Gameplay feedback (pickups, parries, kills, ult, heavy
  windup, cadre summon) goes to right-side toasts — the subtitle bar sits over the play area
  and reading it mid-fight costs you the fight. Don't move gameplay messages back to `say()`.
- Credits list ONLY: `Arogya Badal`, `Claude Code`, then `Thank you for playing`. Pramit and
  the Khaseka Tara / Albatross song references were removed on request — don't reintroduce.
- The intro story text is the USER'S OWN WRITING, lightly refined for capitals/punctuation.
  Don't rewrite it. Only typo fixed: "kuhuri" → "khukuri".
- Browsers block audio until first user gesture. `startBgm()` is called from the first
  keypress/click (idempotent) and `startGame()` resumes the AudioContext. Expected.
- BGM element is in the DOM as `#bgm` so it's inspectable in devtools. `syncBgmMute()` must be
  called after any `state.muted` toggle or the music won't follow the mute key.
- `bgmSuspended` (cutscene silence) is deliberately SEPARATE from `state.muted`. Playback needs
  `!muted && !suspended`. Without the flag, `startBgm()` — which fires on every keypress for
  autoplay reasons — would restart the music on any stray key during the cutscene.
  `reset()` calls `resumeBgm()` so pressing R mid-cutscene can't strand it in silence.
- Cutscene dialogue is USER-WRITTEN. Don't rewrite. To add a line, append to `LINES[]` and
  check `LEAVE_FROM` / `RAJU_SPEAKS` indices still point at the right lines.
- Cutscene camera stays on the ending area with a slight cinematic drift.
  Anything positioned right of 5200 during the cutscene is OFF SCREEN — this bit Raju, whose
  walk-in was tuned for the old timed pacing and left him off-camera when players mashed Enter.
  `RAJU_SPEED` + a hard snap at `RAJU_SPEAKS` guard it.
- Two harmless 404s in console — both are `favicon.ico`. `background.mp3` returns 200.
- `khukuri.html` still contains the OLD credits (Pramit / Khaseka Tara) and the removed song
  code. That's fine — it's the frozen original. Don't grep it for current behavior.
- Credits `drawCredits()` increments `state.t` itself (render-driven, not update-driven). Quirk
  inherited from the original — the credits scene has no update step.
- Intro layout is tuned for exactly 10 lines (y = 112 + i*27, 15px font). Adding lines will
  overflow into the "Enter" prompt at y = H-26.

## Testing approach that works here
No test framework. Verify with headless Edge via `puppeteer-core` (no Chromium download):
`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
- Seed `Math.random` via `evaluateOnNewDocument` for determinism, script keypresses,
  screenshot `#c`, watch `pageerror`.
- **Jump to any scene directly** — modules are same-origin, so from `page.evaluate`:
  `const {state} = await import('/src/state.js'); state.scene='credits'; state.t=200;`
  No need to beat the boss to check the cutscene/credits.
- Scratchpad scripts: `compare.js` (orig-vs-split), `play.js` (playthrough), `credits.js`
  (cutscene+credits), `intro.js` (intro layout).
- **`node --check` is NOT enough** — it catches syntax but not bad imports. A stale
  `import {queueNarrate}` passed `--check` and only failed in the browser. Always load the page.
- **Grep case-sensitively at your peril**: searching `narrate` misses `queueNarrate`. Use `-i`.

---

## Last session (2026-10-01 — intro cinematic)
1. Reworked `src/scenes/BootScene.js` as title menu → ten-shot story cinematic → difficulty
   selection. Captions use the unchanged `introLines` wording, centered over the image with no
   subtitle panel; shots run 180 fixed frames each with short dissolves and letterbox bars.
2. Intro actors/backgrounds use the actual game renderers (`drawHari`, `drawMuna`, `drawEnemy`,
   `drawHouse`, `drawBackground`, `drawGround`). Hari has a native-renderer meditation pose and
   stays unarmed until the khukuri story beat. Casual and Warrior are clickable buttons; choosing
   either starts the game. Enter opens the cinematic from the title menu; keys 1/2 choose difficulty.
3. `git diff --check` passed. No browser verification run.

## Last session (2026-10-02 — bilingual menus and cutscene sound)
1. Menu order: title → subtitle language → difficulty → intro. Difficulty selection starts the
   cinematic; its last Enter fades into play. Shots wait for Enter. Added title controls with a fade,
   village houses, a distinct villager messenger, heartbeat pulse as Hari learns Muna was taken, and
   an opening daraj revealing the khukuri. Hari meditates during the raid shot.
2. Replaced cage bars with Muna tied to a post. Added a short fading gameplay control guide. Ending
   cutscene has letterbox bars, slow camera drift, centered dialogue without the regular subtitle
   panel/HUD, a quiet transition whoosh, and an arrival rustle.
3. English and romanized Nepali subtitle options cover intro lines and mapped `say()` dialogue;
   English describes Hari as having a ponytail (the Nepali `tupi` detail), not wearing a topi.
   `git diff --check` passed. No browser verification run.

## Last session (2026-08-30, part 2 — animation overhaul)
1. Rewrote character rendering: 2-bone IK limbs (`limb2`) for Hari + enemies, katana/khukuri
   HYBRID blade (`hybridBlade`, `drawBlade`), per-move directional attack choreography
   (`POSE`/`attackPose`), Phantom-Blade blade smears (`hariTrail`) + afterimage ghosts, and
   articulated enemy weapon arms (`enemyArm`) with wind-up→thrust poses + slash smears.
2. Added **Iai-jutsu** (key O): dash-through draw-cut with i-frames, cooldown, 4 dmg.
   Remapped: J=light, K=heavy, O=iai, I=throw. index.html help updated.
3. Verified headless (Edge, server on :8123 via background `python -m http.server`): O→IAI move,
   iaiCd set, iai deals 4 dmg; captured 3x close-ups (scratchpad cu_*.png / anim_*.png) — hybrid
   blade, articulated limbs, overhead-chop windup, fighting stance all render correctly. No errors.
   NOTE: the preview_start server on :8000 keeps dying between tool calls — for headless testing
   start your OWN `python -m http.server <port>` as a background Bash task and point scripts at it.

## Last session (2026-08-30, part 1 — Phaser + combat)
1. **Ported the game onto Phaser 3** (vendored `vendor/phaser.min.js`). Phaser owns loop/scene/
   display; kept fixed 60Hz + all frame counters; rendering still procedural into `cv`, shown as a
   Phaser texture. canvas.js now creates `cv` off-DOM; index.html uses `<div id="game">`.
2. Added **Casual/Warrior difficulty** (intro keys 1/2), a **Light+Heavy combo system** with
   ground strings + finisher + per-swing hit gating + combo counter (controls: J=light, K=heavy,
   throw moved K→I), and **polished animation**: new light/heavy blade arcs with wind-up/
   drive lean + trailing slash fx for Hari, and anticipation/idle-sway lean for all enemies + boss.
3. Verified in **headless Edge** (puppeteer-core installed in the scratchpad, not the repo):
   Phaser loads, 60Hz loop alive, move/jump/attack all work; LLLH string lands all 4 hits (7 dmg,
   combo counter 4); Casual/Warrior HP 12/8; throw on I; parry stance + scaled window; cutscene/
   credits render clean. Only console noise is the known favicon 404s.
4. NOTE: scratchpad test scripts are `verify.js` / `verify2.js` / `verify3.js`. rAF does NOT fire
   in the in-app Browser pane (loop stalls there) — use headless Edge, not the pane, to test logic.

## Prior session (2026-08-10)
1. Split the 1264-line `khukuri.html` into the module structure above; verified identical behavior
   vs the original via seeded-random side-by-side headless runs.
2. Reworked on request: romanized all text, slowed subtitles/cutscene beats, Nine Sols-style parry
   (+ metallic clang, sparks, shake, flash), animations for everything, ult → 1 charge w/ reduced
   damage, layered parallax background.
3. Then, in order: removed the TTS voiceover; removed all English story text (`say()` refactored
   to 3 args); replaced the intro with the user's own 10-line Maobadi story; moved gameplay
   feedback out of subtitles into right-side toasts; added `background.mp3` as global BGM and
   rewrote the credits (Arogya Badal / Claude Code / Thank you for playing); made shockwaves
   parryable and widened the parry window 13→16 active frames; stopped BGM during the cutscene
   (fade out/in); converted the cutscene from timed beats to Enter-advanced dialogue.
4. **Phaser migration STILL NOT STARTED** — user never answered the fixed-timestep vs
   idiomatic-Phaser question. Ask before starting. Note the heavy canvas animation work done in
   render.js would need re-baking under the agreed `generateTexture()` sprite plan.

## Last session (2026-10-02 — village platforming and cinematic setting)
1. Added a distant city skyline for the English “city’s greed” story beat; moved the raid into a
   house cutaway with Hari meditating inside and Muna’s kidnapping outside.
2. Unified the sky and scene grade around the dark cinematic look. Made the mountain profiles
   sharper, grounded distant houses at the valley floor, attached prayer flags to supports, and
   moved a large stupa into the playable foreground.
3. Reworked the level route with climbable village house roofs, stone terrace ledges, house/stupa
   collision, and a lethal jumpable ground gap. Updated the collectible note to village-protection
   lore and translated it; the English ending preserves “muji.”
4. Removed the end cutscene’s horizontal camera sway for steady framing. `git diff --check` passed;
   no browser verification run.
5. Browser follow-up: confirmed the prior `GROUND_GAPS` export/import error is absent in the local
   preview. Suppressed gameplay platform geometry in intro shots (it rendered as floating bars)
   and strengthened the dark scene grade. Checked title, intro raid shot, and gameplay transition;
   `git diff --check` passes.
6. Follow-up on a persistent browser console error: the server serves the current `GROUND_GAPS`
   export (HTTP 200), but an old cached module was being reused. Added `?v=20261002-2` to the
   config imports and module entry URL. Confirmed the cache-busted URL renders the title screen.

## Last session (2026-10-02 — Upper Mustang level and underground finale)
1. Researched Upper Mustang/Lo Manthang references: arid high-altitude valleys, ochre wind-carved cliffs, mud-brick flat-roof homes, rooftop firewood, and walled settlements. Sources: Nepal Tourism Board Lo Manthang, Wikimedia Commons Lo Manthang photo, AP Samjung feature, and Nepali Times on Mustang rooftops.
2. Replaced arbitrary floating rectangular platforms with playable mud-house roofs and stone terrace paths; added a surface stair-mouth and descending rock-cut dungeon with small alcoves. Moved the boss, its floor physics, and its healing pickups underground. Fixed the cutscene camera height to match the dungeon view.
3. Added an abrupt BGM cut, short heartbeat/glassy shock sting, screen flash/pulse, and shake when Muna says she loves someone else. Replaced the paper text with a translated prophecy: “The mountain gods already know the one who will guard this village.”
4. Added cave strata, torch glows, wall niches, and layered dark grading. Unified mutable module import URLs at `?v=20261002-3` to avoid stale exports and duplicated module state; index.html now uses the same cache version.
5. `git diff --check` passed. No tests or browser run were performed in this session.

## Follow-up (2026-10-02 — dungeon route, yak hazard, character pass)
1. Researched Team Cherry's world-building framing and Jump King's risk/readability around deliberate jumps, plus Upper Mustang yak references. Links: ACMI Team Cherry interview, Jump King official page, and Wikimedia Commons yaks of Nepal.
2. Extended the world to 8,500 units so the village route to the dungeon is about as long as the subterranean route to Muna. The boss room begins at x=7,380, after a long cave approach. Added a boss arrival taunt with a visible Enter prompt; Enter starts combat, and the minister now has localized combat barks and phase dialogue.
3. Reduced terrace ledges from 13 to 6, village roof platforms from 13 to 7, stair platforms from 5 to 3, and removed the dungeon alcove ledges. The final chamber has no platforms. Added two cave-floor pits; player falls are lethal, and enemies can fall and be removed.
4. Added a moving yak hazard on the village path. Its warning state telegraphs a short charge, with a quiet snort cue. Improved Hari, the minister, regular enemies, Muna, and Raju with added silhouette, clothing, face, and movement detail in the same dark painterly canvas style.
5. Updated every local JS module and the entry URL to `?v=20261002-4`. `git diff --check` passed. No browser run or gameplay tests were performed.

## Follow-up (2026-10-02 — character design revision)
1. Used the supplied images as silhouette and clothing references while preserving the established dark, painterly canvas style.
2. Gave Hari a clearer, larger profile nose and three white forehead stripes. Redesigned Muna's face and high ponytail while keeping her dress; refined Raju's face and side-parted hair and added separated light trousers.
3. Simplified the minister into a dark suit, white shirt, restrained tie, and cream trousers. Removed the handheld blade, added unarmed attack gestures, and widened/separated his animated legs.
4. Unified module cache URLs at `?v=20261002-5`. `git diff --check` passed; no browser or gameplay verification was run.
## Follow-up (2026-10-02 — Hari hair and forehead marks)
1. Repositioned Hari's tied ponytail and knot to the back crown so they sit behind the skull in profile.
2. Cleared the front hairline and moved the three white forehead marks to the visible front plane, following the latest user reference.
3. Updated all local module URLs and index.html to `?v=20261002-6` for a fresh browser load. `git diff --check` passed; no browser verification was run.
## Follow-up (2026-10-02 — minister caricature and character separation)
1. Reworked the minister toward the new reference: broad caricature face, dark glasses, large moustache, raised-fist idle pose, and blue jacket over an open-collar red shirt. Removed the tie.
2. Increased the visual distinction between Muna and Raju: kept Muna's dress and added a longer back braid; gave Raju a Dhaka topi, different skin shading, and a moustache.
3. Bumped the shared local module URL to `?v=20261002-7`. `git diff --check` passed; no browser preview or gameplay tests were run.
## Follow-up (2026-10-02 — minister shirt and Hari cutscene face)
1. Replaced the minister's red shirt panel with a white open-collar shirt; the outfit has no tie.
2. Removed Hari's remaining scalp hair so only his back ponytail remains. Enlarged the eye and disabled blinking during cutscenes so it stays visible in the ending.
3. Bumped shared module URLs to `?v=20261002-8`. `git diff --check` passed; no browser preview was run.
## Follow-up (2026-10-02 — hide boss fight subtitles)
1. Suppressed subtitle rendering while the minister is active and combat has started. The pre-fight dialogue/Enter prompt and post-fight victory subtitle remain visible.
2. Updated all local module URLs to `?v=20261002-9`. `git diff --check` passed; no browser test was run.
## Follow-up (2026-10-02 — thinner obstacle course and recoverable falls)
1. Reduced terrace platforms from six to three, made only four of seven village houses solid/climbable while keeping all visible, and reduced dungeon pits from two to one. Kept the entry stairs and yak.
2. Pit and surface-gap falls now cost 2 HP (clamped so they cannot kill Hari directly) and respawn him just before the jump with brief hurt protection.
3. Unified local module URLs at `?v=20261002-10`. `git diff --check` passed; no browser or gameplay test was run.
## Follow-up (2026-10-02 — Xbox controller support)
1. Added browser Gamepad API polling with left-stick/D-pad movement and Xbox-standard buttons: A jump/confirm, X attack, B dodge, RB parry, Y iai, D-pad up free Muna, and Start advance dialogue/start the boss. Actions trigger once per press while movement stays held.
2. Added controller navigation/focus to language and difficulty menus and listed controller mappings in the startup controls card. B selects the second menu option; D-pad/left-stick horizontal chooses the option, then A confirms. Updated app module URLs to `?v=20261002-11`.
3. `git diff --check` passed. No connected-controller or browser gameplay verification was run.
## Follow-up (2026-10-02 — PlayStation-style controller scheme and controls selector)
1. Remapped standard gamepad buttons to PS labels on any controller brand: Cross jumps, Square confirms/interacts/frees Muna and advances dialogue, Circle dodges, Triangle uses iai, L1 blocks, and R1 attacks. Controller movement remains left stick/D-pad; Start also confirms and begins the boss fight.
2. Added a Keyboard/Controller selector and a persistent controls card on the title screen. The chosen display mode updates intro, dialogue, boss prompts, and the fading in-game tutorial; controller glyphs remain PS-style even for Xbox pads. Bumped local module URLs to `?v=20261002-12`.
3. `git diff --check` passed. No connected-controller or browser gameplay verification was run.
## Follow-up (2026-10-02 — controller remap and button prompt badges)
1. Final controller mapping: Cross = jump and contextual Action (menu confirm, dialogue advance, boss start, free Muna); Square = attack; Circle = dodge; Triangle = Ultimate; L1 = block. R1 has no gameplay binding. Keyboard Enter remains Action.
2. Replaced plain key text with matching PS-button circles or keyboard keycaps in the title/menu hints, intro and ending advance prompts, boss-start prompt, Muna interaction prompt, and Ultimate HUD indicator. Controls card and tutorial now label Cross as Jump / Action and Square as Attack; removed duplicate Action mappings and obsolete F prompts.
3. Bumped all local module references and index.html to `?v=20261002-17`. `git diff --check` passed; no browser or physical controller test was run.

## Follow-up (2026-10-02 — persistent controls and aerial slash)
1. Replaced the fading top-corner tutorial with a persistent, full-width controls strip at the bottom of gameplay. Kept story/menu prompts separate; moved gameplay subtitles above the strip and placed the Muna Action prompt just above it.
2. Added focus-loss/hidden-tab input cleanup so stuck keyboard or gamepad states release when the page loses focus. Bumped all local module references and index.html to `?v=20261002-18`.
3. Added AIR_DOWN: the regular attack input starts a downward aerial khukuri slash while airborne, with a dedicated pose, hitbox, and warm blade trail. The ground combo remains unchanged.
4. `git diff --check` passed. No browser or controller runtime test was run.

## Follow-up (2026-10-02 — below-screen controls and controller detection)
1. Moved the always-visible control strip out of the Canvas into the page layout below the game. It switches between keyboard and PS-style controller labels and reports whether a gamepad is detected, including its reported name.
2. Gamepad polling now chooses the connected pad that is actively receiving input instead of always taking the first connected device. It retains Cross = Jump / Action, Square = Attack, Circle = Dodge, L1 = Block, Triangle = Ultimate; focus-loss cleanup remains enabled.
3. Kept the midair attack as a downward khukuri slash. Unified local module URLs and index.html at `?v=20261002-19`. `git diff --check` passed and the local server returns index.html with HTTP 200; no physical controller test was possible.

## Follow-up (2026-10-02 — remove controller status text)
1. Removed the connected/not-detected message from the below-canvas control strip. The strip now contains only button/key badges and their action labels, with PS-style colored face buttons in controller mode and keycaps in keyboard mode.
2. Kept the page layout and active-gamepad polling. Bumped all local module references and index.html to `?v=20261002-20`. `git diff --check` passed; local index.html responds HTTP 200.

## Follow-up (2026-10-02 — intro-matched controls below game)
1. Rebuilt the below-game controls as the intro-style dark card with gold heading, key/button badges, and paired rows. The heading and labels update for keyboard/controller mode and English/Nepali.
2. Kept the footer action label simply Attack (or prahar); it does not mention the aerial/downward slash.
3. Kept the controls beneath the canvas and refreshed local module URLs to `?v=20261002-21`. `git diff --check` passed; no browser or gameplay test was run.

## Follow-up (2026-10-02 — match the intro controls panel)
1. Resized and restyled the footer card to match the intro panel: centered gold title, dark fill, gold border, two-column paired rows, and matching key/button badges.
2. Added a stylesheet cache-buster (`?v=20261002-22`) so the corrected layout replaces the stale footer styling shown in the screenshot.
3. `git diff --check` passed; no browser or gameplay test was run.

## Follow-up (2026-10-02 — sharper mountain silhouettes)
1. Replaced the soft, noisy ridge profiles with spaced angular peaks across the far, middle, and near parallax layers. Added restrained light/shadow facets and larger jagged snowcaps to make the distant range read more clearly as mountains while retaining the dark palette.
2. Refreshed local module and stylesheet URLs to `?v=20261002-23`. `git diff --check` passed; no gameplay test was run.

## Presentation (2026-10-03)
1. Edited `Khukuri_Presentation (1).pptx` into `outputs/Khukuri_Presentation_illustrated.pptx`, retaining the 14-slide deck and visual style.
2. Added six direct game captures across slides 2, 7, 9, and 11: romanized-Nepali opening, combat, village gameplay, story raid, title/controls, and playable scene. Existing cover key art remains.
3. Added image-placement suggestions on slide 4 and presenter notes on slides 2, 4–12 with concrete context for real-game, film, book, and interface images.
4. Validated as a 14-slide PPTX and rendered all slides for visual review. The demo screenshots use English gameplay/menu text except for the opening story captures, which show romanized Nepali.

## Follow-up (2026-10-10 — cover start and input selection)
1. Added the presentation cover artwork as `assets/khukuri-title.jpg` and use it on a distinct first start screen.
2. Added a separate Keyboard & Mouse / Controller selection screen before language and difficulty. Keyboard, mouse, and gamepad users can select their preferred mode; the below-game controls strip stays hidden until an explicit choice, then shows only that mode's mapping.
3. Shifted page and canvas chrome toward the cover's midnight blue, teal, and muted gold palette. No automated tests or browser preview were run.

## Follow-up (2026-10-10 — branching ending cutscene)
1. Added a two-option choice after Muna says goodbye: “Let them leave” or “Punch Raju.” The options do not use the profanity.
2. Let-them-leave branch retains Hari’s “...muji.” line and plays the couple walking away.
3. Punch branch puts “Ko hos ta? Ma bata Muna chorne? Feri?!” in Hari’s cutscene dialogue, animates the punch, gives Raju a response, then shows Muna angrily slapping Hari and running off with Raju. Added English subtitle translations and keyboard, mouse, and controller choice input.
4. Updated cache-busting URLs for changed modules. No browser preview or tests were run.

## Follow-up (2026-10-10 — timed ultimate, guard/parry, Casual tuning)
1. Ultimate starts with one of three charges and regenerates one charge every 480 gameplay frames (8 seconds). Parrying no longer grants ultimate charge; the HUD shows progress around the next charge pip.
2. Right-click / controller L1 now hold a directional guard. A fresh press also opens a short timed parry window; a correctly timed deflect keeps the existing counter and posture rewards, while a held guard blocks frontal attacks (including the yak, enemy/boss attacks, projectiles, and shockwaves).
3. Updated controls text to “Block / Parry.” Casual now has 13 HP, takes reduced damage, faces slower enemies, has a more forgiving parry window, and gets stronger healing orbs. Cache-busting URLs were unified at `20261010-4`.
4. No browser preview or tests were run.
