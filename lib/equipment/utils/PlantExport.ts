import { Plant } from '@/types/equipment/plant';

// Safe formatters for Date | string
const fmtDate = (v?: Date | string) => {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
};
const fmtDateTime = (v?: Date | string) => {
  if (!v) return '';
  const d = typeof v === 'string' ? new Date(v) : v;
  return isNaN(d.getTime()) ? '' : d.toLocaleString();
};

export function exportPlantToCSV(plant: Plant[], filename?: string) {

  if (plant.length === 0) {
    throw new Error('No plant data to export');
  }

  // Define CSV headers
  const headers = [
    'Name',
    'Auto ID',
    'Group',
    'Registration Number',
    'Status',
    'Service Due Date',
    'Location',
    'Responsible Person',
    'Vehicle Make',
    'Vehicle Model',
    'Odometer (km)',
    'Service Due Odometer',           // ← added to match data
    'Last Service Odometer',          // ← added to match data
    'Service Interval (km)',          // ← added to match data
    'Service Interval (days)',        // ← added to match data
    'HIAB Fitted',
    'HIAB Make',
    'HIAB Model',
    'HIAB Service Due Date',
    'UVI',
    'Outboard Type',
    'Outboard Quantity',
    'Vessel Survey Due Date',
    'Vessel Survey Type',
    'Certificate of Operation Due Date',
    'Description',
    'Serial Number',
    'Plant Status',
    'Created At',
    'Updated At'
  ];

  // Convert plant data to CSV rows
  const csvData = plant.map(item => [
    `"${item.name || ''}"`,
    `"${item.autoId || ''}"`,
    `"${item.groupName || ''}"`,
    `"${item.registrationNumber || ''}"`,
    `"${item.status || ''}"`,
    `"${fmtDate(item.serviceDueDate)}"`,
    `"${item.location || ''}"`,
    `"${item.responsiblePerson || ''}"`,
    `"${item.vehicleMake || ''}"`,
    `"${item.vehicleModel || ''}"`,
    item.odometer != null ? `"${item.odometer}"` : '""',

    // Service tracking fields (now aligned with headers)
    item.serviceDueOdometer != null ? `"${item.serviceDueOdometer}"` : '""',
    item.lastServiceOdometer != null ? `"${item.lastServiceOdometer}"` : '""',
    item.serviceIntervalKm != null ? `"${item.serviceIntervalKm}"` : '""',
    item.serviceIntervalDays != null ? `"${item.serviceIntervalDays}"` : '""',

    item.hiabFitted ? '"Yes"' : '"No"',
    `"${item.hiabMake || ''}"`,
    `"${item.hiabModel || ''}"`,
    `"${fmtDate(item.hiabServiceDueDate)}"`,
    `"${item.uvi || ''}"`,
    `"${item.outboardType || ''}"`,
    item.outboardQuantity != null ? `"${item.outboardQuantity}"` : '""',
    `"${fmtDate(item.vesselSurveyDueDate)}"`,
    `"${item.vesselSurveyType || ''}"`,
    `"${fmtDate(item.certificateOfOperationDueDate)}"`,
    `"${item.description || ''}"`,
    `"${item.serialNumber || ''}"`,
    `"${item.plantStatus ? item.plantStatus.replace('_', ' ') : ''}"`,
    `"${fmtDateTime(item.createdAt)}"`,
    `"${fmtDateTime(item.updatedAt)}"`
  ]);

  // Combine headers and data
  const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename || `plant_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function exportSelectedPlantToCSV(plant: Plant[], selectedIds: string[], filename?: string) {
  const selectedPlant = plant.filter(item => selectedIds.includes(item.id));
  const exportFilename = filename || `selected_plant_export_${new Date().toISOString().split('T')[0]}.csv`;
  exportPlantToCSV(selectedPlant, exportFilename);
}