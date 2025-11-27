"use client";

import { CardContent } from "@/components/ui/card";
import { BookOpen, Users, Clock, Trophy, CheckCircle2, Hourglass } from "lucide-react";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { format } from "date-fns";
import { useSettings } from "@/hooks/use-settings";
import type { DeadlineCountdownResult } from "@/hooks/use-deadline-countdown";

interface QuizInfoProps {
  totalQuestions: number;
  entryFeePerQuestion: number;
  maxParticipants: number;
  baseCost?: number; // Base cost from database (what participants pay)
  platformFee?: number; // Platform fee from database
  totalCost?: number; // Total cost from database (base + platform fee)
  participantCounts?: {
    total: number;
    completed: number;
  };
  startDate?: string;
  endDate?: string;
  durationMinutes?: number;
  status: string;
  countdown?: DeadlineCountdownResult;
}

export function QuizInfo({
  totalQuestions,
  entryFeePerQuestion,
  maxParticipants,
  baseCost: storedBaseCost,
  platformFee: storedPlatformFee,
  totalCost,
  participantCounts,
  startDate,
  endDate,
  durationMinutes,
  status,
  countdown,
}: QuizInfoProps) {
  const { getSetting } = useSettings();
  const platformFeePercentage = getSetting('fees.quiz_platform_fee_percentage', 0.10) as number;
  
  // Calculate prize pool
  // Use stored values if available, otherwise calculate
  let baseCost: number;
  let platformFee: number;
  let prizePool: number;
  
  if (storedBaseCost !== undefined && storedBaseCost !== null) {
    // Use stored base cost and platform fee
    baseCost = storedBaseCost;
    platformFee = storedPlatformFee || (baseCost * platformFeePercentage);
    prizePool = baseCost;
  } else if (totalCost !== undefined && totalCost !== null) {
    // Fallback: calculate from total cost
    baseCost = totalCost / (1 + platformFeePercentage);
    platformFee = baseCost * platformFeePercentage;
    prizePool = baseCost;
  } else {
    // Calculate from entry fee (for display purposes)
    baseCost = entryFeePerQuestion * totalQuestions * maxParticipants;
    platformFee = baseCost * platformFeePercentage;
    prizePool = baseCost;
  }

  return (
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Questions</p>
          <p className="text-lg font-semibold">{totalQuestions}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Entry Fee</p>
          <p className="text-lg font-semibold">
            {formatCurrency(entryFeePerQuestion, DEFAULT_CURRENCY)} per question
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Max Participants</p>
          <p className="text-lg font-semibold">{maxParticipants}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Participants</p>
          <p className="text-lg font-semibold">
            {participantCounts?.total || 0} / {maxParticipants}
          </p>
        </div>
      </div>

      {(startDate || endDate || durationMinutes) && (
        <div className="pt-4 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {startDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Start Time</p>
                  <p className="text-sm font-medium">
                    {format(new Date(startDate), 'PPp')}
                  </p>
                </div>
              </div>
            )}
            {endDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">End Time</p>
                  <p className="text-sm font-medium">
                    {format(new Date(endDate), 'PPp')}
                  </p>
                </div>
              </div>
            )}
            {durationMinutes && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-medium">{durationMinutes} minutes</p>
                </div>
              </div>
            )}
          </div>

          {endDate && countdown && (
            <div className="mt-4">
              <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                countdown.hasElapsed 
                  ? 'border-muted bg-muted/30' 
                  : countdown.status === 'red'
                    ? 'border-red-300 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                    : countdown.status === 'orange'
                      ? 'border-orange-300 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20'
                      : 'border-emerald-300 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
              }`}>
                <Hourglass className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    {countdown.hasElapsed ? 'Quiz Ended' : 'Ends In'}
                  </p>
                  <p className="text-lg font-semibold">
                    {countdown.hasElapsed 
                      ? 'Results are being processed'
                      : countdown.countdown.replace(/^00:/, '')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {participantCounts && participantCounts.completed > 0 && (
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Completed</span>
            </div>
            <span className="font-medium">
              {participantCounts.completed} / {participantCounts.total}
            </span>
          </div>
        </div>
      )}

      <div className="pt-4 border-t space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Prize Pool</span>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{formatCurrency(prizePool, DEFAULT_CURRENCY)}</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Total Contributions:</span>
            <span>{formatCurrency(baseCost, DEFAULT_CURRENCY)}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform Fee ({Math.round(platformFeePercentage * 100)}%):</span>
            <span>-{formatCurrency(platformFee, DEFAULT_CURRENCY)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t">
            <span>Prize Pool:</span>
            <span className="font-semibold">{formatCurrency(prizePool, DEFAULT_CURRENCY)}</span>
          </div>
          <p className="text-xs mt-1">
            Based on {maxParticipants} participants
            {participantCounts && participantCounts.total > 0 && (
              <span> ({participantCounts.total} invited)</span>
            )}
          </p>
        </div>
      </div>
    </CardContent>
  );
}

