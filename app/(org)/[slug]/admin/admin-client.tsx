'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader as UIDialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Mail, 
  Settings, 
  Shield,
  CheckCircle,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getSystemLogs,
  createEmailJob,
  updateEmailJob,
  deleteEmailJob,
  duplicateEmailJob
} from './actions';

// Import from the new job templates file
import { type EmailAutomationJob } from './job-templates';

// Import the extracted components
import type { User } from './components/user-management/user-row';
import { EmailAutomationSettings } from './components/email-automation/email-automation-settings';
import { SystemSettings } from './components/system-settings/system-settings';
import MembersTable from '@/components/members-table';
import { InviteByEmailForm } from '@/components/forms/invite-by-email-form';
import InvitationsTable from '@/components/invitations-table';
import type { Member } from '@/db/schema';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

interface SystemLog {
  id: string;
  event_type: string;
  user_email?: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface AdminClientProps {
  initialUsers: User[];
  initialAdmins: AdminUser[];
  initialEmailSettings: EmailAutomationJob[];
  initialSystemLogs: SystemLog[];
  organizationName?: string;
  organizationId: string;
  organizationSlug?: string;
  members: Member[];
  invitations: {
    id: string;
    email: string;
    role: string | null;
    status: string;
    expiresAt: string | null;
  }[];
}

export default function AdminClient({ 
  initialUsers, 
  initialAdmins, 
  initialEmailSettings,
  initialSystemLogs,
  organizationName,
  organizationId,
  organizationSlug,
  members,
  invitations
}: AdminClientProps) {
  const [users, setUsers] = useState(initialUsers);
  const [admins, setAdmins] = useState(initialAdmins);
  const [emailSettings, setEmailSettings] = useState(initialEmailSettings);
  const [systemLogs, setSystemLogs] = useState(initialSystemLogs);

  // Function to refresh system logs
  const refreshSystemLogs = async () => {
    try {
      const logs = await getSystemLogs(10);
      setSystemLogs(logs);
    } catch (error) {
      console.error('Failed to refresh system logs:', error);
    }
  };

  // Email Job Functions
  const handleCreateEmailJob = async (jobData: Partial<EmailAutomationJob>) => {
    try {
      const result = await createEmailJob(jobData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        if (result.data) {
          setEmailSettings([...emailSettings, result.data]);
        }
        await refreshSystemLogs();
      }
    } catch (error) {
      toast.error('Failed to create email job');
    }
  };

  const handleUpdateEmailJob = async (jobId: string, updates: Partial<EmailAutomationJob>) => {
    try {
      const result = await updateEmailJob(jobId, updates);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        if (result.data) {
          setEmailSettings(emailSettings.map(job => 
            job.id === jobId ? result.data : job
          ));
        }
        await refreshSystemLogs();
      }
    } catch (error) {
      toast.error('Failed to update email job');
    }
  };

  const handleDeleteEmailJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this email automation job?')) return;
    
    try {
      const result = await deleteEmailJob(jobId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        setEmailSettings(emailSettings.filter(job => job.id !== jobId));
        await refreshSystemLogs();
      }
    } catch (error) {
      toast.error('Failed to delete email job');
    }
  };

  const handleDuplicateEmailJob = async (jobId: string) => {
    try {
      const result = await duplicateEmailJob(jobId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
        if (result.data) {
          setEmailSettings([...emailSettings, result.data]);
        }
        await refreshSystemLogs();
      }
    } catch (error) {
      toast.error('Failed to duplicate email job');
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">System Administration</h1>
            <p className="text-muted-foreground mt-1">Manage users, permissions, and automated notifications</p>
            {(organizationName || organizationSlug) && (
              <p className="text-muted-foreground text-sm mt-1">
                Organisation · {organizationName || organizationSlug}
                {organizationName && organizationSlug ? ` (${organizationSlug})` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <CheckCircle className="h-3 w-3 mr-1 text-muted-foreground" />
              System Online
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Users className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Org Members</p>
                  <p className="text-2xl font-bold text-foreground">{(members || []).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Shield className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Admin Users</p>
                  <p className="text-2xl font-bold text-foreground">{admins.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <CheckCircle className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Verified Users</p>
                  <p className="text-2xl font-bold text-foreground">
                    {users.filter(u => u.phone_confirmed_at).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

    <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Mail className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Invitations</p>
                  <p className="text-2xl font-bold text-foreground">{(invitations || []).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Automation
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Settings
            </TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-6">
            {/* Organization Management in a responsive layout */}
            <div className="grid grid-cols-1 gap-6">
              {/* Members table now full width with Add User button */}
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Members</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <UIDialogHeader>
                        <DialogTitle>Invite user by email</DialogTitle>
                      </UIDialogHeader>
                      <InviteByEmailForm organizationId={organizationId || ''} />
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <MembersTable members={members || []} />
                </CardContent>
              </Card>
            </div>

            {/* Pending invitations as its own full-width row */}
            <Card>
              <CardHeader>
                <CardTitle>Pending invitations</CardTitle>
              </CardHeader>
              <CardContent>
                <InvitationsTable invitations={invitations || []} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Automation Tab */}
          <TabsContent value="emails" className="space-y-6">
            <EmailAutomationSettings
              jobs={emailSettings}
              onUpdate={handleUpdateEmailJob}
              onCreate={handleCreateEmailJob}
              onDelete={handleDeleteEmailJob}
              onDuplicate={handleDuplicateEmailJob}
            />
          </TabsContent>

          {/* System Settings Tab */}
          <TabsContent value="system" className="space-y-6">
            <SystemSettings systemLogs={systemLogs} onRefreshLogs={refreshSystemLogs} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}