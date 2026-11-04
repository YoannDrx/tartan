import type { Metadata } from "next";
import { LegalPage } from "@/features/shell/legal-page";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegalesPage() {
  return (
    <LegalPage title="Mentions légales" updated="4 novembre 2026">
      <h2>Éditeur</h2>
      <p>
        Tartan est édité sous le nom commercial Yodev par Yoann Andrieux, entrepreneur individuel. SIREN 803 272 590,
        SIRET 803 272 590 00024, code NAF/APE 62.01Z. TVA non applicable, article 293 B du Code général des impôts.
      </p>
      <p>
        Adresse : 7 allée des Jonquilles, 95130 Franconville, France. Contact : hello@tartan.coach. Directeur de la
        publication : Yoann Andrieux.
      </p>
      <h2>Hébergement</h2>
      <p>
        Site et application : Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis, exécution en Union
        européenne (Francfort).
      </p>
      <p>Base de données : Neon (neon.com), région Union européenne (Francfort).</p>
      <p>Stockage et diffusion des vidéos : Mux, Inc., 88 Stevenson Street, San Francisco, CA 94105, États-Unis.</p>
      <h2>Propriété intellectuelle</h2>
      <p>
        La marque, le logo et l'application Tartan appartiennent à leur éditeur. Les contenus publiés par les coachs et
        les athlètes restent les leurs.
      </p>
    </LegalPage>
  );
}
