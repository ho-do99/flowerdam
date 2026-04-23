// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)
export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  return { valid: true };
};

// Phone validation (Korean format: 010-xxxx-xxxx or 10 digits)
export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^01[0-9]-\d{3,4}-\d{4}$|^\d{10,11}$/;
  return phoneRegex.test(phone.replace(/-/g, ''));
};

// Role validation
export const validateRole = (role: string): boolean => {
  const validRoles = ['customer', 'seller', 'partner_owner', 'partner_staff', 'admin'];
  return validRoles.includes(role);
};
