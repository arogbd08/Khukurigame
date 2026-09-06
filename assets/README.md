# assets

The original single-file game had **no embedded images or base64 data** — every
character, prop and background is drawn procedurally with canvas paths (see
`src/render.js`), and every sound effect is synthesised at runtime with the Web
Audio API (see `src/audio.js`).

Contents:

- `background.mp3` — looping background music for the whole game. Started on the
  first keypress/click (browsers block autoplay before a user gesture) and played
  at low volume (`BGM_VOLUME` in `src/audio.js`) so it sits under the SFX.
  If the file is missing the game runs fine, just silent.
