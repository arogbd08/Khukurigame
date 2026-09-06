# context.md

Read this at session start. Update it as the LAST step of every session, without being asked.
Keep it scannable — facts, not prose. This file exists to avoid re-explaining the project.

---

## What this is
`Khukuri` — 2D side-scrolling action-platformer, browser, vanilla JS + Canvas 2D.
Nepali setting/story. Hari fights across a 5200px level to rescue Muna; the ending is a joke
rejection cutscene. **All in-fiction text is romanized Nepali only** — no English, no Devanagari.
No voiceover: story is told through on-screen subtitles.

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
- **Romanized Nepali only.** No Devanagari, no English story text, no voiceover.
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

## TODO / not done
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
- **`say(text, frames, color)` — 3 args, single language.** Was `say(ne, en, frames, color)`;
  the English line was removed and all 24 callsites refactored. `sub` is `{text,t,color}`.
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
- **English story text was removed on request.** User chose "story text only" scope: functional
  UI in English STAYS (HUD labels `khukuri:`/`ult:`/`Phase N`, `Press F — Munalai fukau`, the
  keyboard hints in index.html, credit names, `Thank you for playing`).
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
- Cutscene camera is fixed at `cam = WORLD-W` (4380), so only x 4380–5200 is visible.
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
