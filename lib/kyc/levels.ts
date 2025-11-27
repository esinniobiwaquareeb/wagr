export interface KycLevelDefinition {
  level: number;
  key: string;
  label: string;
  description: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
  accentClass: string;
  requirements: string[];
  limitHint?: string;
}

export const KYC_LEVELS: KycLevelDefinition[] = [
  {
    level: 1,
    key: 'level_1',
    label: 'Level 1 — Email Verified',
    description: 'Basic account access with email verification only.',
    badgeVariant: 'secondary',
    accentClass: 'text-amber-600 dark:text-amber-400',
    requirements: [
      'Verify your email address',
      'Enable basic security controls',
    ],
    limitHint: 'View wagers, deposit funds, but transfers stay locked.',
  },
  {
    level: 2,
    key: 'level_2',
    label: 'Level 2 — Identity Verified',
    description: 'Unlock wallet transfers up to ₦50,000 by validating your BVN or NIN.',
    badgeVariant: 'default',
    accentClass: 'text-green-600 dark:text-green-400',
    requirements: [
      'Provide legal name and date of birth',
      'Verify BVN or NIN',
      'Confirm phone number',
    ],
    limitHint: 'Transfers between ₦2,000 and ₦50,000 per transaction.',
  },
  {
    level: 3,
    key: 'level_3',
    label: 'Level 3 — Face & Document Verified',
    description: 'Highest trust tier with document review and face recognition.',
    badgeVariant: 'outline',
    accentClass: 'text-blue-600 dark:text-blue-400',
    requirements: [
      'Upload a valid government document',
      'Complete face recognition / liveness check',
      'Agree to enhanced monitoring',
    ],
    limitHint: 'Transfers up to ₦500,000 per transaction/day.',
  },
];

export function getKycLevelConfig(level: number): KycLevelDefinition {
  return KYC_LEVELS.find((definition) => definition.level === level) ?? KYC_LEVELS[0];
}

