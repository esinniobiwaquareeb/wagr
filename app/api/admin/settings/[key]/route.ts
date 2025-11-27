import { NextRequest } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/server';
import { AppError, logError } from '@/lib/error-handler';
import { ErrorCode } from '@/lib/error-handler';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';

/**
 * GET /api/admin/settings/[key]
 * Get a specific setting by key (admin only, or public if is_public=true)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const user = await requireAuth();
    const serviceSupabase = createServiceRoleClient();
    const { key } = await params;

    // Get setting
    const { data: setting, error } = await serviceSupabase
      .from('platform_settings')
      .select('*')
      .eq('key', key)
      .single();

    if (error || !setting) {
      throw new AppError(ErrorCode.WAGER_NOT_FOUND, 'Setting not found');
    }

    // Check if user is admin or setting is public
    if (!setting.is_public) {
      const { data: profile } = await serviceSupabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (!profile?.is_admin) {
        throw new AppError(ErrorCode.FORBIDDEN, 'Only admins can access this setting');
      }
    }

    return successResponseNext({ setting });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

/**
 * PATCH /api/admin/settings/[key]
 * Update a specific setting (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const user = await requireAuth();
    const serviceSupabase = createServiceRoleClient();
    const { key } = await params;

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
    const { value, category, label, description, data_type, is_public, requires_restart } = body;

    if (value === undefined) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Value is required');
    }

    // Get existing setting to validate data_type and preserve other fields
    const { data: existingSetting } = await serviceSupabase
      .from('platform_settings')
      .select('data_type, category, label, description, is_public, requires_restart')
      .eq('key', key)
      .single();

    const settingDataType = data_type || existingSetting?.data_type || 'string';

    // Validate and convert value based on data_type
    let validatedValue = value;
    if (settingDataType === 'boolean') {
      validatedValue = typeof value === 'boolean' ? value : value === 'true' || value === true;
    } else if (settingDataType === 'number') {
      validatedValue = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(validatedValue)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid number value');
      }
    } else if (settingDataType === 'array') {
      validatedValue = Array.isArray(value) ? value : JSON.parse(value);
    } else if (settingDataType === 'json') {
      validatedValue = typeof value === 'object' ? value : JSON.parse(value);
    }

    const { data: setting, error } = await serviceSupabase
      .from('platform_settings')
      .upsert({
        key,
        value: validatedValue,
        category: category || existingSetting?.category || 'general',
        label: label || existingSetting?.label || key,
        description: description !== undefined ? description : existingSetting?.description,
        data_type: settingDataType,
        is_public: is_public !== undefined ? is_public : existingSetting?.is_public || false,
        requires_restart: requires_restart !== undefined ? requires_restart : existingSetting?.requires_restart || false,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      })
      .select()
      .single();

    if (error) {
      logError(new Error(`Failed to update setting: ${error.message}`), { error });
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to update setting');
    }

    return successResponseNext({
      message: 'Setting updated successfully',
      setting,
      requiresRestart: setting.requires_restart,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

