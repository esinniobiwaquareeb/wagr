// Notification helper functions
// Used to create notifications for various events

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role for creating notifications (bypasses RLS)
// Initialize only if both URL and key are available
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

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
 */
export async function createNotification(data: NotificationData): Promise<void> {
  try {
    // Validate service role key is configured
    if (!supabaseServiceKey || !supabaseUrl || !supabaseAdmin) {
      console.error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is not configured. Cannot create notification.");
      return;
    }

    // Check user preferences
    // Note: If preferences don't exist, we default to enabled (fail open)
    const { data: preferences } = await supabaseAdmin
      .from('user_preferences')
      .select('notification_enabled, notification_types')
      .eq('user_id', data.user_id)
      .maybeSingle();

    // If notifications are explicitly disabled, don't create notification
    // Default to enabled if preferences don't exist
    if (preferences && preferences.notification_enabled === false) {
      return;
    }

    // If notification types are specified, check if this type is enabled
    // Only check if user has explicitly set notification_types (non-empty array)
    if (preferences?.notification_types && Array.isArray(preferences.notification_types) && preferences.notification_types.length > 0) {
      if (!preferences.notification_types.includes(data.type)) {
        // User has specific notification types enabled, and this type is not in the list
        return;
      }
    }

    const { data: insertedData, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link || null,
        metadata: data.metadata || null,
        read: false,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error("Error creating notification:", {
        error,
        notificationData: {
          user_id: data.user_id,
          type: data.type,
          title: data.title,
        },
      });
      // Don't throw - notifications are non-critical, but log for debugging
      return;
    }

    if (!insertedData) {
      console.error("Notification insert returned no data:", {
        notificationData: {
          user_id: data.user_id,
          type: data.type,
          title: data.title,
        },
      });
      return;
    }

    // Send push notification if enabled (async, don't wait)
    if (insertedData) {
      // Check if push notifications are enabled for this user
      const { data: pushPrefs } = await supabaseAdmin
        .from('user_preferences')
        .select('push_notifications_enabled')
        .eq('user_id', data.user_id)
        .maybeSingle();

      if (pushPrefs?.push_notifications_enabled === true) {
        // Send push notification asynchronously (don't wait)
        const pushUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const apiSecret = process.env.NOTIFICATION_API_SECRET || process.env.CRON_SECRET;
        
        fetch(`${pushUrl}/api/push/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiSecret && { 'Authorization': `Bearer ${apiSecret}` }),
          },
          body: JSON.stringify({
            user_id: data.user_id,
            title: data.title,
            body: data.message,
            url: data.link || null,
            data: {
              ...data.metadata,
              notification_id: insertedData.id,
              type: data.type,
            },
          }),
        }).catch((error) => {
          console.error('Failed to send push notification:', error);
          // Don't throw - push notifications are non-critical
        });
      }
    }
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

