# SEVEN HOURS — The Seven vs. The Combine

A 10-minute 3D animated fan short film (The Boys × Half-Life 2's *Seven Hours War*), rendered live in your browser.

**Watch it:** open `index.html` (double-click). Press **PLAY**. No install, no network, no downloads — it is one self-contained file.

* Space — pause · ←/→ — seek 10 s · F — fullscreen · M — mute · C — captions · V — voices on/off · hover for the control bar
* Performance menu on the start screen: *Battery saver* (30 fps, 0.7× render scale), *Balanced* (30 fps — default), *High* (60 fps).
  The film is capped at 30 fps by default, renders only the letter-boxed 2.39:1 picture area, auto-lowers resolution if frames run long, and pauses completely when the tab is hidden — built to stay inside a small charger's power budget on a laptop with no battery.
* "Spoken dialogue" uses your browser's built-in text-to-speech voices (on by default when available). Each line is spoken once, strictly one at a time, and the film waits for the speech engine's own "finished" event before moving on, so nothing is cut off or talked over. Dialogue is always subtitled.

## Rebuilding
```
npm install
node build.mjs          # bundles src/ + three.js into index.html
node tools/shot.mjs 120 260   # headless screenshots at given seconds (needs a local Chromium)
```
Everything (models, textures, music, sound effects) is generated procedurally in code — no assets.

Fan work. *The Boys* © Amazon / Sony / Kripke / Ennis & Robertson. *Half-Life* © Valve. Not affiliated; dialogue is original.
