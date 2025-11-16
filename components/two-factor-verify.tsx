"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield } from "lucide-react";

interface TwoFactorVerifyProps {
  isOpen: boolean;
  onVerify: (code: string, isBackupCode: boolean) => Promise<void>;
}

export function TwoFactorVerify({ isOpen, onVerify }: TwoFactorVerifyProps) {
  const [code, setCode] = useState("");
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleVerify = async () => {
    if (!code || (isBackupCode ? code.length < 8 : code.length !== 6)) {
      toast({
        title: "Code format issue",
        description: isBackupCode 
          ? "Backup codes need to be at least 8 characters"
          : "Enter the 6-digit code from your authenticator app",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onVerify(code, isBackupCode);
      setCode("");
      setIsBackupCode(false);
    } catch (error) {
      toast({
        title: "Verification didn't work",
        description: error instanceof Error ? error.message : "That code didn't work. Double-check and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Check Required
          </DialogTitle>
          <DialogDescription>
            Open your authenticator app and enter the code shown
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              type="text"
              value={code}
              onChange={(e) => {
                const value = isBackupCode
                  ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  : e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(value);
              }}
              placeholder={isBackupCode ? "Backup code" : "000000"}
              maxLength={isBackupCode ? 20 : 6}
              className={isBackupCode ? "text-center" : "text-center text-2xl tracking-widest font-mono"}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="backup-code"
              checked={isBackupCode}
              onChange={(e) => {
                setIsBackupCode(e.target.checked);
                setCode("");
              }}
              className="rounded"
            />
            <label htmlFor="backup-code" className="text-sm text-muted-foreground">
              Using backup code
            </label>
          </div>

          <Button
            onClick={handleVerify}
            disabled={loading || !code || (isBackupCode ? code.length < 8 : code.length !== 6)}
            className="w-full"
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

