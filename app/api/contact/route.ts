import { NextRequest, NextResponse } from 'next/server';
import { nestjsServerFetch } from '@/lib/nestjs-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Sanitize and validate input
    const { sanitizeString, sanitizeEmail, escapeHtml } = await import('@/lib/security/input-sanitizer');
    
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Valid name is required' },
        { status: 400 }
      );
    }
    const sanitizedName = sanitizeString(name, 100);

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }
    const sanitizedEmail = sanitizeEmail(email);
    if (!sanitizedEmail) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
      return NextResponse.json(
        { error: 'Valid subject is required' },
        { status: 400 }
      );
    }
    const sanitizedSubject = sanitizeString(subject, 200);

    if (!message || typeof message !== 'string' || message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Valid message is required' },
        { status: 400 }
      );
    }
    const sanitizedMessage = sanitizeString(message, 5000);

    // Store contact message via NestJS backend
    try {
      const response = await nestjsServerFetch('/contact', {
        method: 'POST',
        requireAuth: false,
        body: JSON.stringify({
          name: sanitizedName,
          email: sanitizedEmail,
          subject: sanitizedSubject,
          message: sanitizedMessage,
        }),
      });

      if (!response.success) {
        console.error('Error storing contact message:', response.error);
        // Still return success to user, but log for admin review
      }
    } catch (error) {
      console.error('Error calling contact API:', error);
      // Still return success to user, but log for admin review
    }

    return NextResponse.json({
      success: true,
      message: 'Message received successfully',
    });
  } catch (error) {
    console.error('Error processing contact form:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

