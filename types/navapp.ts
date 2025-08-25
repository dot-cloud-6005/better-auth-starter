// Types for the imported NavApp data (inspections and equipment)

export type InspectionRecord = {
  _RowNumber?: string;
  "Row ID"?: string;
  Key?: string; // asset number as string
  "Location Code"?: string;
  "Date/Time"?: string;
  "Inspection Notes"?: string;
  Recommendations?: string;
  "Condition Rating"?: string;
  "Water Depth"?: string;
  "Attendance Type"?: string;
  "Asset Status"?: string;
  "Main Asset Photo"?: string;
  "Additional #1"?: string;
  "Additional #2"?: string;
  "Additional #3"?: string;
  "Additional #4"?: string;
  "Additional #5"?: string;
  "Additional #6"?: string;
  Created?: string;
  Modified?: string;
  "Equipment Used"?: string;
  "Used Equipment?"?: string;
  Situation?: string;
  Location?: string;
  "Primary Key"?: string;
};

export type EquipmentRecord = {
  "Asset ID"?: string; // asset number as string
  "Equipment Type"?: string;
  "Light Make"?: string;
  "Light Model"?: string;
  "Light Colour"?: string;
  "Light Install Date"?: string;
  "Battery Type"?: string;
  "Battery Qty"?: string;
  "Battery Install Date"?: string;
  "Buoy Type"?: string;
  "Buoy Install Date"?: string;
  "Mains Power Onsite"?: string;
  "Equipment Title"?: string; // like XX-123
  Location?: string; // two-letter code
  "Last Service"?: string;
};
