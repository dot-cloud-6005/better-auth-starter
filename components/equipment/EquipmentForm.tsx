'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save } from 'lucide-react';
import { Equipment, EquipmentGroup, Schedule } from '@/types/equipment/equipment';
import { generateAutoId, calculateNextInspection, getEquipmentStatus } from '@/lib/equipment/equipment';
import { Badge } from '@/components/ui/badge';

// Helper function to safely convert any date-like value to a Date object
const safelyParseDate = (dateValue: any): Date | null => {
  if (!dateValue) return null;
  
  try {
    // If it's already a Date object
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      return dateValue;
    }
    
    // Try to parse it as a string
    const parsedDate = new Date(dateValue);
    return !isNaN(parsedDate.getTime()) ? parsedDate : null;
  } catch (e) {
    console.error('Error parsing date:', e);
    return null;
  }
};
 
interface EquipmentFormProps {
  onSubmit: (equipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  existingEquipment: Equipment[];
  equipment?: Equipment;
  groups: Array<{id: string, name: EquipmentGroup}>;
  schedules: Array<{id: string, name: Schedule}>;
  readOnly?: boolean; // ADD THIS
  onEdit?: () => void; // ADD THIS for the edit button
}

const EquipmentForm = ({ 
  onSubmit, 
  onCancel, 
  existingEquipment, 
  equipment, 
  groups, 
  schedules, 
  readOnly = false, // ADD THIS
  onEdit // ADD THIS
}: EquipmentFormProps) => {
  const [formData, setFormData] = useState({
    name: equipment?.name || '',
    groupName: (equipment?.groupName as EquipmentGroup) || '' as EquipmentGroup, // Type assertion for equipment?.groupName
    autoId: equipment?.autoId || '',
    description: equipment?.description || '',
    scheduleName: (equipment?.scheduleName as Schedule) || '' as Schedule, // Type assertion for equipment?.scheduleName
    lastInspection: equipment?.lastInspection ? 
      (() => {
        const date = safelyParseDate(equipment.lastInspection);
        return date ? date.toISOString().split('T')[0] : '';
      })() : 
      '',
    location: equipment?.location || ''
  });

  const [nextInspection, setNextInspection] = useState<Date | null>(null);

  // Auto-generate ID when group changes
  useEffect(() => {
    if (formData.groupName && !equipment) { 
      const autoId = generateAutoId(formData.groupName, existingEquipment); 
      setFormData(prev => ({ ...prev, autoId }));
    }
  }, [formData.groupName, existingEquipment, equipment]); 

  // Calculate next inspection date when schedule or last inspection changes
  useEffect(() => {
    if (formData.scheduleName && formData.lastInspection) {
      const lastInspectionDate = new Date(formData.lastInspection);
      const nextInspectionDate = calculateNextInspection(lastInspectionDate, formData.scheduleName);
      setNextInspection(nextInspectionDate);
      console.log('Calculating next inspection:', { // Add debug log
        lastInspection: formData.lastInspection,
        schedule: formData.scheduleName,
        nextInspection: nextInspectionDate
      });
    } else {
      setNextInspection(null);
    }
  }, [formData.scheduleName, formData.lastInspection]); 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.groupName || !formData.scheduleName) {
      alert('Please fill in all required fields');
      return;
    }

    const lastInspectionDate = formData.lastInspection ? safelyParseDate(formData.lastInspection) : new Date();
    if (!lastInspectionDate) {
      alert('Invalid last inspection date');
      return;
    }
    
    const nextInspectionDate = calculateNextInspection(lastInspectionDate, formData.scheduleName);
    const status = getEquipmentStatus(nextInspectionDate);

    // Find the actual IDs from the passed data
    const selectedGroup = groups.find(g => g.name === formData.groupName);
    const selectedSchedule = schedules.find(s => s.name === formData.scheduleName);

    const equipmentData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.name,
      groupId: selectedGroup?.id || '',
      groupName: formData.groupName,
      autoId: formData.autoId,
      description: formData.description,
      scheduleId: selectedSchedule?.id || '',
      scheduleName: formData.scheduleName,
      lastInspection: formData.lastInspection ? new Date(formData.lastInspection) : undefined,
      nextInspection: nextInspectionDate,
      status,
      location: formData.location
    };

    onSubmit(equipmentData);
  };

  return (
    <div className="h-full pb-8 overflow-y-auto">
      <div className="container mx-auto max-w-2xl">
        {/* Enhanced Header */}
        <div className="flex items-center gap-4 mb-8 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {readOnly ? 'Equipment Details' : 
               equipment ? 'Edit Equipment' : 'Add New Equipment'}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {readOnly ? `Viewing details for ${equipment?.name || 'equipment'}` :
               equipment ? 'Update equipment details' : 'Create a new equipment entry for compliance tracking'}
            </p>
          </div>
          
          {/* Edit Button in Read-Only Mode */}
          {readOnly && onEdit && (
            <Button
              onClick={onEdit}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Edit Equipment
            </Button>
          )}
        </div>

        {/* Enhanced Form */}
        <Card className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 shadow-md mb-8">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">Equipment Details</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              {readOnly ? 'Equipment information and inspection details' : 
               'Fill in the equipment information. The ID will be auto-generated based on the group.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Group Selection */}
              <div className="space-y-2">
                <Label htmlFor="group" className="text-slate-700 dark:text-slate-300">
                  Equipment Group *
                </Label>
                {readOnly ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                    <span className="text-slate-900 dark:text-slate-100 font-medium">{formData.groupName}</span>
                  </div>
                ) : (
                  <Select
                    value={formData.groupName}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, groupName: value as EquipmentGroup }))}
                  >
                    <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400">
                      <SelectValue placeholder="Select equipment group" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 shadow-lg">
                      <SelectItem value="PFD" className="text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700">PFD</SelectItem>
                      <SelectItem value="Heights Safety" className="text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700">Heights Safety</SelectItem>
                      <SelectItem value="Fire" className="text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700">Fire Safety</SelectItem>
                      <SelectItem value="First Aid" className="text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700">First Aid</SelectItem>
                      <SelectItem value="Racking" className="text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700">Racking</SelectItem>
                      <SelectItem value="Other" className="text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location" className="text-slate-700 dark:text-slate-300">
                  Location
                </Label>
                {readOnly ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                    <span className="text-slate-900 dark:text-slate-100">{formData.location || 'Not specified'}</span>
                  </div>
                ) : (
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Enter equipment location"
                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                )}
              </div>

              {/* Equipment Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">
                  Equipment Name *
                </Label>
                {readOnly ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                    <span className="text-slate-900 dark:text-slate-100 font-medium">{formData.name}</span>
                  </div>
                ) : (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter equipment name"
                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                    required
                  />
                )}
              </div>

              {/* Auto-generated ID */}
              <div className="space-y-2">
                <Label htmlFor="autoId" className="text-slate-700 dark:text-slate-300">
                  Equipment ID
                </Label>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                  <span className="text-slate-900 dark:text-slate-100 font-mono">{formData.autoId}</span>
                </div>
                {!readOnly && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This ID is automatically generated based on the selected group
                  </p>
                )}
              </div>

              {/* Last Inspection Date */}
              <div className="space-y-2">
                <Label htmlFor="lastInspection" className="text-slate-700 dark:text-slate-300">
                  Last Inspection Date
                </Label>
                {readOnly ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                    <span className="text-slate-900 dark:text-slate-100">
                      {formData.lastInspection ? 
                        (() => {
                          const date = safelyParseDate(formData.lastInspection);
                          return date ? date.toLocaleDateString() : 'Unknown date';
                        })() : 
                        'No inspection recorded'}
                    </span>
                  </div>
                ) : (
                  <Input
                    id="lastInspection"
                    type="date"
                    value={formData.lastInspection}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastInspection: e.target.value }))}
                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                )}
              </div>

              {/* Schedule */}
              <div className="space-y-2">
                <Label htmlFor="schedule" className="text-slate-700 dark:text-slate-300">
                  Inspection Schedule *
                </Label>
                {readOnly ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                    <span className="text-slate-900 dark:text-slate-100 font-medium">{formData.scheduleName}</span>
                  </div>
                ) : (
                  <Select
                    value={formData.scheduleName}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, scheduleName: value as Schedule }))}
                  >
                    <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400">
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 shadow-lg">
                      {schedules?.map((schedule) => (
                        <SelectItem 
                          key={schedule.id} 
                          value={schedule.name}
                          className="text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          {schedule.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Next Inspection Date Display */}
              {(nextInspection || (readOnly && equipment?.nextInspection)) && (
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    Next Inspection Date {!readOnly && '(Calculated)'}
                  </Label>
                  <div className={`p-3 border rounded-md ${
                    readOnly ? 
                      'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 
                      'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  }`}>
                    <div className={`font-medium ${
                      readOnly ? 
                        'text-slate-800 dark:text-slate-200' : 
                        'text-blue-800 dark:text-blue-300'
                    }`}>
                      {readOnly && equipment?.nextInspection ? 
                        (() => {
                          const date = safelyParseDate(equipment.nextInspection);
                          return date ? date.toLocaleDateString() : 'Unknown date';
                        })() :
                        nextInspection?.toLocaleDateString()}
                    </div>
                    {!readOnly && (
                      <div className="text-blue-600 dark:text-blue-400 text-sm">
                        Based on {formData.scheduleName} schedule from last inspection
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Display for Read-Only */}
              {readOnly && equipment && (
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300">
                    Current Status
                  </Label>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
                    <Badge className={`${
                      equipment.status === 'compliant' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800' :
                      equipment.status === 'upcoming' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                      'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
                    }`}>
                      {equipment.status === 'compliant' ? 'Compliant' : 
                       equipment.status === 'upcoming' ? 'Due Soon' : 
                       'Overdue'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-700 dark:text-slate-300">
                  Description
                </Label>
                {readOnly ? (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md min-h-[80px]">
                    <span className="text-slate-900 dark:text-slate-100">
                      {formData.description || 'No description provided'}
                    </span>
                  </div>
                ) : (
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter equipment description"
                    className="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                    rows={3}
                  />
                )}
              </div>

              {/* Submit Buttons - Only show in edit mode */}
              {!readOnly && (
                <div className="flex gap-4 pt-4">
                  <Button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {equipment ? 'Update Equipment' : 'Add Equipment'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Additional Info for Read-Only Mode */}
        {readOnly && equipment && (
          <Card className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 shadow-md">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-100">Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-slate-600 dark:text-slate-400">Created</Label>
                  <p className="text-slate-900 dark:text-slate-100">
                    {equipment.createdAt ? 
                      (() => {
                        const date = safelyParseDate(equipment.createdAt);
                        return date ? date.toLocaleDateString() : 'Unknown date';
                      })() : 
                      'Unknown'}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-600 dark:text-slate-400">Last Updated</Label>
                  <p className="text-slate-900 dark:text-slate-100">
                    {equipment.updatedAt ? 
                      (() => {
                        const date = safelyParseDate(equipment.updatedAt);
                        return date ? date.toLocaleDateString() : 'Unknown date';
                      })() : 
                      'Unknown'}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-600 dark:text-slate-400">Group ID</Label>
                  <p className="text-slate-900 dark:text-slate-100 font-mono">{equipment.groupId}</p>
                </div>
                <div>
                  <Label className="text-slate-600 dark:text-slate-400">Schedule ID</Label>
                  <p className="text-slate-900 dark:text-slate-100 font-mono">{equipment.scheduleId}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EquipmentForm;