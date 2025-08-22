'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Mail, 
  Plus, 
  Settings, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Copy,
  Filter,
  Info
} from 'lucide-react';
import { getJobTemplates, type EmailAutomationJob } from '../../job-templates';
import { cronToHumanReadable } from '../../schedule-utils';
import { SchedulePicker } from '../shared/schedule-picker';

interface EmailAutomationSettingsProps {
  jobs: EmailAutomationJob[];
  onUpdate: (jobId: string, updates: Partial<EmailAutomationJob>) => void;
  onCreate: (jobData: Partial<EmailAutomationJob>) => void;
  onDelete: (jobId: string) => void;
  onDuplicate: (jobId: string) => void;
}

export function EmailAutomationSettings({
  jobs,
  onUpdate,
  onCreate,
  onDelete,
  onDuplicate
}: EmailAutomationSettingsProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<EmailAutomationJob | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  // Update the handleCreateFromTemplate function with better validation
  const handleCreateFromTemplate = (template: Partial<EmailAutomationJob>) => {
    console.log('Template received in handleCreateFromTemplate:', template); // Debug log
    
    // Validate automation_category specifically
    if (!template.automation_category) {
      console.error('Template missing automation_category:', template);
      return;
    }
    
    // Ensure all required fields are present for database insertion
    const jobData = {
      name: template.name || 'Unnamed Job',
      description: template.description || '',
      automation_category: template.automation_category, // This is required and validated above
      schedule: template.schedule || '0 8 * * 1',
      recipients: template.recipients || [],
      template: template.template?.includes('{{content}}') 
        ? template.template 
        : (template.template || '') + '\n\n{{content}}',
      priority: template.priority || 5,
      enabled: template.enabled ?? true,
      criteria: template.criteria || {},
      run_count: 0,
      error_count: 0
    };

    console.log('Final jobData being sent to onCreate:', jobData); // Debug log
    console.log('automation_category value:', jobData.automation_category); // Specific debug
    
    onCreate(jobData);
    setCreateDialogOpen(false);
    setTemplateDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Email Automation</h2>
          <p className="text-slate-600">Manage automated email notifications and reports</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setTemplateDialogOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-4 w-4 text-slate-500" />
            <Select defaultValue="all">
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="enabled">Enabled Only</SelectItem>
                <SelectItem value="disabled">Disabled Only</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all-types">
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-types">All Types</SelectItem>
                <SelectItem value="monthly_schedule_overview">Monthly Schedule Overview</SelectItem>
                <SelectItem value="weekly_overdue_equipment">Weekly Overdue Equipment</SelectItem>
                <SelectItem value="weekly_overdue_plant">Weekly Overdue Plant</SelectItem>
                <SelectItem value="weekly_plant_action_required">Weekly Plant Action Required</SelectItem>
                <SelectItem value="custom_reports">Custom Reports</SelectItem>
                <SelectItem value="data_quality">Data Quality</SelectItem>
                <SelectItem value="user_activity">User Activity</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {jobs.map((job) => (
          <EmailJobCard
            key={job.id}
            job={job}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onEdit={setEditingJob}
          />
        ))}
      </div>

      {/* Create Job Dialog */}
      <CreateJobDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={onCreate}
      />

      {/* Job Templates Dialog */}
      <JobTemplatesDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSelectTemplate={handleCreateFromTemplate}
      />

      {/* Edit Job Dialog */}
      {editingJob && (
        <EditJobDialog
          job={editingJob}
          open={!!editingJob}
          onOpenChange={(open) => !open && setEditingJob(null)}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

// Individual Email Job Card Component
function EmailJobCard({
  job,
  onUpdate,
  onDelete,
  onDuplicate,
  onEdit
}: {
  job: EmailAutomationJob;
  onUpdate: (jobId: string, updates: Partial<EmailAutomationJob>) => void;
  onDelete: (jobId: string) => void;
  onDuplicate: (jobId: string) => void;
  onEdit: (job: EmailAutomationJob) => void;
}) {
  const toggleEnabled = () => {
    onUpdate(job.id, { enabled: !job.enabled });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'monthly_schedule_overview': return '📅';
      case 'weekly_overdue_equipment': return '🚨';
      case 'weekly_overdue_plant': return '🚛';
      case 'weekly_plant_action_required': return '📋';
      case 'custom_reports': return '📊';
      case 'data_quality': return '🔍';
      case 'user_activity': return '👥';
      default: return '📧';
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority <= 3) return 'text-red-600 bg-red-50';
    if (priority <= 6) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  // Safe access to automation_category with fallback
  const automationCategory = job.automation_category || (job as any).type || 'unknown';
  const displayCategory = automationCategory.replace(/_/g, ' ');

  return (
    <Card className={`${job.enabled ? '' : 'opacity-60'} hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getTypeIcon(automationCategory)}</span>
            <div>
              <CardTitle className="text-lg">{job.name}</CardTitle>
              <p className="text-sm text-slate-600 capitalize">
                {displayCategory}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              className={`text-xs ${getPriorityColor(job.priority)}`}
              variant="secondary"
            >
              Priority {job.priority}
            </Badge>
            <Switch
              checked={job.enabled}
              onCheckedChange={toggleEnabled}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {job.description && (
          <p className="text-sm text-slate-600">{job.description}</p>
        )}
        
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="text-slate-600">
              {cronToHumanReadable(job.schedule)}
            </span>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-slate-500" />
            <span className="text-slate-600">
              {job.recipients?.length || 0} recipient{(job.recipients?.length || 0) !== 1 ? 's' : ''}
            </span>
          </div>
          
          {job.last_run && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-slate-500" />
              <span className="text-slate-600">
                Last run: {new Date(job.last_run).toLocaleString()}
              </span>
            </div>
          )}
          
          {job.next_run && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-slate-600">
                Next run: {new Date(job.next_run).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Runs: {job.run_count || 0}</span>
            {(job.error_count || 0) > 0 && (
              <span className="text-red-600">Errors: {job.error_count}</span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(job)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDuplicate(job.id)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(job.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Template Builder Component
function TemplateBuilder({
  value,
  onChange,
  placeholder = "Enter content that will appear before the data table..."
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  // Extract the parts before and after {{content}}
  const contentPlaceholder = '{{content}}';
  const parts = value.split(contentPlaceholder);
  const beforeContent = parts[0] || '';
  const afterContent = parts[1] || '';

  const handleBeforeChange = (newBefore: string) => {
    onChange(newBefore + contentPlaceholder + afterContent);
  };

  const handleAfterChange = (newAfter: string) => {
    onChange(beforeContent + contentPlaceholder + newAfter);
  };

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 text-blue-700 text-sm font-medium mb-2">
          <Info className="h-4 w-4" />
          Template Structure
        </div>
        <p className="text-blue-600 text-xs">
          Your email will have: Header Content + Data Table + Footer Content. 
          The data table is automatically generated based on your job type.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="before-content">Header Content (appears before data table)</Label>
        <Textarea
          id="before-content"
          value={beforeContent}
          onChange={(e) => handleBeforeChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="resize-none"
        />
      </div>

      <div className="bg-slate-100 border border-slate-300 rounded p-3 text-center">
        <span className="text-slate-600 font-mono text-sm bg-slate-200 px-2 py-1 rounded">
          {`{{content}}`} - Auto-generated data table
        </span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="after-content">Footer Content (appears after data table)</Label>
        <Textarea
          id="after-content"
          value={afterContent}
          onChange={(e) => handleAfterChange(e.target.value)}
          placeholder="Enter content that will appear after the data table..."
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
}

// Create Job Dialog Component
function CreateJobDialog({
  open,
  onOpenChange,
  onCreate
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (jobData: Partial<EmailAutomationJob>) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    automation_category: 'monthly_schedule_overview' as EmailAutomationJob['automation_category'],
    schedule: '0 8 * * 1',
    recipients: '',
    template: '{{content}}', // Default template with required placeholder
    priority: 5,
    enabled: true,
    criteria: {}
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = formData.recipients.split(',').map(email => email.trim()).filter(Boolean);
    
    // Ensure template always includes {{content}}
    let template = formData.template;
    if (!template.includes('{{content}}')) {
      template = template + '\n\n{{content}}';
    }
    
    onCreate({
      ...formData,
      recipients,
      template
    });
    
    onOpenChange(false);
    setFormData({
      name: '',
      description: '',
      automation_category: 'monthly_schedule_overview',
      schedule: '0 8 * * 1',
      recipients: '',
      template: '{{content}}',
      priority: 5,
      enabled: true,
      criteria: {}
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Email Automation Job</DialogTitle>
          <DialogDescription>
            Set up a new automated email notification or report
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Job Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Weekly Equipment Report"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Job Type</Label>
              <Select 
                value={formData.automation_category} 
                onValueChange={(value: EmailAutomationJob['automation_category']) => 
                  setFormData(prev => ({ ...prev, automation_category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly_schedule_overview">Monthly Schedule Overview</SelectItem>
                  <SelectItem value="weekly_overdue_equipment">Weekly Overdue Equipment</SelectItem>
                  <SelectItem value="weekly_overdue_plant">Weekly Overdue Plant</SelectItem>
                  <SelectItem value="weekly_plant_action_required">Weekly Plant Action Required</SelectItem>
                  <SelectItem value="custom_reports">Custom Reports</SelectItem>
                  <SelectItem value="data_quality">Data Quality</SelectItem>
                  <SelectItem value="user_activity">User Activity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of what this job does..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Schedule</Label>
            <SchedulePicker
              value={formData.schedule}
              onChange={(schedule) => setFormData(prev => ({ ...prev, schedule }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients">Recipients</Label>
            <Textarea
              id="recipients"
              value={formData.recipients}
              onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
              placeholder="user1@ventia.com, user2@ventia.com"
              rows={2}
            />
            <p className="text-xs text-slate-500">
              Comma-separated email addresses
            </p>
          </div>

          <div className="space-y-2">
            <Label>Email Template</Label>
            <TemplateBuilder
              value={formData.template}
              onChange={(template) => setFormData(prev => ({ ...prev, template }))}
              placeholder="Enter your email header content here..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1-10)</Label>
              <Input
                id="priority"
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
              />
              <Label htmlFor="enabled">Enable immediately</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Job</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Job Templates Dialog Component
function JobTemplatesDialog({
  open,
  onOpenChange,
  onSelectTemplate
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: Partial<EmailAutomationJob>) => void;
}) {
  const templates = getJobTemplates();

  const getTemplateIcon = (automationCategory: string) => {
    switch (automationCategory) {
      case 'monthly_schedule_overview': return '📅';
      case 'weekly_overdue_equipment': return '🚨';
      case 'weekly_overdue_plant': return '🚛';
      case 'weekly_plant_action_required': return '📋';
      case 'custom_reports': return '📊';
      case 'data_quality': return '🔍';
      case 'user_activity': return '👥';
      default: return '📧';
    }
  };

  const handleSelectTemplate = (template: Partial<EmailAutomationJob>) => {
    console.log('Raw template before processing:', template); // Debug
    
    // Validate required fields
    if (!template.automation_category) {
      console.error('Template is missing automation_category field!', template);
      alert('Error: Template is missing required automation category');
      return;
    }

    if (!template.name) {
      console.error('Template is missing name field!', template);
      alert('Error: Template is missing required name');
      return;
    }

    // Create a clean template object with all required fields
    const completeTemplate: Partial<EmailAutomationJob> = {
      name: template.name,
      description: template.description || '',
      automation_category: template.automation_category,
      schedule: template.schedule || '0 8 * * 1',
      recipients: Array.isArray(template.recipients) ? template.recipients : [],
      template: template.template || '{{content}}',
      priority: template.priority || 5,
      enabled: template.enabled ?? true,
      criteria: template.criteria || {},
      run_count: 0,
      error_count: 0
    };

    console.log('Complete template being passed:', completeTemplate); // Debug log
    console.log('automation_category in complete template:', completeTemplate.automation_category); // Specific check
    
    onSelectTemplate(completeTemplate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Job Templates</DialogTitle>
          <DialogDescription>
            Choose from pre-configured email automation templates
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template, index) => {
            // Debug each template
            console.log(`Template ${index}:`, template);
            
            return (
              <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-2xl">
                      {getTemplateIcon(template.automation_category || '')}
                    </span>
                    {template.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">{template.description}</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Type:</span>
                      <span className="capitalize">{template.automation_category?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Schedule:</span>
                      <span>{template.schedule ? cronToHumanReadable(template.schedule) : 'Custom'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Priority:</span>
                      <span>{template.priority}</span>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => handleSelectTemplate(template)}
                    disabled={!template.automation_category || !template.name}
                  >
                    Use Template
                  </Button>
                  {(!template.automation_category || !template.name) && (
                    <p className="text-xs text-red-500 mt-1">Template is missing required fields</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Job Dialog Component
function EditJobDialog({
  job,
  open,
  onOpenChange,
  onUpdate
}: {
  job: EmailAutomationJob;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (jobId: string, updates: Partial<EmailAutomationJob>) => void;
}) {
  const [formData, setFormData] = useState({
    name: job.name,
    description: job.description || '',
    automation_category: job.automation_category,
    schedule: job.schedule,
    recipients: job.recipients.join(', '),
    template: job.template.includes('{{content}}') ? job.template : job.template + '\n\n{{content}}',
    priority: job.priority,
    enabled: job.enabled,
    criteria: job.criteria
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = formData.recipients.split(',').map(email => email.trim()).filter(Boolean);
    
    // Ensure template always includes {{content}}
    let template = formData.template;
    if (!template.includes('{{content}}')) {
      template = template + '\n\n{{content}}';
    }
    
    onUpdate(job.id, {
      ...formData,
      recipients,
      template
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Email Automation Job</DialogTitle>
          <DialogDescription>
            Update the configuration for &quot;{job.name}&quot;
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Job Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-type">Job Type</Label>
              <Select 
                value={formData.automation_category} 
                onValueChange={(value: EmailAutomationJob['automation_category']) => 
                  setFormData(prev => ({ ...prev, automation_category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly_schedule_overview">Monthly Schedule Overview</SelectItem>
                  <SelectItem value="weekly_overdue_equipment">Weekly Overdue Equipment</SelectItem>
                  <SelectItem value="weekly_overdue_plant">Weekly Overdue Plant</SelectItem>
                  <SelectItem value="weekly_plant_action_required">Weekly Plant Action Required</SelectItem>
                  <SelectItem value="custom_reports">Custom Reports</SelectItem>
                  <SelectItem value="data_quality">Data Quality</SelectItem>
                  <SelectItem value="user_activity">User Activity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Schedule</Label>
            <SchedulePicker
              value={formData.schedule}
              onChange={(schedule) => setFormData(prev => ({ ...prev, schedule }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-recipients">Recipients</Label>
            <Textarea
              id="edit-recipients"
              value={formData.recipients}
              onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Email Template</Label>
            <TemplateBuilder
              value={formData.template}
              onChange={(template) => setFormData(prev => ({ ...prev, template }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-priority">Priority (1-10)</Label>
              <Input
                id="edit-priority"
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
              />
            </div>
            
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="edit-enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
              />
              <Label htmlFor="edit-enabled">Enabled</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Update Job</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}