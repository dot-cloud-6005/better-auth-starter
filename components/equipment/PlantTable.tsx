'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Trash2, 
  Search, 
  Filter, 
  Car, 
  Download,
  Truck, 
  TypeOutline, 
  Ship, 
  Fuel,
  Calendar,
  MapPin,
  User,
  Hash,
  AlertTriangle,
  X
} from 'lucide-react';
import { Plant } from '@/types/equipment/plant';
import { toast } from 'sonner';


interface PlantTableProps {
  plant: Plant[];
  onEdit: (plant: Plant) => void; // Changed back to simple function
  onView: (plant: Plant) => void; // ADD THIS
  onDelete: (id: string) => Promise<{ error?: string }>;
  bulkMode: boolean;
  selectedIds: string[];
  onBulkSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onExportAll?: (data: Plant[]) => void;
  onExportSelected?: (selectedIds: string[]) => void;
}

const groupIcons = {
  Vehicle: Car,
  Truck: Truck,
  Trailer: TypeOutline,
  Vessel: Ship,
  'Petrol Plant': Fuel
};

const groupColors = {
  Vehicle: 'bg-blue-500',
  Truck: 'bg-orange-500',
  Trailer: 'bg-purple-500',
  Vessel: 'bg-cyan-500',
  'Petrol Plant': 'bg-red-500'
};

const statusColors = {
  compliant: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
  upcoming: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  overdue: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
};

export default function PlantTable({ 
  plant, 
  onEdit, 
  onView, // ADD THIS
  onDelete, 
  bulkMode, 
  selectedIds, 
  onBulkSelect, 
  onSelectAll,
  onExportAll, 
  onExportSelected  
}: PlantTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'compliant' | 'upcoming' | 'overdue'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  

  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Filter plant based on search and status
  const filteredPlant = plant.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.autoId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.registrationNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.responsiblePerson?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || (item.status || 'compliant') === statusFilter;
    
    return matchesSearch && matchesStatus;
  });


  const handleDelete = async (id: string) => {
    const plantToDelete = plant.find(p => p.id === id);
    const plantName = plantToDelete?.name || 'plant item';
    
    // Show the confirmation modal instead of browser confirm
    setDeleteConfirmation({
      id,
      name: plantName
    });
  };

  
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
  };

  const handleSelectAll = () => {
    const allSelected = filteredPlant.length > 0 && filteredPlant.every(item => selectedIds.includes(item.id));
    onSelectAll(!allSelected);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Not set';
    const d = typeof date === 'string' ? new Date(date) : date;
    return isNaN(d.getTime()) ? 'Not set' : d.toLocaleDateString('en-AU');
  };

  const getDaysUntilDue = (date: Date | string | undefined) => {
    if (!date) return null;
    const dueDate = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dueDate.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const renderPlantDetails = (plantItem: Plant) => {
    switch (plantItem.groupName) {
      case 'Vehicle':
      case 'Truck':
        return (
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1">
              <Car className="h-3 w-3" />
              {plantItem.vehicleMake} {plantItem.vehicleModel}
            </div>
            {plantItem.registrationNumber && (
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {plantItem.registrationNumber}
              </div>
            )}
            {plantItem.odometer && (
              <div>Odometer: {plantItem.odometer.toLocaleString()} km</div>
            )}
            {plantItem.hiabFitted && (
              <div className="text-orange-600 dark:text-orange-400">
                HIAB: {plantItem.hiabMake} {plantItem.hiabModel}
              </div>
            )}
          </div>
        );
      case 'Trailer':
        return (
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            {plantItem.registrationNumber && (
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {plantItem.registrationNumber}
              </div>
            )}
          </div>
        );
      case 'Vessel':
        return (
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            {plantItem.uvi && (
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                UVI: {plantItem.uvi}
              </div>
            )}
            {plantItem.outboardType && (
              <div>
                Outboard: {plantItem.outboardType}
                {plantItem.outboardQuantity && ` (${plantItem.outboardQuantity})`}
              </div>
            )}
            {plantItem.vesselSurveyType && (
              <div>Survey: {plantItem.vesselSurveyType}</div>
            )}
          </div>
        );
      case 'Petrol Plant':
        return (
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            {plantItem.serialNumber && (
              <div className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                S/N: {plantItem.serialNumber}
              </div>
            )}
            {plantItem.plantStatus && (
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  plantItem.plantStatus === 'in_service' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800' :
                  plantItem.plantStatus === 'out_of_service' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                  plantItem.plantStatus === 'decommissioned' ? 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700' :
                  'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800'
                }`}
              >
                {plantItem.plantStatus.replace('_', ' ').toUpperCase()}
              </Badge>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const allSelected = filteredPlant.length > 0 && filteredPlant.every(item => selectedIds.includes(item.id));
  const someSelected = filteredPlant.some(item => selectedIds.includes(item.id));

  // Add this function to handle card clicks
  const handleCardClick = (plantItem: Plant) => {
    if (!bulkMode && onView) {
      onView(plantItem); // Use the new onView prop instead of modal
    }
  };

  return (
    <div className="space-y-4">
      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <CardHeader>
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <CardTitle className="flex items-center gap-2 dark:text-slate-200">
      Plant Items
      <Badge variant="secondary" className="dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">{filteredPlant.length}</Badge>
    </CardTitle>
    
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 h-4 w-4" />
        <Input
          placeholder="Search plant..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full sm:w-64 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
      </div>
      
      <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
        <SelectTrigger className="w-full sm:w-40 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
          <Filter className="h-4 w-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
          <SelectItem value="all" className="dark:text-slate-200 dark:focus:bg-slate-700">All Status</SelectItem>
          <SelectItem value="compliant" className="dark:text-slate-200 dark:focus:bg-slate-700">Compliant</SelectItem>
          <SelectItem value="upcoming" className="dark:text-slate-200 dark:focus:bg-slate-700">Upcoming</SelectItem>
          <SelectItem value="overdue" className="dark:text-slate-200 dark:focus:bg-slate-700">Overdue</SelectItem>
        </SelectContent>
      </Select>


      {bulkMode && selectedIds.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Call export selected function passed from parent
            if (onExportSelected) {
              onExportSelected(selectedIds);
            }
          }}
          className="text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Download className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Export Selected</span>
          <span className="sm:hidden">📊</span>
        </Button>
      )}

      <Button
  onClick={() => {
    // Call export all function with the filtered data from the table
    if (onExportAll) {
      onExportAll(filteredPlant); 
    }
  }}
  variant="outline"
  size="sm"
  className="text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
>
  <Download className="h-4 w-4 mr-2" />
  <span className="hidden sm:inline">Export</span>
  <span className="sm:hidden">📊</span>
</Button>
    </div>
  </div>
</CardHeader>
        
        <CardContent>
          {filteredPlant.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-500 dark:text-slate-400 mb-2">No plant found</div>
              <div className="text-sm text-slate-400 dark:text-slate-500">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters' 
                  : 'Start by adding your first plant item'
                }
              </div>
            </div>
          ) : (
            <>
              {/* Bulk selection header */}
              {bulkMode && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) {
                        const input = el.querySelector('input') as HTMLInputElement;
                        if (input) {
                          input.indeterminate = someSelected && !allSelected;
                        }
                      }
                    }}
                    onCheckedChange={handleSelectAll}
                    className="dark:border-slate-600"
                  />
                  <span className="text-sm text-blue-800 dark:text-blue-300">
                    {allSelected 
                      ? `All ${filteredPlant.length} items selected` 
                      : someSelected 
                      ? `${selectedIds.length} items selected`
                      : 'Select all items'
                    }
                  </span>
                </div>
              )}

              {/* Plant grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlant.map((plantItem) => {
                  const Icon = groupIcons[plantItem.groupName as keyof typeof groupIcons]; // CHANGED: group → groupName
                  const daysUntilDue = getDaysUntilDue(plantItem.serviceDueDate);
                  const isSelected = selectedIds.includes(plantItem.id);
                  
                  return (
                    <Card 
                      key={plantItem.id} 
                      className={`transition-all duration-200 hover:shadow-md border cursor-pointer ${
                        isSelected ? 'ring-2 ring-blue-500 border-blue-300 dark:border-blue-700' : 'border-slate-200 dark:border-slate-700'
                      } ${!bulkMode ? 'hover:bg-slate-50 dark:hover:bg-slate-800' : ''} dark:bg-slate-900`}
                      onClick={() => handleCardClick(plantItem)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {bulkMode && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => onBulkSelect(plantItem.id, checked as boolean)}
                                onClick={(e) => e.stopPropagation()} // Prevent card click when clicking checkbox
                                className="dark:border-slate-600"
                              />
                            )}
                            <div className={`p-2 rounded-lg ${groupColors[plantItem.groupName as keyof typeof groupColors]}`}> {/* CHANGED: group → groupName */}
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <Badge variant="outline" className="text-xs dark:border-slate-700 dark:text-slate-300">
                              {plantItem.groupName} 
                            </Badge>
                          </div>
                          
                          <Badge className={`text-xs ${statusColors[(plantItem.status || 'compliant') as keyof typeof statusColors]}`}>
                            {(plantItem.status || 'compliant').charAt(0).toUpperCase() + (plantItem.status || 'compliant').slice(1)}
                          </Badge>
                        </div>

                        <div className="mb-3">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm mb-1">{plantItem.name}</h3>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">ID: {plantItem.autoId}</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                            {renderPlantDetails(plantItem)}
                          </div>
                        </div>

                        {/* Service information */}
                        {plantItem.serviceDueDate && (
                          <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded text-xs">
                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 mb-1">
                              <Calendar className="h-3 w-3" />
                              Service Due: {formatDate(plantItem.serviceDueDate)}
                            </div>
                            {daysUntilDue !== null && (
                              <div className={`flex items-center gap-1 ${
                                daysUntilDue < 0 ? 'text-red-600 dark:text-red-400' : 
                                daysUntilDue <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
                              }`}>
                                {daysUntilDue < 0 && <AlertTriangle className="h-3 w-3" />}
                                {daysUntilDue < 0 
                                  ? `${Math.abs(daysUntilDue)} days overdue`
                                  : daysUntilDue === 0 
                                  ? 'Due today'
                                  : `${daysUntilDue} days remaining`
                                }
                              </div>
                            )}
                          </div>
                        )}

                        {/* Additional info */}
                        <div className="space-y-1 mb-3">
                          {plantItem.location && (
                            <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                              <MapPin className="h-3 w-3" />
                              {plantItem.location}
                            </div>
                          )}
                          {plantItem.responsiblePerson && (
                            <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                              <User className="h-3 w-3" />
                              {plantItem.responsiblePerson}
                            </div>
                          )}
                        </div>

                        {/* Update the footer */}
                        {!bulkMode && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                            <span className="text-xs text-slate-500 dark:text-slate-400">Click to view details</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal - ADDED TO MATCH EQUIPMENT TABLE */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="text-red-600 dark:text-red-500">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-200">Delete Plant</h2>
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
                className="dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white dark:bg-red-800 dark:hover:bg-red-700"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}