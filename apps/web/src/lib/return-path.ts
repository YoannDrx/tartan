const LOCAL_ORIGIN = "https://tartan.invalid";

// Le navigateur normalise notamment /\ en // : tester le préfixe seul ne suffit pas.
export const safeReturnPath = (value: string | undefined, fallback = "/accueil"): string => {
  if (!value?.startsWith("/") || [...value].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) {
    return fallback;
  }
  try {
    const url = new URL(value, LOCAL_ORIGIN);
    return url.origin === LOCAL_ORIGIN && !url.pathname.startsWith("//")
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
};
