export interface Equipment {
  id: string
  name: string
  groupId: string // Foreign key to equipment_groups table
  groupName?: string // Joined from equipment_groups.name
  autoId: string
  description?: string
  scheduleId: string // Foreign key to equipment_schedules table
  scheduleName?: string // Joined from equipment_schedules.name
  lastInspection?: Date
  nextInspection: Date
  status: 'compliant' | 'overdue' | 'upcoming'
  location?: string
  createdAt: Date
  updatedAt: Date
}

// Keep these for filtering/display purposes
export type EquipmentGroup = 'PFD' | 'Heights Safety' | 'Fire' | 'First Aid' | 'Racking' | 'Other';
export type Schedule = 'Monthly' | 'Quarterly' | '6-Monthly' | 'Annual' | 'Biennial';

export interface GroupStats {
  group: EquipmentGroup;
  total: number;
  compliant: number;
  overdue: number;
  upcoming: number;
}

export interface InspectionHistory {
  id: string;
  equipmentId: string;
  inspectionDate: Date;
  inspectorName?: string;
  notes?: string;
  status: 'pass' | 'fail' | 'needs_repair';
  nextInspectionDate?: Date;
  createdAt: Date;
}

export interface CreateInspection {
  equipmentId: string;
  inspectionDate: Date;
  inspectorName: string;
  notes?: string;
  status: 'pass' | 'fail' | 'needs_repair';
}