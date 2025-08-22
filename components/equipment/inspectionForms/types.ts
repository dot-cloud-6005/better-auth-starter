// Base interface for common inspectable properties
export interface BaseInspectableItem {
  id: string;
  name: string;
  autoId: string;
  group: string;
  status: 'compliant' | 'upcoming' | 'overdue';
  nextInspection: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Equipment-specific inspectable interface
export interface EquipmentInspectable extends BaseInspectableItem {
  type: 'equipment';
  // Equipment specific fields
  location?: string;
  certificateNumber?: string;
  description?: string;
  schedule?: string;
  lastInspection?: Date;
}

// Plant-specific inspectable interface  
export interface PlantInspectable extends BaseInspectableItem {
  type: 'plant';
  // Plant specific fields
  registrationNumber?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  plantStatus?: string;
  serviceDueDate?: Date | string;
  location?: string;
  responsiblePerson?: string;
  odometer?: number;
  
  // Service tracking
  serviceDueOdometer?: number;
  lastServiceOdometer?: number;
  serviceIntervalKm?: number;
  serviceIntervalDays?: number;
  
  // Hiab specific (for trucks)
  hiabFitted?: boolean;
  hiabMake?: string;
  hiabModel?: string;
  hiabServiceDueDate?: Date | string;
  
  // Vessel specific
  uvi?: string;
  outboardType?: string;
  outboardQuantity?: number;
  vesselSurveyDueDate?: Date | string;
  vesselSurveyType?: string;
  certificateOfOperationDueDate?: Date | string;

  // Vessel safety equipment (prefills)
  firstAidKitExpiryDate?: Date | string;
  fireExtinguisherExpiryDate?: Date | string;
  epirbExpiryDate?: Date | string;
  lifeJacketQuantity?: number;
  flareQuantity?: number;

  // Outboard service tracking
  outboardServiceDueDate?: Date | string;
  
  // Petrol Plant specific
  description?: string;
  serialNumber?: string;
}

// Union type for all inspectable items
export type InspectableItem = EquipmentInspectable | PlantInspectable;

// Form props interfaces
export interface PlantFormProps {
  selectedItem: PlantInspectable;
}

export interface EquipmentFormProps {
  selectedItem: EquipmentInspectable;
}