"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/auth/client";
import { apiGet, apiPatch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { Loader2, ShieldCheck, ShieldAlert, Clock, Calendar, Eye } from "lucide-react";
import type { KycSubmissionRecord } from "@/lib/kyc/types";

interface KycUser {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url?: string | null;
  kyc_level?: number | null;
  kyc_level_label?: string | null;
}

interface KycSubmission extends KycSubmissionRecord {
  user: KycUser | null;
  payload?: Record<string, any>;
}

interface KycSummaryCounts {
  pending: number;
  verified: number;
  rejected: number;
}

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

export default function AdminKycPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [summary, setSummary] = useState<KycSummaryCounts>({ pending: 0, verified: 0, rejected: 0 });
  const [activeFilter, setActiveFilter] = useState('pending');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState<'verified' | 'rejected'>('verified');
  const [reviewReason, setReviewReason] = useState('');
  const [activeSubmission, setActiveSubmission] = useState<KycSubmission | null>(null);
  const [processingDecision, setProcessingDecision] = useState(false);

  const checkAdmin = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser(true);
      if (!currentUser || !currentUser.is_admin) {
        router.replace("/admin/login");
        return false;
      }
      setIsAdmin(true);
      return true;
    } catch (error) {
      console.error("Error checking admin status:", error);
      router.replace("/admin/login");
      return false;
    }
  }, [router]);

  const fetchSubmissions = useCallback(
    async (status = activeFilter) => {
      if (!isAdmin) return;
      setLoading(true);
      try {
        const response = await apiGet<{ submissions: KycSubmission[]; summary: KycSummaryCounts }>(
          `/admin/kyc?status=${status}`,
        );
        setSubmissions(response.submissions || []);
        setSummary(response.summary || { pending: 0, verified: 0, rejected: 0 });
      } catch (error) {
        console.error("Error fetching KYC submissions:", error);
        toast({
          title: "Error",
          description: "Failed to fetch KYC submissions.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [activeFilter, isAdmin, toast],
  );

  useEffect(() => {
    checkAdmin().then((allowed) => {
      if (allowed) {
        fetchSubmissions();
      }
    });
  }, [checkAdmin, fetchSubmissions]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    fetchSubmissions(filter);
  };

  const openReviewDialog = (submission: KycSubmission, mode: 'verified' | 'rejected') => {
    setActiveSubmission(submission);
    setReviewMode(mode);
    setReviewReason('');
    setReviewDialogOpen(true);
  };

  const closeDialog = () => {
    setReviewDialogOpen(false);
    setActiveSubmission(null);
    setReviewReason('');
    setProcessingDecision(false);
  };

  const handleDecision = async () => {
    if (!activeSubmission) return;
    if (reviewMode === 'rejected' && !reviewReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }

    setProcessingDecision(true);
    try {
      const response = await apiPatch<{ submission: KycSubmission; message: string }>(
        `/admin/kyc/${activeSubmission.id}`,
        {
          status: reviewMode,
          reason: reviewReason.trim() || undefined,
        },
      );
      toast({
        title: "Success",
        description: response.message,
      });
      closeDialog();
      fetchSubmissions(activeFilter);
    } catch (error: any) {
      console.error("Error updating KYC submission:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to update submission.",
        variant: "destructive",
      });
      setProcessingDecision(false);
    }
  };

  const stats = useMemo(
    () => [
      { label: "Pending Reviews", value: summary.pending, tone: "text-amber-600", icon: Clock },
      { label: "Verified", value: summary.verified, tone: "text-green-600", icon: ShieldCheck },
      { label: "Rejected", value: summary.rejected, tone: "text-red-600", icon: ShieldAlert },
    ],
    [summary],
  );

  const columns = useMemo(
    () => [
      {
        id: "user",
        header: "User",
        cell: (row: KycSubmission) => (
          <div className="flex items-center gap-3 min-w-[200px]">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={row.user?.avatar_url || ''} alt={row.user?.username || ''} />
              <AvatarFallback>
                {row.user?.username?.slice(0, 2)?.toUpperCase() ||
                  row.user?.email?.slice(0, 2)?.toUpperCase() ||
                  'US'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {row.user?.username || row.user?.email || 'Unknown user'}
              </p>
              {row.user?.email && row.user?.username && (
                <p className="text-xs text-muted-foreground truncate">{row.user.email}</p>
              )}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                <ShieldCheck className="h-3 w-3" />
                <span>Current: {row.user?.kyc_level_label || 'Level 1'}</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: "level",
        header: "Level Requested",
        cell: (row: KycSubmission) => (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold">
              Level {row.level_requested}
            </Badge>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (row: KycSubmission) => (
          <Badge
            variant={
              row.status === 'verified'
                ? 'default'
                : row.status === 'rejected'
                ? 'destructive'
                : 'secondary'
            }
            className="font-medium"
          >
            {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
          </Badge>
        ),
      },
      {
        id: "submitted",
        header: "Submitted",
        cell: (row: KycSubmission) => (
          <div className="text-sm text-muted-foreground min-w-[140px]">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              <span>{format(new Date(row.created_at), "MMM d, yyyy")}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
            </div>
          </div>
        ),
      },
      {
        id: "reviewer",
        header: "Reviewed By",
        cell: (row: KycSubmission) => {
          if (row.status === 'pending') {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <div className="text-sm text-muted-foreground">
              {row.reviewed_at ? (
                <>
                  <div>{format(new Date(row.reviewed_at), "MMM d, yyyy")}</div>
                  <div className="text-xs mt-0.5">
                    {formatDistanceToNow(new Date(row.reviewed_at), { addSuffix: true })}
                  </div>
                </>
              ) : (
                '—'
              )}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: (row: KycSubmission) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openReviewDialog(row, row.status === 'pending' ? 'verified' : 'rejected')}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            {row.status === 'pending' && (
              <>
                <Button size="sm" onClick={() => openReviewDialog(row, 'verified')}>
                  <ShieldCheck className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openReviewDialog(row, 'rejected')}
                >
                  <ShieldAlert className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">KYC Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Oversee all identity submissions, approve verified accounts, and keep the platform compliant.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border border-border/80">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                  <Icon className={`h-4 w-4 ${stat.tone}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-semibold ${stat.tone}`}>{stat.value.toLocaleString()}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs value={activeFilter} onValueChange={handleFilterChange} className="w-full">
          <TabsList className="flex flex-wrap gap-2 justify-start">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="px-3 py-1.5 text-xs md:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card className="border border-border/80">
            <CardContent className="p-0">
              <DataTable
                data={submissions.map(sub => ({
                  ...sub,
                  _searchUsername: sub.user?.username || '',
                  _searchEmail: sub.user?.email || '',
                  _searchName: `${sub.user?.username || ''} ${sub.user?.email || ''}`.trim(),
                }))}
                columns={columns}
                searchable={true}
                searchPlaceholder="Search by name, username, or email..."
                searchKeys={['_searchName', '_searchUsername', '_searchEmail', 'status', 'level_requested']}
                pagination={true}
                pageSize={10}
                emptyMessage="No KYC submissions found for this filter."
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={reviewDialogOpen} onOpenChange={(open) => !processingDecision && setReviewDialogOpen(open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewMode === 'verified' ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  Approve KYC Verification
                </>
              ) : (
                <>
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                  Reject KYC Verification
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Review the submitted information carefully before making your decision.
            </DialogDescription>
          </DialogHeader>

          {activeSubmission && (
            <div className="space-y-6">
              {/* User Information */}
              <Card className="border border-border/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">User Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={activeSubmission.user?.avatar_url || ''} alt="" />
                      <AvatarFallback>
                        {activeSubmission.user?.username?.slice(0, 2)?.toUpperCase() || 'US'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold">{activeSubmission.user?.username || activeSubmission.user?.email}</p>
                      {activeSubmission.user?.email && activeSubmission.user?.username && (
                        <p className="text-sm text-muted-foreground">{activeSubmission.user.email}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          Current: {activeSubmission.user?.kyc_level_label || 'Level 1'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Requesting: Level {activeSubmission.level_requested}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submission Details */}
              <Card className="border border-border/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Submission Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Submitted</p>
                      <p className="font-medium">
                        {format(new Date(activeSubmission.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(activeSubmission.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Status</p>
                      <Badge
                        variant={
                          activeSubmission.status === 'verified'
                            ? 'default'
                            : activeSubmission.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {activeSubmission.status.charAt(0).toUpperCase() + activeSubmission.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submitted Data */}
              {activeSubmission.payload && Object.keys(activeSubmission.payload).length > 0 && (
                <Card className="border border-border/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Submitted Data</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 text-sm">
                      {Object.entries(activeSubmission.payload).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-4 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                          <span className="font-medium capitalize text-muted-foreground min-w-[140px]">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="text-foreground text-right break-words flex-1">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rejection Reason */}
              {reviewMode === 'rejected' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rejection Reason *</label>
                  <Textarea
                    value={reviewReason}
                    onChange={(event) => setReviewReason(event.target.value)}
                    placeholder="Provide a clear explanation for why this verification is being rejected..."
                    className="text-sm min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    This reason will be sent to the user via email notification.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t border-border">
                <Button variant="outline" onClick={closeDialog} disabled={processingDecision}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDecision}
                  disabled={processingDecision}
                  variant={reviewMode === 'rejected' ? 'destructive' : 'default'}
                >
                  {processingDecision ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : reviewMode === 'verified' ? (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Approve Verification
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 mr-2" />
                      Reject Verification
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

