"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, ShieldCheck, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface TwoFactorManageProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function TwoFactorManage({ isOpen, onClose, onComplete }: TwoFactorManageProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const { toast } = useToast();

  // Reset state when dialog closes
  const handleClose = () => {
    setPassword("");
    setShowPassword(false);
    setLoading(false);
    setShowDisableConfirm(false);
    onClose();
  };

  const handleDisable = async () => {
    if (!password) {
      toast({
        title: "Password needed",
        description: "Enter your password to confirm you want to disable 2FA",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to disable 2FA');
      }

      toast({
        title: "2FA has been turned off",
        description: "Your account is no longer protected with two-factor authentication.",
      });

      // Reset state
      setPassword("");
      setShowDisableConfirm(false);
      
      onComplete();
      handleClose();
    } catch (error) {
      toast({
        title: "Couldn't disable 2FA",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              Two-Factor Authentication
            </DialogTitle>
            <DialogDescription>
              Manage your two-factor authentication settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-green-600/10 dark:bg-green-400/10 border border-green-600/20 dark:border-green-400/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                    Two-Factor Authentication is Enabled
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your account is protected with an additional layer of security. You'll need to enter a code from your authenticator app each time you log in.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Enter your password to confirm
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                We need your password to make sure it's really you.
              </p>
            </div>

            <div className="bg-yellow-600/10 dark:bg-yellow-400/10 border border-yellow-600/20 dark:border-yellow-400/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Turning off 2FA makes your account less secure. Only do this if you're sure.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleClose}
                variant="outline"
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowDisableConfirm(true)}
                disabled={loading || !password}
                variant="destructive"
                className="flex-1"
              >
                {loading ? "Processing..." : "Disable 2FA"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDisableConfirm}
        onOpenChange={setShowDisableConfirm}
        title="Disable Two-Factor Authentication?"
        description="Are you sure you want to disable 2FA? This will reduce your account security. You'll need to enter your password to confirm."
        confirmText="Yes, Disable"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDisable}
      />
    </>
  );
}

