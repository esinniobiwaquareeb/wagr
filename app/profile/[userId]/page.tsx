"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { socialApi } from "@/lib/api-client";
import { BackButton } from "@/components/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Users, Trophy, TrendingUp, Calendar, Mail, Eye, EyeOff, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { format } from "date-fns";
import { extractErrorMessage } from "@/lib/error-extractor";
import { logger } from "@/lib/logger";
import { UserAchievementBadges } from "@/components/user-achievement-badges";
import { gamificationApi } from "@/lib/api-client";

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
      if (response?.data?.profile) {
        setProfile(response.data.profile);
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
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
          <Skeleton className="h-10 w-32 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
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
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {/* Back button integrated into header */}
        <div className="mb-4">
          <BackButton position="inline" />
        </div>

        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username || "User"}
                    className="w-20 h-20 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                    <User className="h-10 w-10 text-primary" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-2xl md:text-3xl font-bold">
                    {profile.username || profile.email || "User"}
                  </h1>
                  <UserAchievementBadges 
                    achievements={achievements} 
                    maxDisplay={4}
                    size="sm"
                  />
                  {profile.stats?.win_rate > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {profile.stats.win_rate.toFixed(1)}% Win Rate
                    </Badge>
                  )}
                </div>

                {profile.bio && (
                  <p className="text-muted-foreground mb-3">{profile.bio}</p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {format(new Date(profile.created_at), "MMM yyyy")}</span>
                  </div>
                  {profile.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      <span>{profile.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {!isOwnProfile && currentUser && (
                <Button
                  onClick={toggleFollow}
                  disabled={togglingFollow || checkingFollow}
                  variant={following ? "outline" : "default"}
                >
                  {togglingFollow ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : following ? (
                    <>
                      <UserMinus className="h-4 w-4 mr-2" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Follow
                    </>
                  )}
                </Button>
              )}

              {isOwnProfile && (
                <Button onClick={() => router.push("/profile")} variant="outline">
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Wagers Created</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{profile.stats?.total_wagers_created || 0}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Wagers Joined</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{profile.stats?.total_wagers_joined || 0}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Wins</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <div className="text-2xl font-bold">{profile.stats?.total_wins || 0}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Winnings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div className="text-2xl font-bold">
                  {formatCurrency(profile.stats?.total_winnings || 0, DEFAULT_CURRENCY)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Win Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {profile.stats?.win_rate?.toFixed(1) || "0.0"}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Followers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{profile.stats?.followers_count || 0}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Following</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-bold">{profile.stats?.following_count || 0}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        {profile.recent_activities && profile.recent_activities.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest activities from this user</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profile.recent_activities.map((activity: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{activity.title}</div>
                      {activity.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {activity.description}
                        </div>
                      )}
                      {activity.wager && (
                        <Button
                          variant="link"
                          className="p-0 h-auto mt-1 text-xs"
                          onClick={() => router.push(`/wager/${activity.wager.id}`)}
                        >
                          View Wager →
                        </Button>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(activity.created_at), "MMM d, h:mm a")}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

