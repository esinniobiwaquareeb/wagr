"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  ExternalLink,
  User,
  Mail,
  Calendar,
  CreditCard,
  FileText,
  Activity,
  Coins,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/auth/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface AdminTransactionDetailPageProps {
  params: Promise<{ id: string }>;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  reference: string | null;
  description: string | null;
  created_at: string;
  user_id: string;
  wager_id: string | null;
  profiles?: {
    id: string;
    username: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

export default function AdminTransactionDetailPage({ params }: AdminTransactionDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const loadTransactionDetails = useCallback(
    async (transactionId: string) => {
      if (!isAdmin) return;

      setLoading(true);
      try {
        // Fetch transaction with user profile
        const { data: transactionData, error: transactionError } = await supabase
          .from("transactions")
          .select(`
            *,
            profiles:user_id (
              id,
              username,
              email,
              avatar_url
            )
          `)
          .eq("id", transactionId)
          .single();

        if (transactionError || !transactionData) {
          throw transactionError || new Error("Transaction not found");
        }

        // Transform the data - Supabase returns profiles as an array
        const transformedTransaction = {
          ...transactionData,
          profiles: Array.isArray(transactionData.profiles)
            ? transactionData.profiles[0]
            : transactionData.profiles || null,
        };

        setTransaction(transformedTransaction);
      } catch (error: any) {
        console.error("Error loading transaction:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load transaction details.",
          variant: "destructive",
        });
        router.push("/admin/transactions");
      } finally {
        setLoading(false);
      }
    },
    [supabase, isAdmin, toast, router]
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
        loadTransactionDetails(id);
      } catch (error) {
        router.replace("/admin/login");
      }
    })();
  }, [params, router, loadTransactionDetails]);

  const copyReference = async (reference: string) => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
      toast({
        title: "Copied",
        description: "Reference copied to clipboard",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  const isPositive = (type: string) => {
    return ["deposit", "wager_win", "wager_refund", "quiz_refund", "transfer_in"].includes(type);
  };

  const parseReference = (reference: string | null, type: string) => {
    if (!reference) {
      return { display: "N/A", link: null, linkText: null, fullReference: null };
    }

    // Transfer references
    if (reference.startsWith("transfer_")) {
      return {
        display: "Transfer",
        link: null,
        linkText: null,
        fullReference: reference,
      };
    }

    // Bill payment references
    if (reference.startsWith("bill_")) {
      const billType = reference.includes("_airtime_") ? "Airtime" : "Data";
      return {
        display: `${billType} Purchase`,
        link: null,
        linkText: null,
        fullReference: reference,
      };
    }

    // Deposit references
    if (reference.startsWith("wagr_")) {
      return {
        display: "Deposit",
        link: null,
        linkText: null,
        fullReference: reference,
      };
    }

    // Check if it's a UUID (wager or quiz reference)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(reference)) {
      if (type.includes("wager") || type === "wager_create" || type === "wager_join" || type === "wager_win" || type === "wager_refund") {
        return {
          display: reference.substring(0, 8) + "...",
          link: `/admin/wagers/${reference}`,
          linkText: "View Wager",
          fullReference: reference,
        };
      } else if (type.includes("quiz") || type === "quiz_creation" || type === "quiz_refund") {
        return {
          display: reference.substring(0, 8) + "...",
          link: `/admin/quizzes/${reference}`,
          linkText: "View Quiz",
          fullReference: reference,
        };
      }
      return {
        display: reference.substring(0, 8) + "...",
        link: `/admin/wagers/${reference}`,
        linkText: "View",
        fullReference: reference,
      };
    }

    return {
      display: reference.length > 30 ? reference.substring(0, 30) + "..." : reference,
      link: null,
      linkText: null,
      fullReference: reference,
    };
  };

  if (!isAdmin) {
    return null;
  }

  if (loading || !transaction) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading transaction details...</p>
        </div>
      </main>
    );
  }

  const currency = DEFAULT_CURRENCY as Currency;
  const refInfo = parseReference(transaction.reference, transaction.type);
  const profile = transaction.profiles;

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin/transactions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Transaction Details</h1>
            <p className="text-sm text-muted-foreground">View detailed information about this transaction</p>
          </div>
        </div>

        {/* Transaction Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Transaction Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Amount */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                <div className="flex items-center gap-2">
                  {isPositive(transaction.type) ? (
                    <ArrowUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <ArrowDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                  <span
                    className={`text-2xl font-bold ${
                      isPositive(transaction.type)
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {isPositive(transaction.type) ? "+" : "-"}
                    {formatCurrency(Math.abs(transaction.amount), currency)}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="text-sm">
                {getTransactionTypeLabel(transaction.type)}
              </Badge>
            </div>

            {/* Transaction Details Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Transaction ID</p>
                <p className="text-sm font-mono">{transaction.id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Date & Time</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">
                    {format(new Date(transaction.created_at), "MMM d, yyyy 'at' HH:mm:ss")}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <Badge variant="outline">{getTransactionTypeLabel(transaction.type)}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="text-sm">{transaction.description || "N/A"}</p>
              </div>
            </div>

            {/* Reference */}
            <div className="space-y-2 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">Reference</p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <div className="flex-1 min-w-0">
                  {refInfo.link ? (
                    <Link
                      href={refInfo.link}
                      className="flex items-center gap-2 text-sm font-mono text-primary hover:underline"
                    >
                      <span>{refInfo.display}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </Link>
                  ) : (
                    <p className="text-sm font-mono truncate">{refInfo.display}</p>
                  )}
                  {refInfo.linkText && (
                    <p className="text-xs text-muted-foreground mt-1">{refInfo.linkText}</p>
                  )}
                </div>
                {refInfo.fullReference && (
                  <button
                    onClick={() => copyReference(refInfo.fullReference!)}
                    className="p-2 hover:bg-muted rounded transition-colors flex-shrink-0"
                    title="Copy reference"
                  >
                    {copiedRef ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              User Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile ? (
              <Link
                href={`/admin/users/${profile.id}`}
                className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                {profile.avatar_url ? (
                  <div className="relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={profile.avatar_url}
                      alt={profile.username || profile.email || "User"}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold group-hover:text-primary transition">
                      {profile.username || profile.email || `User ${profile.id.substring(0, 8)}`}
                    </p>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
                  </div>
                  {profile.username && profile.email && (
                    <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{profile.id}</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">User {transaction.user_id.substring(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{transaction.user_id}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Related Information */}
        {transaction.wager_id && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Related Wager
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/admin/wagers/${transaction.wager_id}`}
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
              >
                <span className="text-sm font-mono">{transaction.wager_id.substring(0, 8)}...</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition" />
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

