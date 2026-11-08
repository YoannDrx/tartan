import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { PLANNER_MAX_AUDIO_BYTES } from "@tartan/domain";
import { readPlannerUpload } from "@/server/ai/upload";
const metadata = { id: randomUUID(), requestedAt: new Date().toISOString(), audioProcessingAccepted: true };
const form = () => {
  const f = new FormData();
  f.set("metadata", JSON.stringify(metadata));
  f.set("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/wav" }), "dictee.wav");
  return f;
};
const request = (body: FormData) => new Request("https://test.invalid", { method: "POST", body });
it("lit le multipart borné sans accepter une durée fournie par le client", async () => {
  const read = await readPlannerUpload(request(form()));
  expect(read.metadata).toEqual(metadata);
  expect(read.bytes).toEqual(new Uint8Array([1, 2, 3]));
  const forged = form();
  forged.set("metadata", JSON.stringify({ ...metadata, audioSeconds: 1 }));
  await expect(readPlannerUpload(request(forged))).rejects.toMatchObject({ status: 400 });
});
it("coupe le flux trop gros même si Content-Length prétend qu'il est petit", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(PLANNER_MAX_AUDIO_BYTES + 4097));
    },
    cancel,
  });
  const req = new Request("https://test.invalid", {
    method: "POST",
    body: stream,
    headers: { "content-type": "multipart/form-data; boundary=x", "content-length": "1" },
    duplex: "half",
  } as RequestInit);
  await expect(readPlannerUpload(req)).rejects.toMatchObject({ status: 400 });
  expect(cancel).toHaveBeenCalledTimes(1);
});
it("refuse consentement absent, champs supplémentaires, doublons et fichier vide", async () => {
  const variants = [form(), form(), form(), form()];
  variants[0]!.set("metadata", JSON.stringify({ ...metadata, audioProcessingAccepted: false }));
  variants[1]!.set("duration", "1");
  variants[2]!.append("audio", new Blob(["duplicate"]), "second.wav");
  variants[3]!.set("audio", new Blob([]), "empty.wav");
  for (const variant of variants)
    await expect(readPlannerUpload(request(variant))).rejects.toMatchObject({ status: 400 });
});
