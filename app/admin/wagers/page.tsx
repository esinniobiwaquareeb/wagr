"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Eye, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";

interface Wager {
  id: string;
  title: string;
  status: string;
  amount: number;
  created_at: string;
  deadline: string | null;
  creator_id: string | null;
  is_system_generated: boolean;
  winning_side: string | null;
  category: string | null;
  side_a: string;
  side_b: string;
}

export default function AdminWagersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wagers, setWagers] = useState<Wager[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "user" | "system">("all");
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [selectedWager, setSelectedWager] = useState<{ id: string; title: string; sideA: string; sideB: string; side: "a" | "b" | null } | null>(null);

  const checkAdmin = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      router.push("/admin/login");
      return;
    }

    setUser(currentUser);

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", currentUser.id)
      .single();

    if (error || !profile?.is_admin) {
      router.push("/admin/login");
      return;
    }

    setIsAdmin(true);
  }, [supabase, router]);

  const fetchWagers = useCallback(async (force = false) => {
    if (!isAdmin) return;

    // Check cache first
    if (!force) {
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      const cached = cache.get<Wager[]>(CACHE_KEYS.ADMIN_WAGERS);
      
      if (cached) {
        setWagers(cached);
        
        // Check if cache is stale - refresh in background if needed
        const cacheEntry = cache.memoryCache.get(CACHE_KEYS.ADMIN_WAGERS);
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.ADMIN_DATA / 2;
          
          if (age > staleThreshold) {
            fetchWagers(true).catch(() => {});
          }
        }
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from("wagers")
        .select("id, title, status, amount, created_at, deadline, creator_id, is_system_generated, winning_side, category, side_a, side_b")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWagers(data || []);
      
      // Cache the results
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      cache.set(CACHE_KEYS.ADMIN_WAGERS, data || [], CACHE_TTL.ADMIN_DATA);
    } catch (error) {
      console.error("Error fetching wagers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch wagers.",
        variant: "destructive",
      });
    }
  }, [supabase, isAdmin, toast]);

  const handleResolveClick = (wager: Wager, side: "a" | "b") => {
    setSelectedWager({
      id: wager.id,
      title: wager.title,
      sideA: wager.side_a,
      sideB: wager.side_b,
      side: side,
    });
    setShowResolveDialog(true);
  };

  const handleResolveWager = async () => {
    if (!isAdmin || !selectedWager || !selectedWager.side) return;

    const wagerId = selectedWager.id;
    const winningSide = selectedWager.side;
    setShowResolveDialog(false);
    setResolving(wagerId);
    try {
      // First, set the winning side
      const { error: updateError } = await supabase
        .from("wagers")
        .update({ 
          winning_side: winningSide
        })
        .eq("id", wagerId);

      if (updateError) throw updateError;

      // Immediately settle the wager using the database function
      // Note: settle_wager returns void, so we check for errors
      try {
        const { data: settleData, error: settleError } = await supabase.rpc("settle_wager", {
          wager_id_param: wagerId
        });

        // Wait a moment for the settlement to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify the wager status was updated
        const { data: updatedWager, error: checkError } = await supabase
          .from("wagers")
          .select("status, winning_side")
          .eq("id", wagerId)
          .single();

        if (settleError) {
          // If RPC call returned an error
          const errorMessage = settleError.message || JSON.stringify(settleError) || 'Unknown error';
          console.error("Error settling wager (RPC error):", {
            error: settleError,
            message: settleError.message,
            details: settleError.details,
            hint: settleError.hint,
            code: settleError.code,
            wagerId,
            fullError: JSON.stringify(settleError, Object.getOwnPropertyNames(settleError))
          });
          
          toast({
            title: "Winning side set",
            description: `Winning side has been set. Settlement will be processed automatically. Error: ${errorMessage}`,
            variant: "default",
          });
        } else if (updatedWager?.status === "SETTLED" || updatedWager?.status === "RESOLVED") {
          // Success - wager was settled
          toast({
            title: "Wager resolved",
            description: "Wager has been resolved and settled. Winnings have been distributed to participants.",
          });
        } else if (updatedWager?.winning_side === winningSide) {
          // Winning side was set but settlement didn't complete yet
          // This might happen if the function returns early or has issues
          toast({
            title: "Winning side set",
            description: "Winning side has been set. Settlement will be processed automatically on the next cron run.",
            variant: "default",
          });
        } else {
          // Unexpected state
          console.warn("Unexpected wager state after settlement attempt:", updatedWager);
          toast({
            title: "Winning side set",
            description: "Winning side has been set. Please verify the wager status.",
            variant: "default",
          });
        }
      } catch (rpcError: any) {
        // Catch any errors from the RPC call
        console.error("Exception during settlement:", rpcError);
        toast({
          title: "Winning side set",
          description: `Winning side has been set. Settlement encountered an error: ${rpcError?.message || 'Unknown error'}. It will be processed automatically.`,
          variant: "default",
        });
      }

      // Invalidate cache and refresh
      const { cache, CACHE_KEYS } = await import('@/lib/cache');
      cache.remove(CACHE_KEYS.ADMIN_WAGERS);
      fetchWagers(true);
    } catch (error) {
      console.error("Error resolving wager:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resolve wager.",
        variant: "destructive",
      });
    } finally {
      setResolving(null);
    }
  };

  useEffect(() => {
    checkAdmin().then(() => {
      setLoading(false);
    });
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchWagers();
    }
  }, [isAdmin, fetchWagers]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-700 dark:text-green-400 text-xs">
            <Clock className="h-3 w-3" />
            Open
          </span>
        );
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 text-xs">
            <CheckCircle className="h-3 w-3" />
            Resolved
          </span>
        );
      case "SETTLED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/20 text-green-700 dark:text-green-400 text-xs">
            <CheckCircle className="h-3 w-3" />
            Settled
          </span>
        );
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs">
            <XCircle className="h-3 w-3" />
            Refunded
          </span>
        );
      default:
        return <span className="text-xs text-muted-foreground">{status}</span>;
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      {selectedWager && (
        <ConfirmDialog
          open={showResolveDialog}
          onOpenChange={setShowResolveDialog}
          title="Resolve Wager"
          description={
            <div className="space-y-3 mt-2">
              <p className="font-semibold text-foreground">{selectedWager.title}</p>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">You are about to resolve this wager with:</p>
                <div className="p-3 rounded-lg border-2 bg-primary/10 border-primary">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-primary">
                      {selectedWager.side === "a" ? "Side A" : "Side B"}:
                    </span>
                    <span className="text-sm font-medium">
                      {selectedWager.side === "a" ? selectedWager.sideA : selectedWager.sideB}
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
          }
          confirmText={selectedWager.side === "a" ? `Resolve: ${selectedWager.sideA}` : `Resolve: ${selectedWager.sideB}`}
          cancelText="Cancel"
          variant="default"
          onConfirm={handleResolveWager}
        />
      )}
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Wagers</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Manage all wagers in the system</p>
          
          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterType === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("user")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterType === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              User Created
            </button>
            <button
              onClick={() => setFilterType("system")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterType === "system"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              System Generated
            </button>
          </div>
        </div>

        <DataTable
          data={wagers.filter(w => {
            if (filterType === "user") return !w.is_system_generated;
            if (filterType === "system") return w.is_system_generated;
            return true;
          })}
          columns={[
            {
              id: "title",
              header: "Title",
              accessorKey: "title",
              cell: (row) => (
                <div className="font-medium max-w-xs">
                  <Link
                    href={`/wager/${row.id}`}
                    className="hover:text-primary transition line-clamp-1"
                  >
                    {row.title}
                  </Link>
                  {row.is_system_generated && (
                    <span className="ml-2 text-xs text-muted-foreground">(System)</span>
                  )}
                </div>
              ),
            },
            {
              id: "status",
              header: "Status",
              accessorKey: "status",
              cell: (row) => getStatusBadge(row.status),
            },
            {
              id: "amount",
              header: "Amount",
              accessorKey: "amount",
              cell: (row) => formatCurrency(row.amount, DEFAULT_CURRENCY as Currency),
            },
            {
              id: "sides",
              header: "Sides",
              cell: (row) => (
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-muted-foreground">A:</span>
                    <span className="truncate max-w-[120px]">{row.side_a}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-muted-foreground">B:</span>
                    <span className="truncate max-w-[120px]">{row.side_b}</span>
                  </div>
                </div>
              ),
            },
            {
              id: "category",
              header: "Category",
              accessorKey: "category",
              cell: (row) => (
                <span className="text-xs text-muted-foreground capitalize">
                  {row.category || "N/A"}
                </span>
              ),
            },
            {
              id: "deadline",
              header: "Deadline",
              accessorKey: "deadline",
              cell: (row) => (
                <span className="text-sm text-muted-foreground">
                  {row.deadline ? format(new Date(row.deadline), "MMM d, HH:mm") : "N/A"}
                </span>
              ),
            },
            {
              id: "created_at",
              header: "Created",
              accessorKey: "created_at",
              cell: (row) => (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(row.created_at), "MMM d, yyyy")}
                </span>
              ),
            },
            {
              id: "actions",
              header: "Actions",
              cell: (row) => (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/wager/${row.id}`}
                    className="p-1 hover:bg-muted rounded transition"
                    title="View"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  {row.status === "OPEN" && !row.is_system_generated && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleResolveClick(row, "a")}
                        disabled={resolving === row.id}
                        className="px-2 py-1 text-xs bg-green-500/10 text-green-700 dark:text-green-400 rounded hover:bg-green-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Resolve: ${row.side_a}`}
                      >
                        {resolving === row.id ? "..." : "A"}
                      </button>
                      <button
                        onClick={() => handleResolveClick(row, "b")}
                        disabled={resolving === row.id}
                        className="px-2 py-1 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Resolve: ${row.side_b}`}
                      >
                        {resolving === row.id ? "..." : "B"}
                      </button>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
          searchable
          searchPlaceholder="Search by title, category, or sides..."
          searchKeys={["title", "category", "side_a", "side_b"]}
          pagination
          pageSize={20}
          sortable
          defaultSort={{ key: "created_at", direction: "desc" }}
          emptyMessage="No wagers found"
        />
      </div>
    </main>
  );
}

