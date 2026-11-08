import { useEffect, useState } from "react";

type Cue = "tap" | "success" | "error" | "round" | "win" | "tick";
let audio: AudioContext | undefined;
let enabled = true;
export function unlockSound() {
  if (!enabled || typeof window === "undefined") return;
  try { audio ??= new AudioContext(); void audio.resume().catch(() => {}); } catch { /* audio unavailable */ }
}
export function playSound(cue: Cue) {
  if (!enabled || !audio || audio.state !== "running") return;
  const notes: Record<Cue, number[]> = { tap: [420], success: [523, 659, 784], error: [200, 140], round: [392, 523], win: [523, 659, 784, 1047], tick: [880] };
  notes[cue].forEach((frequency, i) => {
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const at = audio.currentTime + i * 0.11;
    oscillator.type = "sine"; oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.09, at + 0.01); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(at); oscillator.stop(at + 0.17);
  });
}
export function useSoundPreference() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    enabled = localStorage.getItem("fp-sound") !== "off"; setOn(enabled);
    const unlock = () => unlockSound();
    window.addEventListener("pointerdown", unlock); window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);
  return { on, toggle: () => { enabled = !enabled; setOn(enabled); localStorage.setItem("fp-sound", enabled ? "on" : "off"); if (enabled) { unlockSound(); playSound("tap"); } } };
}