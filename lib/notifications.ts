// Notification helper functions
// Used to create notifications for various events

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role for creating notifications (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
 */
export async function createNotification(data: NotificationData): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link || null,
        metadata: data.metadata || null,
        read: false,
      });

    if (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  } catch (error) {
    console.error("Failed to create notification:", error);
    // Don't throw - notifications are non-critical
  }
}

/**
 * Create notification when a wager is resolved
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
    title: won ? "You won a wager! 🎉" : "Wager resolved",
    message: won
      ? `You won ${amount} on "${wagerTitle}"`
      : `The wager "${wagerTitle}" has been resolved`,
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

