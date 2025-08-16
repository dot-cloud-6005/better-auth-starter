import path from 'path';
import { randomUUID } from 'node:crypto';

// File upload security configuration
export const UPLOAD_CONFIG = {
  // Maximum file size in bytes (50MB)
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  
  // Maximum number of files per upload
  MAX_FILES_PER_UPLOAD: 10,
  
  // Allowed MIME types
  ALLOWED_MIME_TYPES: [
    // Images
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Text files
    'text/plain',
    'text/csv',
    'application/json',
    'application/xml',
    'text/xml',
    
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    
    // Audio/Video (common formats)
    'audio/mpeg',
    'audio/wav',
    'video/mp4',
    'video/mpeg',
  ],
  
  // Allowed file extensions
  ALLOWED_EXTENSIONS: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.txt', '.csv', '.json', '.xml',
    '.zip', '.rar', '.7z',
    '.mp3', '.wav', '.mp4', '.mpeg',
  ],
  
  // Dangerous file extensions to explicitly block
  BLOCKED_EXTENSIONS: [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.vbe', '.js', '.jar',
    '.sh', '.ps1', '.php', '.asp', '.aspx', '.jsp', '.pl', '.py', '.rb',
    '.msi', '.deb', '.rpm', '.dmg', '.pkg',
  ],
};

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename');
  }
  
  // Remove path separators and null bytes
  let sanitized = filename.replace(/[\/\\:\*\?"<>\|]/g, '_');
  sanitized = sanitized.replace(/\x00/g, '');
  
  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[\.\s]+|[\.\s]+$/g, '');
  
  // Ensure it's not empty
  if (!sanitized) {
    sanitized = 'unnamed_file';
  }
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    sanitized = name.substring(0, 255 - ext.length) + ext;
  }
  
  // Avoid reserved Windows names
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6',
    'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6',
    'LPT7', 'LPT8', 'LPT9'
  ];
  
  const nameWithoutExt = path.basename(sanitized, path.extname(sanitized));
  if (reservedNames.includes(nameWithoutExt.toUpperCase())) {
    sanitized = `file_${sanitized}`;
  }
  
  return sanitized;
}

/**
 * Generate a secure file path for storage
 */
export function generateSecureStoragePath(
  organizationId: string, 
  parentId: string | null, 
  originalFilename: string
): string {
  const sanitizedFilename = sanitizeFilename(originalFilename);
  const fileId = randomUUID();
  const timestamp = Date.now();
  
  // Create a secure path structure
  const basePath = `${organizationId}/${parentId || 'root'}`;
  const securePath = `${basePath}/${timestamp}_${fileId}_${sanitizedFilename}`;
  
  return securePath;
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check file size
  if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum allowed size of ${UPLOAD_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // Check file extension
  const extension = path.extname(file.name).toLowerCase();
  if (UPLOAD_CONFIG.BLOCKED_EXTENSIONS.includes(extension)) {
    errors.push(`File type '${extension}' is not allowed for security reasons`);
  }
  
  if (!UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(extension)) {
    errors.push(`File type '${extension}' is not supported`);
  }
  
  // Check MIME type
  if (file.type && !UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
    errors.push(`MIME type '${file.type}' is not allowed`);
  }
  
  // Check for empty files
  if (file.size === 0) {
    errors.push('Empty files are not allowed');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate input parameters for storage operations
 */
export function validateStorageInput(input: Record<string, unknown>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate organization ID
  if (!input.organizationId || typeof input.organizationId !== 'string') {
    errors.push('Valid organization ID is required');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(input.organizationId)) {
    errors.push('Organization ID contains invalid characters');
  }
  
  // Validate parent ID if provided
  if (input.parentId && typeof input.parentId !== 'string') {
    errors.push('Parent ID must be a string');
  } else if (input.parentId && typeof input.parentId === 'string' && !/^[a-zA-Z0-9_-]+$/.test(input.parentId)) {
    errors.push('Parent ID contains invalid characters');
  }
  
  // Validate visibility
  if (input.visibility && !['org', 'private', 'custom'].includes(input.visibility as string)) {
    errors.push('Visibility must be one of: org, private, custom');
  }
  
  // Validate name if provided
  if (input.name && typeof input.name === 'string') {
    if (input.name.length > 255) {
      errors.push('Name cannot exceed 255 characters');
    }
    if (input.name.trim().length === 0) {
      errors.push('Name cannot be empty');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Rate limiting configuration for file operations
 */
export const RATE_LIMITS = {
  // Maximum uploads per minute per user
  UPLOADS_PER_MINUTE: 10,
  
  // Maximum downloads per minute per user  
  DOWNLOADS_PER_MINUTE: 100,
  
  // Maximum storage operations per minute per user
  STORAGE_OPS_PER_MINUTE: 50,
};

/**
 * Audit log types for storage operations
 */
export enum StorageAuditAction {
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_DOWNLOAD = 'FILE_DOWNLOAD', 
  FILE_DELETE = 'FILE_DELETE',
  FILE_RENAME = 'FILE_RENAME',
  FOLDER_CREATE = 'FOLDER_CREATE',
  FOLDER_DELETE = 'FOLDER_DELETE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  ACCESS_DENIED = 'ACCESS_DENIED',
}

/**
 * Create audit log entry
 */
export function createAuditLog(
  action: StorageAuditAction,
  userId: string,
  organizationId: string,
  itemId: string | null,
  details: Record<string, unknown> = {},
  ipAddress?: string
) {
  const logEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    userId,
    organizationId,
    itemId,
    details,
    ipAddress,
  };
  
  // In production, this should be sent to a proper logging service
  console.log('STORAGE_AUDIT:', JSON.stringify(logEntry));
  
  return logEntry;
}
