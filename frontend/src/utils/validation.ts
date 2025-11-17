/**
 * Input Validation Utilities
 *
 * Provides sanitization and validation functions to prevent XSS, injection attacks,
 * and ensure data integrity for user-generated content.
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes potentially dangerous tags and attributes
 */
export function sanitizeHTML(input: string): string {
  if (!input) return '';

  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.textContent = input; // This automatically escapes HTML
  return temp.innerHTML;
}

/**
 * Validate and sanitize broadcast title
 */
export function validateBroadcastTitle(title: string): { valid: boolean; sanitized: string; error?: string } {
  if (!title || typeof title !== 'string') {
    return { valid: false, sanitized: '', error: 'Title is required' };
  }

  const trimmed = title.trim();

  if (trimmed.length === 0) {
    return { valid: false, sanitized: '', error: 'Title cannot be empty' };
  }

  if (trimmed.length > 200) {
    return { valid: false, sanitized: trimmed.slice(0, 200), error: 'Title must be 200 characters or less' };
  }

  // Remove control characters and excessive whitespace
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ');

  return { valid: true, sanitized };
}

/**
 * Validate and sanitize participant name
 */
export function validateParticipantName(name: string): { valid: boolean; sanitized: string; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, sanitized: '', error: 'Name is required' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, sanitized: '', error: 'Name cannot be empty' };
  }

  if (trimmed.length > 50) {
    return { valid: false, sanitized: trimmed.slice(0, 50), error: 'Name must be 50 characters or less' };
  }

  // Only allow alphanumeric, spaces, hyphens, and underscores
  const sanitized = trimmed.replace(/[^a-zA-Z0-9 \-_]/g, '');

  if (sanitized.length === 0) {
    return { valid: false, sanitized, error: 'Name contains invalid characters' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate and sanitize chat message
 */
export function validateChatMessage(message: string): { valid: boolean; sanitized: string; error?: string } {
  if (!message || typeof message !== 'string') {
    return { valid: false, sanitized: '', error: 'Message is required' };
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { valid: false, sanitized: '', error: 'Message cannot be empty' };
  }

  if (trimmed.length > 500) {
    return { valid: false, sanitized: trimmed.slice(0, 500), error: 'Message must be 500 characters or less' };
  }

  // Remove control characters but allow newlines
  const sanitized = trimmed.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Sanitize HTML to prevent XSS
  const htmlSanitized = sanitizeHTML(sanitized);

  return { valid: true, sanitized: htmlSanitized };
}

/**
 * Validate URL for safety (prevent javascript:, data:, etc.)
 */
export function validateURL(url: string): { valid: boolean; sanitized: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, sanitized: '', error: 'URL is required' };
  }

  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, sanitized: '', error: 'Only HTTP and HTTPS URLs are allowed' };
    }

    return { valid: true, sanitized: parsed.toString() };
  } catch (error) {
    return { valid: false, sanitized: '', error: 'Invalid URL format' };
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { valid: boolean; sanitized: string; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, sanitized: '', error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(trimmed)) {
    return { valid: false, sanitized: '', error: 'Invalid email format' };
  }

  if (trimmed.length > 254) {
    return { valid: false, sanitized: '', error: 'Email is too long' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate RTMP URL for streaming
 */
export function validateRTMPURL(url: string): { valid: boolean; sanitized: string; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, sanitized: '', error: 'RTMP URL is required' };
  }

  const trimmed = url.trim();

  // RTMP URLs should start with rtmp:// or rtmps://
  if (!trimmed.startsWith('rtmp://') && !trimmed.startsWith('rtmps://')) {
    return { valid: false, sanitized: '', error: 'RTMP URL must start with rtmp:// or rtmps://' };
  }

  try {
    const parsed = new URL(trimmed);
    return { valid: true, sanitized: parsed.toString() };
  } catch (error) {
    return { valid: false, sanitized: '', error: 'Invalid RTMP URL format' };
  }
}

/**
 * Sanitize and validate file name
 */
export function validateFileName(fileName: string): { valid: boolean; sanitized: string; error?: string } {
  if (!fileName || typeof fileName !== 'string') {
    return { valid: false, sanitized: '', error: 'File name is required' };
  }

  const trimmed = fileName.trim();

  if (trimmed.length === 0) {
    return { valid: false, sanitized: '', error: 'File name cannot be empty' };
  }

  // Remove path traversal attempts and invalid characters
  let sanitized = trimmed
    .replace(/\.\./g, '') // Remove ..
    .replace(/[/\\]/g, '') // Remove slashes
    .replace(/[<>:"|?*\x00-\x1F]/g, '') // Remove invalid file name characters
    .trim();

  if (sanitized.length === 0) {
    return { valid: false, sanitized: '', error: 'File name contains only invalid characters' };
  }

  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    const nameWithoutExt = sanitized.slice(0, -(ext?.length || 0) - 1);
    sanitized = nameWithoutExt.slice(0, 255 - (ext?.length || 0) - 1) + '.' + ext;
  }

  return { valid: true, sanitized };
}

/**
 * Rate limiting helper - tracks request counts
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a request should be allowed
   */
  allowRequest(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  /**
   * Get remaining requests for a key
   */
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);

    return Math.max(0, this.maxRequests - validRequests.length);
  }

  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.requests.clear();
  }
}
