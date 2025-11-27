export type KycStatus = 'verified' | 'pending' | 'locked';

export interface KycLevelState {
  level: number;
  label: string;
  description: string;
  status: KycStatus;
  statusLabel: string;
  completedAt?: string;
  requirements: string[];
  limits?: {
    min?: number | null;
    max?: number | null;
  };
}

export interface KycSubmissionRecord {
  id: string;
  user_id: string;
  level_requested: number;
  status: string;
  reviewer_id?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface KycLimitsConfig {
  level1TransferEnabled: boolean;
  level2MinTransfer: number;
  level2MaxTransfer: number;
  level3MinTransfer: number;
  level3MaxTransfer: number;
  dailyTransferCap: number;
}

export interface KycSummary {
  currentLevel: number;
  currentLabel: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
  badgeDescription: string;
  levels: KycLevelState[];
  submissions: Array<Omit<KycSubmissionRecord, 'payload'>>;
  limits: KycLimitsConfig;
}

