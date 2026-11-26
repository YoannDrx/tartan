import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

// Le masque de confiance du modèle Selfie Segmenter indique quels pixels appartiennent à la personne.
self.onmessage = async (event: MessageEvent<ImageBitmap>) => {
  const source = event.data;
  let segmenter: ImageSegmenter | undefined;
  try {
    const files = await FilesetResolver.forVisionTasks("/portrait/runtime");
    segmenter = await ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetPath: "/portrait/selfie-segmenter-v1.tflite" },
      canvas: new OffscreenCanvas(1, 1),
      outputConfidenceMasks: true,
      outputCategoryMask: false,
      runningMode: "IMAGE",
    });
    segmenter.segment(source, (result) => {
      const mask = result.confidenceMasks?.at(-1);
      if (!mask) throw new Error("portrait_mask");
      const alpha = Uint8ClampedArray.from(mask.getAsFloat32Array(), (v) => v * 255);
      self.postMessage({ width: mask.width, height: mask.height, alpha });
    });
  } catch {
    self.postMessage(null);
  } finally {
    segmenter?.close();
    source.close();
  }
};
