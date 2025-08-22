export interface Plant {
  id: string
  name: string
  groupId?: string
  groupName: PlantGroup
  autoId: string

  // Common
  registrationNumber?: string
  serviceDueDate?: Date | string
  location?: string
  responsiblePerson?: string
  status?: 'compliant' | 'upcoming' | 'overdue'

  // Vehicle/Truck
  vehicleMake?: string
  vehicleModel?: string
  odometer?: number
  serviceDueOdometer?: number
  lastServiceOdometer?: number
  serviceIntervalKm?: number
  serviceIntervalDays?: number

  // HIAB
  hiabFitted?: boolean
  hiabMake?: string
  hiabModel?: string
  hiabServiceDueDate?: Date | string

  // Vessel
  uvi?: string
  outboardType?: string
  outboardQuantity?: number
  vesselSurveyDueDate?: Date | string
  vesselSurveyType?: string
  certificateOfOperationDueDate?: Date | string
  // Optional safety prefills
  firstAidKitExpiryDate?: Date | string
  fireExtinguisherExpiryDate?: Date | string
  epirbExpiryDate?: Date | string
  lifeJacketQuantity?: number
  flareQuantity?: number
  // Outboard service
  outboardServiceDueDate?: Date | string

  // Petrol Plant
  description?: string
  serialNumber?: string
  plantStatus?: 'in_service' | 'out_of_service' | 'retired' | string

  // Timestamps
  createdAt?: Date | string
  updatedAt?: Date | string
}

// Keep these for filtering/display purposes
export type PlantGroup = 'Vehicle' | 'Truck' | 'Trailer' | 'Vessel' | 'Petrol Plant'

export interface GroupStats {
  group: PlantGroup
  total: number
  compliant: number
  overdue: number
  upcoming: number
}

export interface ServiceHistory {
  id: string
  plantId: string
  serviceDate: Date
  serviceType: string
  servicedBy?: string
  notes?: string
  status?: string
  nextServiceDate?: Date
  createdAt: Date
  inspectionData?: any // JSONB field
}

export interface CreateService {
  plantId: string
  serviceDate: Date
  serviceType: string
  servicedBy: string
  notes?: string
  status?: string
}