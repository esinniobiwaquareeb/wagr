import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';

/**
 * GET /api/settings/public
 * Get all public platform settings (accessible to all users)
 */
export async function GET(request: NextRequest) {
  try {
    const serviceSupabase = createServiceRoleClient();

    // Get only public settings
    const { data: settings, error } = await serviceSupabase
      .from('platform_settings')
      .select('key, value')
      .eq('is_public', true);

    if (error) {
      logError(new Error(`Failed to fetch public settings: ${error.message}`), { error });
      throw new Error('Failed to fetch settings');
    }

    // Convert to key-value map
    const settingsMap: Record<string, any> = {};
    (settings || []).forEach((setting: any) => {
      settingsMap[setting.key] = setting.value;
    });

    return successResponseNext({ settings: settingsMap });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

