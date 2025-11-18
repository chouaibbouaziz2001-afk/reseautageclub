import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptcha } from '@/lib/verify-recaptcha';
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP to prevent abuse
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`recaptcha:${clientIp}`, RATE_LIMITS.api);
    if (rateLimit.limited) {
      return createRateLimitResponse(rateLimit.resetTime);
    }

    const body = await request.json();
    const { token } = body;

    // SECURITY: Validate input
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'reCAPTCHA token is required and must be a string' },
        { status: 400 }
      );
    }

    // SECURITY: Limit token length to prevent abuse
    if (token.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Invalid token format' },
        { status: 400 }
      );
    }

    const result = await verifyRecaptcha(token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, score: result.score });
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
