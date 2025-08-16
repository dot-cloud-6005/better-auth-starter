import { NextRequest } from "next/server";
import { createFile } from "@/server/storage";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSupabaseAdmin, getSupabaseBucket } from '@/lib/supabase';
import { 
  validateFile, 
  validateStorageInput, 
  generateSecureStoragePath, 
  createAuditLog, 
  StorageAuditAction,
  UPLOAD_CONFIG 
} from '@/lib/security';
import { rateLimitTake } from '@/lib/rate-limit';

export const runtime = 'nodejs';

async function getUserId() {
  const s = await auth.api.getSession({ headers: await headers() });
  return s?.user.id ?? null;
}

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  return 'unknown';
}

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);
  let userId: string | null = null;
  let organizationId = '';
  
  try {
    // Get user session first
    userId = await getUserId();
    if (!userId) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, 'anonymous', '', null, 
        { reason: 'No authentication' }, clientIP);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting - check uploads per minute
    const uploadRateKey = `upload_rate:${userId}`;
    const rateCheck = await rateLimitTake(uploadRateKey, UPLOAD_CONFIG.MAX_FILES_PER_UPLOAD, 60);
    
    if (!rateCheck.allowed) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, '', null, 
        { reason: 'Rate limit exceeded', remaining: rateCheck.remaining }, clientIP);
      return Response.json({ 
        error: 'Upload rate limit exceeded. Please try again later.',
        remaining: rateCheck.remaining 
      }, { status: 429 });
    }

    // Parse form data with size limits
    const form = await req.formData();
    
    // Validate input parameters
    const inputData = {
      organizationId: String(form.get('organizationId') || ''),
      parentId: (form.get('parentId') as string) || null,
      visibility: (form.get('visibility') as string) || 'private',
      userIds: (form.get('userIds') as string) || '',
    };
    
    organizationId = inputData.organizationId;
    
    const inputValidation = validateStorageInput(inputData);
    if (!inputValidation.isValid) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, organizationId, null, 
        { reason: 'Invalid input', errors: inputValidation.errors }, clientIP);
      return Response.json({ 
        error: 'Invalid input parameters', 
        details: inputValidation.errors 
      }, { status: 400 });
    }

    // Extract and validate file
    const file = form.get('file') as unknown as File;
    if (!file) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, organizationId, null, 
        { reason: 'No file provided' }, clientIP);
      return Response.json({ error: 'Missing file' }, { status: 400 });
    }

    // Validate file security
    const fileValidation = validateFile(file);
    if (!fileValidation.isValid) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, organizationId, null, 
        { reason: 'Invalid file', errors: fileValidation.errors, filename: file.name }, clientIP);
      return Response.json({ 
        error: 'Invalid file', 
        details: fileValidation.errors 
      }, { status: 400 });
    }

    // Parse user IDs for custom visibility
    const userIds = inputData.userIds ? 
      inputData.userIds.split(',').map(s => s.trim()).filter(Boolean) : 
      undefined;

    // Validate visibility and user IDs combination
    if (inputData.visibility === 'custom' && (!userIds || userIds.length === 0)) {
      return Response.json({ 
        error: 'Custom visibility requires at least one user ID' 
      }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);

    // Generate secure storage path
    const storagePath = generateSecureStoragePath(
      organizationId, 
      inputData.parentId, 
      file.name
    );

    // Upload to Supabase Storage with security headers
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, organizationId, null, 
        { reason: 'Storage service unavailable' }, clientIP);
      return Response.json({ error: 'Storage service unavailable' }, { status: 500 });
    }
    
    const bucket = getSupabaseBucket();
    const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
      cacheControl: '3600',
      duplex: 'half', // Security: prevent request smuggling
    });
    
    if (upErr) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, organizationId, null, 
        { reason: 'Upload failed', error: upErr.message, filename: file.name }, clientIP);
      return Response.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }

    // Create database record
    const res = await createFile({
      organizationId: inputData.organizationId,
      parentId: inputData.parentId,
      name: file.name,
      mimeType: file.type,
      size: buf.length,
      storagePath,
      visibility: inputData.visibility as "org"|"private"|"custom",
      userIds,
    }, userId);

    // Log successful upload
    createAuditLog(StorageAuditAction.FILE_UPLOAD, userId, organizationId, res.id, {
      filename: file.name,
      size: buf.length,
      mimeType: file.type,
      visibility: inputData.visibility,
      storagePath
    }, clientIP);

    return Response.json(res);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    
    // Log the error
    createAuditLog(StorageAuditAction.ACCESS_DENIED, userId || 'unknown', organizationId, null, 
      { reason: 'Exception during upload', error: message }, clientIP);
    
    console.error('Upload error:', e);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
