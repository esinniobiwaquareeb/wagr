/**
 * Utility functions for generating notification links
 * Ensures all notifications have proper navigation links
 */

export interface NotificationMetadata {
  wager_id?: string;
  quiz_id?: string;
  transaction_id?: string;
  user_id?: string;
  reference?: string;
  [key: string]: any;
}

/**
 * Generate a navigation link for a notification based on its type and metadata
 * Note: For wagers, this will use the wager_id from metadata. The frontend
 * will need to resolve short_id if needed, or we can enhance this to fetch short_id.
 */
export function generateNotificationLink(
  type: string,
  metadata: NotificationMetadata | null,
  existingLink?: string | null
): string | null {
  // If link already exists, use it
  if (existingLink) {
    return existingLink;
  }

  // Generate link based on notification type and metadata
  switch (type) {
    case 'wager_resolved':
    case 'wager_settled':
    case 'wager_ending':
    case 'wager_joined':
    case 'wager_invitation':
    case 'new_wager':
    case 'wager_created':
      if (metadata?.wager_id) {
        // Use wager_id - the frontend route handler will resolve short_id if needed
        return `/wager/${metadata.wager_id}`;
      }
      // If we have a reference that might be a wager ID
      if (metadata?.reference) {
        return `/wager/${metadata.reference}`;
      }
      return '/wagers';

    case 'balance_update':
    case 'deposit':
    case 'withdrawal':
    case 'transfer':
      return '/wallet';

    case 'quiz_invitation':
    case 'quiz_completed':
    case 'quiz_result':
      if (metadata?.quiz_id) {
        return `/quiz/${metadata.quiz_id}`;
      }
      return '/quizzes';

    case 'transaction':
      if (metadata?.transaction_id) {
        return `/wallet/transactions?transaction=${metadata.transaction_id}`;
      }
      return '/wallet/transactions';

    case 'profile_update':
    case 'account_verified':
      return '/profile';

    case 'admin_action':
      return '/admin';

    default:
      // For unknown types, try to infer from metadata
      if (metadata?.wager_id) {
        return `/wager/${metadata.wager_id}`;
      }
      if (metadata?.quiz_id) {
        return `/quiz/${metadata.quiz_id}`;
      }
      if (metadata?.reference) {
        // Try to determine if reference is a wager or quiz ID
        return `/wager/${metadata.reference}`;
      }
      return null;
  }
}

/**
 * Get notification action text based on type
 */
export function getNotificationActionText(type: string): string {
  switch (type) {
    case 'wager_resolved':
    case 'wager_settled':
      return 'View Results';
    case 'wager_ending':
      return 'View Wager';
    case 'wager_joined':
    case 'wager_invitation':
    case 'new_wager':
      return 'View Wager';
    case 'balance_update':
    case 'deposit':
    case 'withdrawal':
    case 'transfer':
      return 'View Wallet';
    case 'quiz_invitation':
    case 'quiz_completed':
    case 'quiz_result':
      return 'View Quiz';
    case 'transaction':
      return 'View Transaction';
    default:
      return 'View';
  }
}

/**
 * Check if notification should be clickable
 */
export function isNotificationClickable(type: string, metadata: NotificationMetadata | null): boolean {
  // Most notifications are clickable if they have relevant metadata
  const clickableTypes = [
    'wager_resolved',
    'wager_settled',
    'wager_ending',
    'wager_joined',
    'wager_invitation',
    'wager_created',
    'new_wager',
    'balance_update',
    'deposit',
    'withdrawal',
    'transfer',
    'quiz_invitation',
    'quiz_completed',
    'quiz_result',
    'transaction',
  ];

  if (!clickableTypes.includes(type)) {
    return false;
  }

  // Check if metadata has relevant IDs
  return !!(metadata?.wager_id || metadata?.quiz_id || metadata?.transaction_id || metadata?.reference);
}

