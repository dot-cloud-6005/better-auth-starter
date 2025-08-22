'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Settings } from 'lucide-react';
import { SCHEDULE_OPTIONS, validateCron, getNextRunTime } from '../../schedule-utils';

interface SchedulePickerProps {
  value: string;
  onChange: (schedule: string) => void;
  className?: string;
}

export function SchedulePicker({ value, onChange, className }: SchedulePickerProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [customCron, setCustomCron] = useState(value);
  const [selectedPreset, setSelectedPreset] = useState(() => {
    const preset = SCHEDULE_OPTIONS.find(opt => opt.cron === value);
    return preset ? preset.cron : '';
  });

  const handlePresetChange = (presetCron: string) => {
    setSelectedPreset(presetCron);
    onChange(presetCron);
  };

  const handleCustomChange = (cron: string) => {
    setCustomCron(cron);
    const validation = validateCron(cron);
    if (validation.valid) {
      onChange(cron);
    }
  };

  const validation = validateCron(mode === 'custom' ? customCron : value);
  const nextRun = getNextRunTime(value);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'preset' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('preset')}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Common Schedules
        </Button>
        <Button
          type="button"
          variant={mode === 'custom' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('custom')}
        >
          <Settings className="h-4 w-4 mr-1" />
          Custom
        </Button>
      </div>

      {mode === 'preset' ? (
        <div className="space-y-3">
          <Select value={selectedPreset} onValueChange={handlePresetChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a schedule..." />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {/* Group by category */}
              <div className="p-2 text-xs font-medium text-slate-500 border-b">Frequent</div>
              {SCHEDULE_OPTIONS.filter(opt => opt.category === 'frequent').map((option) => (
                <SelectItem key={option.cron} value={option.cron}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-slate-500">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
              
              <div className="p-2 text-xs font-medium text-slate-500 border-b border-t">Daily</div>
              {SCHEDULE_OPTIONS.filter(opt => opt.category === 'daily').map((option) => (
                <SelectItem key={option.cron} value={option.cron}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-slate-500">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
              
              <div className="p-2 text-xs font-medium text-slate-500 border-b border-t">Weekly</div>
              {SCHEDULE_OPTIONS.filter(opt => opt.category === 'weekly').map((option) => (
                <SelectItem key={option.cron} value={option.cron}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-slate-500">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
              
              <div className="p-2 text-xs font-medium text-slate-500 border-b border-t">Monthly</div>
              {SCHEDULE_OPTIONS.filter(opt => opt.category === 'monthly').map((option) => (
                <SelectItem key={option.cron} value={option.cron}>
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-slate-500">{option.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="customSchedule">Custom Schedule (Cron Expression)</Label>
          <Input
            id="customSchedule"
            value={customCron}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Enter cron expression"
            className="font-mono"
          />
          <p className="text-xs text-slate-500">
            {validation.valid ? `Next run: ${nextRun}` : validation.error}
          </p>
        </div>
      )}
    </div>
  );
}