"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Clock, CheckCircle2, Users, AlertTriangle, ExternalLink, Trophy, DollarSign, TrendingUp, TrendingDown, Award } from "lucide-react";
import { useAdmin } from "@/contexts/admin-context";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

interface AdminWagerDetailPageProps {
  params: Promise<{ id: string }>;
}

interface WagerEntry {
  id: string;
  user_id: string;
  amount: number;
  side: string;
  created_at: string;
  user?: {
    id: string;
    username: string | null;
    email: string | null;
    avatar_url?: string | null;
  } | null;
  winnings?: number;
  isWinner?: boolean;
}

interface WagerTransaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  reference: string;
  description: string;
  created_at: string;
  user?: {
    id: string;
    username: string | null;
    email: string | null;
  } | null;
}

export default function AdminWagerDetailPage({ params }: AdminWagerDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { isAdmin } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [wager, setWager] = useState<any>(null);
  const [entries, setEntries] = useState<WagerEntry[]>([]);
  const [resolving, setResolving] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [selectedSide, setSelectedSide] = useState<"a" | "b" | null>(null);

  const [sideASum, setSideASum] = useState(0);
  const [sideBSum, setSideBSum] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [transactions, setTransactions] = useState<WagerTransaction[]>([]);
  const [platformFee, setPlatformFee] = useState(0);
  const [winningsPool, setWinningsPool] = useState(0);
  const [totalWinnings, setTotalWinnings] = useState(0);
  const [settledAt, setSettledAt] = useState<string | null>(null);

  const loadDetails = useCallback(
    async (wagerId: string) => {
      if (!isAdmin) return;

      setLoading(true);
      try {
        const { apiGet } = await import('@/lib/api-client');
        const response = await apiGet<{ wager: any }>(`/wagers/${wagerId}`);

        if (!response.wager) {
          throw new Error("Wager not found");
        }

        const wagerData = response.wager;
        setWager(wagerData);

        // Extract entries from wager data - entries can be an object with sideA/sideB or a flat array
        let entriesArray: any[] = [];
        
        if (wagerData.entries) {
          if (Array.isArray(wagerData.entries)) {
            // If it's already an array, use it directly
            entriesArray = wagerData.entries;
          } else if (wagerData.entries.sideA || wagerData.entries.sideB) {
            // If it's an object with sideA/sideB, combine them
            entriesArray = [
              ...(Array.isArray(wagerData.entries.sideA) ? wagerData.entries.sideA : []),
              ...(Array.isArray(wagerData.entries.sideB) ? wagerData.entries.sideB : []),
            ];
          }
        }
        
        const entriesWithFallback = entriesArray.map((entry: any) => ({
          ...entry,
          user: entry.user || null,
        }));

        setEntries(entriesWithFallback);
        setTotalParticipants(entriesWithFallback.length);
        setSideASum(
          entriesWithFallback
            .filter((entry: any) => (entry.side || "").toLowerCase() === "a")
            .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0),
        );
        setSideBSum(
          entriesWithFallback
            .filter((entry: any) => (entry.side || "").toLowerCase() === "b")
            .reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0),
        );

        // Fetch transactions related to this wager
        // Fetch wager_win and wager_refund transactions, then filter by reference
        try {
          const [winTransactionsResponse, refundTransactionsResponse] = await Promise.all([
            apiGet<{ transactions: WagerTransaction[] }>(`/admin/transactions?type=wager_win&limit=1000`).catch(() => ({ transactions: [] })),
            apiGet<{ transactions: WagerTransaction[] }>(`/admin/transactions?type=wager_refund&limit=1000`).catch(() => ({ transactions: [] })),
          ]);
          
          const allTransactions = [
            ...(winTransactionsResponse.transactions || []),
            ...(refundTransactionsResponse.transactions || []),
          ];
          
          const wagerTransactions = allTransactions.filter(
            (tx: any) => tx.reference?.includes(`wager:${wagerId}:`)
          );
          
          setTransactions(wagerTransactions);

          // Calculate settlement statistics
          const winTransactions = wagerTransactions.filter(
            (tx: any) => tx.type === 'wager_win'
          );
          const totalWinningsAmount = winTransactions.reduce(
            (sum: number, tx: any) => sum + Number(tx.amount || 0),
            0
          );
          setTotalWinnings(totalWinningsAmount);

          // Calculate platform fee and winnings pool
          const totalPoolAmount = sideASum + sideBSum;
          const feePercentage = Number(wagerData.fee_percentage || 0.05);
          const calculatedPlatformFee = totalPoolAmount * feePercentage;
          const calculatedWinningsPool = totalPoolAmount - calculatedPlatformFee;
          setPlatformFee(calculatedPlatformFee);
          setWinningsPool(calculatedWinningsPool);

          // Get settlement date from the latest transaction
          if (winTransactions.length > 0 || wagerTransactions.some((tx: any) => tx.type === 'wager_refund')) {
            const latestTx = wagerTransactions.sort(
              (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
            setSettledAt(latestTx.created_at);
          }

          // Enrich entries with winnings data
          const entriesWithWinnings = entriesWithFallback.map((entry: any) => {
            const userWinTx = winTransactions.find(
              (tx: any) => tx.user_id === entry.user_id
            );
            const isWinner = userWinTx !== undefined && wagerData.winning_side && 
                             entry.side?.toLowerCase() === wagerData.winning_side.toLowerCase();
            
            return {
              ...entry,
              winnings: userWinTx ? Number(userWinTx.amount) : 0,
              isWinner,
            };
          });

          setEntries(entriesWithWinnings);
        } catch (txError) {
          // If transactions endpoint fails, continue without transaction data
          logger.warn("Failed to load transactions", txError);
        }
      } catch (error) {
        logger.error("Failed to load wager", error);
        toast({
          title: "Unable to load wager",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [isAdmin, toast],
  );

  const handleResolveClick = (side: "a" | "b") => {
    setSelectedSide(side);
    setShowResolveDialog(true);
  };

  const handleResolveWager = async () => {
    if (!isAdmin || !wager || !selectedSide) return;

    const wagerId = wager.id;
    const winningSide = selectedSide;
    
    setShowResolveDialog(false);
    setResolving(true);
    
    try {
      // Check if deadline has passed
      if (wager.deadline) {
        const deadline = new Date(wager.deadline);
        const now = new Date();
        
        if (deadline > now) {
          toast({
            title: "Cannot settle wager",
            description: `The deadline for this wager has not passed yet. Deadline: ${format(deadline, "MMM d, yyyy 'at' HH:mm")}. You can only settle wagers after their deadline.`,
            variant: "destructive",
          });
          setResolving(false);
          setSelectedSide(null);
          return;
        }
      }

      // Resolve the wager via API (calls NestJS backend)
      const { apiPost } = await import('@/lib/api-client');
      const resolveResponse = await apiPost<{ message: string }>(`/admin/wagers/${wagerId}/resolve`, {
        winningSide: winningSide,
      });

      // Show success message from backend response
      toast({
        title: "Wager resolved",
        description: resolveResponse.message || "Wager has been resolved successfully.",
      });

      // Refresh wager details
      await loadDetails(wagerId);
    } catch (error) {
      logger.error("Error resolving wager", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resolve wager.",
        variant: "destructive",
      });
    } finally {
      setResolving(false);
      setSelectedSide(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      (async () => {
        const { id } = await params;
        loadDetails(id);
      })();
    }
  }, [isAdmin, params, loadDetails]);

  if (loading || !wager) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading wager...</p>
        </div>
      </main>
    );
  }

  const currency = (wager.currency || DEFAULT_CURRENCY) as Currency;
  const totalPool = sideASum + sideBSum;

  const statusBadge = (() => {
    switch (wager.status) {
      case "OPEN":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
            <Clock className="h-3 w-3 mr-1" />
            Open
          </Badge>
        );
      case "SETTLED":
      case "RESOLVED":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {wager.status}
          </Badge>
        );
      case "REFUNDED":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Refunded
          </Badge>
        );
      default:
        return <Badge variant="outline">{wager.status}</Badge>;
    }
  })();

  const isSettled = wager.status === "SETTLED" || wager.status === "RESOLVED";
  const winningSide = wager.winning_side?.toLowerCase();

  const participantColumns = [
    {
      id: "participant",
      header: "Participant",
      cell: (row: WagerEntry) => (
        <div className="flex flex-col text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.user?.username ? `@${row.user.username}` : row.user_id}</span>
            {isSettled && row.isWinner && (
              <Award className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          {row.user?.email && <span className="text-xs text-muted-foreground">{row.user.email}</span>}
        </div>
      ),
    },
    {
      id: "side",
      header: "Side",
      cell: (row: WagerEntry) => {
        const isWinningSide = isSettled && winningSide && row.side?.toLowerCase() === winningSide;
        return (
          <Badge 
            variant={isWinningSide ? "default" : "outline"} 
            className={`text-xs uppercase ${isWinningSide ? "bg-green-500/20 text-green-700 dark:text-green-400" : ""}`}
          >
            {row.side}
          </Badge>
        );
      },
    },
    {
      id: "amount",
      header: "Entry Amount",
      cell: (row: WagerEntry) => (
        <span className="text-sm font-semibold">{formatCurrency(row.amount || 0, currency)}</span>
      ),
    },
    ...(isSettled ? [{
      id: "winnings",
      header: "Winnings",
      cell: (row: WagerEntry) => {
        if (row.isWinner && row.winnings) {
          return (
            <div className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400">
              <TrendingUp className="h-4 w-4" />
              {formatCurrency(row.winnings, currency)}
            </div>
          );
        } else if (isSettled && !row.isWinner) {
          return (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingDown className="h-4 w-4" />
              <span>—</span>
            </div>
          );
        }
        return <span className="text-sm text-muted-foreground">—</span>;
      },
    }] : []),
    {
      id: "joined",
      header: "Joined",
      cell: (row: WagerEntry) => (
        <span className="text-xs text-muted-foreground">
          {row.created_at ? format(new Date(row.created_at), "MMM d, yyyy HH:mm") : "—"}
        </span>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <ConfirmDialog
        open={showResolveDialog && selectedSide !== null}
        onOpenChange={(open) => {
          setShowResolveDialog(open);
          if (!open) {
            setSelectedSide(null);
          }
        }}
        title="Resolve Wager"
        description={
          selectedSide ? (
            <div className="space-y-3 mt-2">
              <p className="font-semibold text-foreground">{wager.title}</p>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">You are about to resolve this wager with:</p>
                <div className="p-3 rounded-lg border-2 bg-primary/10 border-primary">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primary">
                      {selectedSide === "a" ? "Side A" : "Side B"}:
                    </span>
                    <span className="text-sm font-medium">
                      {selectedSide === "a" ? wager.side_a : wager.side_b}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>⚠️ This action will:</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>Immediately settle the wager</li>
                    <li>Distribute winnings to participants</li>
                    <li>Mark the wager as RESOLVED</li>
                    <li>This cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            ""
          )
        }
        confirmText={selectedSide ? (selectedSide === "a" ? `Resolve: ${wager.side_a}` : `Resolve: ${wager.side_b}`) : "Confirm"}
        cancelText="Cancel"
        variant="default"
        onConfirm={handleResolveWager}
      />
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
            <h1 className="text-2xl font-bold">{wager.title}</h1>
            {statusBadge}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/wager/${wager.id}`}
              className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-md border hover:bg-muted transition"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View user page
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Pool</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatCurrency(totalPool, currency)}</p>
              {isSettled && (
                <p className="text-xs text-muted-foreground mt-1">
                  {totalParticipants} participant{totalParticipants !== 1 ? 's' : ''}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Participants</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xl font-semibold">{totalParticipants}</p>
                <p className="text-xs text-muted-foreground">
                  {isSettled ? "Settled" : "Active"}
                </p>
              </div>
            </CardContent>
          </Card>
          {isSettled ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    Platform Fee
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatCurrency(platformFee, currency)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((wager.fee_percentage || 0.05) * 100).toFixed(1)}% of pool
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5" />
                    Winnings Pool
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                    {formatCurrency(winningsPool, currency)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Distributed: {formatCurrency(totalWinnings, currency)}
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Side Totals</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm flex justify-between">
                    <span>Side A</span>
                    <span className="font-medium">{formatCurrency(sideASum, currency)}</span>
                  </p>
                  <p className="text-sm flex justify-between">
                    <span>Side B</span>
                    <span className="font-medium">{formatCurrency(sideBSum, currency)}</span>
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Winning Side</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">
                    {wager.winning_side ? wager.winning_side.toUpperCase() : "Not set"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {wager.status === "OPEN" ? "Wager still active" : "Wager resolved"}
                  </p>
                  {wager.status === "OPEN" && !wager.winning_side && !wager.is_system_generated && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolveClick("a")}
                        disabled={resolving}
                        className="flex-1"
                      >
                        <Trophy className="h-3 w-3 mr-1" />
                        Side A
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolveClick("b")}
                        disabled={resolving}
                        className="flex-1"
                      >
                        <Trophy className="h-3 w-3 mr-1" />
                        Side B
                      </Button>
                    </div>
                  )}
                  {resolving && (
                    <p className="text-xs text-muted-foreground mt-2">Settling wager...</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {isSettled && (
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Settlement Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Winning Side</p>
                  <p className="font-semibold text-lg mt-1">
                    {wager.winning_side?.toUpperCase()}: {wager.winning_side?.toLowerCase() === 'a' ? wager.side_a : wager.side_b}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Winnings Distributed</p>
                  <p className="font-semibold text-lg text-green-600 dark:text-green-400 mt-1">
                    {formatCurrency(totalWinnings, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Settled At</p>
                  <p className="font-semibold mt-1">
                    {settledAt ? format(new Date(settledAt), "MMM d, yyyy 'at' HH:mm") : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Wager Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Category:</span>{" "}
                {typeof wager.category === 'object' && wager.category !== null
                  ? wager.category.label || wager.category.slug || "—"
                  : wager.category || "—"}
              </p>
              <p className="flex gap-2">
                <span className="text-muted-foreground">Sides:</span>
                <span>
                  <strong>A:</strong> {wager.side_a}
                </span>
                <span>
                  <strong>B:</strong> {wager.side_b}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Created:</span>{" "}
                {wager.created_at ? format(new Date(wager.created_at), "MMM d, yyyy HH:mm") : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Deadline:</span>{" "}
                {wager.deadline ? format(new Date(wager.deadline), "MMM d, yyyy HH:mm") : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Visibility:</span> {wager.is_public ? "Public" : "Private"}
              </p>
              <p>
                <span className="text-muted-foreground">Origin:</span>{" "}
                {wager.is_system_generated ? "System generated" : "User generated"}
              </p>
              <p>
                <span className="text-muted-foreground">Creator:</span>{" "}
                {wager.creator?.username ? `@${wager.creator.username}` : wager.creator_id || "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {wager.description || "No description provided."}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle>Participants ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No participants yet.</p>
            ) : (
              <DataTable data={entries} columns={participantColumns as any} searchable={false} pageSize={10} pagination />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

