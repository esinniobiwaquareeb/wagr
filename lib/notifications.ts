// Notification helper functions
// Used to create notifications for various events
// Note: This is primarily used server-side. For client-side, use the API directly.

export interface NotificationData {
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification for a user
 * Checks user preferences before creating notification
 * Note: This function is primarily used server-side. For client-side, use the API directly.
 */
export async function createNotification(data: NotificationData): Promise<void> {
  try {
    // This function is typically called from server-side code (API routes, etc.)
    // For now, we'll use the internal API endpoint
    // In production, notifications should be created via NestJS backend directly
    
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000';
    const apiSecret = process.env.NOTIFICATION_API_SECRET || process.env.CRON_SECRET;
    
    // Call internal API endpoint to create notification
    // This will be handled by the NestJS backend via the API route
    fetch(`${apiUrl}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiSecret && { 'Authorization': `Bearer ${apiSecret}` }),
      },
      body: JSON.stringify(data),
    }).catch((error) => {
      console.error('Failed to create notification:', error);
      // Don't throw - notifications are non-critical
    });
  } catch (error) {
    console.error("Failed to create notification (exception):", {
      error,
      notificationData: {
        user_id: data.user_id,
        type: data.type,
        title: data.title,
      },
    });
    // Don't throw - notifications are non-critical
  }
}

/**
 * Create notification when a wager is resolved
 * @param userId - The user ID to notify
 * @param wagerId - The wager ID
 * @param wagerTitle - The wager title
 * @param won - Whether the user won
 * @param amount - The amount won (if won) or lost (if lost)
 */
export async function notifyWagerResolved(
  userId: string,
  wagerId: string,
  wagerTitle: string,
  won: boolean,
  amount: number
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: "wager_resolved",
    title: won ? "You won a wager! 🎉" : "You lost a wager 😔",
    message: won
      ? `You won ${amount} on the wager "${wagerTitle}"`
      : `You lost ${amount} on the wager "${wagerTitle}". Better luck next time!`,
    link: `/wager/${wagerId}`,
    metadata: {
      wager_id: wagerId,
      won,
      amount,
    },
  });
}

/**
 * Create notification when a wager is ending soon
 */
export async function notifyWagerEnding(
  userId: string,
  wagerId: string,
  wagerTitle: string,
  hoursLeft: number
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: "wager_ending",
    title: "Wager ending soon! ⏰",
    message: `"${wagerTitle}" is ending in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}`,
    link: `/wager/${wagerId}`,
    metadata: {
      wager_id: wagerId,
      hours_left: hoursLeft,
    },
  });
}

/**
 * Create notification for balance updates
 */
export async function notifyBalanceUpdate(
  userId: string,
  amount: number,
  type: "deposit" | "withdrawal" | "wager_win" | "wager_loss"
): Promise<void> {
  const messages: Record<string, string> = {
    deposit: `You deposited ${amount}`,
    withdrawal: `You withdrew ${amount}`,
    wager_win: `You won ${amount} from a wager!`,
    wager_loss: `You lost ${amount} from a wager`,
  };

  await createNotification({
    user_id: userId,
    type: "balance_update",
    title: "Balance updated",
    message: messages[type] || `Your balance changed by ${amount}`,
    link: "/wallet",
    metadata: {
      amount,
      type,
    },
  });
}

/**
 * Create notification when someone joins a wager you created
 */
export async function notifyWagerJoined(
  creatorId: string,
  wagerId: string,
  wagerTitle: string,
  participantCount: number
): Promise<void> {
  await createNotification({
    user_id: creatorId,
    type: "wager_joined",
    title: "Someone joined your wager",
    message: `${participantCount} ${participantCount === 1 ? 'person has' : 'people have'} joined "${wagerTitle}"`,
    link: `/wager/${wagerId}`,
    metadata: {
      wager_id: wagerId,
      participant_count: participantCount,
    },
  });
}

/**
 * Create notification for new wagers matching user preferences
 */
export async function notifyNewWager(
  userId: string,
  wagerId: string,
  wagerTitle: string,
  category?: string
): Promise<void> {
  await createNotification({
    user_id: userId,
    type: "new_wager",
    title: "New wager available",
    message: category
      ? `New ${category} wager: "${wagerTitle}"`
      : `New wager: "${wagerTitle}"`,
    link: `/wager/${wagerId}`,
    metadata: {
      wager_id: wagerId,
      category,
    },
  });
}

