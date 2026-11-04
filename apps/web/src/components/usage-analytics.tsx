"use client";

import { Analytics } from "@vercel/analytics/next";
import { scrubAnalyticsEvent } from "@/lib/analytics";

export const UsageAnalytics = () => <Analytics beforeSend={scrubAnalyticsEvent} />;
