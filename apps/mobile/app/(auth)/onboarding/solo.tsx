import { useMutation, useQuery } from "@tanstack/react-query";
import type { TrainingProfile } from "@tartan/contracts";
import { ageAt } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { BirthDateField, toIsoBirthDate, type BirthParts } from "../../../src/features/birth-date-field";
import { ConsentRow, LegalLinks } from "../../../src/features/consent-row";
import { PushStep, Shell } from "../../../src/features/push-step";
import { TrainingProfileFields } from "../../../src/features/training-profile-fields";
import { api } from "../../../src/lib/api";
import { errorMessage } from "../../../src/lib/errors";
import { useMe } from "../../../src/lib/queries";
import { queryClient } from "../../../src/lib/query-client";
import { useSession } from "../../../src/lib/session-store";
import { useSpaceStore } from "../../../src/lib/space-store";
import { Button, Card, Field, LaneLine, ScreenTitle, T } from "../../../src/ui/primitives";
import { LoadingState } from "../../../src/ui/states";
import { space } from "../../../src/ui/theme";

const t = m.mobile.solo;
const STEPS = ["start", "ready", "go"] as const;
type Step = (typeof STEPS)[number];
type Errors = Partial<Record<"firstName" | "lastName" | "birthDate" | "terms", string>>;

// « Je m'entraîne seul » : les mêmes trois temps que le web. Toi (prénom, nom, date de naissance pour les adultes),
// ton entraînement (facultatif), puis les conditions et les deux accords facultatifs, santé et vidéo. L'espace
// personnel naît d'un seul envoi (`POST /me/personal-space`), puis la journée.
export default function SoloOnboarding() {
  const router = useRouter();
  const planner = useLocalSearchParams<{ ensuite?: string }>().ensuite === "planificateur";
  const status = useSession((s) => s.status);
  const me = useMe(status === "signed-in");
  const setActive = useSpaceStore((s) => s.setActive);
  // Le réglage est relu : un choix fermé entre-temps le dit avant le formulaire, pas après.
  const options = useQuery({ queryKey: ["signup-options"], queryFn: api.signupOptions, staleTime: 0 });
  const [step, setStep] = useState<Step>("start");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birth, setBirth] = useState<BirthParts>({ day: "", month: "", year: "" });
  const [profile, setProfile] = useState<TrainingProfile>({
    disciplines: [],
    trainingObjectives: [],
    availableEquipment: [],
  });
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [video, setVideo] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    if (me.data?.firstName) setFirstName((v) => v || (me.data?.firstName ?? ""));
    if (me.data?.lastName) setLastName((v) => v || (me.data?.lastName ?? ""));
  }, [me.data?.firstName, me.data?.lastName]);

  const create = useMutation({
    mutationFn: () =>
      api.createPersonalSpace({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthDate: me.data?.birthDate ? undefined : (toIsoBirthDate(birth) ?? undefined),
        availableEquipment: profile.availableEquipment,
        disciplines: profile.disciplines,
        trainingObjectives: profile.trainingObjectives,
        termsAccepted: true,
        consents: { health, video },
      }),
    onSuccess: async (result) => {
      setActive(result.organizationId);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setCreated(true);
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  if (status === "signed-out") return <Redirect href="/sign-in" />;
  // Après la création : pourquoi les notifications, puis sa journée. Rien ne s'ouvre ensuite par-dessus.
  if (created) return <PushStep coach={false} solo onDone={() => router.replace(planner ? "/planner" : "/today")} />;
  if (me.isPending) return <LoadingState />;
  if (me.data && me.data.spaces.length > 0 && !planner && !create.isPending) return <Redirect href="/" />;

  const index = STEPS.indexOf(step);
  const closed = options.data && !options.data.athlete;

  const checkProfile = (): boolean => {
    const next: Errors = {};
    if (!firstName.trim()) next.firstName = m.mobile.forms.firstNameRequired;
    if (!lastName.trim()) next.lastName = m.mobile.forms.lastNameRequired;
    if (!me.data?.birthDate) {
      if (!birth.day && !birth.month && !birth.year) next.birthDate = m.mobile.invite.birthRequired;
      else if (!toIsoBirthDate(birth)) next.birthDate = m.mobile.invite.birthInvalid;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    setFormError(null);
    if (!checkProfile()) {
      setStep("start");
      return;
    }
    if (!terms) {
      setErrors({ terms: m.invite.termsRequired });
      return;
    }
    const date = toIsoBirthDate(birth);
    if (me.data?.birthDate || !date) {
      create.mutate();
      return;
    }
    // Une date de naissance ne se corrige plus ensuite : elle se confirme, comme pour le coach.
    Alert.alert(
      m.age.checkTitle,
      m.age.check(new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR"), ageAt(date, new Date(), "Europe/Paris")),
      [
        { text: m.age.correct, style: "cancel", onPress: () => setStep("start") },
        { text: m.age.saveConfirmed, onPress: () => create.mutate() },
      ],
    );
  };

  return (
    <Shell>
      <View style={{ gap: space.sm }}>
        <ScreenTitle title={t.title} testID="solo-title" />
        <T>{t.lead}</T>
        <T variant="smallStrong" testID="solo-step" accessibilityLiveRegion="polite">
          {t.stepStatus(index + 1, STEPS.length, t.steps[step])}
        </T>
      </View>
      <LaneLine />
      {closed ? (
        <Card>
          <T accessibilityLiveRegion="polite">{t.closed}</T>
          <Button label={m.mobile.welcome.back} variant="secondary" onPress={() => router.replace("/onboarding")} />
        </Card>
      ) : step === "start" ? (
        <Card>
          <T variant="title2" heading>
            {t.profileTitle}
          </T>
          <Field
            testID="solo-first-name"
            label={m.onboarding.firstName}
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
            error={errors.firstName}
          />
          <Field
            testID="solo-last-name"
            label={m.onboarding.lastName}
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
            textContentType="familyName"
            returnKeyType="done"
            error={errors.lastName}
          />
          {me.data?.birthDate ? (
            <T variant="small">
              {m.invite.birthDate} : {new Date(`${me.data.birthDate}T12:00:00Z`).toLocaleDateString("fr-FR")}
            </T>
          ) : (
            <BirthDateField value={birth} onChange={setBirth} error={errors.birthDate} />
          )}
          <Button
            testID="solo-next"
            label={m.mobile.onboarding.next}
            onPress={() => {
              if (checkProfile()) setStep("ready");
            }}
          />
        </Card>
      ) : step === "ready" ? (
        <Card>
          <T variant="title2" heading>
            {t.trainingTitle}
          </T>
          <T variant="small">{t.trainingHint}</T>
          <TrainingProfileFields
            value={profile}
            onChange={setProfile}
            keys={planner ? undefined : ["disciplines", "trainingObjectives"]}
            hint={false}
          />
          <Button testID="solo-next" label={m.mobile.onboarding.next} onPress={() => setStep("go")} />
        </Card>
      ) : (
        <Card>
          <T variant="title2" heading>
            {t.termsTitle}
          </T>
          <T variant="small">{t.termsLead}</T>
          <ConsentRow
            testID="solo-terms"
            label={t.terms}
            value={terms}
            disabled={create.isPending}
            onChange={(value) => {
              setTerms(value);
              setErrors({});
            }}
          />
          {errors.terms ? (
            <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
              {errors.terms}
            </T>
          ) : null}
          <LegalLinks />
          <ConsentRow
            testID="solo-health"
            label={t.health}
            detail={t.healthWhy}
            value={health}
            disabled={create.isPending}
            onChange={setHealth}
          />
          <ConsentRow
            testID="solo-video"
            label={t.video}
            detail={t.videoWhy}
            value={video}
            disabled={create.isPending}
            onChange={setVideo}
          />
          <T variant="caption" tone="muted">
            {t.optional}
          </T>
          <T variant="small">{t.quotas}</T>
          {formError ? (
            <T variant="small" tone="danger" accessibilityLiveRegion="assertive">
              {formError}
            </T>
          ) : null}
          <Button testID="solo-create" label={t.create} loading={create.isPending} onPress={submit} />
        </Card>
      )}
      <Button
        testID="solo-back"
        label={index === 0 || closed ? m.mobile.welcome.back : m.onboarding.back}
        variant="secondary"
        compact
        disabled={create.isPending}
        onPress={() => (index === 0 || closed ? router.replace("/onboarding") : setStep(STEPS[index - 1]!))}
      />
    </Shell>
  );
}
