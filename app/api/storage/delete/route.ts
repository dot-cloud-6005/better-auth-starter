import { NextRequest } from "next/server";
import { deleteItem } from "@/server/storage";
import { validateStorageInput, createAuditLog, StorageAuditAction, RATE_LIMITS } from "@/lib/security";
import { rateLimitTake } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

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
  let userId: string | undefined;
  let itemId = '';
  let organizationId = '';
  
  try {
    // Check authentication first
    const s = await auth.api.getSession({ headers: await headers() });
    userId = s?.user.id;

    if (!userId) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, 'anonymous', '', '', 
        { reason: 'Unauthorized delete attempt' }, clientIP);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting for storage operations
    const storageRateKey = `storage_ops:${userId}`;
    const rateCheck = await rateLimitTake(storageRateKey, RATE_LIMITS.STORAGE_OPS_PER_MINUTE, 60);
    
    if (!rateCheck.allowed) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, '', '', 
        { reason: 'Storage operation rate limit exceeded', remaining: rateCheck.remaining }, clientIP);
      return Response.json({ 
        error: 'Rate limit exceeded. Please try again later.',
        remaining: rateCheck.remaining 
      }, { status: 429 });
    }

    // Parse and validate request body
    const body = await req.json();
    const { itemId: reqItemId, organizationId: reqOrgId } = body as { itemId: string; organizationId: string };
    
    itemId = reqItemId;
    organizationId = reqOrgId;
    
    // Validate input parameters
    const inputValidation = validateStorageInput({ 
      organizationId,
      itemId 
    });
    
    if (!inputValidation.isValid) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, organizationId, itemId, 
        { reason: 'Invalid input parameters', errors: inputValidation.errors }, clientIP);
      return Response.json({ 
        error: 'Invalid input parameters', 
        details: inputValidation.errors 
      }, { status: 400 });
    }

    if (!itemId || !organizationId) {
      createAuditLog(StorageAuditAction.ACCESS_DENIED, userId, organizationId, itemId, 
        { reason: 'Missing required parameters' }, clientIP);
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Attempt deletion (permissions are checked in deleteItem function)
    const res = await deleteItem(itemId, organizationId);
    
    return Response.json(res);
    
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Delete failed";
    
    // Log the error
    createAuditLog(StorageAuditAction.ACCESS_DENIED, userId || 'unknown', organizationId, itemId, 
      { reason: 'Exception during delete', error: message }, clientIP);
    
    console.error('Delete error:', e);
    
    // Return appropriate error status
    if (message.includes('Unauthorized') || message.includes('Forbidden')) {
      return Response.json({ error: message }, { status: 403 });
    }
    if (message.includes('Not found')) {
      return Response.json({ error: message }, { status: 404 });
    }
    
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
