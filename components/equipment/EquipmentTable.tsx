'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Equipment, EquipmentGroup } from '@/types/equipment/equipment'
import { 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  Download, // ADD THIS
  X,
  Eye
} from 'lucide-react'
import { toast } from "sonner"
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const equipmentGroups: EquipmentGroup[] = [
  'PFD',
  'Heights Safety',
  'Fire',
  'First Aid',
  'Racking',
  'Other'
]

const statusOptions = [
  { value: 'compliant', label: 'Compliant' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' }
]

interface EquipmentTableProps {
  equipment: Equipment[];
  onEdit: (equipment: Equipment) => void;
  onDelete: (id: string) => Promise<{ error: string | null }>; // Change from void to Promise
  bulkMode?: boolean;
  selectedIds?: string[];
  onBulkSelect?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onExportAll?: (data: Equipment[]) => void;
  onExportSelected?: (selectedIds: string[]) => void;
  onView?: (equipment: Equipment) => void; // ADD THIS
}

export default function EquipmentTable({ 
  equipment, 
  onEdit, 
  onDelete, 
  onView, // ADD THIS
  bulkMode, 
  selectedIds, 
  onBulkSelect, 
  onSelectAll,
  onExportAll, // ADD THIS
  onExportSelected // ADD THIS
}: EquipmentTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<EquipmentGroup[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewModalEquipment, setViewModalEquipment] = useState<Equipment | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  
  // Add state for delete confirmation modal
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    name: string;
  } | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredEquipment = useMemo(() => {
    const filtered = equipment.filter(eq => {
      const matchesSearch = eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (eq.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                           eq.autoId.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesGroup = selectedGroups.length === 0 || selectedGroups.includes(eq.groupName as EquipmentGroup) // CHANGED: group → groupName
      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(eq.status)

      return matchesSearch && matchesGroup && matchesStatus
    })

    // Sort by status priority: overdue -> upcoming -> compliant
    return filtered.sort((a, b) => {
      const statusPriority = {
        'overdue': 1,
        'upcoming': 2,
        'compliant': 3
      }
      
      const aPriority = statusPriority[a.status] || 4
      const bPriority = statusPriority[b.status] || 4
      
      // If same status, sort by next inspection date (earliest first)
      if (aPriority === bPriority) {
        const aDate = a.nextInspection ? new Date(a.nextInspection).getTime() : Infinity
        const bDate = b.nextInspection ? new Date(b.nextInspection).getTime() : Infinity
        return aDate - bDate
      }
      
      return aPriority - bPriority
    })
  }, [searchTerm, selectedGroups, selectedStatuses, equipment])

  // Update the getStatusColor function to use more subtle colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 border-l-4 border-l-green-200 dark:border-l-green-700' // Subtle green background with left border
      case 'upcoming':
        return 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-l-4 border-l-amber-200 dark:border-l-amber-700' // Subtle amber background with left border
      case 'overdue':
        return 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-l-4 border-l-red-200 dark:border-l-red-700' // Subtle red background with left border
      default:
        return 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700' // Default subtle gray
    }
  }

  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '-'
    
    // Convert string to Date if needed
    const dateObj = typeof date === 'string' ? new Date(date) : date
    
    // Check if it's a valid date
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return '-'
    }
    
    // Format as DD/MM/YYYY
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const getScheduleName = (scheduleName: string | undefined): string => {
    if (!scheduleName) return 'Unknown';
    
    const scheduleNames: Record<string, string> = {
      'Monthly': 'Monthly',
      'Quarterly': 'Quarterly', 
      '6-Monthly': '6-Monthly',
      'Annual': 'Annual',
      'Biennial': 'Biennial'
    };
    return scheduleNames[scheduleName] || scheduleName;
  };

  const handleRowClick = (equipment: Equipment) => {
    // Don't open anything when in bulk mode
    if (bulkMode) return;
    
    // Open view modal (read-only by default)
    setViewModalEquipment(equipment);
    setIsEditMode(false); // Start in read-only mode
  }

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    
    const { id, name } = deleteConfirmation;
    setDeletingId(id);
    setDeleteConfirmation(null); // Close the modal
    
    try {
      const result = await onDelete(id);
      
      if (result && result.error) {
        throw new Error(result.error);
      }
      
      toast.success(`"${name}" has been deleted successfully!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to delete "${name}". ${errorMessage}`);
    } finally {
      setDeletingId(null);
    }
  }

  const handleGroupToggle = (group: EquipmentGroup) => {
    setSelectedGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    )
  }

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }

  const clearAllFilters = () => {
    setSelectedGroups([])
    setSelectedStatuses([])
    setSearchTerm('')
  }

  const getActiveFilterCount = () => {
    return selectedGroups.length + selectedStatuses.length + (searchTerm ? 1 : 0)
  }

  const handleToggleEdit = () => {
    if (isEditMode && viewModalEquipment) {
      // Collect form data and create updated equipment object
      const form = document.forms[0] as HTMLFormElement; // This is a simplified approach
      
      // You'll need to properly collect the form data and map it to the Equipment type
      // including converting groupName back to groupId for database operations
      
      onEdit(viewModalEquipment);
      setViewModalEquipment(null);
      setIsEditMode(false);
    } else {
      // Switch to edit mode
      setIsEditMode(true);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              Equipment Items
              <Badge variant="secondary">{filteredEquipment.length}</Badge>
            </CardTitle>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search equipment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              
              {/* Export Selected Button */}
              {bulkMode && selectedIds && selectedIds.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (onExportSelected) {
                      onExportSelected(selectedIds);
                    }
                  }}
                  className="text-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Export Selected</span>
                  <span className="sm:hidden">📊</span>
                </Button>
              )}

              {/* Export All Button */}
              <Button
                onClick={() => {
                  if (onExportAll) {
                    onExportAll(filteredEquipment);
                  }
                }}
                variant="outline"
                size="sm"
                className="text-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Export</span>
                <span className="sm:hidden">📊</span>
              </Button>

              {/* Filter Dropdown */}
              <div className="relative" ref={filterRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="text-sm"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {getActiveFilterCount() > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                      {getActiveFilterCount()}
                    </Badge>
                  )}
                </Button>

                {showFilterDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-300 rounded-lg shadow-xl z-10">
                    <div className="p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-slate-900 font-medium">Filters</h3>
                        {getActiveFilterCount() > 0 && (
                          <button
                            onClick={clearAllFilters}
                            className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                          >
                            <X className="h-3 w-3" />
                            Clear all
                          </button>
                        )}
                      </div>

                      {/* Group Filters */}
                      <div className="mb-4">
                        <h4 className="text-slate-800 font-medium mb-2">Equipment Groups</h4>
                        <div className="space-y-2">
                          {equipmentGroups.map(group => (
                            <label key={group} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedGroups.includes(group)}
                                onChange={() => handleGroupToggle(group)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                              />
                              <span className="text-slate-700 text-sm">{group}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Status Filters */}
                      <div>
                        <h4 className="text-slate-800 font-medium mb-2">Status</h4>
                        <div className="space-y-2">
                          {statusOptions.map(status => (
                            <label key={status.value} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedStatuses.includes(status.value)}
                                onChange={() => handleStatusToggle(status.value)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                              />
                              <span className="text-slate-700 text-sm">{status.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          

          {/* Equipment Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  {bulkMode && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-10">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400"
                        checked={selectedIds && equipment.length > 0 && selectedIds.length === equipment.length}
                        onChange={(e) => onSelectAll?.(e.target.checked)}
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Equipment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Last Inspection
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Next Inspection
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Location
                  </th>
                  
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                {filteredEquipment.map((eq) => (
                  <tr 
                    key={eq.id} 
                    className={`transition-colors cursor-pointer ${getStatusColor(eq.status)}`}
                    onClick={(e) => {
                      // Don't trigger row click if clicking on checkbox, button, or other interactive elements
                      if ((e.target as HTMLElement).closest('input, button, [role="button"]')) {
                        return;
                      }
                      // Use the new view functionality instead of old modal
                      if (onView) {
                        onView(eq);
                      }
                    }}
                  >
                    {bulkMode && (
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedIds?.includes(eq.id) || false}
                          onChange={(e) => onBulkSelect?.(eq.id, e.target.checked)}
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {eq.name}
                        </div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {eq.description || 'No description'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {eq.autoId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {getScheduleName(eq.scheduleName)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {formatDate(eq.lastInspection)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {formatDate(eq.nextInspection)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(eq.status)}`}>
                        {eq.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {eq.location}
                    </td>
                    {/* ADD THE ACTIONS COLUMN TD */}
                    <td className="px-3 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {/* Add View Button */}
                        {onView && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent row click
                              onView(eq);
                            }}
                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Existing Edit Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click
                            onEdit(eq);
                          }}
                          className="text-blue-600 hover:text-blue-900 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        {/* Existing Delete Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmation({
                              id: eq.id,
                              name: eq.name
                            });
                          }}
                          className="text-red-600 hover:text-red-900 hover:bg-red-50"
                          disabled={deletingId === eq.id}
                        >
                          {deletingId === eq.id ? (
                            <span className="animate-spin">🌀</span>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredEquipment.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {equipment.length === 0 ? 
                "No equipment found." : 
                "No equipment found matching your search and filter criteria."
              }
            </div>
          )}
        </CardContent>
      </Card>

      {/* Move your modals outside the Card */}
      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="text-red-600 dark:text-red-500">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Delete Equipment</h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-slate-700 dark:text-slate-300 mb-6">
              Are you sure you want to delete <strong>&quot;{deleteConfirmation.name}&quot;</strong>?
            </p>
            
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmation(null)}
                className="border-slate-300 dark:border-slate-600"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Equipment View/Edit Modal */}
      {viewModalEquipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {isEditMode ? 'Edit Equipment' : 'Equipment Details'}
                </h2>
                <p className="text-slate-600 text-sm">
                  {isEditMode ? 'Modify equipment information' : 'View equipment information'}
                </p>
              </div>
              <button
                onClick={() => {
                  setViewModalEquipment(null);
                  setIsEditMode(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4">
              {/* Equipment Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Equipment Name
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    defaultValue={viewModalEquipment.name}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-900">
                    {viewModalEquipment.name}
                  </div>
                )}
              </div>

              {/* Auto ID */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Auto ID
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    defaultValue={viewModalEquipment.autoId}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    readOnly
                  />
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-900">
                    {viewModalEquipment.autoId}
                  </div>
                )}
                {/* ADD HELPER TEXT */}
                <p className="text-xs text-slate-500 mt-1">
                  Auto ID cannot be changed
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                {isEditMode ? (
                  <textarea
                    rows={3}
                    defaultValue={viewModalEquipment.description || ''}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-900 min-h-[76px]">
                    {viewModalEquipment.description || 'No description'}
                  </div>
                )}
              </div>

              {/* Group */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Group
                </label>
                {isEditMode ? (
                  <select
                    defaultValue={viewModalEquipment.groupName} 
                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {equipmentGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-900">
                    {viewModalEquipment.groupName} 
                  </div>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location
                </label>
                {isEditMode ? (
                  <input
                    type="text"
                    defaultValue={viewModalEquipment.location || ''}
                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-900">
                    {viewModalEquipment.location || 'Not specified'}
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Inspection Schedule
                </label>
                {isEditMode ? (
                  <select
                    defaultValue={viewModalEquipment.scheduleName} 
                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="6-Monthly">6-Monthly</option>
                    <option value="Annual">Annual</option>
                    <option value="Biennial">Biennial</option>
                  </select>
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-900">
                    {getScheduleName(viewModalEquipment.scheduleName)} 
                  </div>
                )}
              </div>

              {/* Status and Dates (Read-only) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Current Status
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(viewModalEquipment.status)}`}>
                      {viewModalEquipment.status}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Last Inspection
                  </label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-900">
                    {formatDate(viewModalEquipment.lastInspection)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Next Inspection
                </label>
                <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-900">
                  {formatDate(viewModalEquipment.nextInspection)}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-500">
                {isEditMode ? 'Click "Save Changes" to update equipment' : 'Click "Edit" to modify this equipment'}
              </div>
              <div className="flex gap-3">
                {/* ADD DELETE BUTTON - Only show in edit mode */}
                {isEditMode && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (viewModalEquipment) {
                        // Close the view modal first
                        setViewModalEquipment(null);
                        setIsEditMode(false);
                        // Then show the delete confirmation modal
                        setDeleteConfirmation({
                          id: viewModalEquipment.id,
                          name: viewModalEquipment.name
                        });
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewModalEquipment(null);
                    setIsEditMode(false);
                  }}
                >
                  {isEditMode ? 'Cancel' : 'Close'}
                </Button>
                <Button
                  onClick={handleToggleEdit}
                  className={isEditMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
                >
                  {isEditMode ? 'Save Changes' : 'Edit'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}