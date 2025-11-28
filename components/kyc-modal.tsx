"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KycStatusCard } from "@/components/profile/kyc-status-card";
import { KycUpgradeDialog } from "@/components/profile/kyc-upgrade-dialog";
import type { KycSummary } from "@/lib/kyc/types";

interface KycModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: KycSummary | null;
  loading: boolean;
  onStartUpgrade: (level: 2 | 3) => void;
  levelDialog: 2 | 3 | null;
  onLevelDialogChange: (level: 2 | 3 | null) => void;
  submittingLevel: 2 | 3 | null;
  onSubmit: (level: 2 | 3, payload: Record<string, any>) => Promise<void>;
}

export function KycModal({
  isOpen,
  onClose,
  summary,
  loading,
  onStartUpgrade,
  levelDialog,
  onLevelDialogChange,
  submittingLevel,
  onSubmit,
}: KycModalProps) {
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KYC Verification</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <KycStatusCard
              summary={summary}
              loading={loading}
              onStartUpgrade={onStartUpgrade}
              variant="standalone"
            />
          </div>
        </DialogContent>
      </Dialog>

      <KycUpgradeDialog
        level={2}
        open={levelDialog === 2}
        onOpenChange={(open) => onLevelDialogChange(open ? 2 : null)}
        limits={summary?.limits ?? null}
        submitting={submittingLevel === 2}
        onSubmit={async (payload) => {
          await onSubmit(2, payload);
        }}
      />
      <KycUpgradeDialog
        level={3}
        open={levelDialog === 3}
        onOpenChange={(open) => onLevelDialogChange(open ? 3 : null)}
        limits={summary?.limits ?? null}
        submitting={submittingLevel === 3}
        onSubmit={async (payload) => {
          await onSubmit(3, payload);
        }}
      />
    </>
  );
}

