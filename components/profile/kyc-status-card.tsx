"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { KycSummary } from "@/lib/kyc/types";
import { CheckCircle2, ShieldAlert, Clock, ArrowRight } from "lucide-react";

interface KycStatusCardProps {
  summary: KycSummary | null;
  loading: boolean;
  onStartUpgrade: (level: 2 | 3) => void;
  variant?: 'standalone' | 'embedded';
}

export function KycStatusCard({
  summary,
  loading,
  onStartUpgrade,
  variant = 'standalone',
}: KycStatusCardProps) {
  const Container = variant === 'embedded' ? 'div' : Card;
  const Header = variant === 'embedded' ? 'div' : CardHeader;
  const Content = variant === 'embedded' ? 'div' : CardContent;
  const Title = variant === 'embedded' ? 'div' : CardTitle;

  const baseClasses =
    variant === 'embedded'
      ? "rounded-xl border border-dashed border-border/70 bg-muted/30"
      : undefined;

  const headerClasses =
    variant === 'embedded'
      ? "px-3 py-2 border-b border-border/60 flex flex-wrap items-center justify-between gap-3"
      : undefined;

  if (loading) {
    return (
      <Container className={cn(baseClasses)}>
        <Header className={headerClasses}>
          <Title className="text-base font-semibold">Verification Status</Title>
        </Header>
        <Content className="p-4 space-y-3">
          <div className="h-4 bg-muted animate-pulse rounded w-32" />
          <div className="h-3 bg-muted animate-pulse rounded w-full" />
          <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
        </Content>
      </Container>
    );
  }

  if (!summary) {
    return (
      <Container className={cn(baseClasses)}>
        <Header className={headerClasses}>
          <Title className="text-base font-semibold">Verification Status</Title>
        </Header>
        <Content className="p-4">
          <Alert>
            <AlertTitle>Verification unavailable</AlertTitle>
            <AlertDescription>
              We couldn&apos;t load your KYC information. Please refresh or contact support if the problem
              persists.
            </AlertDescription>
          </Alert>
        </Content>
      </Container>
    );
  }

  const nextLevel = summary.levels.find((level) => level.level === summary.currentLevel + 1);

  const shell = (
    <>
      <Header className={cn("space-y-1", headerClasses)}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Verification Level</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant={summary.badgeVariant}>{summary.currentLabel}</Badge>
              <span className="text-xs text-muted-foreground">{summary.badgeDescription}</span>
            </div>
          </div>
          {nextLevel && nextLevel.level <= 3 && (
            <Button size="sm" onClick={() => onStartUpgrade(nextLevel.level as 2 | 3)}>
              Upgrade to L{nextLevel.level}
            </Button>
          )}
        </div>
      </Header>
      <Content className={cn("space-y-4", variant === 'embedded' ? "p-4" : undefined)}>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {summary.levels.map((level) => (
            <div
              key={level.level}
              className={cn(
                "rounded-lg border p-3 text-sm space-y-2 transition-colors",
                level.status === 'verified'
                  ? "border-green-200/70 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30"
                  : level.status === 'pending'
                  ? "border-amber-200/70 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30"
                  : "border-border bg-background",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground tracking-wide">Level {level.level}</p>
                  <p className="font-semibold text-xs">{level.label}</p>
                </div>
                {level.status === 'verified' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : level.status === 'pending' ? (
                  <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{level.description}</p>
              <div className="text-xs font-medium">
                Status: <span className="text-foreground">{level.statusLabel}</span>
              </div>
              {level.limits && (
                <p className="text-[11px] text-muted-foreground">
                  Limits: ₦{level.limits.min?.toLocaleString() ?? 0} - ₦{level.limits.max?.toLocaleString() ?? 0}
                </p>
              )}
              {level.status !== 'verified' && level.level > summary.currentLevel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-1 text-xs"
                  onClick={() => onStartUpgrade(level.level as 2 | 3)}
                >
                  Start upgrade
                </Button>
              )}
            </div>
          ))}
        </div>

        <Alert>
          <AlertTitle>Why level up?</AlertTitle>
          <AlertDescription className="space-y-2 text-xs">
            <p>
              Wallet transfers unlock at Level 2 (₦2,000 - ₦50,000). Level 3 extends the ceiling to ₦500,000 per
              transaction/day with extra security.
            </p>
            <p>
              Questions? <Link href="/help" className="underline">Contact support</Link>
            </p>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span>Recent submissions</span>
          </div>
          {summary.submissions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No submissions yet. Start with Level 2 to unlock wallet transfers.
            </p>
          ) : (
            <div className="space-y-1">
              {summary.submissions.slice(0, 3).map((submission) => (
                <div
                  key={submission.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs border rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="font-medium">Level {submission.level_requested}</p>
                    <p className="text-muted-foreground">
                      {new Date(submission.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      submission.status === 'verified'
                        ? 'default'
                        : submission.status === 'rejected'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {submission.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Content>
    </>
  );

  if (variant === 'embedded') {
    return (
      <div className={cn(baseClasses)} id="kyc">
        {shell}
      </div>
    );
  }

  return (
    <Card className="border border-border" id="kyc">
      {shell}
    </Card>
  );
}

