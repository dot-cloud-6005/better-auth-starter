// Types for the imported NavApp data (inspections and equipment)

export type InspectionRecord = {
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
  Location?: string;
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
