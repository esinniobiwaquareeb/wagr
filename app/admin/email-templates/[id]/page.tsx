"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { adminEmailTemplatesApi } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  Code,
  Image as ImageIcon,
  HelpCircle,
  Copy,
  Check,
  X,
  Plus,
  Trash2,
  Send,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { extractErrorMessage } from "@/lib/error-extractor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const EMAIL_TYPES = [
  { value: "verification", label: "Email Verification" },
  { value: "welcome", label: "Welcome Email" },
  { value: "password-reset", label: "Password Reset" },
  { value: "password-changed", label: "Password Changed" },
  { value: "2fa-enabled", label: "2FA Enabled" },
  { value: "2fa-disabled", label: "2FA Disabled" },
  { value: "kyc-approved", label: "KYC Approved" },
  { value: "kyc-rejected", label: "KYC Rejected" },
  { value: "wager-invitation", label: "Wager Invitation" },
  { value: "quiz-invitation", label: "Quiz Invitation" },
  { value: "wager-won", label: "Wager Won" },
  { value: "wager-lost", label: "Wager Lost" },
  { value: "wager-refunded", label: "Wager Refunded" },
] as const;

const AVAILABLE_VARIABLES = [
  { name: "{{appName}}", description: "Application name", example: "Wagr" },
  { name: "{{appUrl}}", description: "Application URL", example: "https://wagr.app" },
  { name: "{{supportEmail}}", description: "Support email address", example: "support@wagr.app" },
  { name: "{{currency}}", description: "Default currency", example: "NGN" },
  { name: "{{recipientName}}", description: "Recipient's name", example: "John Doe" },
  { name: "{{recipientEmail}}", description: "Recipient's email", example: "user@example.com" },
  { name: "{{verificationUrl}}", description: "Email verification link", example: "https://wagr.app/verify?token=..." },
  { name: "{{resetUrl}}", description: "Password reset link", example: "https://wagr.app/reset?token=..." },
  { name: "{{loginUrl}}", description: "Login page URL", example: "https://wagr.app/login" },
  { name: "{{wagerTitle}}", description: "Wager title", example: "Will Bitcoin reach $100k?" },
  { name: "{{wagerUrl}}", description: "Wager detail page URL", example: "https://wagr.app/wager/123" },
  { name: "{{sideA}}", description: "Wager side A", example: "Yes" },
  { name: "{{sideB}}", description: "Wager side B", example: "No" },
  { name: "{{amount}}", description: "Wager amount", example: "1,000" },
  { name: "{{deadline}}", description: "Wager deadline", example: "Jan 15, 2026, 11:59 PM" },
  { name: "{{winnings}}", description: "Wager winnings amount", example: "2,000" },
  { name: "{{winningSide}}", description: "Winning side", example: "Yes" },
  { name: "{{entryAmount}}", description: "Entry amount", example: "100" },
  { name: "{{refundAmount}}", description: "Refund amount", example: "100" },
  { name: "{{quizTitle}}", description: "Quiz title", example: "General Knowledge Quiz" },
  { name: "{{quizUrl}}", description: "Quiz detail page URL", example: "https://wagr.app/quiz/123" },
  { name: "{{inviterName}}", description: "Name of person who invited", example: "Jane Doe" },
  { name: "{{currentYear}}", description: "Current year", example: "2026" },
];

interface EmailTemplate {
  id?: string;
  type: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: any[] | null;
  images: any[] | null;
  is_active: boolean;
  description: string | null;
}

export default function AdminEmailTemplateEditPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const id = params.id as string;
  const isNew = id === "new";
  const isPreview = searchParams.get("preview") === "true";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<EmailTemplate>({
    type: "",
    subject: "",
    html_content: "",
    text_content: "",
    variables: [],
    images: [],
    is_active: true,
    description: "",
  });

  const [showVariablesDialog, setShowVariablesDialog] = useState(false);
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newImageAlt, setNewImageAlt] = useState("");
  const [newImageCid, setNewImageCid] = useState("");
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isNew) {
      fetchTemplate();
    }
  }, [id, isNew]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await adminEmailTemplatesApi.getById(id);
      if (response?.template) {
        setTemplate({
          ...response.template,
          variables: response.template.variables || [],
          images: response.template.images || [],
        });
      }
    } catch (error: any) {
      logger.error("Failed to fetch email template", error);
      const errorMessage = extractErrorMessage(error, "Failed to load email template");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      router.push("/admin/email-templates");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const templateData = {
        type: template.type,
        subject: template.subject,
        html_content: template.html_content,
        text_content: template.text_content || null,
        variables: template.variables && template.variables.length > 0 ? template.variables : null,
        images: template.images && template.images.length > 0 ? template.images : null,
        is_active: template.is_active,
        description: template.description || null,
      };

      if (isNew) {
        await adminEmailTemplatesApi.create(templateData);
        toast({
          title: "Success",
          description: "Email template created successfully",
        });
      } else {
        await adminEmailTemplatesApi.update(id, templateData);
        toast({
          title: "Success",
          description: "Email template updated successfully",
        });
      }

      router.push("/admin/email-templates");
    } catch (error: any) {
      logger.error("Failed to save email template", error);
      const errorMessage = extractErrorMessage(error, "Failed to save email template");
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable);
    setCopiedVariable(variable);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  const handleTestEmail = async () => {
    if (!testEmail || !id || id === "new") return;

    try {
      setTesting(true);
      await adminEmailTemplatesApi.test(testEmail, id);
      toast({
        title: "Success",
        description: `Test email sent successfully to ${testEmail}`,
      });
      setShowTestDialog(false);
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

  const addImage = () => {
    if (!newImageUrl || !newImageAlt) {
      toast({
        title: "Error",
        description: "Image URL and Alt text are required",
        variant: "destructive",
      });
      return;
    }

    const newImage = {
      url: newImageUrl,
      alt: newImageAlt,
      cid: newImageCid || undefined,
    };

    setTemplate({
      ...template,
      images: [...(template.images || []), newImage],
    });

    setNewImageUrl("");
    setNewImageAlt("");
    setNewImageCid("");
  };

  const removeImage = (index: number) => {
    setTemplate({
      ...template,
      images: template.images?.filter((_, i) => i !== index) || [],
    });
  };

  const addVariable = (variable: { name: string; description: string; example: string }) => {
    const existing = template.variables?.find((v: any) => v.name === variable.name);
    if (existing) return;

    setTemplate({
      ...template,
      variables: [...(template.variables || []), variable],
    });
  };

  const removeVariable = (index: number) => {
    setTemplate({
      ...template,
      variables: template.variables?.filter((_, i) => i !== index) || [],
    });
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById("html-content") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = template.html_content;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setTemplate({ ...template, html_content: newText });
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
    setShowVariablesDialog(false);
  };

  // Preview HTML with variable substitution
  const getPreviewHTML = () => {
    let html = template.html_content;
    AVAILABLE_VARIABLES.forEach((v) => {
      html = html.replace(new RegExp(v.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), v.example);
    });
    return html;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Card className="border border-border/80">
            <CardContent className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading email template...</p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (isPreview) {
    return (
      <main className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={() => router.push(`/admin/email-templates/${id}`)}>
              Edit Template
            </Button>
          </div>
          <Card className="border border-border/80">
            <CardHeader>
              <CardTitle>Preview: {template.subject}</CardTitle>
              <CardDescription>This is how the email will look with sample data</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="border border-border rounded-lg p-6 bg-white"
                dangerouslySetInnerHTML={{ __html: getPreviewHTML() }}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.push("/admin/email-templates")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {isNew ? "Create Email Template" : "Edit Email Template"}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                {isNew
                  ? "Create a new email template with HTML content and variables"
                  : "Edit email template content, variables, and settings"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowVariablesDialog(true)}>
              <HelpCircle className="h-4 w-4 mr-2" />
              Variables
            </Button>
            {!isNew && (
              <Button
                variant="outline"
                onClick={() => router.push(`/admin/email-templates/${id}?preview=true`)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            )}
            {!isNew && (
              <Button
                variant="outline"
                onClick={() => {
                  setTestEmail("");
                  setShowTestDialog(true);
                }}
                disabled={!template.is_active || saving}
                title={!template.is_active ? "Template must be active to test" : "Test Email"}
              >
                <Send className="h-4 w-4 mr-2" />
                Test Email
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving || !template.type || !template.subject || !template.html_content}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card className="border border-border/80">
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Template type, subject, and description</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Email Type *</Label>
                  <select
                    id="type"
                    value={template.type}
                    onChange={(e) => setTemplate({ ...template, type: e.target.value })}
                    disabled={!isNew}
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Select email type...</option>
                    {EMAIL_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {!isNew && (
                    <p className="text-xs text-muted-foreground">
                      Email type cannot be changed after creation
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Input
                    id="subject"
                    value={template.subject}
                    onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                    placeholder="e.g., Verify your {{appName}} account"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use variables like {`{{recipientName}}`}, {`{{appName}}`}, etc.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={template.description || ""}
                    onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                    placeholder="Brief description of this template"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_active">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive templates will fall back to default templates
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={template.is_active}
                    onCheckedChange={(checked) => setTemplate({ ...template, is_active: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* HTML Content */}
            <Card className="border border-border/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>HTML Content *</CardTitle>
                    <CardDescription>Email body with HTML and variables</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVariablesDialog(true)}
                  >
                    <Code className="h-4 w-4 mr-2" />
                    Insert Variable
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="editor" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="editor">Editor</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="editor" className="space-y-2">
                    <Textarea
                      id="html-content"
                      value={template.html_content}
                      onChange={(e) => setTemplate({ ...template, html_content: e.target.value })}
                      placeholder="Enter HTML content here. Use variables like {{recipientName}}, {{appName}}, etc."
                      className="font-mono text-sm min-h-[400px]"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{template.html_content.length} characters</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowVariablesDialog(true)}
                        className="h-auto p-1 text-xs"
                      >
                        <HelpCircle className="h-3 w-3 mr-1" />
                        Available Variables
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="preview">
                    <div className="border border-border rounded-lg p-6 bg-white min-h-[400px]">
                      {template.html_content ? (
                        <div dangerouslySetInnerHTML={{ __html: getPreviewHTML() }} />
                      ) : (
                        <p className="text-muted-foreground text-center py-12">
                          Enter HTML content to see preview
                        </p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Plain Text Content */}
            <Card className="border border-border/80">
              <CardHeader>
                <CardTitle>Plain Text Content (Optional)</CardTitle>
                <CardDescription>Fallback text version for email clients that don't support HTML</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={template.text_content || ""}
                  onChange={(e) => setTemplate({ ...template, text_content: e.target.value })}
                  placeholder="Enter plain text content here..."
                  className="font-mono text-sm min-h-[200px]"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Variables */}
            <Card className="border border-border/80">
              <CardHeader>
                <CardTitle className="text-lg">Template Variables</CardTitle>
                <CardDescription>Variables used in this template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {template.variables && template.variables.length > 0 ? (
                  template.variables.map((variable: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <div className="flex-1 min-w-0">
                        <code className="text-xs font-mono text-primary">{variable.name}</code>
                        <p className="text-xs text-muted-foreground mt-1">{variable.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariable(index)}
                        className="h-auto p-1 text-destructive hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No variables added yet
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowVariablesDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variable
                </Button>
              </CardContent>
            </Card>

            {/* Images */}
            <Card className="border border-border/80">
              <CardHeader>
                <CardTitle className="text-lg">Images</CardTitle>
                <CardDescription>Images to embed in the email</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {template.images && template.images.length > 0 ? (
                  <div className="space-y-2">
                    {template.images.map((image: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-2 rounded-lg bg-muted/50 border border-border/50"
                      >
                        <ImageIcon className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{image.alt}</p>
                          <p className="text-xs text-muted-foreground truncate">{image.url}</p>
                          {image.cid && (
                            <code className="text-xs text-primary">CID: {image.cid}</code>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeImage(index)}
                          className="h-auto p-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No images added yet
                  </p>
                )}

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Input
                    placeholder="Image URL"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Alt text"
                    value={newImageAlt}
                    onChange={(e) => setNewImageAlt(e.target.value)}
                    className="text-sm"
                  />
                  <Input
                    placeholder="Content-ID (optional, for embedding)"
                    value={newImageCid}
                    onChange={(e) => setNewImageCid(e.target.value)}
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={addImage}
                    disabled={!newImageUrl || !newImageAlt}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Image
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Variables Dialog */}
        <Dialog open={showVariablesDialog} onOpenChange={setShowVariablesDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Available Variables</DialogTitle>
              <DialogDescription>
                Click on a variable to insert it into your template, or add it to the template's variable list
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {AVAILABLE_VARIABLES.map((variable) => (
                <div
                  key={variable.name}
                  className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                        {variable.name}
                      </code>
                      {copiedVariable === variable.name && (
                        <Badge variant="default" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Copied
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{variable.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Example: <code className="bg-muted px-1 py-0.5 rounded">{variable.example}</code>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(variable.name)}
                    >
                      Insert
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyVariable(variable.name)}
                    >
                      {copiedVariable === variable.name ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    {!template.variables?.find((v: any) => v.name === variable.name) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addVariable(variable)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Test Email Dialog */}
        <Dialog open={showTestDialog} onOpenChange={(open) => {
          if (!testing) {
            setShowTestDialog(open);
            if (!open) {
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
                  The test email will be sent to this address using the current template with sample data.
                </p>
              </div>
              {!template.is_active && (
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
                  setTestEmail("");
                }}
                disabled={testing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTestEmail}
                disabled={!testEmail || testing || !template.is_active || isNew}
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

