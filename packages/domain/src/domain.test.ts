import { describe, expect, it } from "vitest";
import {
  personalBestIds,
  deliveredFps,
  planStretch,
  timeScaleFor,
  toFileSeconds,
  toRealMs,
  addPrescriptionVolumes,
  ageAt,
  alertKinds,
  applyOverride,
  barSheet,
  bestClearedHeight,
  can,
  cellStatusOf,
  compareTrackingRows,
  completionPct,
  effectiveConsent,
  emptyVolumes,
  estimatedOneRm,
  formatHeight,
  formatPrice,
  formatPrescription,
  formatTimecode,
  frameStepMs,
  generateAutonomousBlocks,
  groupPublications,
  invitationDefaults,
  invitationStateOf,
  isAttributionFresh,
  isOverdue,
  isPaidPlan,
  isQuietHours,
  isReferralQualified,
  isSelfReferral,
  isWithinLimit,
  nextAttemptNo,
  notationFor,
  parseInstagramUrl,
  parseYouTubeUrl,
  phaseAt,
  phaseRanges,
  planForSubscription,
  PLANS,
  referralCodeFor,
  renderNotification,
  requiresParentalConsent,
  resolveLoadKg,
  resolveVariant,
  roundToPlate,
  scopeOf,
  sessionLoad,
  STARTER_LIBRARY,
  startOfWeek,
  toCsv,
  trailingMissedCount,
  validateClipRange,
  weekTrendPct,
  youtubeEmbedUrl,
} from "./index";

describe("charges", () => {
  const tests = [
    { exerciseKey: "back_squat", value: 100, kind: "one_rm" as const, date: "2026-09-01" },
    { exerciseKey: "back_squat", value: 110, kind: "one_rm" as const, date: "2026-10-01" },
    { exerciseKey: "clean", value: 60, kind: "three_rm" as const, date: "2026-10-01" },
  ];

  it("arrondit au disque de 1,25 kg", () => {
    expect(roundToPlate(88)).toBe(87.5);
    expect(roundToPlate(88.2)).toBe(88.75);
    expect(roundToPlate(0)).toBe(0);
  });

  it("calcule la charge à partir du dernier test", () => {
    const p = { load: { type: "pct_1rm" as const, value: 80, test: "back_squat" } };
    expect(resolveLoadKg(p, tests)).toBe(87.5);
  });

  it("recalcule après un nouveau test", () => {
    const p = { load: { type: "pct_1rm" as const, value: 80, test: "back_squat" } };
    const next = [...tests, { exerciseKey: "back_squat", value: 120, kind: "one_rm" as const, date: "2026-10-20" }];
    expect(resolveLoadKg(p, next)).toBe(96.25);
  });

  it("estime le 1RM depuis un 3RM", () => {
    expect(estimatedOneRm({ value: 60, kind: "three_rm" })).toBeCloseTo(66);
    const p = { load: { type: "pct_1rm" as const, value: 50, test: "clean" } };
    expect(resolveLoadKg(p, tests)).toBe(32.5);
  });

  it("renvoie null sans test plutôt que d'inventer une charge", () => {
    const p = { load: { type: "pct_1rm" as const, value: 80, test: "snatch" } };
    expect(resolveLoadKg(p, tests)).toBeNull();
  });

  it("garde les charges en kg telles quelles", () => {
    expect(resolveLoadKg({ load: { type: "kg", value: 42.5 } }, [])).toBe(42.5);
    expect(resolveLoadKg({}, [])).toBeNull();
  });

  it("applique un ajustement individuel sans toucher au reste", () => {
    const merged = applyOverride({ sets: 4, reps: 5, rest_s: 150 }, { reps: 3 });
    expect(merged).toEqual({ sets: 4, reps: 3, rest_s: 150 });
    expect(applyOverride({ sets: 4 }, undefined)).toEqual({ sets: 4 });
  });

  it("formate une prescription lisible", () => {
    expect(formatPrescription({ sets: 4, reps: 5, rest_s: 150 }, 87.5)).toBe("4 × 5 rép. · 87,5 kg · récup 2 min 30");
    expect(formatPrescription({ sets: 5, unit: "haies", count: 6, ground_contacts: 30, rest_s: 120 })).toBe(
      "5 × 6 haies · 30 contacts · récup 2 min",
    );
    expect(formatPrescription({ sets: 4, distance_m: 20 })).toBe("4 × 20 m");
  });
});

describe("statuts", () => {
  const now = new Date("2026-10-30T10:00:00Z");

  it("passe en manquée 24 h après la date prévue", () => {
    expect(isOverdue("2026-10-30", now)).toBe(false);
    expect(isOverdue("2026-10-29", now)).toBe(false);
    expect(isOverdue("2026-10-28", now)).toBe(true);
  });

  it("calcule le statut de case", () => {
    expect(cellStatusOf({ status: "done" }, "2026-10-01", now)).toBe("done");
    expect(cellStatusOf({ status: "partial" }, "2026-10-01", now)).toBe("partial");
    expect(cellStatusOf(null, "2026-10-01", now)).toBe("missed");
    expect(cellStatusOf(null, "2026-10-31", now)).toBe("upcoming");
  });

  it("calcule le pourcentage sans compter l'à venir", () => {
    expect(completionPct(["done", "partial", "missed", "upcoming"])).toBe(50);
    expect(completionPct(["upcoming", null])).toBeNull();
  });

  it("compte les manquées consécutives", () => {
    expect(trailingMissedCount(["done", "missed", "missed", "upcoming"])).toBe(2);
    expect(trailingMissedCount(["missed", "done"])).toBe(0);
  });

  it("trouve le lundi de la semaine", () => {
    expect(startOfWeek("2026-10-30")).toBe("2026-10-26");
    expect(startOfWeek("2026-10-26")).toBe("2026-10-26");
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
  });
});

describe("versions de séance", () => {
  const blocks = [{ variant: "club" }, { variant: "both" }];

  it("bascule un absent en autonomie seulement si la version existe", () => {
    const snapshot = { blocks: blocks as never };
    expect(resolveVariant("absent", snapshot)).toBe("autonomous");
    expect(resolveVariant("present", snapshot)).toBe("club");
    expect(resolveVariant("absent", { blocks: [{ variant: "club" }] as never })).toBe("club");
  });

  it("génère la version autonomie depuis la version club", () => {
    const out = generateAutonomousBlocks(blocks);
    expect(out.map((b) => b.variant)).toEqual(["club", "both", "autonomous"]);
  });
});

describe("consentement", () => {
  const now = new Date("2026-11-01T12:00:00Z");

  it("calcule l'âge à l'anniversaire près", () => {
    expect(ageAt("2011-11-01", now)).toBe(15);
    expect(ageAt("2011-11-02", now)).toBe(14);
  });

  it("exige l'accord parental sous 15 ans", () => {
    expect(requiresParentalConsent("2011-11-02", now)).toBe(true);
    expect(requiresParentalConsent("2011-11-01", now)).toBe(false);
    expect(requiresParentalConsent(null, now)).toBe(false);
  });

  it("exige l'accord conjoint de l'enfant et du parent", () => {
    expect(effectiveConsent({ health: true, video: true, guardian: "none" })).toEqual({ health: true, video: true });
    expect(effectiveConsent({ health: true, video: true, guardian: "pending" })).toEqual({
      health: false,
      video: false,
    });
    expect(
      effectiveConsent({
        health: true,
        video: false,
        guardian: "granted",
        guardianScope: { health: true, video: true },
      }),
    ).toEqual({ health: true, video: false });
    expect(
      effectiveConsent({
        health: true,
        video: true,
        guardian: "granted",
        guardianScope: { health: false, video: true },
      }),
    ).toEqual({ health: false, video: true });
  });
});

describe("YouTube", () => {
  it("reconnaît les formes de lien", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42")?.startS).toBe(42);
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=1m30s")).toEqual({ youtubeId: "dQw4w9WgXcQ", startS: 90 });
    expect(parseYouTubeUrl("https://youtube.com/shorts/dQw4w9WgXcQ")?.youtubeId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeUrl("pas un lien")).toBeNull();
  });

  it("garde seulement le code d'un lien Instagram, sans le suivi du partage", () => {
    expect(parseInstagramUrl("https://www.instagram.com/reel/DeKl2zopMw9/?stkn=aDQzNXF5OXZkOHZ5")).toBe("DeKl2zopMw9");
    expect(parseInstagramUrl("https://instagram.com/p/Dbq862ptfM6/")).toBe("Dbq862ptfM6");
    expect(parseInstagramUrl("https://www.instagram.com/tresordpw_/")).toBeNull();
    expect(parseInstagramUrl("https://example.com/reel/DeKl2zopMw9/")).toBeNull();
    expect(parseInstagramUrl("pas un lien")).toBeNull();
  });

  it("construit le lien du lecteur officiel avec l'extrait", () => {
    const url = youtubeEmbedUrl({ youtubeId: "dQw4w9WgXcQ", startS: 10, endS: 40 });
    expect(url).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(url).toContain("start=10");
    expect(url).toContain("end=40");
  });

  it("refuse une fin avant le début", () => {
    expect(validateClipRange(40, 10)).toBe(false);
    expect(validateClipRange(10, null)).toBe(true);
  });
});

describe("feuille de barres", () => {
  const attempts = [
    { barHeightCm: 170, attemptNo: 1, result: "X" as const },
    { barHeightCm: 170, attemptNo: 2, result: "O" as const },
    { barHeightCm: 160, attemptNo: 1, result: "O" as const },
    { barHeightCm: 175, attemptNo: 1, result: "X" as const },
    { barHeightCm: 175, attemptNo: 2, result: "pass" as const },
  ];

  it("note selon la notation officielle", () => {
    expect(barSheet(attempts).map((r) => [r.label, r.notation])).toEqual([
      ["1,60", "O"],
      ["1,70", "XO"],
      ["1,75", "X–"],
    ]);
    expect(
      notationFor([
        { barHeightCm: 1, attemptNo: 2, result: "X" },
        { barHeightCm: 1, attemptNo: 1, result: "X" },
      ]),
    ).toBe("XX");
  });

  it("trouve la meilleure barre et le prochain essai", () => {
    expect(bestClearedHeight(attempts)).toBe(170);
    expect(bestClearedHeight([])).toBeNull();
    expect(nextAttemptNo(attempts, 170)).toBeNull();
    expect(nextAttemptNo(attempts, 180)).toBe(1);
    expect(nextAttemptNo([{ barHeightCm: 180, attemptNo: 1, result: "X" }], 180)).toBe(2);
  });

  it("formate hauteurs, repères et pas d'image", () => {
    expect(formatHeight(172)).toBe("1,72");
    expect(formatTimecode(2400)).toBe("0:02,4");
    expect(frameStepMs(240)).toBeCloseTo(4.1667, 3);
    expect(frameStepMs(null)).toBeCloseTo(33.33, 1);
  });
});

describe("timeline vidéo", () => {
  it("découpe seulement selon les phases annotées", () => {
    const ranges = phaseRanges(
      [
        { tMs: 2400, phase: "takeoff" },
        { tMs: 3100, phase: "clearance" },
        { tMs: 2500, phase: "takeoff" },
        { tMs: 100, phase: null },
      ],
      5000,
    );
    expect(ranges).toEqual([
      { phase: "takeoff", startMs: 0, endMs: 3100 },
      { phase: "clearance", startMs: 3100, endMs: 5000 },
    ]);
    expect(phaseAt(ranges, 3200)).toBe("clearance");
    expect(phaseRanges([], 5000)).toEqual([]);
  });
});

describe("offres", () => {
  it("applique les limites, illimité compris", () => {
    expect(isWithinLimit(PLANS.discovery.limits.maxAthletes, 4)).toBe(true);
    expect(isWithinLimit(PLANS.discovery.limits.maxAthletes, 5)).toBe(false);
    expect(isWithinLimit(PLANS.club.limits.maxAthletes, 5000)).toBe(true);
    expect(isPaidPlan("discovery")).toBe(false);
    expect(isPaidPlan("coach")).toBe(true);
  });

  it("retombe sur Découverte à la résiliation, garde l'accès pendant un impayé", () => {
    expect(planForSubscription("coach", "canceled")).toBe("discovery");
    expect(planForSubscription("coach", "past_due")).toBe("coach");
  });

  it("formate les prix", () => {
    expect(formatPrice(1900)).toBe("19\u00a0€");
    expect(formatPrice(1950)).toBe("19,50\u00a0€");
  });

  it("qualifie un parrainage seulement après 30 jours payés", () => {
    const now = new Date("2026-11-01");
    const base = { plan: "coach" as const, status: "active" as const, now };
    expect(isReferralQualified({ ...base, paidSince: new Date("2026-09-15") })).toBe(true);
    expect(isReferralQualified({ ...base, paidSince: new Date("2026-10-20") })).toBe(false);
    expect(isReferralQualified({ ...base, status: "trialing", paidSince: new Date("2026-09-15") })).toBe(false);
    expect(isReferralQualified({ ...base, plan: "discovery", paidSince: new Date("2026-09-15") })).toBe(false);
  });
});

describe("charge et export", () => {
  it("calcule la charge de séance", () => {
    expect(sessionLoad(7, 60)).toBe(420);
    expect(sessionLoad(null, 60)).toBeNull();
  });

  it("additionne les volumes", () => {
    const v = addPrescriptionVolumes(emptyVolumes(), { sets: 4, reps: 5, ground_contacts: 30, distance_m: 20 }, 80);
    expect(v).toEqual({ groundContacts: 30, tonnageKg: 1600, distanceM: 80, jumps: 0 });
  });

  it("compare à la moyenne récente", () => {
    expect(weekTrendPct([100, 100, 150])).toBe(50);
    expect(weekTrendPct([null, 100])).toBeNull();
  });

  it("protège le CSV contre les formules et les séparateurs", () => {
    expect(toCsv(["a"], [["=1+1"], ["x;y"], [null]])).toBe('a\r\n\'=1+1\r\n"x;y"\r\n');
  });

  it("fournit une bibliothèque de départ exploitable", () => {
    expect(STARTER_LIBRARY.length).toBeGreaterThanOrEqual(30);
    expect(new Set(STARTER_LIBRARY.map((e) => e.name)).size).toBe(STARTER_LIBRARY.length);
    for (const e of STARTER_LIBRARY) expect(e.cues.length).toBeGreaterThan(0);
  });
});

describe("permissions", () => {
  it("respecte la matrice", () => {
    expect(can("owner", "inviteCoach")).toBe(true);
    expect(can("coach", "inviteCoach")).toBe(false);
    expect(scopeOf("coach", "inviteAthlete")).toBe("own_groups");
    expect(can("assistant", "inviteAthlete")).toBe(false);
    expect(scopeOf("assistant", "manageSessions")).toBe("own_sessions");
    expect(scopeOf("assistant", "viewInjuries")).toBe("read");
    expect(can("assistant", "editInjuries")).toBe(false);
    expect(can("assistant", "privateNotes")).toBe(false);
    expect(can("athlete", "privateNotes")).toBe(false);
    expect(can("athlete", "filmAndAnnotate")).toBe(false);
    expect(can("athlete", "validateSession")).toBe(true);
    expect(can("owner", "validateSession")).toBe(false);
    expect(can("coach", "manageSubscription")).toBe(false);
    expect(can("guardian", "viewTracking")).toBe(false);
  });
});

describe("alertes", () => {
  it("détecte douleur, manquées, effort anormal et blessure", () => {
    expect(
      alertKinds({
        recentStatuses: ["done", "missed", "missed"],
        lastRpe: 9,
        lastPain: { recent: true },
        activeInjury: true,
      }),
    ).toEqual(["pain", "missed_streak", "abnormal_rpe", "active_injury"]);
    expect(alertKinds({ recentStatuses: ["missed", "done"], lastRpe: 6, lastPain: null, activeInjury: false })).toEqual(
      [],
    );
  });

  it("place la douleur en tête de grille", () => {
    const rows = [
      { hasPain: false, activeInjury: null, name: "Ana" },
      { hasPain: false, activeInjury: "Genou", name: "Zoé" },
      { hasPain: true, activeInjury: null, name: "Léa" },
    ];
    expect(rows.sort(compareTrackingRows).map((r) => r.name)).toEqual(["Léa", "Zoé", "Ana"]);
  });
});

describe("invitations", () => {
  const now = new Date("2026-11-01T00:00:00Z");
  it("donne l'état d'une invitation", () => {
    const base = { status: "sent", expiresAt: new Date("2026-12-01"), maxUses: 1, useCount: 0 };
    expect(invitationStateOf(base, now)).toBe("valid");
    expect(invitationStateOf({ ...base, useCount: 1 }, now)).toBe("used");
    expect(invitationStateOf({ ...base, expiresAt: new Date("2026-10-01") }, now)).toBe("expired");
    expect(invitationStateOf({ ...base, status: "revoked" }, now)).toBe("revoked");
    expect(invitationStateOf({ ...base, maxUses: null, useCount: 50 }, now)).toBe("valid");
  });
  it("applique 7 jours et usage unique aux nominatives", () => {
    expect(invitationDefaults("personal_email")).toEqual({ days: 7, maxUses: 1 });
    expect(invitationDefaults("group_link").maxUses).toBeNull();
  });
});

describe("notifications", () => {
  it("respecte les heures calmes", () => {
    expect(isQuietHours(23)).toBe(true);
    expect(isQuietHours(6)).toBe(true);
    expect(isQuietHours(7)).toBe(false);
    expect(isQuietHours(21)).toBe(false);
  });
  it("signe avec le nom du coach", () => {
    expect(renderNotification("session_published", { coach: "Thomas", date: "2026-10-29" }).body).toBe(
      "Thomas t'a envoyé une séance pour jeudi",
    );
  });
  it("n'expose aucun détail de santé", () => {
    const { body } = renderNotification("pain_alert", { athlete: "Léa" });
    expect(body).toBe("Nouvelle alerte de Léa");
    expect(body).not.toMatch(/genou|douleur/i);
  });
  it("regroupe les publications par athlète", () => {
    expect(
      groupPublications([
        { userId: "a", date: "1" },
        { userId: "a", date: "2" },
        { userId: "b", date: "1" },
      ]),
    ).toEqual([
      { userId: "a", dates: ["1", "2"] },
      { userId: "b", dates: ["1"] },
    ]);
  });
});

describe("parrainage", () => {
  it("génère un code lisible", () => {
    expect(referralCodeFor("Thomas", new Uint8Array([0, 1, 2, 3]))).toBe("TARTAN-THOMAS-ABCD");
    expect(referralCodeFor("Éloïse", new Uint8Array([0, 0, 0, 0]))).toBe("TARTAN-ELOISE-AAAA");
    expect(referralCodeFor(null, new Uint8Array([0, 0, 0, 0]))).toBe("TARTAN-COACH-AAAA");
  });
  it("respecte la fenêtre de 30 jours", () => {
    const signup = new Date("2026-11-01");
    expect(isAttributionFresh(new Date("2026-10-15"), signup)).toBe(true);
    expect(isAttributionFresh(new Date("2026-09-15"), signup)).toBe(false);
  });
  it("écarte l'auto-parrainage", () => {
    const base = { codeOwnerUserId: "u1", codeOwnerOrgId: null, referredUserId: "u2", referredOrgIds: ["o1"] };
    expect(isSelfReferral(base)).toBe(false);
    expect(isSelfReferral({ ...base, referredUserId: "u1" })).toBe(true);
    expect(isSelfReferral({ ...base, codeOwnerUserId: null, codeOwnerOrgId: "o1" })).toBe(true);
  });
});

describe("étirement vidéo", () => {
  const box = (type: string, ...payload: Uint8Array[]): Uint8Array => {
    const size = 8 + payload.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(size);
    new DataView(out.buffer).setUint32(0, size);
    out.set(
      [...type].map((c) => c.charCodeAt(0)),
      4,
    );
    let pos = 8;
    for (const p of payload) {
      out.set(p, pos);
      pos += p.length;
    }
    return out;
  };
  const u32s = (...values: number[]): Uint8Array => {
    const out = new Uint8Array(values.length * 4);
    values.forEach((v, i) => new DataView(out.buffer).setUint32(i * 4, v));
    return out;
  };
  // 720 images à 240 i/s dans un temps de 24 000 graduations par seconde : 3 secondes.
  const movie = (extra: Uint8Array[] = []): Uint8Array => {
    const stbl = box("stbl", box("stts", u32s(0, 1, 720, 100)), box("ctts", u32s(0, 1, 720, 200)));
    const hdlr = box("hdlr", u32s(0, 0, 0x76696465));
    const mdhd = box("mdhd", u32s(0, 0, 0, 24000, 72000));
    const trak = box(
      "trak",
      box("tkhd", u32s(0, 0, 0, 1, 0, 3000)),
      box("edts", box("elst", u32s(0, 1, 3000, 0, 0x10000))),
      box("mdia", mdhd, hdlr, box("minf", stbl)),
    );
    const moov = box("moov", box("mvhd", u32s(0, 0, 0, 1000, 3000)), trak, ...extra);
    const ftyp = box("ftyp", u32s(0));
    const mdat = box("mdat", u32s(1, 2, 3));
    const out = new Uint8Array(ftyp.length + mdat.length + moov.length);
    out.set(ftyp, 0);
    out.set(mdat, ftyp.length);
    out.set(moov, ftyp.length + mdat.length);
    return out;
  };
  const reader = (file: Uint8Array) => async (offset: number, length: number) => file.slice(offset, offset + length);

  it("choisit le facteur qui ramène à 30 i/s au plus", () => {
    expect(timeScaleFor(240)).toBe(8);
    expect(timeScaleFor(120)).toBe(4);
    expect(timeScaleFor(59.94)).toBe(2);
    expect(timeScaleFor(30)).toBe(1);
    expect(timeScaleFor(null)).toBe(1);
  });

  it("étire toutes les durées sans changer la taille de l'en-tête", async () => {
    const file = movie();
    const plan = await planStretch(reader(file), file.length);
    expect(plan).toMatchObject({ fps: 240, timeScale: 8 });
    const bytes = plan?.patch?.bytes as Uint8Array;
    const before = file.slice(plan?.patch?.offset);
    expect(bytes.length).toBe(before.length);
    const again = new Uint8Array(file);
    again.set(bytes, plan?.patch?.offset as number);
    const stretched = await planStretch(reader(again), again.length);
    expect(stretched).toMatchObject({ fps: 30, timeScale: 1, patch: null });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const values = Array.from({ length: bytes.length >> 2 }, (_, i) => view.getUint32(i * 4));
    for (const scaled of [24000, 800, 1600]) expect(values).toContain(scaled);
  });

  it("laisse partir tel quel un MP4 fragmenté ou un fichier inconnu", async () => {
    const fragmented = movie([box("mvex")]);
    await expect(planStretch(reader(fragmented), fragmented.length)).resolves.toBeNull();
    const garbage = new Uint8Array(64).fill(0x41);
    await expect(planStretch(reader(garbage), garbage.length)).resolves.toBeNull();
  });

  it("rapporte la fréquence réellement lisible", () => {
    expect(deliveredFps({ declaredFps: 240, encodedFps: 30, timeScale: 8 })).toBe(240);
    expect(deliveredFps({ declaredFps: null, encodedFps: 239.97, timeScale: 1 })).toBe(30);
    expect(deliveredFps({ declaredFps: 25, encodedFps: null, timeScale: 1 })).toBe(25);
    expect(deliveredFps({ declaredFps: null, encodedFps: null, timeScale: 1 })).toBeNull();
    expect(toRealMs(toFileSeconds(1500, 8), 8)).toBe(1500);
  });
});

describe("records personnels", () => {
  it("205 cm reste sous 2,10 m, malgré des unités différentes", () => {
    expect(
      personalBestIds([
        { id: "cm", mark: 205, unit: "cm" },
        { id: "m", mark: 2.1, unit: "m" },
      ]),
    ).toEqual(["m"]);
  });
  it("un temps plus court est meilleur", () => {
    expect(
      personalBestIds([
        { id: "lent", mark: 12.4, unit: "s" },
        { id: "vite", mark: 11.9, unit: "s" },
      ]),
    ).toEqual(["vite"]);
  });
  it("sans marque restante, aucun record", () => {
    expect(personalBestIds([])).toEqual([]);
  });
  it("à égalité, la première marque reçue garde le record", () => {
    expect(
      personalBestIds([
        { id: "avant", mark: 2, unit: "m" },
        { id: "apres", mark: 200, unit: "cm" },
      ]),
    ).toEqual(["avant"]);
  });
});
