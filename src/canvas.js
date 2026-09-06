import {W, H} from './config.js';

/* Offscreen buffer that all procedural rendering draws into.
   Phaser displays this canvas as a live texture (see main.js) — it is no longer
   attached to the DOM itself. Keeping it as a standalone 2D canvas means every
   draw function in render.js / the scenes works exactly as before the Phaser port. */
export const cv = document.createElement('canvas');
cv.width = W;
cv.height = H;
export const ctx = cv.getContext('2d');
