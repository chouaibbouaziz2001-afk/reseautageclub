interface RecaptchaResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

export async function verifyRecaptcha(token: string): Promise<{
  success: boolean;
  score?: number;
  error?: string;
}> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('reCAPTCHA secret key is not configured');
    return { success: true };
  }

  try {
    const response = await fetch(
      'https://www.google.com/recaptcha/api/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `secret=${secretKey}&response=${token}`,
      }
    );

    const data: RecaptchaResponse = await response.json();

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes']?.join(', ') || 'reCAPTCHA verification failed',
      };
    }

    const score = data.score ?? 1;

    if (score < 0.5) {
      return {
        success: false,
        score,
        error: 'Low reCAPTCHA score. Please try again.',
      };
    }

    return {
      success: true,
      score,
    };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return {
      success: true,
    };
  }
}
