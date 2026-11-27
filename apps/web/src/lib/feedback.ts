"use client";

import { feedback, renderFeedback, type FeedbackCue } from "@tartan/design-tokens";

// Retours sensoriels du web : un son court synthétisé (Web Audio) et, sur téléphone, une vibration.
// Activés par défaut, coupables par appareil (Réglages, Apparence). Jamais pendant une vidéo ou un enregistrement.

const KEY = "tartan.sounds";
let context: AudioContext | null = null;
const buffers = new Map<FeedbackCue, AudioBuffer>();
let mediaHolds = 0;

export const soundsEnabled = (): boolean => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
};

export const setSoundsEnabled = (on: boolean): void => {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Stockage indisponible : le réglage vaut pour la page ouverte.
  }
};

// Un enregistrement ou une lecture en cours tient les sons à distance ; la fonction rendue les libère.
export const holdFeedback = (): (() => void) => {
  mediaHolds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    mediaHolds = Math.max(0, mediaHolds - 1);
  };
};

const mediaPlaying = (): boolean =>
  mediaHolds > 0 ||
  Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio")).some((media) => !media.paused);

// Le navigateur n'autorise le son qu'après un geste : le premier toucher ouvre le contexte audio.
export const unlockFeedback = (): void => {
  if (context || typeof window === "undefined") return;
  try {
    context = new AudioContext();
  } catch {
    context = null;
  }
};

const bufferFor = (audio: AudioContext, cue: FeedbackCue): AudioBuffer => {
  const known = buffers.get(cue);
  if (known) return known;
  const samples = renderFeedback(cue, audio.sampleRate);
  const buffer = audio.createBuffer(1, samples.length, audio.sampleRate);
  buffer.copyToChannel(samples, 0);
  buffers.set(cue, buffer);
  return buffer;
};

export const playFeedback = (cue: FeedbackCue): void => {
  if (typeof window === "undefined" || document.visibilityState !== "visible" || mediaPlaying()) return;
  const pattern = feedback[cue].vibrate;
  if (pattern.length && window.matchMedia?.("(pointer: coarse)").matches) navigator.vibrate?.([...pattern]);
  if (!soundsEnabled()) return;
  unlockFeedback();
  const audio = context;
  if (!audio) return;
  try {
    if (audio.state === "suspended") void audio.resume();
    const source = audio.createBufferSource();
    source.buffer = bufferFor(audio, cue);
    source.connect(audio.destination);
    source.start();
  } catch {
    // Son indisponible : le geste a déjà eu lieu, rien ne bloque.
  }
};

const isCue = (value: string | undefined): value is FeedbackCue => Boolean(value && value in feedback);

// Écoute unique, posée par `FeedbackListener` : tout élément marqué `data-feedback` joue son retour au clic ;
// une case ou un interrupteur (`input` coché) joue « toggle », sauf `data-feedback="off"`.
export const installFeedback = (): (() => void) => {
  const onPointer = () => unlockFeedback();
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-feedback]") : null;
    if (!target || target.matches(":disabled, [aria-disabled='true']")) return;
    const cue = target.dataset.feedback;
    if (isCue(cue)) playFeedback(cue);
  };
  const onChange = (event: Event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !["checkbox", "radio"].includes(input.type)) return;
    if (input.closest("[data-feedback]")) return;
    playFeedback(input.type === "radio" ? "select" : "toggle");
  };
  document.addEventListener("pointerdown", onPointer, { capture: true, passive: true });
  document.addEventListener("click", onClick, { capture: true });
  document.addEventListener("change", onChange, { capture: true });
  return () => {
    document.removeEventListener("pointerdown", onPointer, { capture: true });
    document.removeEventListener("click", onClick, { capture: true });
    document.removeEventListener("change", onChange, { capture: true });
  };
};
