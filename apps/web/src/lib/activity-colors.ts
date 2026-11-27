import { exerciseCategory, type ExerciseCategory, type ExerciseFamily, type SessionType } from "@tartan/contracts";

// Les teintes suivent le thème choisi : elles sont définies dans globals.css.
export const activityColors = (type: SessionType | ExerciseCategory) => ({
  background: `var(--activity-${type}-bg)`,
  text: `var(--activity-${type}-text)`,
});

// Une catégorie d'exercice prend sa teinte d'activité : liseré, pictogramme et libellé l'accompagnent toujours.
export const categoryColors = (category: string | undefined) => {
  const known = exerciseCategory.safeParse(category);
  return activityColors(known.success ? known.data : "strength");
};

// La teinte d'une famille de la bibliothèque : bandeau de section et vignette, dans le thème choisi.
export const familyColors = (family: ExerciseFamily) => ({
  background: `var(--family-${family}-bg)`,
  text: `var(--family-${family}-text)`,
});
