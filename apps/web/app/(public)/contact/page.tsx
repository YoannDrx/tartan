import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/features/shell/public-page";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: m.contact.title };

const t = m.contact;

export default function ContactPage() {
  const email = env().EMAIL_CONTACT;
  return (
    <PublicPage title={t.title} lead={t.lead} site world="soleil">
      <div className="on-card rounded-card bg-card p-5">
        <Button asChild size="lg" className="w-full">
          <a href={`mailto:${email}`}>
            <Mail aria-hidden className="size-5" />
            {t.write}
          </a>
        </Button>
        <p className="t-num mt-3 text-center text-[20px]">{email}</p>
        <h2 className="t-section mt-5">{t.topicsTitle}</h2>
        <ul className="mt-2">
          {(
            [
              ["/tarifs", t.pricing],
              ["/confidentialite", t.privacy],
              ["/suppression-compte", t.deleteAccount],
            ] as const
          ).map(([href, label]) => (
            <li key={href} className="border-t border-card-line">
              <Link href={href} className="flex min-h-11 items-center">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </PublicPage>
  );
}
