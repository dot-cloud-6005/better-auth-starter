import { Equipment, InspectionHistory } from '@/types/equipment/equipment';
import { Plant } from '@/types/equipment/plant';
import * as XLSX from 'xlsx';

export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = (row as any)[header];
        // Handle dates and escape commas/quotes
        if (value instanceof Date) {
          return `"${value.toLocaleDateString()}"`;
        }
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function prepareScheduleData(equipment: Equipment[]) {
  return equipment.map(eq => ({
    'Equipment Name': eq.name,
    'Auto ID': eq.autoId,
    'Group': eq.groupName, // CHANGED: group → groupName
    'Status': eq.status,
    'Last Inspection': eq.lastInspection ? new Date(eq.lastInspection).toLocaleDateString() : 'Never',
    'Next Inspection': new Date(eq.nextInspection).toLocaleDateString(),
    'Days Until Inspection': Math.ceil((new Date(eq.nextInspection).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    'Schedule': eq.scheduleName, // CHANGED: schedule → scheduleName
    'Location': eq.location || 'N/A'
  }));
}

// Interface for combined schedule data
export interface ScheduleExportData {
  equipment: {
    overdue: Equipment[];
    upcoming: Equipment[];
    compliant: Equipment[];
  };
  plant: {
    overdue: Plant[];
    upcoming: Plant[];
    compliant: Plant[];
  };
}

// Function for plant schedule data
export function preparePlantScheduleData(plant: Plant[]) {
  return plant.map(p => ({
    'Plant Name': p.name,
    'Auto ID': p.autoId,
    'Group': p.groupName, // CHANGED: group → groupName
    'Status': p.status || 'compliant', // Handle optional status
    'Registration Number': p.registrationNumber || 'N/A',
    'Next Service Date': p.serviceDueDate ? new Date(p.serviceDueDate).toLocaleDateString() : 'Not set',
    'Days Until Service': p.serviceDueDate ? Math.ceil((new Date(p.serviceDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
    'Vehicle Make/Model': p.vehicleMake && p.vehicleModel ? `${p.vehicleMake} ${p.vehicleModel}` : 'N/A',
    'Location': p.location || 'N/A',
    'Responsible Person': p.responsiblePerson || 'N/A'
  }));
}

// NEW: Excel multi-sheet export function
export function exportMultiTabSchedule(data: ScheduleExportData, filename: string) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Prepare sheets data
  const sheetsData = {
    'Equipment-Overdue': prepareScheduleData(data.equipment.overdue),
    'Equipment-Next30Days': prepareScheduleData(data.equipment.upcoming),
    'Equipment-Compliant': prepareScheduleData(data.equipment.compliant),
    'Plant-Overdue': preparePlantScheduleData(data.plant.overdue),
    'Plant-Next30Days': preparePlantScheduleData(data.plant.upcoming),
    'Plant-Compliant': preparePlantScheduleData(data.plant.compliant)
  };

  // Create worksheets for each category
  Object.entries(sheetsData).forEach(([sheetName, sheetData]) => {
    let worksheet;
    
    if (sheetData.length === 0) {
      // Create a worksheet with "No items" message for empty categories
      worksheet = XLSX.utils.aoa_to_sheet([
        ['No items in this category']
      ]);
    } else {
      // Create worksheet from JSON data
      worksheet = XLSX.utils.json_to_sheet(sheetData);
      
      // Auto-size columns
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const colWidths: any[] = [];
      
      // Calculate column widths based on content
      for (let col = range.s.c; col <= range.e.c; col++) {
        let maxWidth = 10; // minimum width
        
        for (let row = range.s.r; row <= range.e.r; row++) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellRef];
          
          if (cell && cell.v) {
            const cellWidth = cell.v.toString().length;
            maxWidth = Math.max(maxWidth, cellWidth);
          }
        }
        
        colWidths.push({ width: Math.min(maxWidth + 2, 50) }); // max width of 50
      }
      
      worksheet['!cols'] = colWidths;
    }
    
    // Add worksheet to workbook with sheet name
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  // Create summary sheet
  const summaryData = [
    ['Schedule Summary', '', '', ''],
    ['Category', 'Equipment Count', 'Plant Count', 'Total'],
    ['Overdue', data.equipment.overdue.length, data.plant.overdue.length, data.equipment.overdue.length + data.plant.overdue.length],
    ['Next 30 Days', data.equipment.upcoming.length, data.plant.upcoming.length, data.equipment.upcoming.length + data.plant.upcoming.length],
    ['Compliant', data.equipment.compliant.length, data.plant.compliant.length, data.equipment.compliant.length + data.plant.compliant.length],
    [''],
    ['Export Date', new Date().toLocaleDateString(), '', ''],
    ['Export Time', new Date().toLocaleTimeString(), '', '']
  ];

  const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
  
  // Style the summary sheet
  summaryWorksheet['!cols'] = [
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 10 }
  ];

  // Add summary as the first sheet
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

  // Reorder sheets to put Summary first
  workbook.SheetNames = ['Summary', ...workbook.SheetNames.filter(name => name !== 'Summary')];

  // Generate filename with .xlsx extension
  const excelFilename = filename.replace('.csv', '.xlsx');
  
  // Write and download the file
  XLSX.writeFile(workbook, excelFilename);
}

export function prepareHistoryData(inspections: InspectionHistory[], equipment: Equipment[]) {
  return inspections.map(inspection => {
    const equipmentItem = equipment.find(eq => eq.id === inspection.equipmentId);
    return {
      'Inspection Date': new Date(inspection.inspectionDate).toLocaleDateString(),
      'Equipment Name': equipmentItem?.name || 'Unknown',
      'Auto ID': equipmentItem?.autoId || 'N/A',
      'Group': equipmentItem?.groupName || 'N/A', // CHANGED: group → groupName
      'Inspector': inspection.inspectorName || 'N/A',
      'Status': inspection.status,
      'Notes': inspection.notes || '',
      'Next Inspection': inspection.nextInspectionDate ? new Date(inspection.nextInspectionDate).toLocaleDateString() : 'N/A'
    };
  });
}

// NEW: Add service history export for plant
export function prepareServiceHistoryData(serviceHistory: any[], plant: Plant[]) {
  return serviceHistory.map(service => {
    const plantItem = plant.find(p => p.id === service.plantId);
    return {
      'Service Date': new Date(service.serviceDate).toLocaleDateString(),
      'Plant Name': plantItem?.name || 'Unknown',
      'Auto ID': plantItem?.autoId || 'N/A',
      'Group': plantItem?.groupName || 'N/A',
      'Service Type': service.serviceType,
      'Serviced By': service.servicedBy || 'N/A',
      'Status': service.status || 'complete',
      'Notes': service.notes || '',
      'Next Service': service.nextServiceDate ? new Date(service.nextServiceDate).toLocaleDateString() : 'N/A'
    };
  });
}

// Enhanced multi-tab export with service history
export function exportCompleteSchedule(data: ScheduleExportData, inspectionHistory: InspectionHistory[], serviceHistory: any[], filename: string) {
  const workbook = XLSX.utils.book_new();

  // Prepare all sheets data
  const sheetsData = {
    'Equipment-Overdue': prepareScheduleData(data.equipment.overdue),
    'Equipment-Next30Days': prepareScheduleData(data.equipment.upcoming),
    'Equipment-Compliant': prepareScheduleData(data.equipment.compliant),
    'Plant-Overdue': preparePlantScheduleData(data.plant.overdue),
    'Plant-Next30Days': preparePlantScheduleData(data.plant.upcoming),
    'Plant-Compliant': preparePlantScheduleData(data.plant.compliant),
    'Inspection-History': prepareHistoryData(inspectionHistory, [...data.equipment.overdue, ...data.equipment.upcoming, ...data.equipment.compliant]),
    'Service-History': prepareServiceHistoryData(serviceHistory, [...data.plant.overdue, ...data.plant.upcoming, ...data.plant.compliant])
  };

  // Create worksheets for each category
  Object.entries(sheetsData).forEach(([sheetName, sheetData]) => {
    let worksheet;
    
    if (sheetData.length === 0) {
      worksheet = XLSX.utils.aoa_to_sheet([
        ['No items in this category']
      ]);
    } else {
      worksheet = XLSX.utils.json_to_sheet(sheetData);
      
      // Auto-size columns
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const colWidths: any[] = [];
      
      for (let col = range.s.c; col <= range.e.c; col++) {
        let maxWidth = 10;
        
        for (let row = range.s.r; row <= range.e.r; row++) {
          const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellRef];
          
          if (cell && cell.v) {
            const cellWidth = cell.v.toString().length;
            maxWidth = Math.max(maxWidth, cellWidth);
          }
        }
        
        colWidths.push({ width: Math.min(maxWidth + 2, 50) });
      }
      
      worksheet['!cols'] = colWidths;
    }
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  });

  // Enhanced summary sheet
  const summaryData = [
    ['Complete Schedule Export', '', '', ''],
    [''],
    ['EQUIPMENT SUMMARY', '', '', ''],
    ['Category', 'Count', 'Percentage', ''],
    ['Overdue', data.equipment.overdue.length, `${((data.equipment.overdue.length / (data.equipment.overdue.length + data.equipment.upcoming.length + data.equipment.compliant.length)) * 100).toFixed(1)}%`, ''],
    ['Next 30 Days', data.equipment.upcoming.length, `${((data.equipment.upcoming.length / (data.equipment.overdue.length + data.equipment.upcoming.length + data.equipment.compliant.length)) * 100).toFixed(1)}%`, ''],
    ['Compliant', data.equipment.compliant.length, `${((data.equipment.compliant.length / (data.equipment.overdue.length + data.equipment.upcoming.length + data.equipment.compliant.length)) * 100).toFixed(1)}%`, ''],
    [''],
    ['PLANT SUMMARY', '', '', ''],
    ['Category', 'Count', 'Percentage', ''],
    ['Overdue', data.plant.overdue.length, `${((data.plant.overdue.length / (data.plant.overdue.length + data.plant.upcoming.length + data.plant.compliant.length)) * 100).toFixed(1)}%`, ''],
    ['Next 30 Days', data.plant.upcoming.length, `${((data.plant.upcoming.length / (data.plant.overdue.length + data.plant.upcoming.length + data.plant.compliant.length)) * 100).toFixed(1)}%`, ''],
    ['Compliant', data.plant.compliant.length, `${((data.plant.compliant.length / (data.plant.overdue.length + data.plant.upcoming.length + data.plant.compliant.length)) * 100).toFixed(1)}%`, ''],
    [''],
    ['HISTORY SUMMARY', '', '', ''],
    ['Inspection Records', inspectionHistory.length, '', ''],
    ['Service Records', serviceHistory.length, '', ''],
    [''],
    ['Export Information', '', '', ''],
    ['Export Date', new Date().toLocaleDateString(), '', ''],
    ['Export Time', new Date().toLocaleTimeString(), '', '']
  ];

  const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWorksheet['!cols'] = [
    { width: 25 },
    { width: 15 },
    { width: 15 },
    { width: 10 }
  ];

  // Insert summary as first sheet
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
  workbook.SheetNames = ['Summary', ...workbook.SheetNames.filter(name => name !== 'Summary')];

  const excelFilename = filename.replace('.csv', '.xlsx');
  XLSX.writeFile(workbook, excelFilename);
}