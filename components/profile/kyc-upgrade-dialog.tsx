"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { KycSummary } from "@/lib/kyc/types";

interface KycUpgradeDialogProps {
  level: 2 | 3;
  open: boolean;
  limits: KycSummary["limits"] | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: Record<string, any>) => Promise<void>;
}

export function KycUpgradeDialog({
  level,
  open,
  limits,
  submitting,
  onOpenChange,
  onSubmit,
}: KycUpgradeDialogProps) {
  const [level2State, setLevel2State] = useState({
    fullName: "",
    dateOfBirth: "",
    idType: "bvn",
    idNumber: "",
    phoneNumber: "",
  });

  const [level3State, setLevel3State] = useState({
    documentType: "",
    documentNumber: "",
    faceReference: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) {
      setLevel2State({
        fullName: "",
        dateOfBirth: "",
        idType: "bvn",
        idNumber: "",
        phoneNumber: "",
      });
      setLevel3State({
        documentType: "",
        documentNumber: "",
        faceReference: "",
        notes: "",
      });
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (level === 2) {
      await onSubmit(level2State);
    } else {
      await onSubmit(level3State);
    }
  };

  const title = level === 2 ? "Verify your identity" : "Complete advanced verification";
  const description =
    level === 2
      ? "Provide BVN or NIN details to unlock wallet transfers up to ₦50,000."
      : "Upload document details and confirm a face scan reference to unlock higher limits.";

  const limitHint =
    level === 2
      ? `Transfers available between ₦${limits?.level2MinTransfer?.toLocaleString() ?? "2,000"} and ₦${limits?.level2MaxTransfer?.toLocaleString() ?? "50,000"}.`
      : `Transfers up to ₦${limits?.level3MaxTransfer?.toLocaleString() ?? "500,000"} per transaction/day.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="space-y-1 text-sm">
            <p>{description}</p>
            <p className="text-muted-foreground">{limitHint}</p>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {level === 2 ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Legal Name</Label>
                <Input
                  id="fullName"
                  value={level2State.fullName}
                  onChange={(event) => setLevel2State((prev) => ({ ...prev, fullName: event.target.value }))}
                  placeholder="Enter your full legal name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={level2State.dateOfBirth}
                  onChange={(event) => setLevel2State((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Identity Type</Label>
                <Select
                  value={level2State.idType}
                  onValueChange={(value) => setLevel2State((prev) => ({ ...prev, idType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select identity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bvn">BVN</SelectItem>
                    <SelectItem value="nin">NIN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="idNumber">BVN / NIN</Label>
                <Input
                  id="idNumber"
                  value={level2State.idNumber}
                  onChange={(event) => setLevel2State((prev) => ({ ...prev, idNumber: event.target.value }))}
                  placeholder="Enter the selected identity number"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={level2State.phoneNumber}
                  onChange={(event) => setLevel2State((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                  placeholder="08012345678"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="documentType">Document Type</Label>
                <Input
                  id="documentType"
                  value={level3State.documentType}
                  onChange={(event) => setLevel3State((prev) => ({ ...prev, documentType: event.target.value }))}
                  placeholder="e.g. International Passport"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="documentNumber">Document Number</Label>
                <Input
                  id="documentNumber"
                  value={level3State.documentNumber}
                  onChange={(event) => setLevel3State((prev) => ({ ...prev, documentNumber: event.target.value }))}
                  placeholder="Enter document number"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="faceReference">Face Scan Reference</Label>
                <Input
                  id="faceReference"
                  value={level3State.faceReference}
                  onChange={(event) => setLevel3State((prev) => ({ ...prev, faceReference: event.target.value }))}
                  placeholder="Provide the liveness capture or selfie reference"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Additional Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={level3State.notes}
                  onChange={(event) => setLevel3State((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Add any note that helps us review faster"
                />
              </div>
            </>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting...' : level === 2 ? 'Submit Level 2 details' : 'Submit Level 3 details'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

