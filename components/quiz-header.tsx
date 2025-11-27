"use client";

import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Award, Download, Edit, Trash2, Loader2, Play } from "lucide-react";

interface QuizHeaderProps {
  title: string;
  description?: string;
  isCreator: boolean;
  status: string;
  onInvite?: () => void;
  onSettle?: () => void;
  canSettle?: boolean;
  onExport?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpen?: () => void;
  opening?: boolean;
  exporting?: boolean;
  participants?: Array<any>;
}

export function QuizHeader({
  title,
  description,
  isCreator,
  status,
  onInvite,
  onSettle,
  canSettle = false,
  onExport,
  onEdit,
  onDelete,
  onOpen,
  opening = false,
  exporting = false,
  participants,
}: QuizHeaderProps) {
  return (
    <CardHeader>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <CardTitle className="text-2xl mb-2">{title}</CardTitle>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {isCreator && (
          <div className="flex gap-2 flex-wrap">
            {status === 'draft' && onOpen && (
              <Button
                size="sm"
                onClick={onOpen}
                disabled={opening}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {opening ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Opening...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Open Quiz
                  </>
                )}
              </Button>
            )}
            {status === 'draft' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEdit}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onInvite}
              disabled={!['draft', 'open'].includes(status)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite
            </Button>
            {canSettle && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSettle}
              >
                <Award className="h-4 w-4 mr-2" />
                Settle
              </Button>
            )}
            {status === 'settled' && participants && participants.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export
              </Button>
            )}
          </div>
        )}
      </div>
    </CardHeader>
  );
}

