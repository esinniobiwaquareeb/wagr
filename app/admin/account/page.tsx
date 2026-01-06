"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/contexts/admin-context";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  ShieldCheck, 
  Key, 
  User, 
  Mail, 
  Save,
  Eye,
  EyeOff,
  ChevronRight,
  QrCode,
  Copy,
  Check
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { admin2FAApi, adminManagementApi } from "@/lib/api-client";
import { logger } from "@/lib/logger";
import { ConfirmDialog } from "@/components/confirm-dialog";
import Image from "next/image";

export default function AdminAccountPage() {
  const router = useRouter();
  const { admin, refreshAdmin } = useAdmin();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [show2FADisable, setShow2FADisable] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (admin) {
      setFullName(admin.full_name || "");
      setUsername(admin.username || "");
      setLoading(false);
    }
  }, [admin]);

  const handleSetup2FA = async () => {
    try {
      setLoading(true);
      const data = await admin2FAApi.setup();
      setTwoFactorData(data);
      setShow2FASetup(true);
    } catch (error) {
      logger.error("Error setting up 2FA", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to setup 2FA",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a verification code",
        variant: "destructive",
      });
      return;
    }

    try {
      setVerifying(true);
      const result = await admin2FAApi.verify(verificationCode.trim());
      toast({
        title: "Success",
        description: result?.message || "2FA has been enabled successfully",
      });
      setShow2FASetup(false);
      setTwoFactorData(null);
      setVerificationCode("");
      await refreshAdmin();
    } catch (error) {
      logger.error("Error verifying 2FA", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Invalid verification code",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disableCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter a verification code",
        variant: "destructive",
      });
      return;
    }

    try {
      setDisabling(true);
      const result = await admin2FAApi.disable(disableCode.trim());
      toast({
        title: "Success",
        description: result?.message || "2FA has been disabled successfully",
      });
      setShow2FADisable(false);
      setDisableCode("");
      await refreshAdmin();
    } catch (error) {
      logger.error("Error disabling 2FA", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Invalid verification code",
        variant: "destructive",
      });
    } finally {
      setDisabling(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || data.message || "Failed to change password");
      }

      toast({
        title: "Success",
        description: "Password changed successfully",
      });

      setShowChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      logger.error("Error changing password", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!admin) return;

    try {
      setSaving(true);
      await adminManagementApi.update(admin.id, {
        full_name: fullName || undefined,
        username: username || undefined,
      });

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      await refreshAdmin();
    } catch (error) {
      logger.error("Error updating profile", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(type);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({
      title: "Copied",
      description: `${type} copied to clipboard`,
    });
  };

  if (loading || !admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your admin account settings</p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>Update your profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={admin.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Input
              value={admin.role || "N/A"}
              disabled
              className="bg-muted"
            />
          </div>

          <Button onClick={handleUpdateProfile} disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          {!showChangePassword ? (
            <Button onClick={() => setShowChangePassword(true)} variant="outline">
              Change Password
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 8 characters)"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleChangePassword} disabled={saving}>
                  {saving ? "Changing..." : "Change Password"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowChangePassword(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {admin.two_factor_enabled ? (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            {admin.two_factor_enabled
              ? "2FA is currently enabled for your account"
              : "Add an extra layer of security to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {admin.two_factor_enabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-medium">2FA is active</span>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShow2FADisable(true)}
              >
                Disable 2FA
              </Button>
            </div>
          ) : (
            <Button onClick={handleSetup2FA} disabled={loading}>
              {loading ? "Setting up..." : "Enable 2FA"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 2FA Setup Modal */}
      {show2FASetup && twoFactorData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Setup Two-Factor Authentication</CardTitle>
              <CardDescription>
                Scan the QR code with your authenticator app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <Image
                  src={twoFactorData.qrCode}
                  alt="2FA QR Code"
                  width={200}
                  height={200}
                  className="border rounded"
                />
              </div>

              <div className="space-y-2">
                <Label>Secret Key (Manual Entry)</Label>
                <div className="flex gap-2">
                  <Input
                    value={twoFactorData.secret}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(twoFactorData.secret, "Secret key")}
                  >
                    {copiedCode === "secret" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Backup Codes</Label>
                <div className="bg-muted p-3 rounded-md space-y-1">
                  {twoFactorData.backupCodes.map((code, index) => (
                    <div key={index} className="flex items-center justify-between font-mono text-sm">
                      <span>{code}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(code, `Backup code ${index + 1}`)}
                      >
                        {copiedCode === `backup-${index}` ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Save these backup codes in a safe place. You'll need them if you lose access to your authenticator app.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verificationCode">Verification Code</Label>
                <Input
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code from your app"
                  maxLength={6}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleVerify2FA}
                  disabled={verifying || !verificationCode.trim()}
                  className="flex-1"
                >
                  {verifying ? "Verifying..." : "Verify & Enable"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShow2FASetup(false);
                    setTwoFactorData(null);
                    setVerificationCode("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Disable 2FA Dialog */}
      <ConfirmDialog
        open={show2FADisable}
        onOpenChange={setShow2FADisable}
        title="Disable Two-Factor Authentication"
        description={
          <div className="space-y-4 mt-2">
            <p>Enter your verification code to disable 2FA.</p>
            <div className="space-y-2">
              <Label htmlFor="disableCode">Verification Code</Label>
              <Input
                id="disableCode"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
              />
            </div>
          </div>
        }
        confirmText="Disable"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDisable2FA}
      />
    </div>
  );
}

