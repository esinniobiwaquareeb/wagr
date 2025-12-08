"use client";

import { useState, useEffect } from "react";
import { X, Users, Plus, Trash2, Edit2, User, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";

interface TeamMember {
  user_id: string;
  profiles?: {
    id: string;
    username: string;
    email: string;
    avatar_url?: string;
  };
}

interface Team {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  team_members?: TeamMember[];
}

interface TeamManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTeamSelect?: (teamId: string) => void;
}

export function TeamManagerDialog({
  open,
  onOpenChange,
  onTeamSelect,
}: TeamManagerDialogProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; email: string }>>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const { toast } = useToast();
  const debouncedSearch = useDebounce(memberSearch, 300);

  useEffect(() => {
    if (open) {
      loadTeams();
    }
  }, [open]);

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      searchUsers(debouncedSearch);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch]);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/teams');
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      }
    } catch (error) {
      toast({
        title: "Failed to load teams",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    try {
      const response = await fetch(`/api/wallet/search-users?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a team name",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || null,
          memberIds: selectedMembers,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Team created!",
          description: `"${data.team.name}" has been created successfully`,
        });
        setTeamName("");
        setTeamDescription("");
        setSelectedMembers([]);
        setShowCreateForm(false);
        loadTeams();
      } else {
        throw new Error(data.error || 'Failed to create team');
      }
    } catch (error) {
      toast({
        title: "Failed to create team",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;

    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Team deleted",
          description: "Team has been deleted successfully",
        });
        loadTeams();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete team');
      }
    } catch (error) {
      toast({
        title: "Failed to delete team",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      });
    }
  };

  const addMember = (userId: string) => {
    if (!selectedMembers.includes(userId)) {
      setSelectedMembers([...selectedMembers, userId]);
      setMemberSearch("");
      setSearchResults([]);
    }
  };

  const removeMember = (userId: string) => {
    setSelectedMembers(selectedMembers.filter(id => id !== userId));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-border">
          <div>
            <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Teams
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Create and manage teams for quick invitations
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onOpenChange(false);
              setShowCreateForm(false);
              setTeamName("");
              setTeamDescription("");
              setSelectedMembers([]);
            }}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Create Team Button */}
          {!showCreateForm && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Team
            </Button>
          )}

          {/* Create Team Form */}
          {showCreateForm && (
            <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Create New Team</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTeamName("");
                    setTeamDescription("");
                    setSelectedMembers([]);
                  }}
                  className="h-6 w-6"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Team Name</label>
                <Input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., My Friends, Work Team"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description (Optional)</label>
                <Textarea
                  value={teamDescription}
                  onChange={(e) => setTeamDescription(e.target.value)}
                  placeholder="Brief description of the team"
                  rows={2}
                />
              </div>

              {/* Add Members */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Add Members</label>
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by username (@username)"
                />
                {searchResults.length > 0 && (
                  <div className="border border-border rounded-md bg-background max-h-32 overflow-y-auto">
                    {searchResults
                      .filter(user => !selectedMembers.includes(user.id))
                      .map((user) => (
                        <button
                          key={user.id}
                          onClick={() => addMember(user.id)}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2 transition-colors"
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">@{user.username}</span>
                        </button>
                      ))}
                  </div>
                )}
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedMembers.map((memberId) => {
                      // Find member details from search results or teams
                      const member = searchResults.find(u => u.id === memberId);
                      return member ? (
                        <div
                          key={memberId}
                          className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-full text-sm"
                        >
                          <User className="h-3 w-3" />
                          <span>@{member.username}</span>
                          <button
                            onClick={() => removeMember(memberId)}
                            className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <Button
                onClick={handleCreateTeam}
                disabled={creating || !teamName.trim()}
                className="w-full"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Team
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Teams List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-md">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No teams yet</p>
              <p className="text-xs mt-1">Create your first team to invite multiple people at once</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm md:text-base">{team.name}</h3>
                      {team.description && (
                        <p className="text-xs md:text-sm text-muted-foreground mt-1">{team.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {team.team_members?.length || 0} {team.team_members?.length === 1 ? 'member' : 'members'}
                      </p>
                      {team.team_members && team.team_members.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {team.team_members.slice(0, 5).map((member) => (
                            <span
                              key={member.user_id}
                              className="text-xs px-2 py-0.5 bg-muted rounded-full"
                            >
                              @{member.profiles?.username || 'user'}
                            </span>
                          ))}
                          {team.team_members.length > 5 && (
                            <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                              +{team.team_members.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {onTeamSelect && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onTeamSelect(team.id);
                            onOpenChange(false);
                          }}
                        >
                          Use
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTeam(team.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

