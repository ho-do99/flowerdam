import {
  validateEmail,
  validatePassword,
  validatePhone,
  validateRole,
} from '../src/utils/validation';

describe('Validation Utils', () => {
  // Email validation tests
  describe('validateEmail', () => {
    test('should accept valid email', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user+tag@domain.co.kr')).toBe(true);
    });

    test('should reject invalid email', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  // Password validation tests
  describe('validatePassword', () => {
    test('should accept strong password', () => {
      const result = validatePassword('StrongPass123');
      expect(result.valid).toBe(true);
    });

    test('should reject password with less than 8 characters', () => {
      const result = validatePassword('Weak1');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 8 characters');
    });

    test('should reject password without uppercase', () => {
      const result = validatePassword('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('uppercase');
    });

    test('should reject password without lowercase', () => {
      const result = validatePassword('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('lowercase');
    });

    test('should reject password without number', () => {
      const result = validatePassword('NoNumbers');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('number');
    });
  });

  // Phone validation tests
  describe('validatePhone', () => {
    test('should accept valid Korean phone numbers', () => {
      expect(validatePhone('010-1234-5678')).toBe(true);
      expect(validatePhone('01012345678')).toBe(true);
      expect(validatePhone('02-1234-5678')).toBe(true);
    });

    test('should reject invalid phone numbers', () => {
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('0101')).toBe(false);
      expect(validatePhone('abcd-efgh-ijkl')).toBe(false);
    });
  });

  // Role validation tests
  describe('validateRole', () => {
    test('should accept valid roles', () => {
      expect(validateRole('customer')).toBe(true);
      expect(validateRole('seller')).toBe(true);
      expect(validateRole('partner_owner')).toBe(true);
      expect(validateRole('partner_staff')).toBe(true);
      expect(validateRole('admin')).toBe(true);
    });

    test('should reject invalid roles', () => {
      expect(validateRole('invalid')).toBe(false);
      expect(validateRole('user')).toBe(false);
      expect(validateRole('')).toBe(false);
    });
  });
});
