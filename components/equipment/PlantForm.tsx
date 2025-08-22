'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, X, Car, Truck, Ship, Fuel, TypeOutline } from 'lucide-react';
import { Plant, PlantGroup } from '@/types/equipment/plant';
import { generateAutoId } from '@/lib/equipment/actions/plant';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface PlantFormProps {
  onSubmit: (plantData: Omit<Plant, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  existingPlant: Plant[];
  plant?: Plant;
  groups?: Array<{id: string, name: PlantGroup}>;
  readOnly?: boolean; // ADD THIS
  onEdit?: () => void; // ADD THIS for the edit button
}

const groupIcons = {
  Vehicle: Car,
  Truck: Truck,
  Trailer: TypeOutline,
  Vessel: Ship,
  'Petrol Plant': Fuel
};

const toYMD = (v?: Date | string) => {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};
const displayDate = (v?: Date | string) => {
  if (!v) return 'Not set';
  const d = typeof v === 'string' ? new Date(v) : v;
  return isNaN(d.getTime()) ? 'Not set' : d.toLocaleDateString();
};

const PlantForm = ({ 
  onSubmit, 
  onCancel, 
  existingPlant, 
  plant, 
  groups,
  readOnly = false, 
  onEdit 
}: PlantFormProps) => {
  const [formData, setFormData] = useState({
    name: plant?.name || '',
    groupName: (plant?.groupName as PlantGroup) || ('Vehicle' as PlantGroup),
    autoId: plant?.autoId || '',
    
    // Common fields
    registrationNumber: plant?.registrationNumber || '',
    serviceDueDate: toYMD(plant?.serviceDueDate),
    location: plant?.location || '',
    responsiblePerson: plant?.responsiblePerson || '',
    status: plant?.status || 'compliant' as const,
    
    // Vehicle/Truck specific - keep as strings for form inputs
    vehicleMake: plant?.vehicleMake || '',
    vehicleModel: plant?.vehicleModel || '',
    odometer: plant?.odometer?.toString() || '', // Convert to string for input
    
    // Service tracking fields
    serviceIntervalKm: plant?.serviceIntervalKm?.toString() || '10000',
    serviceIntervalDays: plant?.serviceIntervalDays?.toString() || '365',
    lastServiceOdometer: plant?.lastServiceOdometer?.toString() || '',
    lastServiceDate: '', // Derive lastServiceDate only if you want; otherwise leave blank to avoid bad math
    
    hiabFitted: plant?.hiabFitted || false,
    hiabMake: plant?.hiabMake || '',
    hiabModel: plant?.hiabModel || '',
    hiabServiceDueDate: toYMD(plant?.hiabServiceDueDate),
    
    // Vessel specific
    uvi: plant?.uvi || '',
    outboardType: plant?.outboardType || '',
    outboardQuantity: plant?.outboardQuantity?.toString() || '',
    vesselSurveyDueDate: toYMD(plant?.vesselSurveyDueDate),
    vesselSurveyType: plant?.vesselSurveyType || '',
    certificateOfOperationDueDate: toYMD(plant?.certificateOfOperationDueDate),
    
    // Petrol Plant specific
    description: plant?.description || '',
    serialNumber: plant?.serialNumber || '',
    plantStatus: plant?.plantStatus || 'in_service' as const
  });

  const [loading, setLoading] = useState(false);
  const [autoIdGenerated, setAutoIdGenerated] = useState(!!plant?.autoId);

  // Generate auto ID when group changes (for new plant only)
  useEffect(() => {
    if (!plant && formData.groupName && !autoIdGenerated) {
      generateAutoIdForGroup(formData.groupName); // Now properly typed as PlantGroup
    }
  }, [formData.groupName, plant, autoIdGenerated]);

  const generateAutoIdForGroup = async (group: PlantGroup) => {
    try {
      const result = await generateAutoId(group);
      if (result.autoId) {
        setFormData(prev => ({ ...prev, autoId: result.autoId! }));
        setAutoIdGenerated(true);
      } else if (result.error) {
        toast.error('Failed to generate Auto ID');
      }
    } catch (error) {
      console.error('Error generating auto ID:', error);
      toast.error('Failed to generate Auto ID');
    }
  };

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGroupChange = (newGroup: PlantGroup) => {
    setFormData(prev => ({ 
      ...prev, 
      groupName: newGroup,
      // Reset group-specific fields when changing groups
      vehicleMake: '',
      vehicleModel: '',
      odometer: '',
      hiabFitted: false,
      hiabMake: '',
      hiabModel: '',
      hiabServiceDueDate: '',
      uvi: '',
      outboardType: '',
      outboardQuantity: '',
      vesselSurveyDueDate: '',
      vesselSurveyType: '',
      certificateOfOperationDueDate: '',
      description: '',
      serialNumber: '',
      plantStatus: 'in_service'
    }));
    
    // Generate new auto ID for new plant when group changes
    if (!plant) {
      setAutoIdGenerated(false);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return false;
    }
    
    if (!formData.autoId.trim()) {
      toast.error('Auto ID is required');
      return false;
    }

    // Only check for duplicate auto ID when creating new plant
    if (!plant) {
      const duplicateAutoId = existingPlant.find(p => p.autoId === formData.autoId);
      if (duplicateAutoId) {
        toast.error('Auto ID already exists');
        return false;
      }
    }

    // Group-specific validation
    switch (formData.groupName) {
      case 'Vehicle':
      case 'Truck':
        if (!formData.vehicleMake.trim()) {
          toast.error('Vehicle Make is required');
          return false;
        }
        if (!formData.vehicleModel.trim()) {
          toast.error('Vehicle Model is required');
          return false;
        }
        if (!formData.registrationNumber.trim()) {
          toast.error('Registration Number is required');
          return false;
        }
        if (formData.hiabFitted && (!formData.hiabMake.trim() || !formData.hiabModel.trim())) {
          toast.error('Hiab Make and Model are required when Hiab is fitted');
          return false;
        }
        break;
      case 'Trailer':
        if (!formData.registrationNumber.trim()) {
          toast.error('Registration Number is required');
          return false;
        }
        break;
      case 'Vessel':
        if (!formData.uvi.trim()) {
          toast.error('UVI is required');
          return false;
        }
        // No registration number validation for vessels
        break;
      case 'Petrol Plant':
        if (!formData.description.trim()) {
          toast.error('Description is required');
          return false;
        }
        if (!formData.serialNumber.trim()) {
          toast.error('Serial Number is required');
          return false;
        }
        // No registration number validation for petrol plants
        break;
    }

    return true;
  };

  // Add these fields to your formData state:
  // NEW: Auto-calculate service due dates and odometer
  const calculateServiceDues = () => {
    const currentOdometer = parseInt(formData.odometer) || 0;
    const lastServiceOdo = parseInt(formData.lastServiceOdometer) || currentOdometer;
    const intervalKm = parseInt(formData.serviceIntervalKm) || 10000;
    const intervalDays = parseInt(formData.serviceIntervalDays) || 365;
    
    // Calculate next service due by odometer
    const serviceDueOdometer = lastServiceOdo + intervalKm;
    
    // Calculate next service due by date
    let serviceDueDate: Date | undefined;
    if (formData.lastServiceDate) {
      const lastServiceDate = new Date(formData.lastServiceDate);
      serviceDueDate = new Date(lastServiceDate);
      serviceDueDate.setDate(serviceDueDate.getDate() + intervalDays);
    }
    
    return {
      serviceDueOdometer,
      serviceDueDate
    };
  };

  // Auto-update service dues when relevant fields change
  useEffect(() => {
    if ((formData.groupName === 'Vehicle' || formData.groupName === 'Truck') && 
        (formData.lastServiceOdometer || formData.lastServiceDate)) {
      const { serviceDueOdometer, serviceDueDate } = calculateServiceDues();
      
      // Update the form with calculated values (but don't overwrite user input)
      if (!plant) { // Only auto-calculate for new vehicles
        setFormData(prev => ({
          ...prev,
          serviceDueDate: serviceDueDate ? serviceDueDate.toISOString().split('T')[0] : prev.serviceDueDate
        }));
      }
    }
  }, [formData.lastServiceOdometer, formData.lastServiceDate, formData.serviceIntervalKm, formData.serviceIntervalDays, formData.groupName]);

  // Fix the handleSubmit function to use existing groupId when editing
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Calculate service dues
      const { serviceDueOdometer, serviceDueDate } = calculateServiceDues();
      
      // For existing plant, use the existing groupId. For new plant, find from groups array
      let groupId: string;
      
      if (plant) {
        // EDITING EXISTING PLANT: Use the existing groupId
        groupId = plant.groupId || ''; // Use existing groupId
        console.log('Using existing groupId for edit:', groupId);
      } else {
        // CREATING NEW PLANT: Look up groupId from groups array
        const selectedGroup = groups?.find(g => g.name === formData.groupName);
        groupId = selectedGroup?.id || crypto.randomUUID();
        console.log('Using new groupId for creation:', groupId);
      }
      
      const plantData: Omit<Plant, 'id' | 'createdAt' | 'updatedAt'> = {
        name: formData.name.trim(),
        groupId: groupId, // Now uses correct groupId for both edit and create
        groupName: formData.groupName,
        autoId: formData.autoId.trim(),
        registrationNumber: formData.registrationNumber.trim() || undefined,
        serviceDueDate: serviceDueDate || (formData.serviceDueDate ? new Date(formData.serviceDueDate) : undefined),
        location: formData.location.trim() || undefined,
        responsiblePerson: formData.responsiblePerson.trim() || undefined,
        status: formData.status,
        vehicleMake: formData.vehicleMake.trim() || undefined,
        vehicleModel: formData.vehicleModel.trim() || undefined,
        odometer: formData.odometer ? parseInt(formData.odometer) : undefined,
        
        // Service tracking fields
        serviceDueOdometer,
        lastServiceOdometer: formData.lastServiceOdometer ? parseInt(formData.lastServiceOdometer) : undefined,
        serviceIntervalKm: parseInt(formData.serviceIntervalKm) || 10000,
        serviceIntervalDays: parseInt(formData.serviceIntervalDays) || 365,
        
        hiabFitted: formData.hiabFitted,
        hiabMake: formData.hiabMake.trim() || undefined,
        hiabModel: formData.hiabModel.trim() || undefined,
        hiabServiceDueDate: formData.hiabServiceDueDate ? new Date(formData.hiabServiceDueDate) : undefined,
        
        // Vessel specific
        uvi: formData.uvi.trim() || undefined,
        outboardType: formData.outboardType.trim() || undefined,
        outboardQuantity: formData.outboardQuantity ? parseInt(formData.outboardQuantity) : undefined,
        vesselSurveyDueDate: formData.vesselSurveyDueDate ? new Date(formData.vesselSurveyDueDate) : undefined,
        vesselSurveyType: formData.vesselSurveyType.trim() || undefined,
        certificateOfOperationDueDate: formData.certificateOfOperationDueDate ? new Date(formData.certificateOfOperationDueDate) : undefined,
        
        // Petrol Plant specific
        description: formData.description.trim() || undefined,
        serialNumber: formData.serialNumber.trim() || undefined,
        plantStatus: formData.plantStatus
      };

      console.log('Submitting plant data with groupId:', groupId);
      await onSubmit(plantData);
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to save plant');
    } finally {
      setLoading(false);
    }
  };

  const renderGroupSpecificFields = () => {
    const Icon = groupIcons[formData.groupName as keyof typeof groupIcons];
    
    switch (formData.groupName) {
      case 'Vehicle':
      case 'Truck':
        return (
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-200">
                <Icon className="h-5 w-5 dark:text-slate-300" />
                {formData.groupName} Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Vehicle Make & Model */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vehicleMake" className="dark:text-slate-300">Vehicle Make *</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">{formData.vehicleMake || 'Not specified'}</span>
                    </div>
                  ) : (
                    <Input
                      id="vehicleMake"
                      value={formData.vehicleMake}
                      onChange={(e) => handleInputChange('vehicleMake', e.target.value)}
                      placeholder="e.g., Toyota, Ford"
                      required
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="vehicleModel" className="dark:text-slate-300">Vehicle Model *</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">{formData.vehicleModel || 'Not specified'}</span>
                    </div>
                  ) : (
                    <Input
                      id="vehicleModel"
                      value={formData.vehicleModel}
                      onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                      placeholder="e.g., Hilux, Ranger"
                      required
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>
              </div>

              {/* Odometer */}
              <div>
                <Label htmlFor="odometer" className="dark:text-slate-300">Odometer (km)</Label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                  <span className="text-slate-900 dark:text-slate-200">
                    {formData.odometer ? 
                      parseInt(formData.odometer).toLocaleString() + ' km' : 
                      'Not specified'}
                  </span>
                </div>
                {!readOnly && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Auto-updated from service records
                  </p>
                )}
              </div>

              {/* HIAB Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center gap-2 dark:bg-slate-800 dark:border-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.hiabFitted}
                        disabled
                        className="rounded border-slate-300 dark:border-slate-600"
                      />
                      <span className="text-slate-900 dark:text-slate-200">HIAB Fitted</span>
                    </div>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        id="hiabFitted"
                        checked={formData.hiabFitted}
                        onChange={(e) => handleInputChange('hiabFitted', e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
                      />
                      <Label htmlFor="hiabFitted" className="dark:text-slate-300">HIAB Fitted</Label>
                    </>
                  )}
                </div>

                {formData.hiabFitted && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                    <div>
                      <Label htmlFor="hiabMake" className="dark:text-slate-300">HIAB Make</Label>
                      {readOnly ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                          <span className="text-slate-900 dark:text-slate-200">{formData.hiabMake || 'Not specified'}</span>
                        </div>
                      ) : (
                        <Input
                          id="hiabMake"
                          value={formData.hiabMake}
                          onChange={(e) => handleInputChange('hiabMake', e.target.value)}
                          placeholder="HIAB manufacturer"
                          className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                        />
                      )}
                    </div>
                    <div>
                      <Label htmlFor="hiabModel" className="dark:text-slate-300">HIAB Model</Label>
                      {readOnly ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                          <span className="text-slate-900 dark:text-slate-200">{formData.hiabModel || 'Not specified'}</span>
                        </div>
                      ) : (
                        <Input
                          id="hiabModel"
                          value={formData.hiabModel}
                          onChange={(e) => handleInputChange('hiabModel', e.target.value)}
                          placeholder="HIAB model"
                          className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                        />
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="hiabServiceDueDate" className="dark:text-slate-300">HIAB Service Due Date</Label>
                      {readOnly ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                          <span className="text-slate-900 dark:text-slate-200">
                            {formData.hiabServiceDueDate ? 
                              new Date(formData.hiabServiceDueDate).toLocaleDateString() : 
                              'Not set'}
                          </span>
                        </div>
                      ) : (
                        <Input
                          id="hiabServiceDueDate"
                          type="date"
                          value={formData.hiabServiceDueDate}
                          onChange={(e) => handleInputChange('hiabServiceDueDate', e.target.value)}
                          className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'Vessel':
        return (
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-200">
                <Icon className="h-5 w-5 dark:text-slate-300" />
                Vessel Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="outboardType" className="dark:text-slate-300">Outboard Type</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">{formData.outboardType || 'Not specified'}</span>
                    </div>
                  ) : (
                    <Input
                      id="outboardType"
                      value={formData.outboardType}
                      onChange={(e) => handleInputChange('outboardType', e.target.value)}
                      placeholder="Type of outboard motor"
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>
                
                <div>
                  <Label htmlFor="outboardQuantity" className="dark:text-slate-300">Outboard Quantity</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">
                        {formData.outboardQuantity ? formData.outboardQuantity.toString() : 'Not specified'}
                      </span>
                    </div>
                  ) : (
                    <Input
                      id="outboardQuantity"
                      type="number"
                      value={formData.outboardQuantity || ''}
                      onChange={(e) => handleInputChange('outboardQuantity', e.target.value)}
                      placeholder="Number of outboards"
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>
                
                <div>
                  <Label htmlFor="vesselSurveyType" className="dark:text-slate-300">Survey Type</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">{formData.vesselSurveyType || 'Not specified'}</span>
                    </div>
                  ) : (
                    <Select value={formData.vesselSurveyType} onValueChange={(value) => handleInputChange('vesselSurveyType', value)}>
                      <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                        <SelectValue placeholder="Select survey type" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                        <SelectItem value="Basic" className="dark:text-slate-200 dark:focus:bg-slate-700">Basic</SelectItem>
                        <SelectItem value="Commercial" className="dark:text-slate-200 dark:focus:bg-slate-700">Commercial</SelectItem>
                        <SelectItem value="Safety" className="dark:text-slate-200 dark:focus:bg-slate-700">Safety</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                {/* Add a placeholder div to keep the grid layout balanced */}
                <div></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vesselSurveyDueDate" className="dark:text-slate-300">Vessel Survey Due Date</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">
                        {formData.vesselSurveyDueDate ? 
                          new Date(formData.vesselSurveyDueDate).toLocaleDateString() : 
                          'Not set'}
                      </span>
                    </div>
                  ) : (
                    <Input
                      id="vesselSurveyDueDate"
                      type="date"
                      value={formData.vesselSurveyDueDate}
                      onChange={(e) => handleInputChange('vesselSurveyDueDate', e.target.value)}
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    />
                  )}
                </div>
                
                <div>
                  <Label htmlFor="certificateOfOperationDueDate" className="dark:text-slate-300">Certificate of Operation Due Date</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">
                        {formData.certificateOfOperationDueDate ? 
                          new Date(formData.certificateOfOperationDueDate).toLocaleDateString() : 
                          'Not set'}
                      </span>
                    </div>
                  ) : (
                    <Input
                      id="certificateOfOperationDueDate"
                      type="date"
                      value={formData.certificateOfOperationDueDate}
                      onChange={(e) => handleInputChange('certificateOfOperationDueDate', e.target.value)}
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );

      case 'Petrol Plant':
        return (
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-200">
                <Icon className="h-5 w-5 dark:text-slate-300" />
                Petrol Plant Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="serialNumber" className="dark:text-slate-300">Serial Number</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">{formData.serialNumber || 'Not specified'}</span>
                    </div>
                  ) : (
                    <Input
                      id="serialNumber"
                      value={formData.serialNumber}
                      onChange={(e) => handleInputChange('serialNumber', e.target.value)}
                      placeholder="Equipment serial number"
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>
                
                <div>
                  <Label htmlFor="plantStatus" className="dark:text-slate-300">Plant Status</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 capitalize dark:text-slate-200">
                        {formData.plantStatus ? formData.plantStatus.replace('_', ' ') : 'Not specified'}
                      </span>
                    </div>
                  ) : (
                    <Select value={formData.plantStatus} onValueChange={(value) => handleInputChange('plantStatus', value)}>
                      <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                        <SelectValue placeholder="Select plant status" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                        <SelectItem value="operational" className="dark:text-slate-200 dark:focus:bg-slate-700">Operational</SelectItem>
                        <SelectItem value="maintenance" className="dark:text-slate-200 dark:focus:bg-slate-700">Maintenance</SelectItem>
                        <SelectItem value="out_of_service" className="dark:text-slate-200 dark:focus:bg-slate-700">Out of Service</SelectItem>
                        <SelectItem value="retired" className="dark:text-slate-200 dark:focus:bg-slate-700">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="dark:text-slate-300">Description</Label>
                {readOnly ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md min-h-[80px] dark:bg-slate-800 dark:border-slate-700">
                    <span className="text-slate-900 dark:text-slate-200">{formData.description || 'No description provided'}</span>
                  </div>
                ) : (
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Detailed description of the petrol plant"
                    rows={3}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        );

      case 'Trailer':
        return (
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 dark:text-slate-200">
                <Icon className="h-5 w-5 dark:text-slate-300" />
                Trailer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="description" className="dark:text-slate-300">Description</Label>
                {readOnly ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md min-h-[80px] dark:bg-slate-800 dark:border-slate-700">
                    <span className="text-slate-900 dark:text-slate-200">{formData.description || 'No description provided'}</span>
                  </div>
                ) : (
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Trailer specifications and details"
                    rows={3}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full pb-8 overflow-y-auto">
      <div className="container mx-auto max-w-4xl">
        {/* Enhanced Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {readOnly ? 'Plant Details' : 
               plant ? `Edit ${plant.groupName}` : 'Add New Plant'} {/* Show group in title when editing */}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {readOnly ? `Viewing details for ${plant?.name || 'plant'}` :
               plant ? `Update ${plant.groupName.toLowerCase()} information` : 'Add a new plant item to your inventory'}
            </p>
          </div>
          
          {/* Edit Button in Read-Only Mode */}
          {readOnly && onEdit && (
            <Button
              onClick={onEdit}
              className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              <Save className="h-4 w-4 mr-2" />
              Edit Plant
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card className="dark:bg-slate-900 dark:border-slate-800">
            <CardHeader>
              <CardTitle className="dark:text-slate-200">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="name" className="dark:text-slate-300">Name *</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 font-medium dark:text-slate-200">{formData.name}</span>
                    </div>
                  ) : (
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Plant name"
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>
                
                <div>
                  <Label htmlFor="group" className="dark:text-slate-300">Group *</Label>
                  {readOnly || plant ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 font-medium dark:text-slate-200">{formData.groupName}</span>
                    </div>
                  ) : (
                    <Select value={formData.groupName} onValueChange={handleGroupChange}>
                      <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                        <SelectItem value="Vehicle" className="dark:text-slate-200 dark:focus:bg-slate-700">Vehicle</SelectItem>
                        <SelectItem value="Truck" className="dark:text-slate-200 dark:focus:bg-slate-700">Truck</SelectItem>
                        <SelectItem value="Trailer" className="dark:text-slate-200 dark:focus:bg-slate-700">Trailer</SelectItem>
                        <SelectItem value="Vessel" className="dark:text-slate-200 dark:focus:bg-slate-700">Vessel</SelectItem>
                        <SelectItem value="Petrol Plant" className="dark:text-slate-200 dark:focus:bg-slate-700">Petrol Plant</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {!readOnly && plant && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Group cannot be changed after creation
                    </p>
                  )}
                  {!readOnly && !plant && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Choose carefully - this cannot be changed later
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="autoId" className="dark:text-slate-300">Auto ID *</Label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                    <span className="text-slate-900 font-mono dark:text-slate-200">{formData.autoId}</span>
                  </div>
                  {!readOnly && !plant && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Auto-generated ID (cannot be changed)
                    </p>
                  )}
                  {!readOnly && plant && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Auto ID cannot be changed after creation
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="serviceDueDate" className="dark:text-slate-300">Service Due Date</Label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                    <span className="text-slate-900 dark:text-slate-200">
                      {formData.serviceDueDate ? 
                        new Date(formData.serviceDueDate).toLocaleDateString() : 
                        'Not set'}
                    </span>
                  </div>
                  {!readOnly && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Auto-calculated from completed inspections
                    </p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="location" className="dark:text-slate-300">Location</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">{formData.location || 'Not specified'}</span>
                    </div>
                  ) : (
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                      placeholder="Where is this plant located?"
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>
              </div>

              {/* Conditional Registration Number / UVI field */}
              {formData.groupName === 'Vessel' ? (
                /* UVI for Vessels */
                <div>
                  <Label htmlFor="uvi" className="dark:text-slate-300">UVI (Unique Vessel Identifier) *</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">{formData.uvi || 'Not specified'}</span>
                    </div>
                  ) : (
                    <Input
                      id="uvi"
                      value={formData.uvi}
                      onChange={(e) => handleInputChange('uvi', e.target.value)}
                      placeholder="Unique Vessel Identifier"
                      required
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>
              ) : formData.groupName !== 'Petrol Plant' ? (
                /* Registration Number for Vehicle, Truck, Trailer (but NOT Petrol Plant) */
                <div>
                  <Label htmlFor="registrationNumber" className="dark:text-slate-300">Registration Number *</Label>
                  {readOnly ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                      <span className="text-slate-900 dark:text-slate-200">{formData.registrationNumber || 'Not specified'}</span>
                    </div>
                  ) : (
                    <Input
                      id="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                      placeholder="Registration number"
                      required
                      className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                    />
                  )}
                </div>
              ) : null}

              {/* Responsible Person */}
              <div>
                <Label htmlFor="responsiblePerson" className="dark:text-slate-300">Responsible Person</Label>
                {readOnly ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                    <span className="text-slate-900 dark:text-slate-200">{formData.responsiblePerson || 'Not specified'}</span>
                  </div>
                ) : (
                  <Input
                    id="responsiblePerson"
                    value={formData.responsiblePerson}
                    onChange={(e) => handleInputChange('responsiblePerson', e.target.value)}
                    placeholder="Person responsible for this plant"
                    className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
                  />
                )}
              </div>

              {/* Status Display for Read-Only */}
              {readOnly && plant && (
                <div>
                  <Label className="text-slate-700 dark:text-slate-300">Current Status</Label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md dark:bg-slate-800 dark:border-slate-700">
                    <Badge className={`${
                      (plant.status || 'compliant') === 'compliant' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-800' :
                      (plant.status || 'compliant') === 'upcoming' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-800' :
                      'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-100 dark:border-red-800'
                    }`}>
                      {((plant.status || 'compliant') === 'compliant' ? 'Compliant' : 
                       (plant.status || 'compliant') === 'upcoming' ? 'Due Soon' : 
                       'Overdue')}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhanced Group-specific fields with read-only support */}
          {renderGroupSpecificFields()}

          {/* Submit Buttons - Only show in edit mode */}
          {!readOnly && (
            <div className="flex justify-end space-x-4 pt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel} 
                disabled={loading}
                className="dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading}
                className="dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : plant ? 'Update Plant' : 'Create Plant'}
              </Button>
            </div>
          )}
        </form>

        {/* Additional Info for Read-Only Mode */}
        {readOnly && plant && (
          <Card className="bg-white/80 border-slate-300 shadow-md mt-6 dark:bg-slate-900/80 dark:border-slate-800 dark:shadow-slate-900/50">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-200">Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-slate-600 dark:text-slate-400">Created</Label>
                  <p className="text-slate-900 dark:text-slate-200">{displayDate(plant.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-slate-600 dark:text-slate-400">Last Updated</Label>
                  <p className="text-slate-900 dark:text-slate-200">{displayDate(plant.updatedAt)}</p>
                </div>
                <div>
                  <Label className="text-slate-600 dark:text-slate-400">Group ID</Label>
                  <p className="text-slate-900 font-mono dark:text-slate-200">{plant.groupId}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PlantForm;