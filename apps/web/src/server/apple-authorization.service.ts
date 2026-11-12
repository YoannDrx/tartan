import { appleAuthorizationInput } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { exchangeAppleCode } from "@/lib/apple";
import { env } from "@/lib/env";
import { AppError, forbidden, invalid } from "@/lib/errors";
import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

// Le compte, pas un espace : aucune donnée d'espace n'est lue. Le jeton de rafraîchissement d'Apple est gardé sur la
// liaison Apple du compte connecté, et sert seulement à révoquer l'accès à la suppression du compte.
export const storeAppleAuthorization = async (userId: string, raw: unknown) => {
  const parsed = appleAuthorizationInput.safeParse(raw);
  if (!parsed.success) throw invalid();
  const e = env();
  if (!e.APPLE_APP_BUNDLE_IDENTIFIER || !e.APPLE_PRIVATE_KEY)
    throw new AppError(404, "apple_disabled", m.errors.notFound);
  const account = await prisma.account.findFirst({ where: { userId, providerId: "apple" } });
  if (!account) throw new AppError(409, "apple_not_linked", m.errors.appleNotLinked);
  let exchanged: Awaited<ReturnType<typeof exchangeAppleCode>>;
  try {
    exchanged = await exchangeAppleCode(parsed.data.code);
  } catch {
    log.warn("apple_code_exchange_failed");
    throw new AppError(502, "apple_unavailable", m.errors.appleUnavailable);
  }
  // Le code doit venir du même compte Apple que celui relié : sinon, on ne garde rien.
  if (!exchanged || exchanged.subject !== account.accountId) throw forbidden();
  await prisma.account.update({
    where: { id: account.id },
    data: { refreshToken: exchanged.refreshToken, appleClientId: e.APPLE_APP_BUNDLE_IDENTIFIER },
  });
  return { stored: true as const };
};
