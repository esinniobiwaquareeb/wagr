"use client";

import { Button } from "@/components/ui/button";
import { Play, Check, Loader2 } from "lucide-react";

interface QuizActionsProps {
  user?: any;
  participant?: any;
  quizStatus: string;
  onAcceptInvite?: () => void;
  onStartQuiz?: () => void;
  accepting?: boolean;
}

export function QuizActions({
  user,
  participant,
  quizStatus,
  onAcceptInvite,
  onStartQuiz,
  accepting = false,
}: QuizActionsProps) {
  if (!user) return null;

  const canTakeQuiz = 
    ['open', 'in_progress'].includes(quizStatus) &&
    participant &&
    ['invited', 'accepted'].includes(participant.status);

  // Only show accept button if status is 'invited'
  if (participant && participant.status === 'invited') {
    return (
      <div className="pt-4 border-t">
        <Button 
          onClick={onAcceptInvite} 
          className="w-full" 
          size="lg"
          disabled={accepting}
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
        <p className="text-sm text-muted-foreground mt-2 text-center">
          You've been invited to this quiz. Accept to participate.
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

