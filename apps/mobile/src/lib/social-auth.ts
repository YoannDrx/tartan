import { m } from "@tartan/i18n";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { api } from "./api";
import { authClient } from "./auth-client";
import { config } from "./config";

export type SocialResult = "signed-in" | "cancelled" | "failed";

const CALLBACK = "/callback";

const isCancelled = (error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code;
  return code === "ERR_REQUEST_CANCELED" || code === "SIGN_IN_CANCELLED" || code === "-5";
};

// Connexion Apple native sur iOS ; sur Android, page web pour les comptes créés sur iPhone (§ 10.5).
export const signInWithApple = async (): Promise<SocialResult> => {
  if (Platform.OS !== "ios") {
    const web = await authClient.signIn.social({ provider: "apple", callbackURL: CALLBACK }).catch(() => null);
    return web && !web.error ? "signed-in" : "failed";
  }
  try {
    const nonce = Crypto.randomUUID();
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
    if (!credential.identityToken) return "failed";
    const result = await authClient.signIn.social({
      provider: "apple",
      idToken: {
        token: credential.identityToken,
        nonce,
        // Apple ne transmet le nom qu'à la toute première connexion.
        ...(credential.fullName?.givenName
          ? {
              user: {
                name: {
                  firstName: credential.fullName.givenName,
                  lastName: credential.fullName.familyName ?? "",
                },
                email: credential.email ?? undefined,
              },
            }
          : {}),
      },
    });
    if (result.error) return "failed";
    // Le code d'autorisation permet au serveur de révoquer l'accès Apple si le compte est supprimé. Une panne ne bloque
    // pas la connexion : le code est renvoyé à la connexion Apple suivante.
    if (credential.authorizationCode)
      await api.storeAppleAuthorization(credential.authorizationCode).catch(() => undefined);
    return "signed-in";
  } catch (error) {
    return isCancelled(error) ? "cancelled" : "failed";
  }
};

// Connexion Google native sur Android ; sur iOS, session web sécurisée.
export const signInWithGoogle = async (): Promise<SocialResult> => {
  if (Platform.OS !== "android") {
    const web = await authClient.signIn.social({ provider: "google", callbackURL: CALLBACK }).catch(() => null);
    return web && !web.error ? "signed-in" : "failed";
  }
  try {
    // Chargé à la demande : le module natif n'existe que dans les builds Android.
    const { GoogleSignin, isSuccessResponse } = await import("@react-native-google-signin/google-signin");
    GoogleSignin.configure({ webClientId: config.googleWebClientId });
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return "cancelled";
    const token = response.data.idToken;
    if (!token) return "failed";
    const result = await authClient.signIn.social({ provider: "google", idToken: { token } });
    return result.error ? "failed" : "signed-in";
  } catch (error) {
    return isCancelled(error) ? "cancelled" : "failed";
  }
};

export const appleAvailable = config.appleSignIn;
export const googleAvailable = config.googleSignIn && (Platform.OS !== "android" || Boolean(config.googleWebClientId));
export const socialErrorMessage = m.mobile.auth.socialFailed;
