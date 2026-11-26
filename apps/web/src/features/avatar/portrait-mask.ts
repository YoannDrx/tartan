export async function cutOutPortrait(original: ImageBitmap): Promise<ImageBitmap> {
  const scale = Math.min(1, 1200 / Math.max(original.width, original.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(original.width * scale));
  canvas.height = Math.max(1, Math.round(original.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("portrait_canvas");
  ctx.drawImage(original, 0, 0, canvas.width, canvas.height);
  const source = await createImageBitmap(canvas);
  const worker = new Worker("/portrait/runtime/worker.js");
  try {
    const mask = await new Promise<{ width: number; height: number; alpha: Uint8ClampedArray }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("portrait_timeout")), 30000);
      worker.onerror = () => {
        clearTimeout(timer);
        reject(new Error("portrait_worker"));
      };
      worker.onmessage = (event) => {
        clearTimeout(timer);
        if (event.data) resolve(event.data);
        else reject(new Error("portrait_mask"));
      };
      worker.postMessage(source, [source]);
    });
    const matte = document.createElement("canvas");
    matte.width = mask.width;
    matte.height = mask.height;
    const brush = matte.getContext("2d");
    if (!brush) throw new Error("portrait_canvas");
    const image = brush.createImageData(mask.width, mask.height);
    for (let i = 0; i < mask.alpha.length; i++) image.data[4 * i + 3] = mask.alpha[i]!;
    brush.putImageData(image, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(matte, 0, 0, canvas.width, canvas.height);
    return await createImageBitmap(canvas);
  } finally {
    worker.terminate();
    source.close();
  }
}
