// La géométrie du recadrage, sans DOM : l'écran, l'aperçu et l'export la partagent, et les tests la vérifient.
// Le cadre est un carré de `frame` pixels. L'image, tournée de `turns` quarts de tour, est centrée puis décalée de
// `x`, `y` (en pixels du cadre) et agrandie de `zoom` (1 = la taille de départ).

export type CropFit = "cover" | "contain";
export type CropState = { zoom: number; turns: number; x: number; y: number };
export type ImageSize = { width: number; height: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const START: CropState = { zoom: 1, turns: 0, x: 0, y: 0 };

const clampTo = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Les dimensions de l'image une fois tournée.
export const turnedSize = (image: ImageSize, turns: number): ImageSize =>
  turns % 2 === 0 ? image : { width: image.height, height: image.width };

// L'échelle de départ : la photo couvre tout le cadre ; un logo y tient tout entier.
export const baseScale = (image: ImageSize, turns: number, frame: number, fit: CropFit) => {
  const { width, height } = turnedSize(image, turns);
  return fit === "cover" ? frame / Math.min(width, height) : frame / Math.max(width, height);
};

export const scaleOf = (image: ImageSize, state: CropState, frame: number, fit: CropFit) =>
  baseScale(image, state.turns, frame, fit) * state.zoom;

// Le décalage permis : une photo ne laisse jamais de vide dans le cadre ; un logo plus petit que le cadre y reste.
export const clampCrop = (image: ImageSize, state: CropState, frame: number, fit: CropFit): CropState => {
  const zoom = clampTo(state.zoom, MIN_ZOOM, MAX_ZOOM);
  const turns = ((state.turns % 4) + 4) % 4;
  const scale = baseScale(image, turns, frame, fit) * zoom;
  const { width, height } = turnedSize(image, turns);
  const maxX = Math.abs(width * scale - frame) / 2;
  const maxY = Math.abs(height * scale - frame) / 2;
  // `+ 0` : un zéro négatif reste un zéro.
  return { zoom, turns, x: clampTo(state.x, -maxX, maxX) + 0, y: clampTo(state.y, -maxY, maxY) + 0 };
};

export const moveBy = (image: ImageSize, state: CropState, dx: number, dy: number, frame: number, fit: CropFit) =>
  clampCrop(image, { ...state, x: state.x + dx, y: state.y + dy }, frame, fit);

// Zoomer garde le centre du cadre sur le même point de l'image.
export const zoomTo = (image: ImageSize, state: CropState, zoom: number, frame: number, fit: CropFit) => {
  const next = clampTo(zoom, MIN_ZOOM, MAX_ZOOM);
  const ratio = next / state.zoom;
  return clampCrop(image, { ...state, zoom: next, x: state.x * ratio, y: state.y * ratio }, frame, fit);
};

// Un quart de tour garde, lui aussi, le même point de l'image au centre du cadre.
export const rotate = (image: ImageSize, state: CropState, direction: 1 | -1, frame: number, fit: CropFit) => {
  const before = baseScale(image, state.turns, frame, fit);
  const after = baseScale(image, state.turns + direction, frame, fit);
  const ratio = after / before;
  const [x, y] = direction === 1 ? [-state.y, state.x] : [state.y, -state.x];
  return clampCrop(image, { ...state, turns: state.turns + direction, x: x * ratio, y: y * ratio }, frame, fit);
};

// Toucher un point du cadre l'amène au centre : l'alternative au glisser, d'un seul appui.
export const centerOn = (
  image: ImageSize,
  state: CropState,
  point: { x: number; y: number },
  frame: number,
  fit: CropFit,
) => moveBy(image, state, frame / 2 - point.x, frame / 2 - point.y, frame, fit);

// La transformation à appliquer à un canevas de `size` pixels pour y dessiner le cadre : translation au centre,
// rotation, échelle. L'image est ensuite dessinée centrée sur l'origine.
export const drawTransform = (image: ImageSize, state: CropState, frame: number, size: number, fit: CropFit) => {
  const k = size / frame;
  return {
    translateX: size / 2 + state.x * k,
    translateY: size / 2 + state.y * k,
    rotation: (state.turns * Math.PI) / 2,
    scale: scaleOf(image, state, frame, fit) * k,
  };
};
