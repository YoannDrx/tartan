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

export const deleteAsset = async (assetId: string): Promise<void> => {
  await client().video.assets.delete(assetId);
};

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
    mux.jwt.signPlaybackId(playbackId, { type: "video", expiration: "6h" }),
    mux.jwt.signPlaybackId(playbackId, { type: "thumbnail", expiration: "6h" }),
  ]);
  return {
    hlsUrl: `https://stream.mux.com/${playbackId}.m3u8?token=${video}`,
    mp4Url: `https://stream.mux.com/${playbackId}/highest.mp4?token=${video}`,
    thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${thumbnail}`,
  };
};
