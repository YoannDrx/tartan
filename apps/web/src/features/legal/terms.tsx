import { LegalPage } from "@/features/shell/legal-page";

export const TermsContent = ({ embedded = false }: { embedded?: boolean }) => (
  <LegalPage title="Conditions d'utilisation" updated="4 novembre 2026" embedded={embedded}>
    <p>
      Éditeur : Yodev, Yoann Andrieux, entrepreneur individuel, SIREN 803 272 590, 7 allée des Jonquilles, 95130
      Franconville.
    </p>
    <h2>Le service</h2>
    <p>
      Tartan aide un coach d'athlétisme et ses athlètes à planifier, suivre et analyser l'entraînement. Les offres
      payantes relèvent des conditions de vente.
    </p>
    <h2>Qui peut l'utiliser</h2>
    <p>
      Tartan est réservé aux personnes majeures, en France. En créant un compte, tu déclares avoir 18 ans révolus. Un
      compte qui ne remplit pas cette condition est fermé.
    </p>
    <h2>Ce que Tartan n'est pas</h2>
    <p>
      Tartan n'est pas un dispositif médical. Les indicateurs sont des aides à la décision, pas des diagnostics. En cas
      de douleur, consulte un professionnel de santé.
    </p>
    <h2>Les contenus</h2>
    <p>
      Tu restes responsable de ce que tu publies. Tu dois avoir l'accord de chaque personne que tu filmes. Tartan ne
      tolère aucun contenu abusif : harcèlement, discrimination, nudité, violence ou contenu illicite. Tout contenu peut
      être signalé depuis l'app, et tout utilisateur bloqué. Les signalements sont examinés sous 48 heures ouvrées ; un
      contenu abusif est retiré et son auteur est exclu.
    </p>
    <h2>Ton compte</h2>
    <p>
      Tu peux supprimer ton compte à tout moment depuis les réglages. Si tu es le seul coach de ton espace, l'espace et
      ses données sont supprimés avec lui ; sinon, il revient au coach suivant.
    </p>
    <h2>Droit applicable</h2>
    <p>Droit français.</p>
  </LegalPage>
);
