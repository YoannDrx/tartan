import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Sheet, SheetSection } from "@/components/sheet";
import {
  EmailPreferences,
  NotificationCategories,
  RevokeIcalLink,
  WebPushToggle,
} from "@/features/settings/notifications/notification-forms";
import { requireRubric } from "@/features/settings/rubric-access";
import { LinkField } from "@/features/settings/shared";
import { env } from "@/lib/env";
import { getEmailPreferences } from "@/server/email-preferences.service";
import { icalLink } from "@/server/ical.service";
import { getMe } from "@/server/me.service";

export const metadata: Metadata = { title: w.settings.rubrics.notifications.title };

export default async function NotificationsSettingsPage() {
  const { actor, organizationId, access } = await requireRubric("notifications");
  const [me, emailPreferences, ical] = await Promise.all([
    getMe(actor.userId),
    getEmailPreferences(actor.userId),
    access.athleteId ? icalLink(actor.userId, organizationId) : null,
  ]);
  const categories = me.preferences?.notifications ?? { sessions: true, feedback: true, group: true, product: true };
  const vapidKey = env().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const t = w.settings.notifications;
  return (
    <Sheet className="divide-y divide-card-line">
      {vapidKey ? (
        <SheetSection id="notifications" title={m.push.permissionTitle}>
          <WebPushToggle vapidKey={vapidKey} />
        </SheetSection>
      ) : null}
      <SheetSection id="categories" title={m.inbox.categories}>
        <NotificationCategories {...categories} />
      </SheetSection>
      <SheetSection id="emails" title={m.settings.emails}>
        <EmailPreferences
          digest={emailPreferences.digest}
          notifications={emailPreferences.notifications}
          tips={emailPreferences.tips}
          showDigest={access.role === "owner"}
        />
      </SheetSection>
      {ical ? (
        <SheetSection id="agenda" title={m.settings.calendar}>
          <div className="flex flex-col gap-2">
            <p>{m.settings.calendarDetail}</p>
            <LinkField link={ical} label={t.icalLabel} copyLabel={t.icalCopy} />
            <div>
              <RevokeIcalLink />
            </div>
          </div>
        </SheetSection>
      ) : null}
    </Sheet>
  );
}
