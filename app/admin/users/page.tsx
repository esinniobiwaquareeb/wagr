"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { Shield, User as UserIcon, Lock, Coins, TrendingUp, Calendar } from "lucide-react";
import { DataTable } from "@/components/data-table";
import Image from "next/image";

interface User {
  id: string;
  email: string | null;
  username: string | null;
  avatar_url: string | null;
  balance: number;
  is_admin: boolean;
  two_factor_enabled?: boolean;
  created_at: string;
  wagers_created?: number;
  entries_count?: number;
  total_wagered?: number;
}

export default function AdminUsersPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);

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

  const fetchUsers = useCallback(async (force = false) => {
    if (!isAdmin) return;

    // Check cache first
    if (!force) {
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      const cached = cache.get<User[]>(CACHE_KEYS.ADMIN_USERS);
      
      if (cached) {
        setUsers(cached);
        
        // Check if cache is stale - refresh in background if needed
        const cacheEntry = cache.memoryCache.get(CACHE_KEYS.ADMIN_USERS);
        if (cacheEntry) {
          const age = Date.now() - cacheEntry.timestamp;
          const staleThreshold = CACHE_TTL.ADMIN_DATA / 2;
          
          if (age > staleThreshold) {
            fetchUsers(true).catch(() => {});
          }
        }
        return;
      }
    }

    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      const { users: usersData } = await response.json();
      setUsers(usersData || []);
      
      // Cache the results
      const { cache, CACHE_KEYS, CACHE_TTL } = await import('@/lib/cache');
      cache.set(CACHE_KEYS.ADMIN_USERS, usersData || [], CACHE_TTL.ADMIN_DATA);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users.",
        variant: "destructive",
      });
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    checkAdmin().then(() => {
      setLoading(false);
    });
  }, [checkAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

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

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="mb-2">
            <h1 className="text-2xl md:text-3xl font-bold">Users</h1>
          </div>
          <p className="text-sm text-muted-foreground">Manage all users in the system</p>
        </div>

        <DataTable
          data={users}
          columns={[
            {
              id: "user",
              header: "User",
              cell: (row) => (
                <div className="flex items-center gap-2">
                  {row.avatar_url ? (
                    <div className="relative h-8 w-8 rounded-full overflow-hidden flex-shrink-0">
                      <Image
                        src={row.avatar_url}
                        alt={row.username || row.email || "User"}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <UserIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-sm truncate">
                      {row.username || row.email || `User ${row.id.slice(0, 8)}`}
                    </span>
                    {row.username && row.email && (
                      <span className="text-xs text-muted-foreground truncate">{row.email}</span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              id: "balance",
              header: "Balance",
              accessorKey: "balance",
              cell: (row) => (
                <div className="flex items-center gap-1.5">
                  <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{formatCurrency(row.balance || 0, DEFAULT_CURRENCY as Currency)}</span>
                </div>
              ),
            },
            {
              id: "activity",
              header: "Activity",
              cell: (row) => (
                <div className="flex flex-col gap-0.5 text-xs">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span>{row.wagers_created || 0} wagers</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>{row.entries_count || 0} entries</span>
                  </div>
                  {row.total_wagered && row.total_wagered > 0 && (
                    <div className="text-muted-foreground">
                      {formatCurrency(row.total_wagered, DEFAULT_CURRENCY as Currency)} wagered
                    </div>
                  )}
                </div>
              ),
            },
            {
              id: "role",
              header: "Role & Security",
              cell: (row) => (
                <div className="flex flex-col gap-1">
                  {row.is_admin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs w-fit">
                      <Shield className="h-3 w-3" />
                      Admin
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">User</span>
                  )}
                  {row.two_factor_enabled && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-700 dark:text-green-400 text-xs w-fit">
                      <Lock className="h-3 w-3" />
                      2FA
                    </span>
                  )}
                </div>
              ),
            },
            {
              id: "created_at",
              header: "Joined",
              accessorKey: "created_at",
              cell: (row) => (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(new Date(row.created_at), "MMM d, yyyy")}</span>
                </div>
              ),
            },
          ]}
          searchable
          searchPlaceholder="Search by email, username..."
          searchKeys={["email", "username"]}
          pagination
          pageSize={20}
          sortable
          defaultSort={{ key: "created_at", direction: "desc" }}
          emptyMessage="No users found"
        />
      </div>
    </main>
  );
}

