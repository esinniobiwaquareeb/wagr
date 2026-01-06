export type AdminRole = 'super_admin' | 'admin' | 'moderator';

export interface AdminPermissionDefinition {
  id: string;
  label: string;
  description: string;
  defaultRoles: AdminRole[];
}

export const ADMIN_ROLES: { id: AdminRole; label: string; description: string }[] = [
  {
    id: 'super_admin',
    label: 'Super Admin',
    description: 'Full access to all admin features, including managing other admins and platform settings.',
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Can manage users, wagers, quizzes, withdrawals and view reports/analytics.',
  },
  {
    id: 'moderator',
    label: 'Moderator',
    description: 'Can review KYC, moderate content and assist with support, but cannot change critical platform settings.',
  },
];

export const ADMIN_PERMISSIONS: AdminPermissionDefinition[] = [
  {
    id: 'manage_users',
    label: 'Manage Users',
    description: 'View and manage user accounts, suspension, and KYC levels.',
    defaultRoles: ['super_admin', 'admin'],
  },
  {
    id: 'manage_wagers',
    label: 'Manage Wagers',
    description: 'Create, update, and resolve system wagers; review community wagers.',
    defaultRoles: ['super_admin', 'admin'],
  },
  {
    id: 'manage_quizzes',
    label: 'Manage Quizzes',
    description: 'Create and manage quizzes, review results, and trigger settlements.',
    defaultRoles: ['super_admin', 'admin'],
  },
  {
    id: 'manage_withdrawals',
    label: 'Manage Withdrawals',
    description: 'Review and approve or reject withdrawal requests.',
    defaultRoles: ['super_admin', 'admin'],
  },
  {
    id: 'manage_kyc',
    label: 'Manage KYC',
    description: 'Review and approve KYC submissions.',
    defaultRoles: ['super_admin', 'admin', 'moderator'],
  },
  {
    id: 'manage_settings',
    label: 'Manage Settings',
    description: 'Update platform-level configuration and feature flags.',
    defaultRoles: ['super_admin'],
  },
  {
    id: 'manage_admins',
    label: 'Manage Admins',
    description: 'Create, edit, and deactivate admin accounts and their permissions.',
    defaultRoles: ['super_admin'],
  },
  {
    id: 'view_transactions',
    label: 'View Transactions',
    description: 'View global transaction history and audit trails.',
    defaultRoles: ['super_admin', 'admin'],
  },
  {
    id: 'view_reports',
    label: 'View Reports',
    description: 'Access financial and operational reports.',
    defaultRoles: ['super_admin', 'admin'],
  },
  {
    id: 'view_analytics',
    label: 'View Analytics',
    description: 'Access platform analytics dashboards.',
    defaultRoles: ['super_admin', 'admin'],
  },
  {
    id: 'manage_email_templates',
    label: 'Manage Email Templates',
    description: 'Create and update transactional and marketing email templates.',
    defaultRoles: ['super_admin', 'admin'],
  },
];
