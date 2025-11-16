"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

  const fetchWagers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error } = await supabase
        .from("wagers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setWagers(data || []);
    } catch (error) {
      console.error("Error fetching wagers:", error);
      toast({
        title: "Error",
        description: "Failed to fetch wagers.",
        variant: "destructive",
      });
    }
  }, [supabase, isAdmin, toast]);

  const handleResolveWager = async (wagerId: string, winningSide: "a" | "b") => {
    if (!isAdmin) return;

    setResolving(wagerId);
    try {
      const { error } = await supabase
        .from("wagers")
        .update({ 
          winning_side: winningSide,
          status: "OPEN"
        })
        .eq("id", wagerId);

      if (error) throw error;

      await supabase.rpc("settle_wager", { wager_id_param: wagerId });

      toast({
        title: "Wager resolved",
        description: "Wager has been resolved and settled.",
      });

      fetchWagers();
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Wagers</h1>
          </div>
          <p className="text-sm text-muted-foreground">Manage all wagers in the system</p>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wagers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No wagers found
                    </TableCell>
                  </TableRow>
                ) : (
                  wagers.map((wager) => (
                    <TableRow key={wager.id}>
                      <TableCell className="font-medium max-w-xs">
                        <Link
                          href={`/wager/${wager.id}`}
                          className="hover:text-primary transition line-clamp-1"
                        >
                          {wager.title}
                        </Link>
                        {wager.is_system_generated && (
                          <span className="ml-2 text-xs text-muted-foreground">(System)</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(wager.status)}</TableCell>
                      <TableCell>
                        {formatCurrency(wager.amount, DEFAULT_CURRENCY as Currency)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground capitalize">
                          {wager.category || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {wager.deadline ? (
                          format(new Date(wager.deadline), "MMM d, HH:mm")
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(wager.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/wager/${wager.id}`}
                            className="p-1 hover:bg-muted rounded transition"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {wager.status === "OPEN" && wager.deadline && new Date(wager.deadline) <= new Date() && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleResolveWager(wager.id, "a")}
                                disabled={resolving === wager.id}
                                className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition disabled:opacity-50"
                                title="Resolve Side A"
                              >
                                {resolving === wager.id ? "..." : "A"}
                              </button>
                              <button
                                onClick={() => handleResolveWager(wager.id, "b")}
                                disabled={resolving === wager.id}
                                className="px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition disabled:opacity-50"
                                title="Resolve Side B"
                              >
                                {resolving === wager.id ? "..." : "B"}
                              </button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </main>
  );
}

