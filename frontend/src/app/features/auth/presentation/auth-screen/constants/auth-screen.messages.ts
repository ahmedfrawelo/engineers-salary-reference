export const AUTH_SCREEN_MESSAGES = {
  signupTermsRequired: 'Please accept the Engineers Reference charter to continue',
  signupFailed: 'Unable to create account',
  signupSuccess: 'Your request has been sent to the admin.',
  fullNameRequired: 'Please enter your full name',
  fullNameMinLength: 'Full name must be at least 3 characters',
  emailRequired: 'Please enter your email address',
  emailInvalid: 'Please enter a valid email address',
  passwordRequired: 'Please enter a password',
  passwordMinLength: 'Password must be at least 10 characters',
  passwordLowercase: 'Password must contain at least one lowercase letter',
  passwordUppercase: 'Password must contain at least one uppercase letter',
  passwordDigit: 'Password must contain at least one number',
  passwordSpecial: 'Password must contain at least one special character',
  confirmPasswordRequired: 'Please confirm your password',
  passwordMismatch: 'Passwords must match',
  reviewFields: 'Please review the highlighted fields'
} as const;
