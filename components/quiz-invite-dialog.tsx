"use client";

import { useState, useCallback, useEffect } from "react";
import { X, UserPlus, Users, Mail, User, Loader2, Check, XCircle, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface InviteResult {
  identifier: string;
  type: 'user' | 'email';
  userId?: string;
}

interface QuizInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
  quizTitle: string;
}

export function QuizInviteDialog({
  open,
  onOpenChange,
  quizId,
  quizTitle,
}: QuizInviteDialogProps) {
  const [inviteInput, setInviteInput] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; email?: string; avatar_url?: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteResults, setInviteResults] = useState<{
    invited: InviteResult[];
    notFound: string[];
    errors: Array<{ identifier: string; error: string }>;
  } | null>(null);
  const [invitedUsers, setInvitedUsers] = useState<Array<{
    id: string;
    invitee_id?: string;
    status: string;
    created_at: string;
    invitee?: { id: string; username: string; email?: string; avatar_url?: string };
  }>>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [inviteToRevoke, setInviteToRevoke] = useState<{
    id: string;
    invitee?: { username?: string; email?: string };
  } | null>(null);
  const { toast } = useToast();
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load invited users
  const loadInvitedUsers = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoadingInvites(true);
      }
      const response = await fetch(`/api/quizzes/${quizId}/invites`);
      if (response.ok) {
        const data = await response.json();
        setInvitedUsers(data.data?.invites || []);
      }
    } catch (error) {
      console.error('Failed to load invited users:', error);
    } finally {
      if (showLoading) {
        setLoadingInvites(false);
      }
    }
  }, [quizId]);

  useEffect(() => {
    if (open) {
      loadInvitedUsers(true);
      
      // Set up polling to refresh invites every 2 seconds while dialog is open
      const interval = setInterval(() => {
        loadInvitedUsers();
      }, 2000);
      
      // Listen for custom events when invite is accepted
      const handleInviteAccepted = () => {
        loadInvitedUsers();
      };
      window.addEventListener('quiz-invite-accepted', handleInviteAccepted);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('quiz-invite-accepted', handleInviteAccepted);
      };
    }
  }, [open, loadInvitedUsers]);

  // Search users
  useEffect(() => {
    let cancelled = false;
    
    const performSearch = async () => {
      if (debouncedSearch.length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      try {
        setSearching(true);
        const response = await fetch(`/api/wallet/search-users?q=${encodeURIComponent(debouncedSearch)}`);
        
        if (cancelled) return;

        if (response.ok) {
          const data = await response.json();
          if (!cancelled) {
            const users = data.success && data.data?.users 
              ? data.data.users 
              : data.users || data.data?.users || [];
            setSearchResults(users);
          }
        } else {
          if (!cancelled) {
            setSearchResults([]);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to search users:', error);
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    };

    performSearch();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const addInvite = (identifier: string) => {
    const trimmed = identifier.trim().toLowerCase();
    if (trimmed && !invites.includes(trimmed)) {
      setInvites([...invites, trimmed]);
      setInviteInput("");
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const removeInvite = (identifier: string) => {
    setInvites(invites.filter((inv) => inv !== identifier));
  };

  const handleInviteInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inviteInput.trim()) {
      e.preventDefault();
      addInvite(inviteInput);
    }
  };

  const handleSendInvites = async () => {
    if (invites.length === 0) {
      toast({
        title: "No invites",
        description: "Please add at least one person to invite.",
        variant: "destructive",
      });
      return;
    }

    setInviting(true);
    try {
      const response = await fetch(`/api/quizzes/${quizId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invites }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to send invites');
      }

      setInviteResults(data.data?.results || null);
      setInvites([]);
      setInviteInput("");
      loadInvitedUsers();

      toast({
        title: "Invites sent!",
        description: data.data?.message || `Successfully invited ${data.data?.results?.invited || 0} people`,
      });
    } catch (error) {
      console.error('Error sending invites:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invites",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async () => {
    if (!inviteToRevoke) return;

    setRevokingInviteId(inviteToRevoke.id);
    try {
      // Note: We need to create a revoke endpoint for quizzes similar to wagers
      // For now, we'll use the notification deletion approach
      const response = await fetch(`/api/quizzes/${quizId}/invites/${inviteToRevoke.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke invite');
      }

      toast({
        title: "Invite revoked",
        description: "The invitation has been revoked.",
      });

      setShowRevokeDialog(false);
      setInviteToRevoke(null);
      loadInvitedUsers();
    } catch (error) {
      console.error('Error revoking invite:', error);
      toast({
        title: "Error",
        description: "Failed to revoke invite",
        variant: "destructive",
      });
    } finally {
      setRevokingInviteId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite Participants to Quiz</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search and Add */}
            <div className="space-y-2">
              <Input
                placeholder="Search by username or email..."
                value={inviteInput}
                onChange={(e) => {
                  setInviteInput(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                onKeyDown={handleInviteInputKeyDown}
              />
              
              {searching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="border rounded-lg p-2 space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => addInvite(user.username ? `@${user.username}` : user.email || '')}
                      className="w-full text-left p-2 rounded hover:bg-muted flex items-center gap-2"
                    >
                      <User className="h-4 w-4" />
                      <span>{user.username ? `@${user.username}` : user.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Invite List */}
            {invites.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">To Invite:</p>
                <div className="flex flex-wrap gap-2">
                  {invites.map((invite) => (
                    <div
                      key={invite}
                      className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full"
                    >
                      <span className="text-sm">{invite}</span>
                      <button
                        type="button"
                        onClick={() => removeInvite(invite)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleSendInvites}
                  disabled={inviting}
                  className="w-full"
                >
                  {inviting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Send Invites ({invites.length})
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Invited Users */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Invited Users:</p>
              {loadingInvites ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : invitedUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No users invited yet.</p>
              ) : (
                <div className="space-y-2">
                  {invitedUsers.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {invite.status === 'completed' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : invite.status === 'accepted' || invite.status === 'started' ? (
                          <Check className="h-4 w-4 text-blue-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-medium">
                            {invite.invitee?.username 
                              ? `@${invite.invitee.username}` 
                              : invite.invitee?.email || 'Unknown'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {invite.status === 'completed' ? 'Completed' : 
                             invite.status === 'started' ? 'In Progress' :
                             invite.status === 'accepted' ? 'Accepted' : 'Pending'}
                          </p>
                        </div>
                      </div>
                      {invite.status === 'invited' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setInviteToRevoke(invite);
                            setShowRevokeDialog(true);
                          }}
                          disabled={revokingInviteId === invite.id}
                        >
                          {revokingInviteId === invite.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showRevokeDialog}
        onOpenChange={(open) => {
          if (revokingInviteId === null) {
            setShowRevokeDialog(open);
          }
        }}
        title="Revoke Invitation"
        description={`Are you sure you want to revoke the invitation for ${inviteToRevoke?.invitee?.username ? `@${inviteToRevoke.invitee.username}` : inviteToRevoke?.invitee?.email || 'this user'}?`}
        confirmText={revokingInviteId !== null ? "Revoking..." : "Revoke"}
        onConfirm={handleRevoke}
      />
    </>
  );
}

