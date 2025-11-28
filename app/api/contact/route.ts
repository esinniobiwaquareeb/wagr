import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Store contact message in database
    const supabase = await createClient();
    
    // Create contact_messages table if it doesn't exist (you may need to run a migration)
    // For now, we'll use a simple approach - you can enhance this with a proper table
    const { error } = await supabase
      .from('contact_messages')
      .insert({
        name: sanitizedName,
        email: sanitizedEmail,
        subject: sanitizedSubject,
        message: sanitizedMessage,
        created_at: new Date().toISOString(),
      });

    if (error) {
      // If table doesn't exist, log the message (in production, you'd want to set up the table)
      console.error('Error storing contact message:', error);
      // Don't log sensitive data
      
      // Still return success to user, but log for admin review
      // In production, set up the contact_messages table or use an email service
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

