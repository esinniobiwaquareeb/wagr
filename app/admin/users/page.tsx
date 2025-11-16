"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, DEFAULT_CURRENCY, type Currency } from "@/lib/currency";
import { format } from "date-fns";
import { Shield } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface User {
  id: string;
  email: string | null;
  balance: number;
  is_admin: boolean;
  created_at: string;
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

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email ?? "N/A"}</TableCell>
                      <TableCell>
                        {formatCurrency(u.balance || 0, DEFAULT_CURRENCY as Currency)}
                      </TableCell>
                      <TableCell>
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">User</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(u.created_at), "MMM d, yyyy")}
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

