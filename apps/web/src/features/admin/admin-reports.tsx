"use client";

import { m } from "@tartan/i18n";
import { useAction } from "next-safe-action/hooks";
import { Rows } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { adminResolveReportAction } from "@/features/comments/comment.action";

type Report = {
  id: string;
  organizationName: string;
  entityType: "comment" | "video" | "announcement";
  excerpt: string | null;
  reason: string;
  detail: string | null;
};

export const AdminReports = ({ reports }: { reports: Report[] }) => {
  const resolve = useAction(adminResolveReportAction, {
    onSuccess: () => toast.ok(m.settings.reportDone),
    onError: ({ error }) => toast.error(error.serverError ?? m.common.genericError),
  });
  if (reports.length === 0) return <p className="text-soft">{m.settings.reportsEmpty}</p>;
  return (
    <Rows>
      {reports.map((report) => (
        <li key={report.id} className="flex flex-col gap-2 py-2">
          <div>
            <p className="t-caption font-normal text-soft">
              {report.organizationName}, {m.settings.reportEntity[report.entityType]}, {report.reason}
            </p>
            {report.excerpt ? <p className="break-words">{report.excerpt}</p> : null}
            {report.detail ? <p className="t-caption font-normal text-soft">{report.detail}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={resolve.isPending}
              onClick={() => resolve.execute({ id: report.id, removeContent: false })}
            >
              {m.settings.reportKeep}
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={resolve.isPending}
              onClick={() => resolve.execute({ id: report.id, removeContent: true })}
            >
              {m.settings.reportDelete}
            </Button>
          </div>
        </li>
      ))}
    </Rows>
  );
};
