// Dialogue timing helpers shared by the script (re-flow) and the speech engine.
export const WORDS = (t) => t.replace(/\[.*?\]/g, ' ').split(/\s+/).filter(Boolean).length;
export const PAUSES = (t) => (t.match(/[,;:—….!?]/g) || []).length;
// Estimated spoken duration at speech rate 1 for a typical synthetic voice.
export const estDur = (text, wps = 2.6) => WORDS(text) / wps + PAUSES(text) * 0.16 + 0.25;
