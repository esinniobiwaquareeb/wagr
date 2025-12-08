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
import { getCurrentUser } from "@/lib/auth/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

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
  const [isAdmin, setIsAdmin] = useState(false);
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
        console.error("Failed to load user details", error);
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

  useEffect(() => {
    (async () => {
      const { id } = await params;
      try {
        const currentUser = await getCurrentUser(true);
        if (!currentUser || !currentUser.is_admin) {
          router.replace("/admin/login");
          return;
        }
        setIsAdmin(true);
        loadUserDetails(id);
      } catch (error) {
        router.replace("/admin/login");
      }
    })();
  }, [params, router, loadUserDetails]);

  if (!isAdmin) {
    return null;
  }

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
        const isPositive = ["deposit", "transfer_in", "wager_win", "wager_refund", "quiz_win", "quiz_refund"].includes(row.type);
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
      cell: (row: QuizParticipation) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.score || 0} points</span>
          <span className="text-xs text-muted-foreground">{row.percentage_score?.toFixed(1) || 0}%</span>
        </div>
      ),
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

        {/* User Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-shrink-0">
                {user.avatar_url ? (
                  <div className="relative h-24 w-24 rounded-full overflow-hidden">
                    <Image
                      src={user.avatar_url}
                      alt={user.username || user.email || "User"}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Username</p>
                  <p className="font-semibold">{user.username || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{user.email || "—"}</p>
                    {user.email_verified ? (
                      <Badge variant="outline" className="text-xs">
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
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="font-semibold text-lg">{formatCurrency(user.balance || 0, currency)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">KYC Level</p>
                  <div className="mt-1">{kycBadge}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Account Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {user.is_suspended ? (
                      <Badge variant="destructive">
                        <Ban className="h-3 w-3 mr-1" />
                        Suspended
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                    {user.is_admin && (
                      <Badge variant="outline">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                  <p className="font-semibold">
                    {user.created_at ? format(new Date(user.created_at), "MMM d, yyyy") : "—"}
                  </p>
                </div>
                {user.is_suspended && user.suspension_reason && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground">Suspension Reason</p>
                    <p className="text-sm">{user.suspension_reason}</p>
                    {user.suspended_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Suspended on: {format(new Date(user.suspended_at), "MMM d, yyyy HH:mm")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-semibold">{stats.totalTransactions}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <p className="text-2xl font-semibold text-green-600">
                  {formatCurrency(stats.totalDeposits, currency)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Withdrawals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <p className="text-2xl font-semibold text-red-600">
                  {formatCurrency(stats.totalWithdrawals, currency)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Winnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-600" />
                <p className="text-2xl font-semibold text-yellow-600">
                  {formatCurrency(stats.totalWinnings, currency)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Wagers Created</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-semibold">{stats.wagersCreated}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Wager Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-semibold">{stats.wagerEntries}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Quizzes Created</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-semibold">{stats.quizzesCreated}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Quiz Participations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                <p className="text-2xl font-semibold">{stats.quizParticipations}</p>
              </div>
            </CardContent>
          </Card>
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

