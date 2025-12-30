"use client";

import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";
import type { KycSummary } from "@/lib/kyc/types";

interface KycUpgradeDialogProps {
  level: 2 | 3;
  open: boolean;
  limits: KycSummary["limits"] | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: Record<string, any>) => Promise<void>;
}

// Validation helpers
function validateNigerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-]/g, '');
  return /^(\+?234|0)[789]\d{9}$/.test(cleaned);
}

function validateBvnNin(idNumber: string): boolean {
  const cleaned = idNumber.replace(/\s/g, '');
  return /^\d{11}$/.test(cleaned);
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();
  return monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
}

function validateFullName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, error: "Name is required" };
  if (/\d/.test(trimmed)) return { valid: false, error: "Name should not contain numbers" };
  const words = trimmed.split(/\s+/);
  if (words.length < 2) return { valid: false, error: "Please enter your full name (first and last name)" };
  return { valid: true };
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

  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
      setTouched({});
    }
  }, [open]);

  // Validation state for Level 2
  const level2Validation = useMemo(() => {
    const nameValidation = validateFullName(level2State.fullName);
    const age = level2State.dateOfBirth ? calculateAge(level2State.dateOfBirth) : null;
    const isAdult = age !== null && age >= 18;
    const isValidId = validateBvnNin(level2State.idNumber);
    const isValidPhone = validateNigerianPhone(level2State.phoneNumber);

    return {
      name: nameValidation,
      age,
      isAdult,
      isValidId,
      isValidPhone,
      isValid: nameValidation.valid && isAdult && isValidId && isValidPhone && level2State.dateOfBirth,
    };
  }, [level2State]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      fullName: true,
      dateOfBirth: true,
      idNumber: true,
      phoneNumber: true,
    });

    if (level === 2) {
      if (!level2Validation.isValid) {
        return;
      }
      await onSubmit(level2State);
    } else {
      await onSubmit(level3State);
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
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

  // Calculate max date for 18+ (today minus 18 years)
  const maxDateFor18Plus = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().split('T')[0];
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="space-y-1 text-sm">
            <p>{description}</p>
            <p className="text-muted-foreground">{limitHint}</p>
          </DialogDescription>
        </DialogHeader>
        
        {/* Important notice about admin review */}
        <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Important:</strong> Your submission will be reviewed by our admin team. 
            You will be notified once your verification is approved.
            Please ensure the information matches your official documents.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          {level === 2 ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="fullName">
                  Legal Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  value={level2State.fullName}
                  onChange={(event) => setLevel2State((prev) => ({ ...prev, fullName: event.target.value }))}
                  onBlur={() => handleBlur('fullName')}
                  placeholder="Enter your full legal name (as on BVN/NIN)"
                  required
                  className={touched.fullName && !level2Validation.name.valid ? 'border-red-500' : ''}
                />
                {touched.fullName && !level2Validation.name.valid && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {level2Validation.name.error}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Must match the name registered with your BVN/NIN
                </p>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="dateOfBirth">
                  Date of Birth <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={level2State.dateOfBirth}
                  onChange={(event) => setLevel2State((prev) => ({ ...prev, dateOfBirth: event.target.value }))}
                  onBlur={() => handleBlur('dateOfBirth')}
                  max={maxDateFor18Plus}
                  required
                  className={touched.dateOfBirth && !level2Validation.isAdult ? 'border-red-500' : ''}
                />
                {touched.dateOfBirth && level2State.dateOfBirth && !level2Validation.isAdult && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    You must be at least 18 years old
                  </p>
                )}
                {level2Validation.age !== null && level2Validation.isAdult && (
                  <p className="text-xs text-green-600">Age: {level2Validation.age} years ✓</p>
                )}
              </div>
              
              <div className="space-y-1.5">
                <Label>
                  Identity Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={level2State.idType}
                  onValueChange={(value) => setLevel2State((prev) => ({ ...prev, idType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select identity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bvn">BVN (Bank Verification Number)</SelectItem>
                    <SelectItem value="nin">NIN (National Identification Number)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="idNumber">
                  {level2State.idType.toUpperCase()} Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="idNumber"
                  value={level2State.idNumber}
                  onChange={(event) => {
                    // Only allow digits
                    const value = event.target.value.replace(/\D/g, '').slice(0, 11);
                    setLevel2State((prev) => ({ ...prev, idNumber: value }));
                  }}
                  onBlur={() => handleBlur('idNumber')}
                  placeholder="Enter 11-digit number"
                  maxLength={11}
                  inputMode="numeric"
                  required
                  className={touched.idNumber && !level2Validation.isValidId ? 'border-red-500' : ''}
                />
                <div className="flex items-center justify-between">
                  {touched.idNumber && level2State.idNumber && !level2Validation.isValidId ? (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Must be exactly 11 digits
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {level2State.idNumber.length}/11 digits
                    </p>
                  )}
                  {level2Validation.isValidId && (
                    <p className="text-xs text-green-600">✓ Valid format</p>
                  )}
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="phoneNumber">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  value={level2State.phoneNumber}
                  onChange={(event) => setLevel2State((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                  onBlur={() => handleBlur('phoneNumber')}
                  placeholder="08012345678"
                  required
                  className={touched.phoneNumber && !level2Validation.isValidPhone ? 'border-red-500' : ''}
                />
                {touched.phoneNumber && level2State.phoneNumber && !level2Validation.isValidPhone ? (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Enter a valid Nigerian phone number
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nigerian number linked to your BVN/NIN
                  </p>
                )}
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

          <Button 
            type="submit" 
            className="w-full" 
            disabled={submitting || (level === 2 && !level2Validation.isValid)}
          >
            {submitting ? 'Submitting for review...' : level === 2 ? 'Submit for Admin Review' : 'Submit for Admin Review'}
          </Button>
          
          {level === 2 && !level2Validation.isValid && (
            <p className="text-xs text-center text-muted-foreground">
              Please fill all required fields correctly to submit
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

