import { NextRequest } from 'next/server';
import { nestjsPost } from '@/lib/nestjs-client';
import { successResponseNext, appErrorToResponse } from '@/lib/api-response';
import { logError } from '@/lib/error-handler';

/**
 * POST /api/wagers/check-title
 * Check if a wager title is similar to existing wagers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, excludeId } = body;

    if (!title || typeof title !== 'string' || title.trim().length < 5) {
      return successResponseNext({
        isDuplicate: false,
        similarWagers: [],
        suggestions: [],
      });
    }

    // Call NestJS backend to check title
    const result = await nestjsPost<{
      isDuplicate: boolean;
      similarWagers: any[];
      suggestions: string[];
    }>('/wagers/check-title', {
      title: title.trim(),
      excludeId,
    }, { requireAuth: false });

    if (!result) {
      return successResponseNext({
        isDuplicate: false,
        similarWagers: [],
        suggestions: [],
      });
    }

    return successResponseNext({
      isDuplicate: result.isDuplicate,
      similarWagers: result.similarWagers,
      suggestions: result.suggestions,
    });
  } catch (error) {
    logError(error as Error);
    return appErrorToResponse(error);
  }
}

