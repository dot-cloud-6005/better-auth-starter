import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a date string to dd/mm/yyyy format
 * Handles various input formats including ISO strings, mm/dd/yyyy, yyyy-mm-dd
 * @param dateString - The date string to format
 * @returns Formatted date as dd/mm/yyyy or original string if invalid
 */
export function formatDateToDDMMYYYY(dateString: string | undefined | null): string {
  if (!dateString || dateString.trim() === '') {
    return '';
  }

  try {
    // Try to parse the date string
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      // If direct parsing fails, try to handle different formats
      const trimmed = dateString.trim();
      
      // Try yyyy-mm-dd format
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split('-');
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(parsedDate.getTime())) {
          const d = parsedDate.getDate().toString().padStart(2, '0');
          const m = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
          const y = parsedDate.getFullYear();
          return `${d}/${m}/${y}`;
        }
      }
      
      // Try dd/mm/yyyy format (already in correct format)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        const d = parseInt(day).toString().padStart(2, '0');
        const m = parseInt(month).toString().padStart(2, '0');
        return `${d}/${m}/${year}`;
      }
      
      // Try mm/dd/yyyy format (US format)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
        const parts = trimmed.split('/');
        if (parts.length === 3) {
          // Assume mm/dd/yyyy and convert to dd/mm/yyyy
          const month = parseInt(parts[0]);
          const day = parseInt(parts[1]);
          const year = parseInt(parts[2]);
          
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const d = day.toString().padStart(2, '0');
            const m = month.toString().padStart(2, '0');
            return `${d}/${m}/${year}`;
          }
        }
      }
      
      // Return original string if we can't parse it
      return dateString;
    }
    
    // Format the valid date as dd/mm/yyyy
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    // Return original string if parsing fails
    return dateString;
  }
}
