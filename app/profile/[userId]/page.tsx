"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { socialApi } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Users, Trophy, TrendingUp, Calendar, Mail, Eye, EyeOff, UserPlus, UserMinus, Loader2, Target, Award, Sparkles, Activity, ArrowRight, Settings } from "lucide-react";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { format, formatDistanceToNow } from "date-fns";
import { extractErrorMessage } from "@/lib/error-extractor";
import { logger } from "@/lib/logger";
import { UserAchievementBadges } from "@/components/user-achievement-badges";
import { gamificationApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [checkingFollow, setCheckingFollow] = useState(true);
  const [togglingFollow, setTogglingFollow] = useState(false);
  const [achievements, setAchievements] = useState<any[]>([]);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await socialApi.getProfile(userId);
      // Handle both response formats: { data: { profile: {...} } } or { profile: {...} }
      const profileData = (response as any)?.data?.profile || (response as any)?.profile || (response as any)?.data;
      if (profileData) {
        setProfile(profileData);
      }
      
      // Fetch achievements for this user (if viewing own profile or if API supports it)
      // For now, we'll try to fetch if it's the current user
      if (currentUser?.id === userId) {
        try {
          const statsResponse = await gamificationApi.getStats();
          if (statsResponse?.data?.achievements) {
            setAchievements(statsResponse.data.achievements);
          }
        } catch (error) {
          // Silently fail - achievements are optional
          logger.debug("Failed to fetch achievements", error);
        }
      }
    } catch (error: any) {
      logger.error("Error fetching profile", error);
      const errorMessage = extractErrorMessage(error, "Failed to load profile");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast, currentUser]);

  const checkFollowStatus = useCallback(async () => {
    if (!currentUser || currentUser.id === userId) {
      setCheckingFollow(false);
      return;
    }

    try {
      const response = await socialApi.isFollowing(userId);
      if (response?.data) {
        setFollowing(response.data.is_following);
      }
    } catch (error) {
      logger.error("Error checking follow status", error);
    } finally {
      setCheckingFollow(false);
    }
  }, [currentUser, userId]);

  const toggleFollow = async () => {
    if (!currentUser) {
      toast({
        title: "Please log in",
        description: "You need to be logged in to follow users",
        variant: "destructive",
      });
      router.push("/wagers?login=true");
      return;
    }

    if (currentUser.id === userId) {
      return;
    }

    setTogglingFollow(true);
    try {
      if (following) {
        await socialApi.unfollow(userId);
        setFollowing(false);
        toast({
          title: "Unfollowed",
          description: `You've unfollowed ${profile?.username || "this user"}`,
        });
      } else {
        await socialApi.follow(userId);
        setFollowing(true);
        toast({
          title: "Following",
          description: `You're now following ${profile?.username || "this user"}`,
        });
      }
    } catch (error: any) {
      logger.error("Error toggling follow", error);
      const errorMessage = extractErrorMessage(error, "Failed to update follow status");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTogglingFollow(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    checkFollowStatus();
  }, [checkFollowStatus]);

  if (loading) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <Skeleton className="h-10 w-32 mb-6" />
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Button onClick={() => router.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </main>
    );
  }

  const isOwnProfile = currentUser?.id === userId;

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-6xl mx-auto px-3 md:px-6 py-3 md:py-6">
        {/* Back button */}

        {/* Hero Profile Section */}
        <Card className="mb-4 md:mb-6 border shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username || "User"}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                    <User className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h1 className="text-xl md:text-2xl font-bold truncate">
                        {profile.username || profile.email || "User"}
                      </h1>
                      <UserAchievementBadges 
                        achievements={achievements} 
                        maxDisplay={4}
                        size="sm"
                        className="flex-shrink-0"
                      />
                    </div>

                    {profile.bio && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {profile.bio}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Joined {format(new Date(profile.created_at), "MMM yyyy")}</span>
                      </div>
                      {profile.stats?.win_rate > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Trophy className="h-3 w-3 mr-1 text-yellow-500" />
                          {profile.stats.win_rate.toFixed(1)}% Win Rate
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isOwnProfile && currentUser && (
                      <Button
                        onClick={toggleFollow}
                        disabled={togglingFollow || checkingFollow}
                        variant={following ? "outline" : "default"}
                        size="sm"
                        className="min-w-[100px]"
                      >
                        {togglingFollow ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : following ? (
                          <>
                            <UserMinus className="h-3.5 w-3.5 mr-1.5" />
                            Unfollow
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                            Follow
                          </>
                        )}
                      </Button>
                    )}

                    {isOwnProfile && (
                      <Button 
                        onClick={() => router.push("/profile")} 
                        variant="outline"
                        size="sm"
                        className="min-w-[100px]"
                      >
                        <Settings className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid - Compact */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 md:gap-4 mb-4 md:mb-6">
          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <p className="text-xs text-muted-foreground truncate">Created</p>
              </div>
              <div className="text-xl md:text-2xl font-bold">{profile.stats?.total_wagers_created || 0}</div>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <User className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <p className="text-xs text-muted-foreground truncate">Joined</p>
              </div>
              <div className="text-xl md:text-2xl font-bold">{profile.stats?.total_wagers_joined || 0}</div>
            </CardContent>
          </Card>

          <Card className="border hover:border-yellow-500/30 transition-colors">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <p className="text-xs text-muted-foreground truncate">Wins</p>
              </div>
              <div className="text-xl md:text-2xl font-bold text-yellow-600 dark:text-yellow-500">
                {profile.stats?.total_wins || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="border hover:border-green-500/30 transition-colors">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" />
                <p className="text-xs text-muted-foreground truncate">Winnings</p>
              </div>
              <div className="text-lg md:text-xl font-bold text-green-600 dark:text-green-500 truncate">
                {formatCurrency(profile.stats?.total_winnings || 0, DEFAULT_CURRENCY)}
              </div>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Target className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-xs text-muted-foreground truncate">Win Rate</p>
              </div>
              <div className="text-xl md:text-2xl font-bold">
                {profile.stats?.win_rate?.toFixed(1) || "0.0"}%
              </div>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <p className="text-xs text-muted-foreground truncate">Followers</p>
              </div>
              <div className="text-xl md:text-2xl font-bold">{profile.stats?.followers_count || 0}</div>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <p className="text-xs text-muted-foreground truncate">Following</p>
              </div>
              <div className="text-xl md:text-2xl font-bold">{profile.stats?.following_count || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        {profile.recent_activities && profile.recent_activities.length > 0 && (
          <Card className="border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {profile.recent_activities.slice(0, 8).map((activity: any, index: number) => {
                  const getActivityIcon = () => {
                    switch (activity.type) {
                      case 'level_up':
                        return <Award className="h-3.5 w-3.5 text-yellow-500" />;
                      case 'joined':
                        return <UserPlus className="h-3.5 w-3.5 text-blue-500" />;
                      case 'wager_created':
                        return <Sparkles className="h-3.5 w-3.5 text-purple-500" />;
                      case 'wager_won':
                        return <Trophy className="h-3.5 w-3.5 text-green-500" />;
                      default:
                        return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
                    }
                  };

                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2.5 md:p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all"
                    >
                      <div className="p-1.5 rounded bg-muted/50 flex-shrink-0">
                        {getActivityIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm mb-0.5 line-clamp-1">{activity.title}</div>
                        {activity.wager && (
                          <Link
                            href={`/wager/${activity.wager.id}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                          >
                            View Wager
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State for Activities */}
        {(!profile.recent_activities || profile.recent_activities.length === 0) && (
          <Card className="border border-dashed">
            <CardContent className="p-8 text-center">
              <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No recent activity
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

