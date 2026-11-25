import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";

export async function uploadVoiceFile(
  url: string,
  method: "PUT" | "POST",
  uri: string,
  headers: Record<string, string>,
  signal: AbortSignal,
) {
  // Avec un File, expo/fetch écrase le MIME déclaré avec celui deviné par Android (« audio/mpeg » pour un .m4a).
  const body = await new File(uri).bytes();
  return expoFetch(url, {
    method,
    headers: { ...headers, "Content-Type": "audio/mp4" },
    signal,
    credentials: "omit",
    body,
  });
}
