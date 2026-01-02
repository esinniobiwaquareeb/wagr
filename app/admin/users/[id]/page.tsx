"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Coins,
  TrendingUp,
  TrendingDown,
  Shield,
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  Award,
  Trophy,
  BookOpen,
  Users,
  FileText,
  CreditCard,
  Activity,
  ExternalLink,
  Ban,
  AlertCircle,
} from "lucide-react";
import { useAdmin } from "@/contexts/admin-context";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { logger } from "@/lib/logger";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface AdminUserDetailPageProps {
  params: Promise<{ id: string }>;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  reference: string | null;
  description: string | null;
  created_at: string;
}

interface Wager {
  id: string;
  title: string;
  status: string;
  amount: number;
  side_a: string;
  side_b: string;
  deadline: string | null;
  winning_side: string | null;
  created_at: string;
}

interface WagerEntry {
  id: string;
  wager_id: string;
  side: string;
  amount: number;
  created_at: string;
  _searchWagerTitle?: string;
  wager?: {
    id: string;
    title: string;
    status: string;
    winning_side: string | null;
  };
}

interface Quiz {
  id: string;
  title: string;
  status: string;
  total_cost: number;
  max_participants: number;
  total_questions: number;
  created_at: string;
}

interface QuizParticipation {
  id: string;
  quiz_id: string;
  status: string;
  score: number;
  percentage_score: number;
  rank: number | null;
  winnings: number;
  completed_at: string | null;
  _searchQuizTitle?: string;
  quiz?: {
    id: string;
    title: string;
    status: string;
  };
}

export default function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wagersCreated, setWagersCreated] = useState<Wager[]>([]);
  const [wagerEntries, setWagerEntries] = useState<WagerEntry[]>([]);
  const [quizzesCreated, setQuizzesCreated] = useState<Quiz[]>([]);
  const [quizParticipations, setQuizParticipations] = useState<QuizParticipation[]>([]);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalWinnings: 0,
    wagersCreated: 0,
    wagerEntries: 0,
    quizzesCreated: 0,
    quizParticipations: 0,
  });
  const [updating, setUpdating] = useState(false);

  const loadUserDetails = useCallback(
    async (userId: string) => {
      if (!isAdmin) return;

      setLoading(true);
      try {
        const { apiGet } = await import('@/lib/api-client');
        const response = await apiGet<{
          user: any;
          statistics: any;
          activities: {
            wagersCreated: Wager[];
            wagerEntries: WagerEntry[];
            transactions: Transaction[];
            quizzesCreated: Quiz[];
            quizParticipations: QuizParticipation[];
            withdrawals: any[];
            billPayments: any[];
          };
        }>(`/admin/users/${userId}`);

        if (!response.user) {
          throw new Error("User not found");
        }

        setUser(response.user);
        setTransactions(response.activities.transactions || []);
        setWagersCreated(response.activities.wagersCreated || []);
        
        // Transform wager entries to match expected format
        const entriesWithWager = (response.activities.wagerEntries || []).map((entry: any) => ({
          ...entry,
          wager: entry.wager || null,
          _searchWagerTitle: entry.wager?.title || '',
        }));
        setWagerEntries(entriesWithWager);
        
        setQuizzesCreated(response.activities.quizzesCreated || []);
        
        // Transform quiz participations to match expected format
        const participationsWithQuiz = (response.activities.quizParticipations || []).map((p: any) => ({
          ...p,
          quiz: p.quiz || null,
          _searchQuizTitle: p.quiz?.title || '',
        }));
        setQuizParticipations(participationsWithQuiz);

        // Use statistics from backend
        setStats({
          totalTransactions: response.statistics.totalTransactions || 0,
          totalDeposits: response.statistics.totalDeposits || 0,
          totalWithdrawals: response.statistics.totalWithdrawals || 0,
          totalWinnings: response.statistics.totalWinnings || 0,
          wagersCreated: response.statistics.wagersCreated || 0,
          wagerEntries: response.statistics.wagerEntries || 0,
          quizzesCreated: response.statistics.quizzesCreated || 0,
          quizParticipations: response.statistics.quizParticipations || 0,
        });
      } catch (error) {
        logger.error("Failed to load user details", error);
        toast({
          title: "Unable to load user details",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, toast],
  );

  const handleUpdateUser = useCallback(
    async (updates: { email_verified?: boolean; kyc_level?: number }) => {
      if (!isAdmin || !user) return;

      setUpdating(true);
      try {
        const { apiPatch } = await import('@/lib/api-client');
        const response = await apiPatch<{ message: string }>(`/admin/users/${user.id}`, updates);

        if (response) {
          toast({
            title: "User updated",
            description: "User information has been updated successfully.",
          });
          
          // Reload user details
          await loadUserDetails(user.id);
        }
      } catch (error) {
        logger.error("Failed to update user", error);
        toast({
          title: "Update failed",
          description: error instanceof Error ? error.message : "Failed to update user information.",
          variant: "destructive",
        });
      } finally {
        setUpdating(false);
      }
    },
    [isAdmin, user, toast, loadUserDetails],
  );

  useEffect(() => {
    if (isAdmin) {
      (async () => {
        const { id } = await params;
        loadUserDetails(id);
      })();
    }
  }, [isAdmin, params, loadUserDetails]);

  if (loading || !user) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading user details...</p>
        </div>
      </main>
    );
  }

  const currency = DEFAULT_CURRENCY as Currency;
  const kycBadge = (() => {
    const level = user.kyc_level || 1;
    switch (level) {
      case 1:
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-700 dark:text-gray-400">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Level 1 — Email Verified
          </Badge>
        );
      case 2:
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Level 2 — BVN/NIN Verified
          </Badge>
        );
      case 3:
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
            <Shield className="h-3 w-3 mr-1" />
            Level 3 — Fully Verified
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Level {level}
          </Badge>
        );
    }
  })();

  const transactionColumns = [
    {
      id: "type",
      header: "Type",
      cell: (row: Transaction) => (
        <Badge variant="outline" className="text-xs capitalize">
          {row.type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      cell: (row: Transaction) => {
        const isPositive = ["deposit", "transfer_in", "wager_win", "wager_refund", "quiz_win", "quiz_refund", "challenge_reward", "streak_reward"].includes(row.type);
        return (
          <span className={`font-semibold ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {isPositive ? "+" : "-"}
            {formatCurrency(Math.abs(row.amount || 0), currency)}
          </span>
        );
      },
    },
    {
      id: "description",
      header: "Description",
      cell: (row: Transaction) => (
        <span className="text-sm text-muted-foreground max-w-xs truncate block">
          {row.description || "—"}
        </span>
      ),
    },
    {
      id: "reference",
      header: "Reference",
      cell: (row: Transaction) => (
        <span className="text-xs font-mono text-muted-foreground">
          {row.reference ? row.reference.substring(0, 20) + "..." : "—"}
        </span>
      ),
    },
    {
      id: "date",
      header: "Date",
      cell: (row: Transaction) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.created_at), "MMM d, yyyy HH:mm")}
        </span>
      ),
    },
  ];

  const wagerColumns = [
    {
      id: "title",
      header: "Title",
      cell: (row: Wager) => (
        <Link
          href={`/admin/wagers/${row.id}`}
          className="font-medium hover:text-primary transition line-clamp-1"
        >
          {row.title}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row: Wager) => (
        <Badge variant="outline" className="text-xs">
          {row.status}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      cell: (row: Wager) => formatCurrency(row.amount || 0, currency),
    },
    {
      id: "sides",
      header: "Sides",
      cell: (row: Wager) => (
        <div className="text-xs">
          <div>A: {row.side_a}</div>
          <div>B: {row.side_b}</div>
        </div>
      ),
    },
    {
      id: "winning_side",
      header: "Winning Side",
      cell: (row: Wager) => (
        <span className="text-sm font-medium">
          {row.winning_side ? row.winning_side.toUpperCase() : "—"}
        </span>
      ),
    },
    {
      id: "created",
      header: "Created",
      cell: (row: Wager) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.created_at), "MMM d, yyyy")}
        </span>
      ),
    },
  ];

  const wagerEntryColumns = [
    {
      id: "wager",
      header: "Wager",
      cell: (row: WagerEntry) => (
        <Link
          href={`/admin/wagers/${row.wager_id}`}
          className="font-medium hover:text-primary transition line-clamp-1"
        >
          {row.wager?.title || `Wager ${row.wager_id.substring(0, 8)}`}
        </Link>
      ),
    },
    {
      id: "side",
      header: "Side",
      cell: (row: WagerEntry) => (
        <Badge variant="outline" className="text-xs uppercase">
          {row.side}
        </Badge>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      cell: (row: WagerEntry) => formatCurrency(row.amount || 0, currency),
    },
    {
      id: "status",
      header: "Wager Status",
      cell: (row: WagerEntry) => (
        <Badge variant="outline" className="text-xs">
          {row.wager?.status || "—"}
        </Badge>
      ),
    },
    {
      id: "result",
      header: "Result",
      cell: (row: WagerEntry) => {
        if (!row.wager?.winning_side) return <span className="text-muted-foreground">—</span>;
        const isWinner = row.wager.winning_side.toLowerCase() === row.side.toLowerCase();
        return (
          <Badge variant={isWinner ? "default" : "outline"} className={isWinner ? "bg-green-500/10 text-green-700 dark:text-green-400" : ""}>
            {isWinner ? "Won" : "Lost"}
          </Badge>
        );
      },
    },
    {
      id: "created",
      header: "Joined",
      cell: (row: WagerEntry) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.created_at), "MMM d, yyyy")}
        </span>
      ),
    },
  ];

  const quizColumns = [
    {
      id: "title",
      header: "Title",
      cell: (row: Quiz) => (
        <Link
          href={`/admin/quizzes/${row.id}`}
          className="font-medium hover:text-primary transition line-clamp-1"
        >
          {row.title}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row: Quiz) => (
        <Badge variant="outline" className="text-xs">
          {row.status}
        </Badge>
      ),
    },
    {
      id: "cost",
      header: "Total Cost",
      cell: (row: Quiz) => formatCurrency(Number(row.total_cost || 0), currency),
    },
    {
      id: "questions",
      header: "Questions",
      cell: (row: Quiz) => <span>{row.total_questions}</span>,
    },
    {
      id: "participants",
      header: "Max Participants",
      cell: (row: Quiz) => <span>{row.max_participants}</span>,
    },
    {
      id: "created",
      header: "Created",
      cell: (row: Quiz) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.created_at), "MMM d, yyyy")}
        </span>
      ),
    },
  ];

  const quizParticipationColumns = [
    {
      id: "quiz",
      header: "Quiz",
      cell: (row: QuizParticipation) => (
        <Link
          href={`/admin/quizzes/${row.quiz_id}`}
          className="font-medium hover:text-primary transition line-clamp-1"
        >
          {row.quiz?.title || `Quiz ${row.quiz_id.substring(0, 8)}`}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row: QuizParticipation) => (
        <Badge variant="outline" className="text-xs">
          {row.status}
        </Badge>
      ),
    },
    {
      id: "score",
      header: "Score",
      cell: (row: QuizParticipation) => {
        const percentageScore = typeof row.percentage_score === 'number' 
          ? row.percentage_score 
          : typeof row.percentage_score === 'string' 
            ? parseFloat(row.percentage_score) 
            : 0;
        return (
          <div className="flex flex-col">
            <span className="font-semibold">{row.score || 0} points</span>
            <span className="text-xs text-muted-foreground">
              {!isNaN(percentageScore) ? percentageScore.toFixed(1) : '0.0'}%
            </span>
          </div>
        );
      },
    },
    {
      id: "rank",
      header: "Rank",
      cell: (row: QuizParticipation) => (
        row.rank ? (
          <div className="flex items-center gap-1">
            <Trophy className={`h-4 w-4 ${row.rank === 1 ? 'text-yellow-500' : row.rank === 2 ? 'text-gray-400' : row.rank === 3 ? 'text-orange-600' : 'text-muted-foreground'}`} />
            <span className="font-semibold">#{row.rank}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )
      ),
    },
    {
      id: "winnings",
      header: "Winnings",
      cell: (row: QuizParticipation) => (
        <span className="font-semibold text-green-600 dark:text-green-400">
          {formatCurrency(Number(row.winnings || 0), currency)}
        </span>
      ),
    },
    {
      id: "completed",
      header: "Completed",
      cell: (row: QuizParticipation) => (
        <span className="text-sm text-muted-foreground">
          {row.completed_at ? format(new Date(row.completed_at), "MMM d, yyyy") : "—"}
        </span>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-2xl font-bold">User Details</h1>
          </div>
        </div>

        {/* User Profile Card - Reorganized */}
        <Card className="border border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar and Basic Info */}
            <div className="flex items-start gap-4 pb-4 border-b border-border/50">
              <div className="flex-shrink-0">
                {user.avatar_url ? (
                  <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-border">
                    <Image
                      src={user.avatar_url}
                      alt={user.username || user.email || "User"}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold truncate">{user.username || "No username"}</h2>
                  {user.is_admin && (
                    <Badge variant="outline" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                  {user.is_suspended ? (
                    <Badge variant="destructive" className="text-xs">
                      <Ban className="h-3 w-3 mr-1" />
                      Suspended
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 truncate">{user.email || "—"}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Member since {user.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Balance</p>
                <p className="text-xl font-bold">{formatCurrency(user.balance || 0, currency)}</p>
              </div>
            </div>

            {/* Verification & KYC Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email Verification */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Email Verification</span>
                  </div>
                  {user.email_verified ? (
                    <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 dark:text-green-400">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      <XCircle className="h-3 w-3 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={user.email_verified || false}
                    onCheckedChange={(checked) => handleUpdateUser({ email_verified: checked })}
                    disabled={updating}
                  />
                  <span className="text-xs text-muted-foreground">
                    {updating ? "Updating..." : user.email_verified ? "Email is verified" : "Toggle to verify email"}
                  </span>
                  {updating && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
              </div>

              {/* KYC Level */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">KYC Level</span>
                  </div>
                  {kycBadge}
                </div>
                <Select
                  value={String(user.kyc_level || 1)}
                  onValueChange={(value) => handleUpdateUser({ kyc_level: parseInt(value) })}
                  disabled={updating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select KYC Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Level 1 — Email Verified</SelectItem>
                    <SelectItem value="2">Level 2 — BVN/NIN Verified</SelectItem>
                    <SelectItem value="3">Level 3 — Fully Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Suspension Details */}
            {user.is_suspended && user.suspension_reason && (
              <div className="pt-3 border-t border-border/50">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-destructive mb-1">Suspension Details</p>
                    <p className="text-sm text-foreground">{user.suspension_reason}</p>
                    {user.suspended_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Suspended on: {format(new Date(user.suspended_at), "MMM d, yyyy 'at' HH:mm")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics Cards - Compact */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Transactions</h3>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                <Activity className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight">{stats.totalTransactions.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Deposits</h3>
              <div className="h-6 w-6 rounded-md bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors flex-shrink-0">
                <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight text-green-600 dark:text-green-400 truncate">
              {formatCurrency(stats.totalDeposits, currency)}
            </div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Withdrawals</h3>
              <div className="h-6 w-6 rounded-md bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors flex-shrink-0">
                <TrendingDown className="h-3 w-3 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight text-red-600 dark:text-red-400 truncate">
              {formatCurrency(stats.totalWithdrawals, currency)}
            </div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Winnings</h3>
              <div className="h-6 w-6 rounded-md bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors flex-shrink-0">
                <Trophy className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight text-yellow-600 dark:text-yellow-400 truncate">
              {formatCurrency(stats.totalWinnings, currency)}
            </div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Wagers Created</h3>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                <FileText className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight">{stats.wagersCreated.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Wager Entries</h3>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                <Users className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight">{stats.wagerEntries.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Quizzes Created</h3>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                <BookOpen className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight">{stats.quizzesCreated.toLocaleString()}</div>
          </div>

          <div className="flex flex-col justify-between p-2.5 rounded-lg border border-border/80 hover:border-primary/50 hover:shadow-md transition-all duration-200 group">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[11px] font-medium text-muted-foreground leading-tight">Quiz Participations</h3>
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                <Award className="h-3 w-3 text-primary" />
              </div>
            </div>
            <div className="text-base font-bold leading-tight">{stats.quizParticipations.toLocaleString()}</div>
          </div>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="transactions">
              <CreditCard className="h-4 w-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="wagers-created">
              <FileText className="h-4 w-4 mr-2" />
              Wagers Created
            </TabsTrigger>
            <TabsTrigger value="wager-entries">
              <Users className="h-4 w-4 mr-2" />
              Wager Entries
            </TabsTrigger>
            <TabsTrigger value="quizzes-created">
              <BookOpen className="h-4 w-4 mr-2" />
              Quizzes Created
            </TabsTrigger>
            <TabsTrigger value="quiz-participations">
              <Award className="h-4 w-4 mr-2" />
              Quiz Participations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transactions ({transactions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transactions found.</p>
                ) : (
                  <DataTable
                    data={transactions}
                    columns={transactionColumns as any}
                    searchable
                    searchPlaceholder="Search by type or description..."
                    searchKeys={["type", "description", "reference"]}
                    pageSize={20}
                    pagination
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wagers-created">
            <Card>
              <CardHeader>
                <CardTitle>Wagers Created ({wagersCreated.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {wagersCreated.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No wagers created.</p>
                ) : (
                  <DataTable
                    data={wagersCreated}
                    columns={wagerColumns as any}
                    searchable
                    searchPlaceholder="Search by title..."
                    searchKeys={["title"]}
                    pageSize={20}
                    pagination
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wager-entries">
            <Card>
              <CardHeader>
                <CardTitle>Wager Entries ({wagerEntries.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {wagerEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No wager entries found.</p>
                ) : (
                  <DataTable
                    data={wagerEntries}
                    columns={wagerEntryColumns as any}
                    searchable
                    searchPlaceholder="Search by wager title..."
                    searchKeys={["_searchWagerTitle"]}
                    pageSize={20}
                    pagination
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quizzes-created">
            <Card>
              <CardHeader>
                <CardTitle>Quizzes Created ({quizzesCreated.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {quizzesCreated.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No quizzes created.</p>
                ) : (
                  <DataTable
                    data={quizzesCreated}
                    columns={quizColumns as any}
                    searchable
                    searchPlaceholder="Search by title..."
                    searchKeys={["title"]}
                    pageSize={20}
                    pagination
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quiz-participations">
            <Card>
              <CardHeader>
                <CardTitle>Quiz Participations ({quizParticipations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {quizParticipations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No quiz participations found.</p>
                ) : (
                  <DataTable
                    data={quizParticipations}
                    columns={quizParticipationColumns as any}
                    searchable
                    searchPlaceholder="Search by quiz title..."
                    searchKeys={["_searchQuizTitle"]}
                    pageSize={20}
                    pagination
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

