// Mux sert le MP4 d'analyse à 30 i/s au plus, quelle que soit la source : un 240 i/s y perd 7 images sur 8.
// On étire donc la durée de chaque image dans l'en-tête du fichier avant l'envoi, sans réencoder : un 240 i/s devient
// un 30 i/s huit fois plus long, Mux garde toutes les images, et le lecteur retrouve le temps réel avec `timeScale`.
export const MAX_DELIVERED_FPS = 30;

export const timeScaleFor = (fps: number | null | undefined): number =>
  fps && fps > 0 ? Math.max(1, Math.ceil(fps / MAX_DELIVERED_FPS - 0.05)) : 1;

// Conversions entre le temps réel du saut (partout dans l'app) et le temps du fichier étiré (le lecteur vidéo).
export const toFileSeconds = (realMs: number, timeScale: number): number => (realMs * timeScale) / 1000;
export const toRealMs = (fileSeconds: number, timeScale: number): number => (fileSeconds * 1000) / timeScale;

// Fréquence réellement lisible image par image, une fois la vidéo encodée par Mux.
export const deliveredFps = (input: { declaredFps: number | null; encodedFps: number | null; timeScale: number }) => {
  if (input.timeScale > 1) return input.declaredFps;
  const fps = input.encodedFps ?? input.declaredFps;
  return fps === null ? null : Math.min(Math.round(fps), MAX_DELIVERED_FPS);
};

export type ReadBytes = (offset: number, length: number) => Promise<Uint8Array>;

export type StretchPlan = {
  fps: number;
  timeScale: number;
  // En-tête à réécrire au même endroit, de même taille. Absent si le fichier part tel quel.
  patch: { offset: number; bytes: Uint8Array } | null;
};

type Box = { type: string; start: number; end: number };

const MAX_MOOV_BYTES = 64 * 1024 * 1024;
const TWO_32 = 2 ** 32;

const typeAt = (view: DataView, offset: number): string =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );

const childrenOf = (view: DataView, start: number, end: number): Box[] => {
  const boxes: Box[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = view.getUint32(pos);
    let header = 8;
    if (size === 1) {
      size = view.getUint32(pos + 8) * TWO_32 + view.getUint32(pos + 12);
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header || pos + size > end) throw new Error("mp4_box_invalid");
    boxes.push({ type: typeAt(view, pos + 4), start: pos + header, end: pos + size });
    pos += size;
  }
  return boxes;
};

const childOf = (view: DataView, box: Box, type: string): Box | undefined =>
  childrenOf(view, box.start, box.end).find((b) => b.type === type);

const scaleU32 = (view: DataView, offset: number, factor: number): void => {
  const value = view.getUint32(offset) * factor;
  if (value >= TWO_32) throw new Error("mp4_duration_overflow");
  view.setUint32(offset, value);
};

const scaleI32 = (view: DataView, offset: number, factor: number): void => {
  const value = view.getInt32(offset) * factor;
  if (Math.abs(value) >= 2 ** 31) throw new Error("mp4_duration_overflow");
  view.setInt32(offset, value);
};

// Sans BigInt : Hermes, sur mobile, ne couvre pas toute l'API DataView en 64 bits.
const scaleU64 = (view: DataView, offset: number, factor: number): void => {
  const value = (view.getUint32(offset) * TWO_32 + view.getUint32(offset + 4)) * factor;
  if (!Number.isSafeInteger(value)) throw new Error("mp4_duration_overflow");
  view.setUint32(offset, Math.floor(value / TWO_32));
  view.setUint32(offset + 4, value % TWO_32);
};

const isVersion1 = (view: DataView, box: Box): boolean => view.getUint8(box.start) === 1;

const scaleEditList = (view: DataView, elst: Box, factor: number): void => {
  const wide = isVersion1(view, elst);
  const count = view.getUint32(elst.start + 4);
  let pos = elst.start + 8;
  for (let i = 0; i < count; i += 1) {
    if (wide) {
      scaleU64(view, pos, factor);
      // Temps média à -1 : segment vide, il reste à -1.
      if (view.getUint32(pos + 8) !== 0xffffffff) scaleU64(view, pos + 8, factor);
      pos += 20;
    } else {
      scaleU32(view, pos, factor);
      if (view.getInt32(pos + 4) !== -1) scaleU32(view, pos + 4, factor);
      pos += 12;
    }
  }
};

const scaleSampleTable = (view: DataView, stbl: Box, factor: number): void => {
  for (const box of childrenOf(view, stbl.start, stbl.end)) {
    if (box.type === "stts") {
      const count = view.getUint32(box.start + 4);
      for (let i = 0; i < count; i += 1) scaleU32(view, box.start + 8 + i * 8 + 4, factor);
    } else if (box.type === "ctts") {
      const signed = isVersion1(view, box);
      const count = view.getUint32(box.start + 4);
      for (let i = 0; i < count; i += 1) {
        const offset = box.start + 8 + i * 8 + 4;
        if (signed) scaleI32(view, offset, factor);
        else scaleU32(view, offset, factor);
      }
    } else if (box.type === "cslg") {
      for (let i = 0; i < 5; i += 1) scaleI32(view, box.start + 4 + i * 4, factor);
    }
  }
};

const scaleTrack = (view: DataView, trak: Box, factor: number): void => {
  const tkhd = childOf(view, trak, "tkhd");
  if (tkhd) {
    if (isVersion1(view, tkhd)) scaleU64(view, tkhd.start + 28, factor);
    else scaleU32(view, tkhd.start + 20, factor);
  }
  const edts = childOf(view, trak, "edts");
  const elst = edts && childOf(view, edts, "elst");
  if (elst) scaleEditList(view, elst, factor);
  const mdia = childOf(view, trak, "mdia");
  if (!mdia) return;
  const mdhd = childOf(view, mdia, "mdhd");
  if (mdhd) {
    if (isVersion1(view, mdhd)) scaleU64(view, mdhd.start + 24, factor);
    else scaleU32(view, mdhd.start + 16, factor);
  }
  const minf = childOf(view, mdia, "minf");
  const stbl = minf && childOf(view, minf, "stbl");
  if (stbl) scaleSampleTable(view, stbl, factor);
};

const videoFpsOf = (view: DataView, traks: Box[]): number | null => {
  for (const trak of traks) {
    const mdia = childOf(view, trak, "mdia");
    const hdlr = mdia && childOf(view, mdia, "hdlr");
    if (!mdia || !hdlr || typeAt(view, hdlr.start + 8) !== "vide") continue;
    const mdhd = childOf(view, mdia, "mdhd");
    const minf = childOf(view, mdia, "minf");
    const stbl = minf && childOf(view, minf, "stbl");
    const stts = stbl && childOf(view, stbl, "stts");
    if (!mdhd || !stts) return null;
    const timescale = view.getUint32(mdhd.start + (isVersion1(view, mdhd) ? 20 : 12));
    const count = view.getUint32(stts.start + 4);
    let frames = 0;
    let ticks = 0;
    for (let i = 0; i < count; i += 1) {
      const samples = view.getUint32(stts.start + 8 + i * 8);
      frames += samples;
      ticks += samples * view.getUint32(stts.start + 8 + i * 8 + 4);
    }
    return frames > 1 && ticks > 0 ? (frames * timescale) / ticks : null;
  }
  return null;
};

// Réécrit l'en-tête `moov` (contenu complet, en-tête de boîte compris) : toutes les pistes, pour rester synchronisées.
export const stretchMoov = (moov: Uint8Array, factor: number): void => {
  const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
  const header = view.getUint32(0) === 1 ? 16 : 8;
  const boxes = childrenOf(view, header, moov.byteLength);
  const mvhd = boxes.find((b) => b.type === "mvhd");
  if (mvhd) {
    if (isVersion1(view, mvhd)) scaleU64(view, mvhd.start + 24, factor);
    else scaleU32(view, mvhd.start + 16, factor);
  }
  for (const box of boxes) if (box.type === "trak") scaleTrack(view, box, factor);
};

const findMoov = async (read: ReadBytes, fileSize: number): Promise<{ offset: number; size: number } | null> => {
  let pos = 0;
  while (pos + 8 <= fileSize) {
    const head = await read(pos, 16);
    const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let size = view.getUint32(0);
    if (size === 1) size = view.getUint32(8) * TWO_32 + view.getUint32(12);
    else if (size === 0) size = fileSize - pos;
    if (size < 8) return null;
    if (typeAt(view, 4) === "moov") return { offset: pos, size };
    pos += size;
  }
  return null;
};

// Null si le fichier n'est pas lisible ainsi (autre format, MP4 fragmenté) : il part tel quel, à 30 i/s au plus.
export const planStretch = async (read: ReadBytes, fileSize: number): Promise<StretchPlan | null> => {
  try {
    const found = await findMoov(read, fileSize);
    if (!found || found.size > MAX_MOOV_BYTES) return null;
    const moov = new Uint8Array(await read(found.offset, found.size));
    const view = new DataView(moov.buffer, moov.byteOffset, moov.byteLength);
    const boxes = childrenOf(view, view.getUint32(0) === 1 ? 16 : 8, moov.byteLength);
    if (boxes.some((b) => b.type === "mvex")) return null;
    const fps = videoFpsOf(
      view,
      boxes.filter((b) => b.type === "trak"),
    );
    if (fps === null) return null;
    const timeScale = timeScaleFor(fps);
    if (timeScale === 1) return { fps: Math.round(fps), timeScale, patch: null };
    stretchMoov(moov, timeScale);
    return { fps: Math.round(fps), timeScale, patch: { offset: found.offset, bytes: moov } };
  } catch {
    return null;
  }
};
