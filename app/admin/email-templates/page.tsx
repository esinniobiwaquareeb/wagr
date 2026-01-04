"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { adminEmailTemplatesApi } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Send
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { logger } from "@/lib/logger";
import { extractErrorMessage } from "@/lib/error-extractor";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface EmailTemplate {
  id: string;
  type: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: any[] | null;
  images: any[] | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  verification: "Email Verification",
  welcome: "Welcome Email",
  "password-reset": "Password Reset",
  "password-changed": "Password Changed",
  "2fa-enabled": "2FA Enabled",
  "2fa-disabled": "2FA Disabled",
  "kyc-approved": "KYC Approved",
  "kyc-rejected": "KYC Rejected",
  "wager-invitation": "Wager Invitation",
  "quiz-invitation": "Quiz Invitation",
  "wager-won": "Wager Won",
  "wager-lost": "Wager Lost",
  "wager-refunded": "Wager Refunded",
};

export default function AdminEmailTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [templateToTest, setTemplateToTest] = useState<EmailTemplate | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await adminEmailTemplatesApi.getAll();
      if (response?.templates) {
        setTemplates(response.templates);
      }
    } catch (error: any) {
      logger.error("Failed to fetch email templates", error);
      const errorMessage = extractErrorMessage(error, "Failed to load email templates");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!templateToDelete) return;

    try {
      setDeletingId(templateToDelete.id);
      await adminEmailTemplatesApi.delete(templateToDelete.id);
      toast({
        title: "Success",
        description: "Email template deleted successfully",
      });
      await fetchTemplates();
      setShowDeleteDialog(false);
      setTemplateToDelete(null);
    } catch (error: any) {
      logger.error("Failed to delete email template", error);
      const errorMessage = extractErrorMessage(error, "Failed to delete email template");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleTestEmail = async () => {
    if (!templateToTest || !testEmail) return;

    try {
      setTesting(true);
      await adminEmailTemplatesApi.test(testEmail, templateToTest.id);
      toast({
        title: "Success",
        description: `Test email sent successfully to ${testEmail}`,
      });
      setShowTestDialog(false);
      setTemplateToTest(null);
      setTestEmail("");
    } catch (error: any) {
      logger.error("Failed to send test email", error);
      const errorMessage = extractErrorMessage(error, "Failed to send test email");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = 
      template.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesFilter = filterActive === null || template.is_active === filterActive;
    
    return matchesSearch && matchesFilter;
  });

  const activeCount = templates.filter((t) => t.is_active).length;
  const inactiveCount = templates.filter((t) => !t.is_active).length;

  return (
    <main className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Email Templates</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Manage email templates with HTML content, images, and variables
              </p>
            </div>
            <Button
              onClick={() => router.push("/admin/email-templates/new")}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Card className="border border-border/80">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Total</span>
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xl font-bold">{templates.length}</div>
            </CardContent>
          </Card>
          <Card className="border border-border/80">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Active</span>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </div>
              <div className="text-xl font-bold text-green-600">{activeCount}</div>
            </CardContent>
          </Card>
          <Card className="border border-border/80">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Inactive</span>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold text-muted-foreground">{inactiveCount}</div>
            </CardContent>
          </Card>
          <Card className="border border-border/80">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">Types</span>
                <Filter className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xl font-bold">{new Set(templates.map((t) => t.type)).size}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border border-border/80">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates by type, subject, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterActive === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterActive(null)}
                >
                  All
                </Button>
                <Button
                  variant={filterActive === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterActive(true)}
                >
                  Active
                </Button>
                <Button
                  variant={filterActive === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterActive(false)}
                >
                  Inactive
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates List */}
        {loading ? (
          <Card className="border border-border/80">
            <CardContent className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading email templates...</p>
            </CardContent>
          </Card>
        ) : filteredTemplates.length === 0 ? (
          <Card className="border border-border/80">
            <CardContent className="p-12 text-center">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No templates found</h3>
              <p className="text-muted-foreground mb-6">
                {templates.length === 0
                  ? "Get started by creating your first email template"
                  : "No templates match your search criteria"}
              </p>
              {templates.length === 0 && (
                <Button
                  onClick={() => router.push("/admin/email-templates/new")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card
                key={template.id}
                className={`border transition-all hover:shadow-md ${
                  template.is_active
                    ? "border-border/80 hover:border-primary/50"
                    : "border-border/50 opacity-75"
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold truncate">
                        {EMAIL_TYPE_LABELS[template.type] || template.type}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Type: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{template.type}</code>
                      </CardDescription>
                    </div>
                    <Badge
                      variant={template.is_active ? "default" : "secondary"}
                      className="flex-shrink-0"
                    >
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Subject</p>
                    <p className="text-sm line-clamp-2">{template.subject}</p>
                  </div>
                  
                  {template.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {template.variables && template.variables.length > 0 && (
                      <span>{template.variables.length} variables</span>
                    )}
                    {template.images && template.images.length > 0 && (
                      <span>• {template.images.length} images</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => router.push(`/admin/email-templates/${template.id}`)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/email-templates/${template.id}?preview=true`)}
                      title="Preview"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTemplateToTest(template);
                        setTestEmail("");
                        setShowTestDialog(true);
                      }}
                      title="Test Email"
                      disabled={!template.is_active}
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setTemplateToDelete(template);
                        setShowDeleteDialog(true);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={(open) => {
            if (!deletingId) {
              setShowDeleteDialog(open);
              if (!open) setTemplateToDelete(null);
            }
          }}
          title="Delete Email Template"
          description={
            templateToDelete
              ? `Are you sure you want to delete the "${EMAIL_TYPE_LABELS[templateToDelete.type] || templateToDelete.type}" template? This action cannot be undone.`
              : ""
          }
          confirmText={deletingId ? "Deleting..." : "Delete"}
          cancelText="Cancel"
          variant="destructive"
          onConfirm={handleDelete}
          loading={!!deletingId}
        />

        {/* Test Email Dialog */}
        <Dialog open={showTestDialog} onOpenChange={(open) => {
          if (!testing) {
            setShowTestDialog(open);
            if (!open) {
              setTemplateToTest(null);
              setTestEmail("");
            }
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Test Email Template</DialogTitle>
              <DialogDescription>
                Send a test email to verify how the template looks. The email will be prefixed with "[TEST]" in the subject line.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Email Address</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  disabled={testing}
                />
                <p className="text-xs text-muted-foreground">
                  The test email will be sent to this address using the "{templateToTest ? EMAIL_TYPE_LABELS[templateToTest.type] || templateToTest.type : ''}" template.
                </p>
              </div>
              {templateToTest && !templateToTest.is_active && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ This template is inactive. Only active templates can be tested.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowTestDialog(false);
                  setTemplateToTest(null);
                  setTestEmail("");
                }}
                disabled={testing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTestEmail}
                disabled={!testEmail || testing || !templateToTest?.is_active}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

