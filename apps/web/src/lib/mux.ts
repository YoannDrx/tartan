import Mux from "@mux/mux-node";
import { env } from "./env";

export const videoEnabled = (): boolean => Boolean(env().MUX_TOKEN_ID && env().MUX_TOKEN_SECRET);

const client = (): Mux => {
  const e = env();
  return new Mux({
    tokenId: e.MUX_TOKEN_ID,
    tokenSecret: e.MUX_TOKEN_SECRET,
    webhookSecret: e.MUX_WEBHOOK_SECRET,
    jwtSigningKey: e.MUX_SIGNING_KEY_ID,
    jwtPrivateKey: e.MUX_SIGNING_PRIVATE_KEY,
  });
};

// Envoi direct : le téléphone parle à Mux sans passer par nos serveurs (§ 11.5).
export const createDirectUpload = async (passthrough: string): Promise<{ uploadId: string; url: string }> => {
  const upload = await client().video.uploads.create({
    cors_origin: env().NEXT_PUBLIC_APP_URL,
    timeout: 60 * 60 * 24,
    new_asset_settings: {
      passthrough,
      playback_policy: ["signed"],
      // MP4 pour l'analyse image par image : plafonné à 30 i/s par Mux, d'où l'étirement avant l'envoi (video-stretch).
      static_renditions: [{ resolution: "highest" }],
    },
  });
  if (!upload.url) throw new Error("mux_upload_url_missing");
  return { uploadId: upload.id, url: upload.url };
};

export const unwrapWebhook = (rawBody: string, headers: Headers) => client().webhooks.unwrap(rawBody, headers);

export type MuxUploadState =
  | { state: "missing" | "waiting" | "failed" | "expired" }
  | {
      state: "asset";
      asset: {
        id: string;
        status: string;
        duration?: number;
        playback_ids?: { id: string }[];
        tracks?: { type?: string; max_frame_rate?: number }[];
      };
    };

// Rattrapage : l'état réel d'un envoi direct, quand le webhook ne l'a pas transmis.
export const readUpload = async (uploadId: string): Promise<MuxUploadState> => {
  const mux = client();
  let upload;
  try {
    upload = await mux.video.uploads.retrieve(uploadId);
  } catch (error) {
    if (error instanceof Mux.NotFoundError) return { state: "missing" };
    throw error;
  }
  if (upload.asset_id) return { state: "asset", asset: await mux.video.assets.retrieve(upload.asset_id) };
  if (upload.status === "errored" || upload.status === "cancelled") return { state: "failed" };
  if (upload.status === "timed_out") return { state: "expired" };
  return { state: "waiting" };
};

export const deleteAsset = async (assetId: string): Promise<void> => {
  await client().video.assets.delete(assetId);
};

export const cancelUpload = async (uploadId: string): Promise<void> => {
  await client().video.uploads.cancel(uploadId);
};

// Parcourt tout le compte Mux, page après page, pour le rapprochement quotidien.
export async function* listAssets(): AsyncGenerator<{ id: string; passthrough: string | null; createdAt: Date }> {
  for await (const asset of client().video.assets.list({ limit: 100 })) {
    yield {
      id: asset.id,
      passthrough: asset.passthrough ?? null,
      createdAt: new Date(Number(asset.created_at) * 1000),
    };
  }
}

// Jetons signés à durée limitée, aucune URL publique (§ 11.4).
export const signedPlayback = async (
  playbackId: string,
): Promise<{ hlsUrl: string; mp4Url: string; thumbnailUrl: string }> => {
  const e = env();
  if (!e.MUX_SIGNING_KEY_ID || !e.MUX_SIGNING_PRIVATE_KEY) {
    throw new Error("mux_signing_key_missing");
  }
  const mux = client();
  const [video, thumbnail] = await Promise.all([
    mux.jwt.signPlaybackId(playbackId, { type: "video", expiration: "1h" }),
    mux.jwt.signPlaybackId(playbackId, { type: "thumbnail", expiration: "1h" }),
  ]);
  return {
    hlsUrl: `https://stream.mux.com/${playbackId}.m3u8?token=${video}`,
    mp4Url: `https://stream.mux.com/${playbackId}/highest.mp4?token=${video}`,
    thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${thumbnail}`,
  };
};
