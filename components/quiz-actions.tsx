"use client";

import { Button } from "@/components/ui/button";
import { Play, Check, X, Loader2 } from "lucide-react";

interface QuizActionsProps {
  user?: any;
  participant?: any;
  quizStatus: string;
  onAcceptInvite?: () => void;
  onDeclineInvite?: () => void;
  onStartQuiz?: () => void;
  accepting?: boolean;
  declining?: boolean;
}

export function QuizActions({
  user,
  participant,
  quizStatus,
  onAcceptInvite,
  onDeclineInvite,
  onStartQuiz,
  accepting = false,
  declining = false,
}: QuizActionsProps) {
  if (!user) return null;

  const canTakeQuiz = 
    ['open', 'in_progress'].includes(quizStatus) &&
    participant &&
    ['invited', 'accepted', 'INVITED', 'ACCEPTED'].includes(participant.status);

  // Normalize status to lowercase for comparison
  const normalizedStatus = participant?.status?.toLowerCase();

  // Only show accept/decline buttons if status is 'invited'
  if (participant && normalizedStatus === 'invited') {
    return (
      <div className="pt-4 border-t">
        <div className="space-y-3">
          <Button 
            onClick={onAcceptInvite} 
            className="w-full" 
            size="lg"
            disabled={accepting || declining}
          >
            {accepting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Accept Invitation
              </>
            )}
          </Button>
          <Button 
            onClick={onDeclineInvite} 
            variant="outline"
            className="w-full" 
            size="lg"
            disabled={accepting || declining}
          >
            {declining ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Declining...
              </>
            ) : (
              <>
                <X className="h-4 w-4 mr-2" />
                Decline Invitation
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-3 text-center">
          You've been invited to this quiz. Accept to participate or decline to remove the invitation.
        </p>
      </div>
    );
  }

  // Don't show accept button if already accepted or other status
  if (participant && participant.status !== 'invited' && participant.status !== 'accepted' && participant.status !== 'started' && participant.status !== 'completed') {
    return null;
  }

  if (canTakeQuiz) {
    return (
      <div className="pt-4 border-t">
        <Button onClick={onStartQuiz} className="w-full" size="lg">
          <Play className="h-4 w-4 mr-2" />
          Start Quiz
        </Button>
      </div>
    );
  }

  if (!participant && user && quizStatus === 'open') {
    return (
      <div className="pt-4 border-t">
        <p className="text-sm text-muted-foreground mb-2">
          You need to be invited to participate in this quiz.
        </p>
      </div>
    );
  }

  return null;
}

