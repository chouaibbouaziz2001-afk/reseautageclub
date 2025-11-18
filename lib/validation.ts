export const BUSINESS_STAGES = [
  { value: 'idea', label: 'Idea Stage', description: 'Just exploring a business idea' },
  { value: 'validation', label: 'Validation Stage', description: 'Validating market fit' },
  { value: 'mvp', label: 'MVP Stage', description: 'Building minimum viable product' },
  { value: 'launch', label: 'Launch Stage', description: 'Launching to market' },
  { value: 'growth', label: 'Growth Stage', description: 'Scaling the business' },
  { value: 'established', label: 'Established', description: 'Running profitable business' },
  { value: 'exit', label: 'Exit Stage', description: 'Planning exit strategy' },
] as const;

export type BusinessStage = typeof BUSINESS_STAGES[number]['value'];

export function getStageLabel(stage: string): string {
  const stageInfo = BUSINESS_STAGES.find(s => s.value === stage);
  return stageInfo?.label || stage;
}

export function getStageDescription(stage: string): string {
  const stageInfo = BUSINESS_STAGES.find(s => s.value === stage);
  return stageInfo?.description || '';
}

export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'Email is required' };
  }

  const emailRegex = /^[A-Za-z0-9._+\-àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address like user@example.com'
    };
  }

  if (email.includes('..')) {
    return {
      isValid: false,
      error: 'Email cannot contain consecutive dots'
    };
  }

  if (email.split('@').length !== 2) {
    return {
      isValid: false,
      error: 'Email must contain exactly one @ symbol'
    };
  }

  if (email.includes(' ')) {
    return {
      isValid: false,
      error: 'Email cannot contain spaces'
    };
  }

  return { isValid: true };
}

export function validatePhoneNumber(phone: string): { isValid: boolean; error?: string } {
  if (!phone || phone.trim() === '') {
    return { isValid: true };
  }

  const digitsOnly = phone.replace(/[\s\-()]/g, '');

  if (!/^[0-9+]+$/.test(digitsOnly)) {
    return {
      isValid: false,
      error: 'Phone number can only contain digits, spaces, dashes, and parentheses'
    };
  }

  const hasPlus = digitsOnly.startsWith('+');
  const digits = digitsOnly.replace('+', '');

  if (digits.length < 7 || digits.length > 15) {
    return {
      isValid: false,
      error: 'Phone number must be between 7 and 15 digits'
    };
  }

  if (!hasPlus && digits.length === 10) {
    const areaCode = digits.substring(0, 3);
    if (['514', '438', '450', '418', '819', '873', '581'].includes(areaCode)) {
      return { isValid: true };
    }
    if (digits.startsWith('0')) {
      return { isValid: true };
    }
  }

  if (hasPlus && digits.length >= 7 && digits.length <= 15) {
    return { isValid: true };
  }

  if (digits.length === 10) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: 'Please enter a valid phone number (10 digits for Canada/France, or international format with +)'
  };
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  const digitsOnly = phone.replace(/[\s\-()]/g, '').replace('+', '');

  if (digitsOnly.length === 10 && !phone.startsWith('+')) {
    if (digitsOnly.startsWith('0')) {
      return `${digitsOnly.substring(0, 2)} ${digitsOnly.substring(2, 4)} ${digitsOnly.substring(4, 6)} ${digitsOnly.substring(6, 8)} ${digitsOnly.substring(8, 10)}`;
    }
    return `${digitsOnly.substring(0, 3)}-${digitsOnly.substring(3, 6)}-${digitsOnly.substring(6, 10)}`;
  }

  return phone;
}

export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';

  let normalized = phone.replace(/[\s\-()]/g, '');

  if (!normalized.startsWith('+') && normalized.length > 0 && !/^[0-9+]/.test(normalized[0])) {
    return '';
  }

  return normalized;
}

export function validateStage(stage: string): { isValid: boolean; error?: string } {
  const validStages = BUSINESS_STAGES.map(s => s.value);

  if (!stage) {
    return { isValid: false, error: 'Please select your current business stage' };
  }

  if (!validStages.includes(stage as BusinessStage)) {
    return { isValid: false, error: 'Please select a valid business stage' };
  }

  return { isValid: true };
}
