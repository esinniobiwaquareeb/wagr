"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
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
import { Loader2, ShieldCheck, ShieldAlert, Clock, ArrowRight } from "lucide-react";
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
      { label: "Pending Reviews", value: summary.pending, tone: "text-amber-600" },
      { label: "Verified", value: summary.verified, tone: "text-green-600" },
      { label: "Rejected", value: summary.rejected, tone: "text-red-600" },
    ],
    [summary],
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

        <div className="grid gap-3 md:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="border border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{stat.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-semibold ${stat.tone}`}>{stat.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
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
        ) : submissions.length === 0 ? (
          <Card className="border border-dashed border-border">
            <CardContent className="py-10 text-center space-y-3">
              <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No submissions found for this filter. Check back later or switch tabs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {submissions.map((submission) => (
              <Card key={submission.id} className="border border-border/80">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={submission.user?.avatar_url || ''} alt={submission.user?.username || ''} />
                        <AvatarFallback>
                          {submission.user?.username?.slice(0, 2)?.toUpperCase() ||
                            submission.user?.email?.slice(0, 2)?.toUpperCase() ||
                            'US'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">
                          {submission.user?.username || submission.user?.email || 'Unknown user'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Level {submission.level_requested} • Submitted{" "}
                          {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        submission.status === 'verified'
                          ? 'default'
                          : submission.status === 'rejected'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {submission.status}
                    </Badge>
                  </div>

                  <div className="grid gap-2 text-xs text-muted-foreground border border-dashed rounded-lg p-3 bg-muted/30">
                    {Object.entries(submission.payload || {}).slice(0, 4).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-foreground truncate">{String(value)}</span>
                      </div>
                    ))}
                    {submission.payload && Object.keys(submission.payload).length > 4 && (
                      <div className="text-right text-[11px] text-muted-foreground">+ more details inside</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {submission.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => openReviewDialog(submission, 'verified')}>
                          <ShieldCheck className="h-4 w-4 mr-1.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openReviewDialog(submission, 'rejected')}
                        >
                          <ShieldAlert className="h-4 w-4 mr-1.5" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => openReviewDialog(submission, submission.status === 'pending' ? 'verified' : 'rejected')}
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      View details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={reviewDialogOpen} onOpenChange={(open) => !processingDecision && setReviewDialogOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewMode === 'verified' ? 'Approve verification' : 'Reject verification'}
            </DialogTitle>
            <DialogDescription>
              Review the submitted data carefully before completing this action.
            </DialogDescription>
          </DialogHeader>

          {activeSubmission && (
            <div className="space-y-4">
              <Card className="border border-border/80">
                <CardContent className="p-3 text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={activeSubmission.user?.avatar_url || ''} alt="" />
                      <AvatarFallback>
                        {activeSubmission.user?.username?.slice(0, 2)?.toUpperCase() || 'US'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{activeSubmission.user?.username || activeSubmission.user?.email}</p>
                      <p className="text-muted-foreground">
                        Level requested: {activeSubmission.level_requested}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-1">
                    {Object.entries(activeSubmission.payload || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-3">
                        <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                        <span className="text-muted-foreground text-right">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {reviewMode === 'rejected' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Rejection reason</label>
                  <Textarea
                    value={reviewReason}
                    onChange={(event) => setReviewReason(event.target.value)}
                    placeholder="Provide a short explanation"
                    className="text-sm"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={closeDialog} disabled={processingDecision}>
                  Cancel
                </Button>
                <Button onClick={handleDecision} disabled={processingDecision}>
                  {processingDecision ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : reviewMode === 'verified' ? (
                    'Approve'
                  ) : (
                    'Reject'
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

