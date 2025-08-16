import { NextRequest } from "next/server";
import { listItems } from "@/server/storage";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSupabaseAdmin, getSupabaseBucket } from '@/lib/supabase';
import { validateStorageInput, createAuditLog, StorageAuditAction, RATE_LIMITS } from '@/lib/security';
import { rateLimitTake } from '@/lib/rate-limit';

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

export async function GET(req: NextRequest) {
  const clientIP = getClientIP(req);
  let userId: string | undefined;
  let itemId = '';
  let orgId = '';
  
  try {
    const { searchParams } = new URL(req.url);
    itemId = searchParams.get('itemId') || '';
    orgId = searchParams.get('organizationId') || '';
    
    // Validate input parameters
    const inputValidation = validateStorageInput({ 
      organizationId: orgId,
      itemId: itemId 
    });
    
    if (!itemId || !orgId) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, 'unknown', orgId, itemId, 
        { reason: 'Missing required parameters' }, clientIP);
      return new Response('Missing required parameters', { status: 400 });
    }

    if (!inputValidation.isValid) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, 'unknown', orgId, itemId, 
        { reason: 'Invalid parameters', errors: inputValidation.errors }, clientIP);
      return new Response('Invalid parameters', { status: 400 });
    }

    // Get user session
    const s = await auth.api.getSession({ headers: await headers() });
    userId = s?.user.id;

    if (!userId) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, 'anonymous', orgId, itemId, 
        { reason: 'Unauthorized access attempt' }, clientIP);
      return new Response('Unauthorized', { status: 401 });
    }

    // Rate limiting for downloads
    const downloadRateKey = `download_rate:${userId}`;
    const rateCheck = await rateLimitTake(downloadRateKey, RATE_LIMITS.DOWNLOADS_PER_MINUTE, 60);
    
    if (!rateCheck.allowed) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, orgId, itemId, 
        { reason: 'Download rate limit exceeded', remaining: rateCheck.remaining }, clientIP);
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // First check through proper permission system
    const items = await listItems(orgId, undefined, userId);
    const allowedItem = items.find(i => i.id === itemId);
    
    if (!allowedItem) {
      // Log access denied - item not found or no permission
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, orgId, itemId, 
        { reason: 'Item not found or access denied' }, clientIP);
      return new Response('Not found', { status: 404 });
    }

    // Validate file properties
    if (!allowedItem.storagePath || allowedItem.type !== 'file') {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, orgId, itemId, 
        { reason: 'Invalid file or not a file type', type: allowedItem.type }, clientIP);
      return new Response('Not a downloadable file', { status: 400 });
    }

    // Generate signed URL from Supabase Storage
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, orgId, itemId, 
        { reason: 'Storage service unavailable' }, clientIP);
      return new Response('Storage service unavailable', { status: 500 });
    }
    
    const bucket = getSupabaseBucket();
    
    // Create signed URL with limited expiration (5 minutes for security)
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(
      allowedItem.storagePath, 
      300, // 5 minutes expiration
      {
        download: allowedItem.name,
      }
    );
    
    if (error || !data?.signedUrl) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, orgId, itemId, 
        { reason: 'Failed to generate download URL', error: error?.message }, clientIP);
      return new Response('Failed to generate download URL', { status: 500 });
    }

    // Log successful download
    createAuditLog(StorageAuditAction.FILE_DOWNLOAD, userId, orgId, itemId, {
      filename: allowedItem.name,
      size: allowedItem.size,
      mimeType: allowedItem.mimeType,
      storagePath: allowedItem.storagePath
    }, clientIP);

    // Redirect to signed URL
    return new Response(null, { 
      status: 302, 
      headers: { 
        Location: data.signedUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Download failed';
    
    // Log the error
    createAuditLog(StorageAuditAction.ACCESS_DENIED, userId || 'unknown', orgId, itemId, 
      { reason: 'Exception during download', error: message }, clientIP);
    
    console.error('Download error:', e);
    return new Response('Internal server error', { status: 500 });
  }
}
