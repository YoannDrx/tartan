import { Prisma } from "@/generated/prisma/client";
import {
  exerciseClassification,
  exerciseInput,
  exerciseSearchQuery,
  quickExerciseInput,
  type ExerciseDefaultsResult,
  type ExerciseGuideEdit,
  type ExerciseInput,
  type ExerciseSearchQuery,
  type ExerciseSearchResult,
  type ExerciseSheet,
  type ExerciseSummary,
  type CatalogVideo,
  type QuickExerciseInput,
  type QuickExerciseResult,
  prescriptionSchema,
} from "@tartan/contracts";
import {
  cleanExerciseAliases,
  exerciseFamilyOf,
  findExerciseByName,
  matchesExerciseSearch,
  normalizeExerciseTerm,
  parseInstagramUrl,
  parseYouTubeUrl,
  sortExercises,
  suggestExerciseDefaults,
  validateClipRange,
} from "@tartan/domain";
import { m } from "@tartan/i18n";
import { invalid, notFound } from "@/lib/errors";
import { env } from "@/lib/env";
import { createDirectUpload, signedPlayback, videoEnabled } from "@/lib/mux";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requireOrgMember } from "./access";
import { assertNotDemoSpace } from "./demo-space-guard";
import {
  ensureExerciseCatalog,
  readExerciseGuide,
  retainedExerciseGuide,
  withConcise,
} from "./exercise-catalog.service";
import {
  addToOwnList,
  exerciseMemberships,
  favoriteExerciseIds,
  moveListItems,
  ownListedExerciseIds,
  readableListExerciseIds,
} from "./exercise-list.service";
import { legacyCovers, legacyCoverStamp } from "./legacy-catalog-covers";
import { approvedEditorial, withApprovedImage } from "./catalog-editorial.service";
import { approvedMotionFamilies, withMotion } from "./motion-review.service";
import { assertVideoReservation, withVideoReservation } from "./video-capacity.service";
import { catalogVideos, withCatalogVideos } from "./catalog-media.service";

type MediaRow = {
  kind: "upload" | "youtube" | "instagram";
  muxPlaybackId: string | null;
  youtubeId: string | null;
  instagramCode: string | null;
  author: string | null;
  embeddable: boolean;
  customTitle: string | null;
  startS: number | null;
  endS: number | null;
};

export const mediaSnapshot = (media: MediaRow | undefined) => {
  if (!media) return null;
  if (media.kind === "youtube" && media.youtubeId) {
    return {
      kind: "youtube" as const,
      youtubeId: media.youtubeId,
      title: media.customTitle,
      author: media.author,
      startS: media.startS,
      endS: media.endS,
    };
  }
  if (media.kind === "instagram" && media.instagramCode) {
    return {
      kind: "instagram" as const,
      instagramCode: media.instagramCode,
      title: media.customTitle,
      author: media.author,
      embeddable: media.embeddable,
    };
  }
  return { kind: "upload" as const, muxPlaybackId: media.muxPlaybackId, title: media.customTitle };
};

type ExerciseRow = Prisma.ExerciseGetPayload<{ include: { media: true } }>;
// La fiche commune d'un exercice : la sienne, ou celle dont la copie du coach est tirée.
const catalogKeyOf = (row: ExerciseRow) => row.catalogKey ?? row.sourceCatalogKey ?? "";

// Sans guide ni lecture signée : ce qu'une liste de résultats affiche (nom, famille, vignette du geste).
const lightSummary = (e: ExerciseRow): ExerciseSummary => {
  const guide = readExerciseGuide(e.guide);
  return {
    id: e.id,
    classification: e.classification ? exerciseClassification.parse(e.classification) : null,
    name: e.name,
    category: e.category,
    tags: e.tags,
    aliases: e.aliases,
    cues: e.cues,
    defaultPrescription: prescriptionSchema.parse(e.defaultPrescription),
    strengthLoadKind: e.strengthLoadKind as ExerciseSummary["strengthLoadKind"],
    loadStepKg: Number(e.loadStepKg),
    media: mediaSnapshot(e.media[0]),
    shared: e.organizationId === null,
    family: exerciseFamilyOf(guide?.family, e.category),
    motionKey: guide?.catalogKey ?? null,
    guide: null,
  };
};

const exerciseSummary = async (
  e: ExerciseRow,
  families: readonly string[],
  reviewed: ReadonlySet<string>,
  videos: ReadonlyMap<string, CatalogVideo[]>,
): Promise<ExerciseSummary> => {
  const media = mediaSnapshot(e.media[0]);
  // Vidéos du coach privées : lecture par jeton signé, comme dans une séance.
  const stream =
    media?.kind === "upload" && media.muxPlaybackId && env().MUX_SIGNING_KEY_ID
      ? await signedPlayback(media.muxPlaybackId)
      : null;
  const cover = e.organizationId === null && e.catalogKey === null ? legacyCovers.get(e.id) : undefined;
  return {
    ...lightSummary(e),
    ...(cover && reviewed.has(legacyCoverStamp(cover)) ? { cover: { path: cover.path, alt: cover.alt } } : {}),
    media: stream && media ? { ...media, streamUrl: stream.mp4Url, hlsUrl: stream.hlsUrl } : media,
    guide: withApprovedImage(
      withCatalogVideos(withConcise(withMotion(readExerciseGuide(e.guide), families)), videos),
      reviewed,
    ),
  };
};

const mediaInclude = { media: { orderBy: { createdAt: "desc" as const }, take: 1 } };

// La bibliothèque de l'espace : ses fiches et le catalogue commun. Une copie du catalogue tient la place de sa
// fiche d'origine : le même geste n'apparaît jamais deux fois.
const libraryRows = async (organizationId: string, where: Prisma.ExerciseWhereInput = {}) => {
  const rows = await prisma.exercise.findMany({
    where: { AND: [{ OR: [{ organizationId }, { organizationId: null }], deletedAt: null }, where] },
    orderBy: { name: "asc" },
    include: mediaInclude,
  });
  const represented = new Set(
    (
      await prisma.exercise.findMany({
        where: { organizationId, deletedAt: null, sourceCatalogKey: { not: null } },
        select: { sourceCatalogKey: true },
      })
    ).map((row) => row.sourceCatalogKey),
  );
  return rows.filter((row) => !row.catalogKey || !represented.has(row.catalogKey));
};

export const listExercises = async (userId: string, organizationId: string): Promise<ExerciseSummary[]> => {
  await requireOrgMember(userId, organizationId, "editExercises");
  await ensureExerciseCatalog(userId, organizationId);
  const rows = await libraryRows(organizationId);
  const [families, reviewed, videos] = await Promise.all([
    approvedMotionFamilies(),
    approvedEditorial(),
    catalogVideos(rows.map(catalogKeyOf)),
  ]);
  return Promise.all(rows.map((row) => exerciseSummary(row, families, reviewed, videos)));
};

/** La bibliothèque sans les guides : la page `/exercices` filtre et pagine ces lignes, chaque fiche a son adresse. */
export const listExerciseIndex = async (userId: string, organizationId: string): Promise<ExerciseSummary[]> => {
  await requireOrgMember(userId, organizationId, "editExercises");
  await ensureExerciseCatalog(userId, organizationId);
  return (await libraryRows(organizationId)).map(lightSummary);
};

/** Les fiches qu'une séance ou un modèle cite déjà, sans guide : le constructeur n'embarque plus la bibliothèque. */
export const exerciseSummariesByIds = async (
  userId: string,
  organizationId: string,
  ids: readonly string[],
): Promise<ExerciseSummary[]> => {
  await requireOrgMember(userId, organizationId, "editExercises");
  if (ids.length === 0) return [];
  const rows = await prisma.exercise.findMany({
    // Une séance garde l'exercice qu'elle cite, même retiré depuis de la bibliothèque.
    where: { id: { in: [...new Set(ids)] }, OR: [{ organizationId }, { organizationId: null }] },
    include: mediaInclude,
  });
  return rows.map(lightSummary);
};

/** Une page de résultats, filtrée et cherchée côté serveur : le sélecteur du constructeur charge à la demande. */
export const searchExercises = async (
  userId: string,
  organizationId: string,
  raw: ExerciseSearchQuery,
): Promise<ExerciseSearchResult> => {
  const query = exerciseSearchQuery.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  await ensureExerciseCatalog(userId, organizationId);
  const { filter } = query;
  const order =
    filter.kind === "list"
      ? await readableListExerciseIds(access, filter.listId)
      : filter.kind === "favorites"
        ? await favoriteExerciseIds(access)
        : undefined;
  const rows = await libraryRows(
    organizationId,
    order ? { id: { in: order } } : filter.kind === "mine" ? { organizationId } : {},
  );
  const sorted = sortExercises(
    rows
      .map(lightSummary)
      .filter((e) => filter.kind !== "family" || e.family === filter.family)
      .filter((e) => matchesExerciseSearch(e, query.q)),
    query.q,
    order,
  );
  // Avant toute recherche, ce que le coach a rangé lui-même passe devant : ses favoris, puis ses listes.
  const own = query.ownFirst && !query.q && filter.kind === "all" ? await ownListedExerciseIds(access) : [];
  const rank = new Map(own.map((id, index) => [id, index]));
  const position = (id: string) => rank.get(id) ?? own.length;
  // Le tri est stable : le reste de la bibliothèque garde son ordre alphabétique.
  const found = own.length === 0 ? sorted : [...sorted].sort((a, b) => position(a.id) - position(b.id));
  return { items: found.slice(query.offset, query.offset + query.limit), total: found.length };
};

// Les noms de la bibliothèque de l'espace, sans guide ni média : de quoi reconnaître un doublon et proposer une
// famille. Les fiches de l'espace viennent d'abord ; une copie du catalogue tient la place de sa fiche d'origine.
const libraryNames = async (organizationId: string, db: Prisma.TransactionClient = prisma) => {
  const rows = await db.exercise.findMany({
    where: { OR: [{ organizationId }, { organizationId: null }], deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      aliases: true,
      category: true,
      strengthLoadKind: true,
      organizationId: true,
      catalogKey: true,
      sourceCatalogKey: true,
    },
  });
  const represented = new Set(rows.map((row) => row.sourceCatalogKey).filter(Boolean));
  return rows
    .filter((row) => !row.catalogKey || !represented.has(row.catalogKey))
    .sort((a, b) => Number(a.organizationId === null) - Number(b.organizationId === null));
};

/**
 * Ce que la création rapide préremplit pour un nom : la famille et la convention de charge proposées par la règle
 * du domaine, et la fiche de la bibliothèque qui porte déjà ce nom, pour l'utiliser au lieu de la recréer.
 */
export const exerciseDefaultsFor = async (
  userId: string,
  organizationId: string,
  name: string,
): Promise<ExerciseDefaultsResult> => {
  await requireOrgMember(userId, organizationId, "editExercises");
  await ensureExerciseCatalog(userId, organizationId);
  const library = await libraryNames(organizationId);
  const same = findExerciseByName(name, library);
  const existing = same ? await prisma.exercise.findUnique({ where: { id: same.id }, include: mediaInclude }) : null;
  return { ...suggestExerciseDefaults(name, library), existing: existing ? lightSummary(existing) : null };
};

/**
 * Créer une fiche par son seul nom, sans quitter l'écran : privée à l'espace, à compléter plus tard dans la
 * bibliothèque. La famille et la convention de charge non précisées sont proposées par la règle du domaine. Une
 * fiche qui porte déjà ce nom n'est pas recréée : c'est elle qui est rendue. Le terme cherché devient un autre nom
 * de la fiche quand il aide à la retrouver.
 */
export const quickCreateExercise = async (
  userId: string,
  organizationId: string,
  raw: QuickExerciseInput,
): Promise<QuickExerciseResult> => {
  const input = quickExerciseInput.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  await ensureExerciseCatalog(userId, organizationId);
  return prisma.$transaction(async (tx) => {
    // Le verrou de l'espace met en file deux créations du même nom : la seconde retrouve la première.
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    const library = await libraryNames(organizationId, tx);
    const existing = findExerciseByName(input.name, library);
    let id = existing?.id;
    if (!id) {
      const defaults = suggestExerciseDefaults(input.name, library);
      const term = normalizeExerciseTerm(input.searchTerm ?? "");
      // Le terme ne devient un autre nom que s'il ne trouvait rien : la recherche trouve déjà une fiche par un
      // morceau de son nom, et un terme qui mène à d'autres fiches (un début de saisie, le nom d'une autre fiche)
      // resterait ambigu pour qui dicte une séance.
      const keepsTerm =
        term !== "" &&
        !normalizeExerciseTerm(input.name).includes(term) &&
        !library.some((row) => [row.name, ...row.aliases].some((label) => normalizeExerciseTerm(label).includes(term)));
      id = (
        await tx.exercise.create({
          data: {
            organizationId,
            createdBy: userId,
            name: input.name,
            category: input.category ?? defaults.category,
            strengthLoadKind: input.strengthLoadKind === undefined ? defaults.strengthLoadKind : input.strengthLoadKind,
            aliases: keepsTerm ? cleanExerciseAliases(input.name, [input.searchTerm!]) : [],
          },
        })
      ).id;
    }
    if (input.listId) await addToOwnList(tx, access, input.listId, id);
    const row = await tx.exercise.findUniqueOrThrow({ where: { id }, include: mediaInclude });
    return { id, created: !existing, exercise: lightSummary(row) };
  });
};

// Fiche d'un exercice : réservée à l'encadrement, comme la bibliothèque.
export const getExercise = async (
  userId: string,
  organizationId: string,
  exerciseId: string,
): Promise<ExerciseSummary> => {
  await requireOrgMember(userId, organizationId, "editExercises");
  const row = await prisma.exercise.findFirst({
    where: { id: exerciseId, deletedAt: null, OR: [{ organizationId }, { organizationId: null }] },
    include: mediaInclude,
  });
  if (!row) throw notFound();
  const [families, reviewed, videos] = await Promise.all([
    approvedMotionFamilies(),
    approvedEditorial(),
    catalogVideos([catalogKeyOf(row)]),
  ]);
  return exerciseSummary(row, families, reviewed, videos);
};

// La fiche d'une variante dans cet espace : sa copie si l'espace en a une, sinon la fiche commune.
const variantLink = async (organizationId: string, catalogKey: string | null | undefined) => {
  if (!catalogKey) return null;
  const row =
    (await prisma.exercise.findFirst({
      where: { organizationId, sourceCatalogKey: catalogKey, deletedAt: null },
      select: { id: true, name: true },
    })) ??
    (await prisma.exercise.findFirst({
      where: { organizationId: null, catalogKey, deletedAt: null },
      select: { id: true, name: true },
    }));
  return row;
};

/** La fiche complète : guide concis, étoile et listes du coach, variantes en liens vers leur fiche. */
export const getExerciseSheet = async (
  userId: string,
  organizationId: string,
  exerciseId: string,
): Promise<ExerciseSheet> => {
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  const exercise = await getExercise(userId, organizationId, exerciseId);
  const [memberships, easier, harder] = await Promise.all([
    exerciseMemberships(access, exerciseId),
    variantLink(organizationId, exercise.guide?.concise?.easier?.catalogKey),
    variantLink(organizationId, exercise.guide?.concise?.harder?.catalogKey),
  ]);
  return { ...exercise, ...memberships, variants: { easier, harder } };
};

/**
 * « Personnaliser » une fiche commune : une copie dans l'espace, qui garde le guide et le geste, puis s'édite.
 * Elle prend la place de la fiche commune dans la bibliothèque et dans les listes de l'espace. Une seconde demande
 * rend la copie existante.
 */
export const personalizeExercise = async (userId: string, organizationId: string, exerciseId: string) => {
  await requireOrgMember(userId, organizationId, "editExercises");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    const source = await tx.exercise.findFirst({
      where: { id: exerciseId, organizationId: null, deletedAt: null },
      include: { media: { where: { kind: { in: ["youtube", "instagram"] } } } },
    });
    if (!source?.catalogKey) throw notFound();
    const existing = await tx.exercise.findFirst({
      where: { organizationId, sourceCatalogKey: source.catalogKey, deletedAt: null },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };
    const copy = await tx.exercise.create({
      data: {
        organizationId,
        createdBy: userId,
        sourceCatalogKey: source.catalogKey,
        catalogVersion: source.catalogVersion,
        guide: source.guide ?? Prisma.DbNull,
        classification: source.classification ?? Prisma.DbNull,
        name: source.name,
        category: source.category,
        tags: source.tags,
        aliases: source.aliases,
        cues: source.cues,
        defaultPrescription: source.defaultPrescription ?? {},
        strengthLoadKind: source.strengthLoadKind,
        loadStepKg: source.loadStepKg,
      },
      select: { id: true },
    });
    for (const media of source.media) {
      const { id: _id, exerciseId: _exerciseId, createdAt: _createdAt, ...rest } = media;
      await tx.exerciseMedia.create({ data: { ...rest, exerciseId: copy.id } });
    }
    await moveListItems(tx, organizationId, source.id, copy.id);
    return { id: copy.id, created: true };
  });
};

// Le guide réécrit par le coach : le geste garde ses positions, la ligne de chacune suit le nouveau texte.
const editedGuide = (stored: Prisma.JsonValue, edit: ExerciseGuideEdit) => {
  const guide = readExerciseGuide(stored);
  if (!guide) throw invalid(m.exerciseLists.guideWithoutBase);
  return {
    ...guide,
    author: "coach" as const,
    objective: edit.objective,
    setup: [edit.setup],
    steps: edit.steps,
    mistakes: edit.mistakes,
    illustration: { ...guide.illustration, positions: [edit.setup, ...edit.steps] },
  };
};

export const saveExercise = async (userId: string, organizationId: string, raw: ExerciseInput) => {
  const input = exerciseInput.parse(raw);
  const access = await requireOrgMember(userId, organizationId, "editExercises");
  let youtube: { youtubeId: string; startS: number | null; endS: number | null; customTitle: string | null } | null =
    null;
  if (input.media?.kind === "youtube") {
    const parsed = parseYouTubeUrl(input.media.url);
    if (!parsed) throw invalid(m.exercises.youtubeInvalid);
    const startS = input.media.startS ?? parsed.startS;
    const endS = input.media.endS ?? null;
    if (!validateClipRange(startS, endS)) throw invalid(m.exercises.clipInvalid);
    youtube = { youtubeId: parsed.youtubeId, startS, endS, customTitle: input.media.customTitle ?? null };
  }
  let instagram: { instagramCode: string; customTitle: string | null } | null = null;
  if (input.media?.kind === "instagram") {
    const instagramCode = parseInstagramUrl(input.media.url);
    if (!instagramCode) throw invalid(m.exercises.linkInvalid);
    instagram = { instagramCode, customTitle: input.media.customTitle ?? null };
  }
  const data = {
    classification: input.classification === null ? Prisma.DbNull : input.classification,
    name: input.name,
    category: input.category,
    tags: input.tags,
    aliases: input.aliases === undefined ? undefined : cleanExerciseAliases(input.name, input.aliases),
    cues: input.cues,
    defaultPrescription: input.defaultPrescription,
    strengthLoadKind: input.strengthLoadKind,
    loadStepKg: input.loadStepKg,
  };
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
    let id = input.id;
    if (id) {
      const existing = await tx.exercise.findFirst({ where: { id, organizationId, deletedAt: null } });
      if (!existing) throw notFound();
      if (input.strengthLoadKind !== undefined && input.strengthLoadKind !== existing.strengthLoadKind) {
        const [tests, references, sets] = await Promise.all([
          tx.strengthTest.count({ where: { exerciseId: id } }),
          tx.strengthReference.count({ where: { exerciseId: id } }),
          // Une case cochée ne mesure rien : seule une valeur saisie dépend de la convention.
          tx.setLog.count({
            where: {
              exerciseId: id,
              OR: [
                { reps: { not: null } },
                { loadKg: { not: null } },
                { distanceM: { not: null } },
                { timeS: { not: null } },
                { groundContacts: { not: null } },
              ],
            },
          }),
        ]);
        if (tests + references + sets > 0)
          throw new AppError(409, "exercise_convention_locked", m.strength.conventionLocked);
      }
      const retained = retainedExerciseGuide(existing, input);
      // Un guide réécrit ne vaut que pour le même geste : une copie qui change de mouvement le perd.
      const guide = input.guideEdit && retained === undefined ? editedGuide(existing.guide, input.guideEdit) : retained;
      await tx.exercise.update({ where: { id }, data: { ...data, guide } });
    } else {
      if (input.guideEdit) throw invalid(m.exerciseLists.guideWithoutBase);
      id = (await tx.exercise.create({ data: { ...data, organizationId, createdBy: userId } })).id;
    }
    if (input.listId) await addToOwnList(tx, access, input.listId, id);
    // Lien effacé ou remplacé : l'ancien part. Une vidéo filmée par le coach n'est jamais touchée ici.
    if (input.media === null || youtube || instagram) {
      await tx.exerciseMedia.deleteMany({ where: { exerciseId: id, kind: { in: ["youtube", "instagram"] } } });
    }
    if (youtube) await tx.exerciseMedia.create({ data: { exerciseId: id, kind: "youtube", ...youtube } });
    if (instagram) await tx.exerciseMedia.create({ data: { exerciseId: id, kind: "instagram", ...instagram } });
    return { id };
  });
};

// Suppression logique : les séances gardent leur copie, l'exercice sort de la bibliothèque (§ 7.4).
export const deleteExercise = async (userId: string, organizationId: string, exerciseId: string) => {
  await requireOrgMember(userId, organizationId, "editExercises");
  const { count } = await prisma.exercise.updateMany({
    where: { id: exerciseId, organizationId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) throw notFound();
};

export const createExerciseVideoUpload = async (userId: string, organizationId: string, exerciseId: string) => {
  await requireOrgMember(userId, organizationId, "editExercises");
  // Aucun fichier ne part chez Mux depuis l'espace de démonstration.
  await assertNotDemoSpace(organizationId, "video");
  if (!videoEnabled()) throw new AppError(503, "video_disabled", m.errors.videoDisabled);
  const exercise = await prisma.exercise.findFirst({ where: { id: exerciseId, organizationId, deletedAt: null } });
  if (!exercise) throw notFound();
  const media = await withVideoReservation(async (db) => {
    await requireOrgMember(userId, organizationId, "editExercises", db);
    if (!(await db.exercise.count({ where: { id: exerciseId, organizationId, deletedAt: null } }))) throw notFound();
    await assertVideoReservation(organizationId, db);
    return db.exerciseMedia.create({ data: { exerciseId, kind: "upload" } });
  });
  const upload = await createDirectUpload(`exercise:${media.id}`);
  await prisma.exerciseMedia.update({ where: { id: media.id }, data: { muxUploadId: upload.uploadId } });
  return { mediaId: media.id, uploadUrl: upload.url };
};
