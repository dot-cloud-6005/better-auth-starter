'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export interface SystemLog {
  id: string;
  event_type:
    | 'user_login'
    | 'user_logout'
    | 'inspection_created'
    | 'equipment_created'
    | 'plant_service'
    | 'user_created'
    | 'admin_action'
    | 'email_sent'
    | 'data_export'
    | 'system_error'
    | 'invitation_created'
    | 'invitation_revoked'
    | 'invitation_resent'
    | 'member_removed'
    | 'org_switched'
    | 'storage_upload'
    | 'storage_download'
    | 'storage_delete';
  user_id?: string;
  user_email?: string;
  description: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// Log system activity
export async function logSystemActivity({
  eventType,
  userId,
  userEmail,
  description,
  metadata,
  ipAddress,
  userAgent
}: {
  eventType: SystemLog['event_type'];
  userId?: string | null;
  userEmail?: string | null;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const supabase = createAdminClient();

  try {
    const { error } = await supabase
      .schema('equipment')
      .from('system_logs')
      .insert({
        event_type: eventType,
        user_id: userId || undefined,
        user_email: userEmail || undefined,
        description,
        metadata,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log system activity:', error);
    }
  } catch (error) {
    console.error('Error logging system activity:', error);
  }
}

// Get recent system logs
export async function getSystemLogs(limit: number = 20) {
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .schema('equipment')
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch system logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching system logs:', error);
    return [];
  }
}

// Helper function to get user info for logging
export async function getCurrentUserForLogging() {
  try {
    const s = await auth.api.getSession({ headers: await headers() });
    if (!s?.user) return { userId: undefined, userEmail: undefined };
    return { userId: s.user.id, userEmail: s.user.email ?? undefined };
  } catch {
    return { userId: undefined, userEmail: undefined };
  }
}

// Helper to get client IP and user agent (for server actions)
export async function getClientInfo(request?: Request) {
  if (typeof window !== 'undefined') {
    // Client-side
    return {
      userAgent: navigator.userAgent,
      ipAddress: undefined // Can't get IP on client-side
    };
  }

  // Server-side
  return {
    userAgent: request?.headers.get('user-agent') || undefined,
    ipAddress: request?.headers.get('x-forwarded-for') || 
               request?.headers.get('x-real-ip') || 
               undefined
  };
}