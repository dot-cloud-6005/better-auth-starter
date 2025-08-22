// Utility functions for converting between human-readable schedules and cron expressions

export interface ScheduleOption {
  label: string;
  description: string;
  cron: string;
  category: 'frequent' | 'daily' | 'weekly' | 'monthly' | 'custom';
}

export const SCHEDULE_OPTIONS: ScheduleOption[] = [
  // Frequent
  { label: 'Every Hour', description: 'Runs at the start of every hour', cron: '0 * * * *', category: 'frequent' },
  { label: 'Every 2 Hours', description: 'Runs every 2 hours starting at midnight', cron: '0 */2 * * *', category: 'frequent' },
  { label: 'Every 4 Hours', description: 'Runs every 4 hours (12am, 4am, 8am, 12pm, 4pm, 8pm)', cron: '0 */4 * * *', category: 'frequent' },
  { label: 'Every 6 Hours', description: 'Runs every 6 hours (12am, 6am, 12pm, 6pm)', cron: '0 */6 * * *', category: 'frequent' },
  { label: 'Twice Daily', description: 'Runs at 8am and 5pm every day', cron: '0 8,17 * * *', category: 'frequent' },
  
  // Daily
  { label: 'Daily at 8:00 AM', description: 'Runs every day at 8:00 AM', cron: '0 8 * * *', category: 'daily' },
  { label: 'Daily at 9:00 AM', description: 'Runs every day at 9:00 AM', cron: '0 9 * * *', category: 'daily' },
  { label: 'Daily at 12:00 PM', description: 'Runs every day at noon', cron: '0 12 * * *', category: 'daily' },
  { label: 'Daily at 5:00 PM', description: 'Runs every day at 5:00 PM', cron: '0 17 * * *', category: 'daily' },
  { label: 'Daily at 6:00 PM', description: 'Runs every day at 6:00 PM', cron: '0 18 * * *', category: 'daily' },
  
  // Weekly
  { label: 'Weekly on Monday at 8:00 AM', description: 'Runs every Monday at 8:00 AM', cron: '0 8 * * 1', category: 'weekly' },
  { label: 'Weekly on Tuesday at 9:00 AM', description: 'Runs every Tuesday at 9:00 AM', cron: '0 9 * * 2', category: 'weekly' },
  { label: 'Weekly on Wednesday at 8:00 AM', description: 'Runs every Wednesday at 8:00 AM', cron: '0 8 * * 3', category: 'weekly' },
  { label: 'Weekly on Friday at 9:00 AM', description: 'Runs every Friday at 9:00 AM', cron: '0 9 * * 5', category: 'weekly' },
  { label: 'Weekdays at 8:00 AM', description: 'Runs Monday to Friday at 8:00 AM', cron: '0 8 * * 1-5', category: 'weekly' },
  
  // Monthly
  { label: 'Monthly on 1st at 8:00 AM', description: 'Runs on the 1st day of every month at 8:00 AM', cron: '0 8 1 * *', category: 'monthly' },
  { label: 'Monthly on 15th at 9:00 AM', description: 'Runs on the 15th day of every month at 9:00 AM', cron: '0 9 15 * *', category: 'monthly' },
  { label: 'Monthly on Last Day at 5:00 PM', description: 'Runs on the last day of every month at 5:00 PM', cron: '0 17 L * *', category: 'monthly' },
  { label: 'End of Quarter at 8:00 AM', description: 'Runs on the last day of Mar, Jun, Sep, Dec at 8:00 AM', cron: '0 8 L 3,6,9,12 *', category: 'monthly' },
];

export function cronToHumanReadable(cron: string): string {
  const option = SCHEDULE_OPTIONS.find(opt => opt.cron === cron);
  if (option) {
    return option.label;
  }
  
  // Try to parse common patterns
  const parts = cron.split(' ');
  if (parts.length !== 5) return `Custom: ${cron}`;
  
  const [minute, hour, day, month, dayOfWeek] = parts;
  
  // Daily patterns
  if (day === '*' && month === '*' && dayOfWeek === '*' && minute === '0') {
    if (hour === '*') return 'Every hour';
    if (hour.includes('*/')) return `Every ${hour.split('*/')[1]} hours`;
    if (hour.includes(',')) return `Daily at ${hour.split(',').map(h => `${h}:00`).join(' and ')}`;
    return `Daily at ${hour}:00`;
  }
  
  // Weekly patterns
  if (day === '*' && month === '*' && dayOfWeek !== '*' && minute === '0') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNames = dayOfWeek.split(',').map(d => days[parseInt(d)] || `Day ${d}`);
    return `Weekly on ${dayNames.join(', ')} at ${hour}:00`;
  }
  
  // Monthly patterns
  if (month === '*' && dayOfWeek === '*' && minute === '0') {
    if (day === '1') return `Monthly on 1st at ${hour}:00`;
    if (day === 'L') return `Monthly on last day at ${hour}:00`;
    return `Monthly on ${day} at ${hour}:00`;
  }
  
  return `Custom: ${cron}`;
}

export function validateCron(cron: string): { valid: boolean; error?: string } {
  const parts = cron.trim().split(/\s+/);
  
  if (parts.length !== 5) {
    return { valid: false, error: 'Cron expression must have exactly 5 parts (minute hour day month dayofweek)' };
  }
  
  const [minute, hour, day, month, dayOfWeek] = parts;
  
  // Basic validation
  const validateRange = (value: string, min: number, max: number, name: string): boolean => {
    if (value === '*') return true;
    if (value.includes('/')) {
      const [range, step] = value.split('/');
      if (range === '*') return parseInt(step) > 0;
      return validateRange(range, min, max, name);
    }
    if (value.includes(',')) {
      return value.split(',').every(v => validateRange(v, min, max, name));
    }
    if (value.includes('-')) {
      const [start, end] = value.split('-');
      return parseInt(start) >= min && parseInt(end) <= max && parseInt(start) <= parseInt(end);
    }
    const num = parseInt(value);
    return !isNaN(num) && num >= min && num <= max;
  };
  
  if (!validateRange(minute, 0, 59, 'minute')) {
    return { valid: false, error: 'Minute must be between 0-59' };
  }
  if (!validateRange(hour, 0, 23, 'hour')) {
    return { valid: false, error: 'Hour must be between 0-23' };
  }
  if (!validateRange(day, 1, 31, 'day')) {
    return { valid: false, error: 'Day must be between 1-31' };
  }
  if (!validateRange(month, 1, 12, 'month')) {
    return { valid: false, error: 'Month must be between 1-12' };
  }
  if (!validateRange(dayOfWeek, 0, 7, 'day of week')) {
    return { valid: false, error: 'Day of week must be between 0-7 (0 and 7 are Sunday)' };
  }
  
  return { valid: true };
}

export function getNextRunTime(cron: string): Date | null {
  // This is a simplified version - in production you'd use a proper cron parser
  try {
    const now = new Date();
    const parts = cron.split(' ');
    if (parts.length !== 5) return null;
    
    const [minute, hour, day, month, dayOfWeek] = parts;
    
    // Simple case: daily at specific time
    if (day === '*' && month === '*' && dayOfWeek === '*') {
      const targetHour = parseInt(hour);
      const targetMinute = parseInt(minute);
      
      if (!isNaN(targetHour) && !isNaN(targetMinute)) {
        const nextRun = new Date(now);
        nextRun.setHours(targetHour, targetMinute, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        
        return nextRun;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}