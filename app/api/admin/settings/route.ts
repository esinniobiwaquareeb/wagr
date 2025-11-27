import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/admin/settings
 * Get all platform settings (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const serviceSupabase = createServiceRoleClient();

    // Check if user is admin
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only admins can access settings');
    }

    // Get all settings
    const { data: settings, error } = await serviceSupabase
      .from('platform_settings')
      .select('*')
      .order('category', { ascending: true })
      .order('key', { ascending: true });

    if (error) {
      logError(new Error(`Failed to fetch settings: ${error.message}`), { error });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to fetch settings');
    }

    // Group settings by category
    const groupedSettings = (settings || []).reduce((acc: any, setting: any) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {});

    return successResponseNext({
      settings: settings || [],
      grouped: groupedSettings,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/admin/settings
 * Update platform settings (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const serviceSupabase = createServiceRoleClient();

    // Check if user is admin
    const { data: profile } = await serviceSupabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      throw new AppError(ErrorCode.FORBIDDEN, 'Only admins can update settings');
    }

    const body = await request.json();
    const { settings } = body;

    if (!Array.isArray(settings)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Settings must be an array');
    }

    // Update each setting
    const updatedSettings = [];
    for (const setting of settings) {
      const { key, value, category, label, description, data_type, is_public, requires_restart } = setting;

      if (!key || value === undefined) {
        continue;
      }

      // Validate value based on data_type
      let validatedValue = value;
      if (data_type === 'boolean') {
        validatedValue = typeof value === 'boolean' ? value : value === 'true' || value === true;
      } else if (data_type === 'number') {
        validatedValue = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(validatedValue)) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, `Invalid number value for ${key}`);
        }
      } else if (data_type === 'array') {
        validatedValue = Array.isArray(value) ? value : JSON.parse(value);
      } else if (data_type === 'json') {
        validatedValue = typeof value === 'object' ? value : JSON.parse(value);
      }

      const { data, error } = await serviceSupabase
        .from('platform_settings')
        .upsert({
          key,
          value: validatedValue,
          category: category || 'general',
          label: label || key,
          description: description || null,
          data_type: data_type || 'string',
          is_public: is_public || false,
          requires_restart: requires_restart || false,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'key',
        })
        .select()
        .single();

      if (error) {
        logError(new Error(`Failed to update setting ${key}: ${error.message}`), { error });
        throw new AppError(ErrorCode.DATABASE_ERROR, `Failed to update setting: ${key}`);
      }

      if (data) {
        updatedSettings.push(data);
      }
    }

    return successResponseNext({
      message: 'Settings updated successfully',
      settings: updatedSettings,
      requiresRestart: updatedSettings.some((s: any) => s.requires_restart),
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

