'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';
import { v4 as uuidv4 } from 'uuid';
import { logSystemActivity, getCurrentUserForLogging, getSystemLogs } from '@/lib/equipment/actions/system-logs';
import { headers } from 'next/headers';
import { Resend } from 'resend';
import { getOrganizationBySlug } from '@/server/organizations';
import { auth } from '@/lib/auth';

// Import the interface from the new file
export type { EmailAutomationJob } from './job-templates';

// Helper to format phone numbers to E.164 (e.g. "0400 000 000" → "+61400000000")
function normalizeAustralianPhone(input: string): string | null {
  if (!input) return null;
  
  // Remove all spaces, hyphens, and parentheses
  let phone = input.replace(/[\s\-()]/g, "");
  
  // If starts with 0, replace with +61
  if (phone.startsWith("0")) {
    phone = "+61" + phone.substring(1);
  }
  
  // If already starts with +61 and correct length
  if (phone.startsWith("+61") && phone.length === 12) {
    return phone;
  }
  
  return null;
}

// Helper: find current org slug from Referer header and compute the admin path for revalidation
async function revalidateOrgAdminPathFallback() {
  try {
    const hdrs = await headers();
    const referer = hdrs.get('referer') || '';
    const url = new URL(referer);
    // Expect pathname like /{slug}/admin or /{slug}/admin?...; extract slug
    const match = url.pathname.match(/^\/(.*?)\/(admin)(\/|$)/);
    const slug = match?.[1];
    if (slug) {
      revalidatePath(`/${slug}/admin`);
      return;
    }
  } catch {}
  // Fallback: revalidate root
  revalidatePath('/');
}

// Helper: enforce org admin/owner permissions when possible based on slug from referer
async function assertOrgAdminPermission() {
  try {
    const hdrs = await headers();
    const referer = hdrs.get('referer') || '';
    const url = new URL(referer);
    const match = url.pathname.match(/^\/(.*?)\//);
    const slug = match?.[1];
    if (!slug) return { ok: true as const };
    const org = await getOrganizationBySlug(slug);
    if (!org) return { ok: false as const, error: 'Organization not found' };
    const { success, error } = await auth.api.hasPermission({
      headers: hdrs,
      body: { permissions: { organization: ['update'] }, organizationId: org.id }
    });
    if (!success) return { ok: false as const, error: error || 'Forbidden' };
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: 'Permission check failed' };
  }
}

export async function createUserByPhoneAction(formData: FormData) {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return { error: perm.error };
  const rawPhone = formData.get('phone')?.toString() || '';
  const email = formData.get('email')?.toString() || '';
  const displayName = formData.get('displayName')?.toString() || '';

  if (!email) {
    return { error: 'Email address is required.' };
  }

  if (!displayName.trim()) {
    return { error: 'Display name is required.' };
  }

  const phone = normalizeAustralianPhone(rawPhone);
  
  if (!phone) {
    return {
      error: 'Phone number must be Australian format (e.g. 0400 000 000 or +61400000000)',
    };
  }

  const password = uuidv4();
  const admin = createAdminClient();

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      phone,
      password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        display_name: displayName.trim()
      }
    });

    if (error) {
      return { error: error.message };
    }

    // Log the activity
    const { userId: adminUserId, userEmail: adminEmail } = await getCurrentUserForLogging();
    const headersList = await headers();
    
    await logSystemActivity({
      eventType: 'user_created',
      userId: adminUserId,
      userEmail: adminEmail,
      description: `Created new user: ${displayName} (${email})`,
      metadata: {
        new_user_id: data.user.id,
        new_user_email: email,
        new_user_phone: phone
      },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined
    });

  await revalidateOrgAdminPathFallback();
    return { success: `User created: ${displayName} (${email})` };

  } catch (catchError) {
    return { error: 'Database error creating new user' };
  }
}

export async function deleteUser(userId: string) {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return { error: perm.error };
  const supabase = createAdminClient();

  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    
    if (error) {
      return { error: error.message };
    }

    // Log the activity
    const { userId: adminUserId, userEmail: adminEmail } = await getCurrentUserForLogging();
    const headersList = await headers();
    
    await logSystemActivity({
      eventType: 'admin_action',
      userId: adminUserId,
      userEmail: adminEmail,
      description: `Deleted user: ${userId}`,
      metadata: {
        deleted_user_id: userId
      },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined
    });

  await revalidateOrgAdminPathFallback();
    return { success: 'User deleted successfully' };
  } catch (error) {
    return { error: 'Failed to delete user' };
  }
}

export async function addAdmin(formData: FormData) {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return { error: perm.error };
  const email = formData.get('email')?.toString();

  if (!email || !email.endsWith('@ventia.com')) {
    return { error: 'Email must be a valid @ventia.com address' };
  }

  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .schema('equipment')
      .from('admin_users')
      .insert({
        email: email.toLowerCase(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // unique constraint violation
        return { error: 'This email is already an admin' };
      }
      return { error: error.message };
    }

    // Log the activity
    const { userId: adminUserId, userEmail: adminEmail } = await getCurrentUserForLogging();
    const headersList = await headers();
    
    await logSystemActivity({
      eventType: 'admin_action',
      userId: adminUserId,
      userEmail: adminEmail,
      description: `Added admin user: ${email}`,
      metadata: {
        new_admin_email: email
      },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined
    });

  await revalidateOrgAdminPathFallback();
    return { success: `Admin added: ${email}` };
  } catch (error) {
    return { error: 'Failed to add admin user' };
  }
}

export async function removeAdmin(adminId: string) {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return { error: perm.error };
  const supabase = createAdminClient();

  try {
    // Get admin info before deletion
    const { data: admin } = await supabase
      .schema('equipment')
      .from('admin_users')
      .select('email')
      .eq('id', adminId)
      .single();

    const { error } = await supabase
      .schema('equipment')
      .from('admin_users')
      .delete()
      .eq('id', adminId);

    if (error) {
      return { error: error.message };
    }

    // Log the activity
    const { userId: adminUserId, userEmail: adminEmail } = await getCurrentUserForLogging();
    const headersList = await headers();
    
    await logSystemActivity({
      eventType: 'admin_action',
      userId: adminUserId,
      userEmail: adminEmail,
      description: `Removed admin user: ${admin?.email || 'Unknown'}`,
      metadata: {
        removed_admin_id: adminId,
        removed_admin_email: admin?.email
      },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined
    });

  await revalidateOrgAdminPathFallback();
    return { success: 'Admin removed successfully' };
  } catch (error) {
    return { error: 'Failed to remove admin' };
  }
}

export async function sendTestEmail(formData: FormData) {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return { error: perm.error };
  const recipients = formData.get('recipients')?.toString();
  const template = formData.get('template')?.toString();
  const emailType = formData.get('emailType')?.toString() as 'plant_due' | 'equipment_due' | 'inspection_alerts';
  
  if (!recipients || !template) {
    return { error: 'Recipients and template are required' };
  }

  // Initialize Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  
  if (!process.env.RESEND_API_KEY) {
    return { error: 'Resend API key not configured' };
  }

  try {
    // Parse recipients
    const recipientList = recipients.split(',').map(email => email.trim()).filter(email => email);
    
    if (recipientList.length === 0) {
      return { error: 'No valid recipients found' };
    }

    // Create subject based on email type
    const subjectMap = {
      'plant_due': 'Test: Plant Service Due Notifications',
      'equipment_due': 'Test: Equipment Inspection Due Notifications', 
      'inspection_alerts': 'Test: Inspection Alert Notifications'
    };

    const subject = subjectMap[emailType] || 'Test Email from Equipment Management System';

    // Add test disclaimer to template
    const testTemplate = `
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h3 style="color: #92400e; margin: 0 0 8px 0;">⚠️ TEST EMAIL</h3>
        <p style="color: #92400e; margin: 0; font-size: 14px;">This is a test email sent from the admin panel. This template is configured for: <strong>${emailType.replace('_', ' ').toUpperCase()}</strong></p>
      </div>
      ${template}
    `;

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: 'Equipment Management <noreply@ventia.com>',
      to: recipientList,
      subject: subject,
      html: testTemplate,
    });

    if (error) {
      console.error('Resend error:', error);
      return { error: `Failed to send email: ${error.message}` };
    }

    // Log the activity
    const { userId, userEmail } = await getCurrentUserForLogging();
    const headersList = await headers();
    
    await logSystemActivity({
      eventType: 'email_sent',
      userId,
      userEmail,
      description: `Sent test email for ${emailType} automation`,
      metadata: {
        email_type: emailType,
        recipients_count: recipientList.length,
        recipients: recipientList,
        test_email: true,
        resend_id: data?.id
      },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined
    });

    return { 
      success: `Test email sent successfully to ${recipientList.length} recipient(s)`,
      data: { id: data?.id, recipients: recipientList }
    };

  } catch (error) {
    console.error('Error sending test email:', error);
    return { 
      error: `Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

export async function getUsers() {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return [];
  const supabase = createAdminClient();
  
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }
    
    return users || [];
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

export async function getAdmins() {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return [];
  const supabase = createAdminClient();
  
  try {
    const { data, error } = await supabase
      .schema('equipment')
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching admins:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching admins:', error);
    return [];
  }
}

export async function getEmailSettings() {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return [];
  const supabase = createAdminClient();
  
  try {
    const { data, error } = await supabase
      .schema('equipment')
      .from('email_automation_settings')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching email settings:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching email settings:', error);
    return [];
  }
}

export async function createEmailJob(jobData: Partial<any>) {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return { error: perm.error };
  const supabase = createAdminClient();

  console.log('createEmailJob received jobData:', jobData); // Debug log

  try {
    const { data, error } = await supabase
      .schema('equipment')
      .from('email_automation_settings')
      .insert({
        name: jobData.name,
        description: jobData.description,
        automation_category: jobData.automation_category, // ✅ Fixed: was 'type'
        enabled: jobData.enabled || false,
        schedule: jobData.schedule,
        recipients: jobData.recipients || [],
        template: jobData.template,
        criteria: jobData.criteria || {},
        priority: jobData.priority || 5,
        run_count: 0,
        error_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error in createEmailJob:', error); // Debug log
      return { error: error.message };
    }

    // Log the activity
    const { userId, userEmail } = await getCurrentUserForLogging();
    const headersList = await headers();
    
    await logSystemActivity({
      eventType: 'admin_action',
      userId,
      userEmail,
      description: `Created email automation job: ${jobData.name}`,
      metadata: {
        job_id: data.id,
        job_type: jobData.automation_category, // ✅ Fixed: was 'jobData.type'
        enabled: jobData.enabled
      },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined
    });

  await revalidateOrgAdminPathFallback();
    return { success: 'Email automation job created successfully', data };
  } catch (error) {
    console.error('Error in createEmailJob:', error); // Debug log
    return { error: 'Failed to create email automation job' };
  }
}

export async function updateEmailJob(jobId: string, updates: Partial<any>) {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return { error: perm.error };
  const supabase = createAdminClient();

  try {
    const { data, error } = await supabase
      .schema('equipment')
      .from('email_automation_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    // Log the activity
    const { userId, userEmail } = await getCurrentUserForLogging();
    const headersList = await headers();
    
    await logSystemActivity({
      eventType: 'admin_action',
      userId,
      userEmail,
      description: `Updated email automation job: ${data.name}`,
      metadata: {
        job_id: jobId,
        job_type: data.automation_category, // ✅ Fixed: was 'data.type'
        enabled: data.enabled
      },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined
    });

  await revalidateOrgAdminPathFallback();
    return { success: 'Email automation job updated successfully', data };
  } catch (error) {
    return { error: 'Failed to update email automation job' };
  }
}

export async function deleteEmailJob(jobId: string) {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return { error: perm.error };
  const supabase = createAdminClient();

  try {
    // Get job info before deletion
    const { data: job } = await supabase
      .schema('equipment')
      .from('email_automation_settings')
      .select('name, automation_category') // ✅ Fixed: was 'type'
      .eq('id', jobId)
      .single();

    const { error } = await supabase
      .schema('equipment')
      .from('email_automation_settings')
      .delete()
      .eq('id', jobId);

    if (error) {
      return { error: error.message };
    }

    // Log the activity
    const { userId, userEmail } = await getCurrentUserForLogging();
    const headersList = await headers();
    
    await logSystemActivity({
      eventType: 'admin_action',
      userId,
      userEmail,
      description: `Deleted email automation job: ${job?.name || 'Unknown'}`,
      metadata: {
        deleted_job_id: jobId,
        job_type: job?.automation_category // ✅ Fixed: was 'job?.type'
      },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined
    });

  await revalidateOrgAdminPathFallback();
    return { success: 'Email automation job deleted successfully' };
  } catch (error) {
    return { error: 'Failed to delete email automation job' };
  }
}

export async function duplicateEmailJob(jobId: string) {
  const perm = await assertOrgAdminPermission();
  if (!perm.ok) return { error: perm.error };
  const supabase = createAdminClient();

  try {
    // Get the original job
    const { data: originalJob, error: fetchError } = await supabase
      .schema('equipment')
      .from('email_automation_settings')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !originalJob) {
      return { error: 'Job not found' };
    }

    // Create duplicate with modified name
    const duplicateData = {
      ...originalJob,
      id: undefined, // Let database generate new ID
      name: `${originalJob.name} (Copy)`,
      enabled: false, // Disable copy by default
      run_count: 0,
      error_count: 0,
      last_run: null,
      next_run: null,
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .schema('equipment')
      .from('email_automation_settings')
      .insert(duplicateData)
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    // Log the activity
    const { userId, userEmail } = await getCurrentUserForLogging();
    const headersList = await headers();
    
    await logSystemActivity({
      eventType: 'admin_action',
      userId,
      userEmail,
      description: `Duplicated email automation job: ${originalJob.name}`,
      metadata: {
        original_job_id: jobId,
        new_job_id: data.id,
        job_type: data.automation_category // ✅ Fixed: was 'data.type'
      },
      ipAddress: headersList.get('x-forwarded-for') || undefined,
      userAgent: headersList.get('user-agent') || undefined
    });

  await revalidateOrgAdminPathFallback();
    return { success: 'Email automation job duplicated successfully', data };
  } catch (error) {
    return { error: 'Failed to duplicate email automation job' };
  }
}

// Re-export getSystemLogs for convenience
export { getSystemLogs };