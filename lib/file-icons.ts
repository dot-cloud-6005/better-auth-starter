import { 
  FileTextIcon,
  ImageIcon,
  FileVideoIcon,
  FileAudioIcon,
  FileSpreadsheetIcon,
  FileIcon,
  ArchiveIcon,
  CodeIcon,
  FileJsonIcon,
  FileImageIcon,
  PresentationIcon,
  DatabaseIcon,
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

// File type to icon mapping
const FILE_TYPE_ICONS: Record<string, LucideIcon> = {
  // Images
  '.jpg': ImageIcon,
  '.jpeg': ImageIcon,  
  '.png': ImageIcon,
  '.gif': ImageIcon,
  '.webp': ImageIcon,
  '.svg': FileImageIcon,
  '.bmp': ImageIcon,
  '.tiff': ImageIcon,
  '.ico': ImageIcon,

  // Documents
  '.pdf': FileTextIcon,
  '.doc': FileTextIcon,
  '.docx': FileTextIcon,
  '.txt': FileTextIcon,
  '.rtf': FileTextIcon,
  '.odt': FileTextIcon,

  // Spreadsheets  
  '.xls': FileSpreadsheetIcon,
  '.xlsx': FileSpreadsheetIcon,
  '.csv': FileSpreadsheetIcon,
  '.ods': FileSpreadsheetIcon,

  // Presentations
  '.ppt': PresentationIcon,
  '.pptx': PresentationIcon,
  '.odp': PresentationIcon,

  // Code files
  '.js': CodeIcon,
  '.ts': CodeIcon,
  '.jsx': CodeIcon,
  '.tsx': CodeIcon,
  '.html': CodeIcon,
  '.css': CodeIcon,
  '.scss': CodeIcon,
  '.sass': CodeIcon,
  '.less': CodeIcon,
  '.php': CodeIcon,
  '.py': CodeIcon,
  '.rb': CodeIcon,
  '.java': CodeIcon,
  '.c': CodeIcon,
  '.cpp': CodeIcon,
  '.cs': CodeIcon,
  '.go': CodeIcon,
  '.rs': CodeIcon,
  '.swift': CodeIcon,
  '.kt': CodeIcon,
  '.scala': CodeIcon,
  '.sh': CodeIcon,
  '.bat': CodeIcon,
  '.ps1': CodeIcon,

  // Data files
  '.json': FileJsonIcon,
  '.xml': FileJsonIcon,
  '.yaml': FileJsonIcon,
  '.yml': FileJsonIcon,
  '.toml': FileJsonIcon,
  '.ini': FileJsonIcon,
  '.conf': FileJsonIcon,
  '.cfg': FileJsonIcon,

  // Archives
  '.zip': ArchiveIcon,
  '.rar': ArchiveIcon,
  '.7z': ArchiveIcon,
  '.tar': ArchiveIcon,
  '.gz': ArchiveIcon,
  '.bz2': ArchiveIcon,
  '.xz': ArchiveIcon,

  // Audio
  '.mp3': FileAudioIcon,
  '.wav': FileAudioIcon,
  '.flac': FileAudioIcon,
  '.aac': FileAudioIcon,
  '.ogg': FileAudioIcon,
  '.wma': FileAudioIcon,
  '.m4a': FileAudioIcon,

  // Video
  '.mp4': FileVideoIcon,
  '.avi': FileVideoIcon,
  '.mov': FileVideoIcon,
  '.wmv': FileVideoIcon,
  '.flv': FileVideoIcon,
  '.webm': FileVideoIcon,
  '.mkv': FileVideoIcon,
  '.m4v': FileVideoIcon,
  '.3gp': FileVideoIcon,

  // Database
  '.sql': DatabaseIcon,
  '.db': DatabaseIcon,
  '.sqlite': DatabaseIcon,
  '.mdb': DatabaseIcon,
};

// MIME type to color mapping for visual distinction
const MIME_TYPE_COLORS: Record<string, string> = {
  // Images - Blue tones
  'image/': 'text-blue-600 dark:text-blue-400',
  
  // Documents - Gray/Black tones  
  'application/pdf': 'text-red-600 dark:text-red-400',
  'application/msword': 'text-blue-700 dark:text-blue-300',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'text-blue-700 dark:text-blue-300',
  'text/': 'text-gray-600 dark:text-gray-400',

  // Spreadsheets - Green tones
  'application/vnd.ms-excel': 'text-green-600 dark:text-green-400',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'text-green-600 dark:text-green-400',
  'text/csv': 'text-green-600 dark:text-green-400',

  // Presentations - Orange tones
  'application/vnd.ms-powerpoint': 'text-orange-600 dark:text-orange-400',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'text-orange-600 dark:text-orange-400',

  // Code - Purple tones
  'application/javascript': 'text-yellow-600 dark:text-yellow-400',
  'text/javascript': 'text-yellow-600 dark:text-yellow-400',
  'application/json': 'text-purple-600 dark:text-purple-400',
  'application/xml': 'text-purple-600 dark:text-purple-400',
  'text/xml': 'text-purple-600 dark:text-purple-400',

  // Archives - Brown tones
  'application/zip': 'text-amber-700 dark:text-amber-500',
  'application/x-rar': 'text-amber-700 dark:text-amber-500',
  'application/x-7z-compressed': 'text-amber-700 dark:text-amber-500',

  // Audio - Pink tones
  'audio/': 'text-pink-600 dark:text-pink-400',

  // Video - Indigo tones
  'video/': 'text-indigo-600 dark:text-indigo-400',
};

/**
 * Get the appropriate icon component for a file based on its name/extension
 */
export function getFileTypeIcon(fileName: string): LucideIcon {
  const extension = getFileExtension(fileName);
  return FILE_TYPE_ICONS[extension] || FileIcon;
}

/**
 * Get the color class for a file based on its MIME type
 */
export function getFileTypeColor(mimeType: string | null): string {
  if (!mimeType) return 'text-gray-500 dark:text-gray-400';
  
  // Check for exact MIME type match first
  if (MIME_TYPE_COLORS[mimeType]) {
    return MIME_TYPE_COLORS[mimeType];
  }
  
  // Check for partial matches (e.g., 'image/' matches 'image/jpeg')
  for (const [type, color] of Object.entries(MIME_TYPE_COLORS)) {
    if (type.endsWith('/') && mimeType.startsWith(type)) {
      return color;
    }
  }
  
  return 'text-gray-500 dark:text-gray-400';
}

/**
 * Get file extension from filename (lowercase, with dot)
 */
export function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return '';
  }
  return fileName.substring(lastDotIndex).toLowerCase();
}

/**
 * Get a human-readable file type description
 */
export function getFileTypeDescription(fileName: string, mimeType: string | null): string {
  const extension = getFileExtension(fileName);
  
  // Common file type descriptions
  const descriptions: Record<string, string> = {
    '.pdf': 'PDF Document',
    '.doc': 'Word Document', 
    '.docx': 'Word Document',
    '.xls': 'Excel Spreadsheet',
    '.xlsx': 'Excel Spreadsheet', 
    '.ppt': 'PowerPoint Presentation',
    '.pptx': 'PowerPoint Presentation',
    '.txt': 'Text File',
    '.csv': 'CSV File',
    '.json': 'JSON Data',
    '.xml': 'XML Document',
    '.zip': 'ZIP Archive',
    '.rar': 'RAR Archive',
    '.7z': '7-Zip Archive',
    '.mp3': 'MP3 Audio',
    '.mp4': 'MP4 Video',
    '.jpg': 'JPEG Image',
    '.png': 'PNG Image',
    '.gif': 'GIF Image',
    '.svg': 'SVG Image',
  };
  
  if (descriptions[extension]) {
    return descriptions[extension];
  }
  
  // Fallback to MIME type description
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'Image File';
    if (mimeType.startsWith('video/')) return 'Video File';
    if (mimeType.startsWith('audio/')) return 'Audio File';
    if (mimeType.startsWith('text/')) return 'Text File';
    if (mimeType === 'application/octet-stream') return 'Binary File';
  }
  
  // Final fallback
  return extension ? `${extension.toUpperCase().substring(1)} File` : 'File';
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  if (i === 0) return `${bytes} ${sizes[i]}`;
  
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Check if file is an image based on MIME type or extension
 */
export function isImageFile(fileName: string, mimeType: string | null): boolean {
  if (mimeType && mimeType.startsWith('image/')) return true;
  
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
  const extension = getFileExtension(fileName);
  
  return imageExtensions.includes(extension);
}

/**
 * Check if file can be previewed in browser
 */
export function isPreviewableFile(fileName: string, mimeType: string | null): boolean {
  // Images are previewable
  if (isImageFile(fileName, mimeType)) return true;
  
  // PDFs are previewable
  if (mimeType === 'application/pdf') return true;
  
  // Text files are previewable  
  if (mimeType && (mimeType.startsWith('text/') || mimeType === 'application/json')) return true;
  
  return false;
}
