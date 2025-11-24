"use client";

import { useState, useCallback, useEffect } from "react";
import { X, UserPlus, Users, Mail, User, Loader2, Check, XCircle, Settings } from "lucide-react";
import { TeamManagerDialog } from "@/components/team-manager-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { createClient } from "@/lib/supabase/client";
import { useMemo } from "react";

interface Team {
  id: string;
  name: string;
  description?: string;
  team_members?: Array<{
    user_id: string;
    profiles?: {
      id: string;
      username: string;
      email: string;
      avatar_url?: string;
    };
  }>;
}

interface InviteResult {
  identifier: string;
  type: 'user' | 'email';
  userId?: string;
}

interface WagerInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wagerId: string;
  wagerTitle: string;
}

export function WagerInviteDialog({
  open,
  onOpenChange,
  wagerId,
  wagerTitle,
}: WagerInviteDialogProps) {
  const [inviteInput, setInviteInput] = useState("");
  const [invites, setInvites] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; email?: string; avatar_url?: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteResults, setInviteResults] = useState<{
    invited: InviteResult[];
    notFound: string[];
    errors: Array<{ identifier: string; error: string }>;
  } | null>(null);
  const [showTeamManager, setShowTeamManager] = useState(false);
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load teams
  const loadTeams = useCallback(async () => {
    try {
      setLoadingTeams(true);
      const response = await fetch('/api/teams');
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadTeams();
    }
  }, [open, loadTeams]);

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
        
        if (cancelled) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          if (!cancelled) {
            // Handle both response formats: { success: true, data: { users: [...] } } or { users: [...] }
            const users = data.success && data.data?.users 
              ? data.data.users 
              : data.users || data.data?.users || [];
            
            console.log('Search results for:', debouncedSearch, 'Found:', users.length, 'users');
            setSearchResults(users);
          }
        } else {
          if (!cancelled) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Search API error:', response.status, errorData);
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
      addInvite(inviteInput.trim());
    }
  };

  const handleTeamSelect = (teamId: string) => {
    if (selectedTeamId === teamId) {
      // Deselect team - remove team members from invites
      setSelectedTeamId(null);
      const team = teams.find((t) => t.id === teamId);
      if (team?.team_members) {
        const teamMemberIdentifiers = team.team_members
          .map((m) => {
            if (m.profiles?.username) return `@${m.profiles.username}`;
            return m.profiles?.email?.toLowerCase() || '';
          })
          .filter(Boolean);
        setInvites(invites.filter(inv => !teamMemberIdentifiers.includes(inv.toLowerCase())));
      }
    } else {
      // Select team - add team members to invites
      const previousTeamId = selectedTeamId;
      setSelectedTeamId(teamId);
      
      // Remove previous team members if any
      if (previousTeamId) {
        const prevTeam = teams.find((t) => t.id === previousTeamId);
        if (prevTeam?.team_members) {
          const prevTeamMemberIdentifiers = prevTeam.team_members
            .map((m) => {
              if (m.profiles?.username) return `@${m.profiles.username}`;
              return m.profiles?.email?.toLowerCase() || '';
            })
            .filter(Boolean);
          setInvites(invites.filter(inv => !prevTeamMemberIdentifiers.includes(inv.toLowerCase())));
        }
      }
      
      // Add new team members
      const team = teams.find((t) => t.id === teamId);
      if (team?.team_members) {
        const teamMemberIdentifiers = team.team_members
          .map((m) => {
            if (m.profiles?.username) return `@${m.profiles.username}`;
            return m.profiles?.email?.toLowerCase() || '';
          })
          .filter(Boolean) as string[];
        setInvites([...new Set([...invites, ...teamMemberIdentifiers])]);
      }
    }
  };

  const handleInvite = async () => {
    if (invites.length === 0 && !selectedTeamId) {
      toast({
        title: "No invites",
        description: "Please add at least one person to invite",
        variant: "destructive",
      });
      return;
    }

    try {
      setInviting(true);
      setInviteResults(null);

      const response = await fetch(`/api/wagers/${wagerId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invites,
          teamId: selectedTeamId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Invite response:', data);
        setInviteResults(data.results || data.data?.results);
        const invitedCount = data.results?.invited?.length || data.data?.results?.invited?.length || 0;
        toast({
          title: "Invitations sent!",
          description: data.message || data.data?.message || `Successfully invited ${invitedCount} ${invitedCount === 1 ? 'person' : 'people'}`,
        });
        
        // Reset form after delay
        setTimeout(() => {
          setInvites([]);
          setSelectedTeamId(null);
          setInviteInput("");
          setInviteResults(null);
        }, 2000);
      } else {
        throw new Error(data.error || 'Failed to send invitations');
      }
    } catch (error) {
      toast({
        title: "Failed to send invitations",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
          <div>
            <h2 className="text-lg md:text-xl font-bold">Invite to Wager</h2>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-1">{wagerTitle}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onOpenChange(false);
              setInvites([]);
              setSelectedTeamId(null);
              setInviteInput("");
              setInviteResults(null);
            }}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Invite Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Invite by username or email</label>
            <div className="relative">
              <Input
                value={inviteInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setInviteInput(value);
                  setSearchQuery(value);
                }}
                onKeyDown={handleInviteInputKeyDown}
                placeholder="Enter username (@username) or email"
                className="pr-10"
                disabled={inviting}
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border border-border rounded-md bg-background max-h-48 overflow-y-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => addInvite(`@${user.username}`)}
                    className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 transition-colors"
                  >
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">@{user.username}</span>
                    {user.email && (
                      <span className="text-xs text-muted-foreground ml-auto truncate max-w-[150px]">
                        {user.email}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Invites */}
          {invites.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Invited ({invites.length})</label>
              <div className="flex flex-wrap gap-2">
                {invites.map((invite) => (
                  <div
                    key={invite}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                  >
                    {invite.includes('@') ? (
                      <Mail className="h-3.5 w-3.5" />
                    ) : (
                      <User className="h-3.5 w-3.5" />
                    )}
                    <span>{invite.startsWith('@') ? invite : invite}</span>
                    <button
                      onClick={() => removeInvite(invite)}
                      className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teams Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Invite Team
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTeamManager(true)}
                className="h-7 text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                Manage
              </Button>
            </div>
            {loadingTeams ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : teams.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-md">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No teams yet</p>
                <p className="text-xs mt-1">Create a team to invite multiple people at once</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => handleTeamSelect(team.id)}
                    className={`w-full p-3 text-left border rounded-md transition-colors ${
                      selectedTeamId === team.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{team.name}</p>
                        {team.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{team.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {team.team_members?.length || 0} {team.team_members?.length === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                      {selectedTeamId === team.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          {inviteResults && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-md">
              <p className="text-sm font-medium">Invitation Results</p>
              {inviteResults.invited.length > 0 && (
                <div className="text-sm text-green-600 dark:text-green-400">
                  ✓ {inviteResults.invited.length} {inviteResults.invited.length === 1 ? 'invitation sent' : 'invitations sent'}
                </div>
              )}
              {inviteResults.notFound.length > 0 && (
                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                  ⚠ {inviteResults.notFound.length} {inviteResults.notFound.length === 1 ? 'user not found' : 'users not found'}
                </div>
              )}
              {inviteResults.errors.length > 0 && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  ✗ {inviteResults.errors.length} {inviteResults.errors.length === 1 ? 'error' : 'errors'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 md:p-6 border-t border-border">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setInvites([]);
              setSelectedTeamId(null);
              setInviteInput("");
              setInviteResults(null);
            }}
            disabled={inviting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={inviting || (invites.length === 0 && !selectedTeamId)}
          >
            {inviting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Send Invitations ({invites.length + (selectedTeamId ? teams.find(t => t.id === selectedTeamId)?.team_members?.length || 0 : 0)})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Team Manager Dialog */}
      <TeamManagerDialog
        open={showTeamManager}
        onOpenChange={(open) => {
          setShowTeamManager(open);
          if (!open) {
            loadTeams(); // Reload teams when manager closes
          }
        }}
        onTeamSelect={(teamId) => {
          setSelectedTeamId(teamId);
          const team = teams.find((t) => t.id === teamId);
          if (team?.team_members) {
            const teamMemberIds = team.team_members
              .map((m) => m.profiles?.username || m.profiles?.email)
              .filter(Boolean) as string[];
            setInvites([...new Set([...invites, ...teamMemberIds])]);
          }
        }}
      />
    </div>
  );
}

