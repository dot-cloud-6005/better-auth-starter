// This file contains utility functions for email automation job templates
// No 'use server' directive since these are client-side utilities

export interface EmailAutomationJob {
  id: string;
  name: string;
  description?: string;
  automation_category: 'monthly_schedule_overview' | 'weekly_overdue_equipment' | 'weekly_overdue_plant' | 'weekly_plant_action_required' | 'custom_reports' | 'data_quality' | 'user_activity';
  enabled: boolean;
  schedule: string; // cron expression
  recipients: string[];
  template: string;
  criteria: Record<string, any>;
  priority: number;
  last_run?: string;
  next_run?: string;
  run_count: number;
  error_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

// Pre-defined job templates with professional styling and {{content}} placeholder
export function getJobTemplates(): Partial<EmailAutomationJob>[] {
  const templates: Partial<EmailAutomationJob>[] = [
    {
      name: "Monthly Schedule Overview",
      description: "Comprehensive monthly overview of all equipment, plant, and vessels",
      automation_category: "monthly_schedule_overview",
      schedule: "0 8 1 * *",
      priority: 2,
      enabled: true,
      recipients: [],
      run_count: 0,
      error_count: 0,
      criteria: {
        daysAhead: 30
      },
      template: `<div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; border-radius: 8px;">
  <h2 style="margin: 0 0 8px 0; font-size: 22px;">📅 Monthly Schedule Overview</h2>
  <p style="margin: 0; opacity: 0.9; font-size: 15px;">Comprehensive equipment and plant schedule for the next 30 days</p>
</div>

<div style="margin-bottom: 20px; padding: 15px; background: #f0f9ff; border-radius: 6px; border: 1px solid #e0f2fe;">
  <h4 style="margin: 0 0 10px 0; color: #0c4a6e; font-size: 16px;">📊 Planning Summary</h4>
  <p style="margin: 0; font-size: 13px; color: #075985;">
    Review all upcoming maintenance, inspections, and service requirements across your fleet.
  </p>
</div>

{{content}}

<div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 6px; border-top: 3px solid #4f46e5;">
  <h4 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">📋 Action Items</h4>
  <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #4f46e5;">
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.6;">
      <li>Coordinate resource allocation for scheduled maintenance</li>
      <li>Confirm availability of parts and equipment</li>
      <li>Schedule technician assignments</li>
      <li>Notify operations of planned downtime</li>
    </ul>
  </div>
</div>`
    },
    {
      name: "Weekly Overdue Equipment Notification",
      description: "Critical alert for overdue equipment inspections requiring immediate action",
      automation_category: "weekly_overdue_equipment",
      schedule: "0 8 * * 1", // Monday at 8 AM
      priority: 1,
      enabled: true,
      recipients: [],
      run_count: 0,
      error_count: 0,
      criteria: {},
      template: `<div style="margin-bottom: 20px; padding: 20px; background: #fef2f2; border: 2px solid #dc2626; border-radius: 6px;">
  <h3 style="margin: 0 0 10px 0; color: #dc2626; font-size: 20px; text-align: center;">🚨 OVERDUE EQUIPMENT ALERT</h3>
  <p style="margin: 0; color: #991b1b; font-size: 16px; text-align: center; font-weight: 600;">IMMEDIATE INSPECTION REQUIRED</p>
</div>

<div style="margin-bottom: 20px; padding: 15px; background: #fff1f2; border-left: 4px solid #f87171; border-radius: 4px;">
  <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
    The following equipment is past its inspection deadline and requires <strong>immediate attention</strong> to prevent safety risks and compliance violations.
  </p>
</div>

{{content}}

<div style="margin-top: 30px; padding: 20px; background: #fafafa; border: 1px solid #d1d5db; border-radius: 6px;">
  <h4 style="margin: 0 0 15px 0; color: #dc2626; font-size: 16px;">📞 Immediate Action Required</h4>
  <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #dc2626;">
    <p style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">Next Steps:</p>
    <ol style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
      <li><strong>Schedule inspections immediately</strong></li>
      <li>Remove equipment from service if safety critical</li>
      <li>Notify operations and safety teams</li>
      <li>Update inspection records in system</li>
    </ol>
  </div>
</div>`
    },
    {
      name: "Weekly Overdue Plant Notification",
      description: "Alert for overdue plant services requiring immediate attention",
      automation_category: "weekly_overdue_plant",
      schedule: "0 8 * * 1", // Monday at 8 AM
      priority: 1,
      enabled: true,
      recipients: [],
      run_count: 0,
      error_count: 0,
      criteria: {},
      template: `<div style="margin-bottom: 20px; padding: 20px; background: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px;">
  <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 20px; text-align: center;">🚛 OVERDUE PLANT SERVICES</h3>
  <p style="margin: 0; color: #78350f; font-size: 16px; text-align: center; font-weight: 600;">SERVICE SCHEDULING REQUIRED</p>
</div>

<div style="margin-bottom: 20px; padding: 15px; background: #fffbeb; border-left: 4px solid #fbbf24; border-radius: 4px;">
  <p style="margin: 0; color: #78350f; font-size: 14px;">
    The following plant and vehicles are overdue for their scheduled services. Please prioritize scheduling to maintain operational efficiency.
  </p>
</div>

{{content}}

<div style="margin-top: 30px; padding: 20px; background: #fafafa; border: 1px solid #d1d5db; border-radius: 6px;">
  <h4 style="margin: 0 0 15px 0; color: #f59e0b; font-size: 16px;">🔧 Service Actions</h4>
  <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #f59e0b;">
    <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px;">
      <li>Schedule service appointments with approved workshops</li>
      <li>Arrange alternative transport if required</li>
      <li>Update service records and due dates</li>
      <li>Check warranty and service history</li>
    </ul>
  </div>
</div>`
    },
    {
      name: "Weekly Plant Action Required Notification",
      description: "Weekly alert for plant requiring action or attention",
      automation_category: "weekly_plant_action_required",
      schedule: "0 9 * * 1", // Monday at 9 AM
      priority: 2,
      enabled: true,
      recipients: [],
      run_count: 0,
      error_count: 0,
      criteria: {
        daysAhead: 14
      },
      template: `<div style="margin-bottom: 20px; padding: 15px; background: #f0f9ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
  <h3 style="margin: 0 0 8px 0; color: #1d4ed8; font-size: 18px;">📋 Plant Action Required</h3>
  <p style="margin: 0; color: #1e40af; font-size: 14px;">Plant and vehicles requiring attention in the next 14 days</p>
</div>

<div style="margin-bottom: 20px; padding: 12px; background: #eff6ff; border-radius: 4px;">
  <p style="margin: 0; font-size: 13px; color: #1e40af;">
    <strong>📅 Planning Notice:</strong> Please review the items below and schedule necessary actions to maintain compliance and operational readiness.
  </p>
</div>

{{content}}

<div style="margin-top: 30px; padding: 15px; background: #f8fafc; border-radius: 4px;">
  <h4 style="margin: 0 0 12px 0; color: #334155; font-size: 16px;">📊 Maintenance Planning</h4>
  <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #e2e8f0;">
    <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 13px;">
      <li>Coordinate with operations for optimal scheduling</li>
      <li>Ensure parts and resources are available</li>
      <li>Book service appointments in advance</li>
      <li>Plan for temporary replacements if needed</li>
    </ul>
  </div>
</div>`
    },
    {
      name: "Weekly Data Quality Report",
      description: "Weekly summary of data quality issues and system health",
      automation_category: "data_quality",
      schedule: "0 9 * * 1", // Monday at 9 AM
      priority: 5,
      enabled: true,
      recipients: [],
      run_count: 0,
      error_count: 0,
      criteria: {},
      template: `<div style="margin-bottom: 20px; padding: 15px; background: #fafaf9; border-left: 4px solid #78716c; border-radius: 4px;">
  <h3 style="margin: 0 0 8px 0; color: #57534e; font-size: 18px;">🔍 Weekly Data Quality Report</h3>
  <p style="margin: 0; color: #78716c; font-size: 14px;">System data integrity and quality assessment</p>
</div>

{{content}}

<div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 4px;">
  <h4 style="margin: 0 0 12px 0; color: #374151; font-size: 16px;">📈 Data Quality Guidelines</h4>
  <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb;">
    <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 13px;">
      <li>Review and update incomplete equipment records</li>
      <li>Verify accuracy of inspection dates and due dates</li>
      <li>Remove or merge duplicate entries</li>
      <li>Ensure all required fields are populated</li>
    </ul>
  </div>
</div>`
    },
    {
      name: "User Activity Summary",
      description: "Weekly summary of system usage and user activity",
      automation_category: "user_activity",
      schedule: "0 17 * * 5", // Friday at 5 PM
      priority: 6,
      enabled: true,
      recipients: [],
      run_count: 0,
      error_count: 0,
      criteria: {
        daysSince: 7
      },
      template: `<div style="margin-bottom: 20px; padding: 15px; background: #f5f3ff; border-left: 4px solid #8b5cf6; border-radius: 4px;">
  <h3 style="margin: 0 0 8px 0; color: #7c3aed; font-size: 18px;">👥 Weekly User Activity Summary</h3>
  <p style="margin: 0; color: #8b5cf6; font-size: 14px;">System usage and activity metrics for the past week</p>
</div>

{{content}}

<div style="margin-top: 30px; padding: 15px; background: #fafafa; border-radius: 4px;">
  <h4 style="margin: 0 0 12px 0; color: #374151; font-size: 16px;">📊 Activity Insights</h4>
  <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb;">
    <p style="margin: 0 0 8px 0; font-size: 13px; color: #4b5563;">
      <strong>System Health:</strong> Monitor user engagement and identify training needs
    </p>
    <p style="margin: 0; font-size: 13px; color: #6b7280;">
      Regular activity tracking helps ensure optimal system utilization and user adoption.
    </p>
  </div>
</div>`
    },
    {
      name: "Executive Summary Report",
      description: "High-level monthly summary for management",
      automation_category: "custom_reports",
      schedule: "0 8 1 * *", // First day of month at 8 AM
      priority: 2,
      enabled: true,
      recipients: [],
      run_count: 0,
      error_count: 0,
      criteria: {
        report_type: "executive_summary"
      },
      template: `<div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">
  <h2 style="margin: 0 0 8px 0; font-size: 22px;">📊 Executive Summary Report</h2>
  <p style="margin: 0; opacity: 0.9; font-size: 15px;">Monthly equipment management performance overview</p>
</div>

{{content}}

<div style="margin-top: 30px; padding: 20px; background: #f9fafb; border-radius: 6px; border-top: 3px solid #3b82f6;">
  <h4 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">📋 Strategic Recommendations</h4>
  <div style="background: white; padding: 15px; border-radius: 4px; border-left: 4px solid #3b82f6;">
    <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.6;">
      <li>Review compliance trends and implement preventive measures</li>
      <li>Optimize maintenance schedules based on performance data</li>
      <li>Consider equipment lifecycle planning for aging assets</li>
      <li>Enhance training programs to improve data quality</li>
    </ul>
  </div>
</div>`
    }
  ];

  return templates;
}

// Get criteria fields based on job type
export function getCriteriaFields(jobType: string) {
  const fieldDefinitions: Record<string, any[]> = {
    monthly_schedule_overview: [
      { name: 'daysAhead', type: 'number', label: 'Days Ahead', default: 30, description: 'Show items due in next N days' },
      { name: 'include_vehicles', type: 'boolean', label: 'Include Vehicles', default: true },
      { name: 'include_trailers', type: 'boolean', label: 'Include Trailers', default: true },
      { name: 'include_vessels', type: 'boolean', label: 'Include Vessels', default: true },
      { name: 'include_equipment', type: 'boolean', label: 'Include Equipment', default: true }
    ],
    weekly_overdue_equipment: [
      { name: 'overdue_days', type: 'number', label: 'Overdue Days', default: 1, description: 'Equipment overdue by N days' }
    ],
    weekly_overdue_plant: [
      { name: 'overdue_days', type: 'number', label: 'Overdue Days', default: 1, description: 'Plant overdue by N days' }
    ],
    weekly_plant_action_required: [
      { name: 'daysAhead', type: 'number', label: 'Days Ahead', default: 14, description: 'Plant requiring action in next N days' },
      { name: 'include_vehicles', type: 'boolean', label: 'Include Vehicles', default: true },
      { name: 'include_trailers', type: 'boolean', label: 'Include Trailers', default: true },
      { name: 'include_vessels', type: 'boolean', label: 'Include Vessels', default: true }
    ],
    custom_reports: [
      { name: 'report_type', type: 'select', label: 'Report Type', options: ['summary', 'detailed', 'executive_summary'], default: 'summary' },
      { name: 'date_range_days', type: 'number', label: 'Date Range (Days)', default: 30 }
    ],
    data_quality: [
      { name: 'min_issue_count', type: 'number', label: 'Min Issue Count', default: 1, description: 'Only alert if N or more issues found' }
    ],
    user_activity: [
      { name: 'daysSince', type: 'number', label: 'Days Since', default: 7, description: 'Show activity from last N days' }
    ]
  };

  return fieldDefinitions[jobType] || [];
}