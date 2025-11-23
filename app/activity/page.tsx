"use client";

import { PlatformActivities } from "@/components/platform-activities";
import { Activity, TrendingUp } from "lucide-react";

export default function ActivityPage() {
  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Header */}
        <div className="mb-4 md:mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Activity className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Platform Activity</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                See what's happening across all wagers in real-time
              </p>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-card border border-border rounded-xl p-4 md:p-6">
          <PlatformActivities />
        </div>
      </div>
    </main>
  );
}

