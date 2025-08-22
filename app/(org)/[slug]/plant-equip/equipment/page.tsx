'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Shield, Anchor, Flame, Heart, Package, Settings, Upload, FileCheck, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { Equipment, EquipmentGroup, Schedule, GroupStats } from '@/types/equipment/equipment';
import { getEquipmentGroups, getEquipmentSchedules, updateEquipment, deleteEquipment, updateEquipmentStatuses, createBulkEquipment, createEquipment } from '@/lib/equipment/actions/equipment';
import { useParams } from 'next/navigation';
import EquipmentForm from '@/components/equipment/EquipmentForm';
import EquipmentTable from '@/components/equipment/EquipmentTable';
import { toast } from "sonner"
import { exportToCSV, prepareScheduleData } from '@/lib/equipment/utils/export';
import { getLocalEquipment, upsertLocalEquipment, enqueue, runSync, getQueue } from '@/lib/client-db/sqlite';

const groupIcons = {
  PFD: Anchor,
  'Heights Safety': Shield,
  Fire: Flame,
  'First Aid': Heart,
  Racking: Package,
  Other: Settings
};

const groupColors = {
  PFD: 'bg-blue-500',
  'Heights Safety': 'bg-orange-500',
  Fire: 'bg-red-500',
  'First Aid': 'bg-green-500',
  Racking: 'bg-purple-500',
  Other: 'bg-gray-500'
};

export default function EquipmentPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<EquipmentGroup | 'all'>('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ADD THESE NEW STATE VARIABLES
  const [viewingEquipment, setViewingEquipment] = useState<Equipment | undefined>(undefined);
  const [showView, setShowView] = useState(false);
  
  // ADD THESE MISSING STATE VARIABLES
  const [groups, setGroups] = useState<Array<{id: string, name: EquipmentGroup}>>([]);
  const [schedules, setSchedules] = useState<Array<{id: string, name: Schedule}>>([]);
  const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState<{
    show: boolean;
    count: number;
    equipmentText: string;
  } | null>(null);

  // Load equipment on component mount
  useEffect(() => {
    // Hydrate from local sqlite first
    (async () => {
      try {
        const local = await getLocalEquipment();
        if (local.length) setEquipment(local);
      } catch {}
      loadEquipment();
      loadGroupsAndSchedules();
    })();
  }, []);
  // Network status
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  // Periodic sync
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (cancelled) return;
      if (!offline) await attemptSync();
      setTimeout(tick, 60000 + Math.random()*15000);
    }
    tick();
    const vis = () => { if (document.visibilityState==='visible' && !offline) attemptSync(); };
    document.addEventListener('visibilitychange', vis);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', vis); };
  }, [offline]);

  async function attemptSync() {
    try {
      setSyncing(true);
      const qBefore = await getQueue();
      setPendingCount(qBefore.length);
      if (!qBefore.length) return;
      await runSync({
        equipment: async (op) => {
          try {
            const payload = op.payload;
            if (op.operation === 'create') {
              const res = await createEquipment(payload.input);
              return !res.error;
            } else if (op.operation === 'update') {
              const res = await updateEquipment(payload.id, payload.input);
              return !res.error;
            } else if (op.operation === 'delete') {
              const res = await deleteEquipment(payload.id);
              return !res.error;
            }
            return true;
          } catch { return false; }
        }
      });
      const qAfter = await getQueue();
      setPendingCount(qAfter.length);
      if (qAfter.length === 0) loadEquipment();
    } finally { setSyncing(false); }
  }

  // Update equipment statuses on component mount
  useEffect(() => {
    updateEquipmentStatuses();
  }, []);

  // ✅ FIXED: loadGroupsAndSchedules function
  const loadGroupsAndSchedules = async () => {
    try {
      const [groupsResult, schedulesResult] = await Promise.all([
        getEquipmentGroups(),
        getEquipmentSchedules()
      ]);

      // Handle groups data
      if (groupsResult.data && Array.isArray(groupsResult.data)) {
        const transformedGroups = groupsResult.data.map((group: any) => ({
          id: group.id,
          name: group.name as EquipmentGroup
        }));
        setGroups(transformedGroups);
      } else {
        console.warn('Groups data is not an array:', groupsResult.data);
        // Set default groups if database doesn't have them yet
        const defaultGroups = [
          { id: '1', name: 'PFD' as EquipmentGroup },
          { id: '2', name: 'Heights Safety' as EquipmentGroup },
          { id: '3', name: 'Fire' as EquipmentGroup },
          { id: '4', name: 'First Aid' as EquipmentGroup },
          { id: '5', name: 'Racking' as EquipmentGroup },
          { id: '6', name: 'Other' as EquipmentGroup }
        ];
        setGroups(defaultGroups);
      }

      // Handle schedules data
      if (schedulesResult.data && Array.isArray(schedulesResult.data)) {
        const transformedSchedules = schedulesResult.data.map((schedule: any) => ({
          id: schedule.id,
          name: schedule.name as Schedule
        }));
        setSchedules(transformedSchedules);
      } else {
        console.warn('Schedules data is not an array:', schedulesResult.data);
        // Set default schedules if database doesn't have them yet
        const defaultSchedules = [
          { id: '1', name: 'Monthly' as Schedule },
          { id: '2', name: 'Quarterly' as Schedule },
          { id: '3', name: '6-Monthly' as Schedule },
          { id: '4', name: 'Annual' as Schedule },
          { id: '5', name: 'Biennial' as Schedule }
        ];
        setSchedules(defaultSchedules);
      }

      // Handle errors
      if (groupsResult.error) {
        console.error('Failed to load groups:', groupsResult.error);
        toast.error('Failed to load equipment groups');
      }
      if (schedulesResult.error) {
        console.error('Failed to load schedules:', schedulesResult.error);
        toast.error('Failed to load equipment schedules');
      }
    } catch (error) {
      console.error('Error loading groups and schedules:', error);
      toast.error('Failed to load form data');
      
      // Set fallback data if there's an error
      const defaultGroups = [
        { id: '1', name: 'PFD' as EquipmentGroup },
        { id: '2', name: 'Heights Safety' as EquipmentGroup },
        { id: '3', name: 'Fire' as EquipmentGroup },
        { id: '4', name: 'First Aid' as EquipmentGroup },
        { id: '5', name: 'Racking' as EquipmentGroup },
        { id: '6', name: 'Other' as EquipmentGroup }
      ];
      const defaultSchedules = [
        { id: '1', name: 'Monthly' as Schedule },
        { id: '2', name: 'Quarterly' as Schedule },
        { id: '3', name: '6-Monthly' as Schedule },
        { id: '4', name: 'Annual' as Schedule },
        { id: '5', name: 'Biennial' as Schedule }
      ];
      setGroups(defaultGroups);
      setSchedules(defaultSchedules);
    }
  };

  const loadEquipment = async (forceFresh = false) => {
    setLoading(true);
    try {
      const url = `/api/equipment?slug=${encodeURIComponent(String(slug))}${forceFresh ? '&forceFresh=1' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setEquipment(json.data as Equipment[]);
        // persist local
        Promise.all((json.data as Equipment[]).map(e => upsertLocalEquipment(e,1)));
      } else {
        console.error('Failed to load equipment:', json.error);
        toast.error('Failed to load equipment');
      }
    } catch (error) {
      console.error('Error loading equipment:', error);
      toast.error('Error loading equipment');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (equipmentData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingEquipment) {
        // Update existing equipment
        // Optimistic update
        setEquipment(prev => prev.map(e => e.id===editingEquipment.id ? { ...e, ...equipmentData } as Equipment : e));
        upsertLocalEquipment({ ...editingEquipment, ...equipmentData });
        if (offline) {
          enqueue({ entity:'equipment', operation:'update', payload:{ id: editingEquipment.id, input: equipmentData }});
          toast.success('Equipment update queued (offline)');
          setShowForm(false); setEditingEquipment(undefined);
        } else {
          const result = await updateEquipment(editingEquipment.id, equipmentData);
            if (result.error) {
              toast.error('Failed to update equipment on server');
            } else {
              toast.success('Equipment updated');
            }
          setShowForm(false); setEditingEquipment(undefined); loadEquipment();
        }
      } else {
        const tempId = 'temp_'+crypto.randomUUID();
        const optimistic: Equipment = { ...(equipmentData as any), id: tempId };
        setEquipment(prev => [optimistic, ...prev]);
        upsertLocalEquipment(optimistic);
        if (offline) {
          enqueue({ entity:'equipment', operation:'create', payload:{ input: equipmentData }});
          toast.success('Equipment queued (offline)');
          setShowForm(false);
        } else {
          const res = await fetch(`/api/equipment?slug=${encodeURIComponent(String(slug))}` , { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(equipmentData) })
          const json = await res.json();
          if (!res.ok) {
            toast.error('Failed to create equipment');
            setEquipment(prev => prev.filter(e => e.id!==tempId));
          } else {
            toast.success('Equipment created');
            loadEquipment();
          }
          setShowForm(false);
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to save equipment. Please try again.');
    }
  };

  const handleView = (equipment: Equipment) => {
    setViewingEquipment(equipment);
    setShowView(true);
  };

  const handleEdit = (equipment: Equipment) => {
    if (showView) {
      // If we're in view mode, switch to edit mode
      setViewingEquipment(undefined);
      setShowView(false);
      setEditingEquipment(equipment);
      setShowForm(true);
    } else {
      // Normal edit flow
      setEditingEquipment(equipment);
      setShowForm(true);
    }
  };

  const handleViewCancel = () => {
    setShowView(false);
    setViewingEquipment(undefined);
  };

  const handleDelete = async (id: string): Promise<{ error: string | null }> => {
    // Optimistic removal
    const prev = equipment;
    setEquipment(equipment.filter(e => e.id!==id));
    if (offline) {
      enqueue({ entity:'equipment', operation:'delete', payload:{ id }});
      toast.success('Delete queued (offline)');
  return { error: null };
    }
    try {
      const result = await deleteEquipment(id);
      if (result.error) {
        toast.error('Delete failed');
        setEquipment(prev); // rollback
  return { error: result.error };
      }
      toast.success('Deleted');
  return { error: null };
    } catch (error) {
      toast.error('Delete error');
      setEquipment(prev);
  return { error: `Failed to delete equipment: ${error}` };
    }
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingEquipment(undefined);
  };

  const handleAddEquipment = () => {
    setEditingEquipment(undefined);
    setShowForm(true);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await loadEquipment(true);
      toast.success('Equipment refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally { setRefreshing(false); }
  };

  // Calculate group statistics
  const groupStats: GroupStats[] = ['PFD', 'Heights Safety', 'Fire', 'First Aid', 'Racking', 'Other'].map(group => {
    const groupEquipment = equipment.filter(eq => eq.groupName === group);
    return {
      group: group as EquipmentGroup,
      total: groupEquipment.length,
      compliant: groupEquipment.filter(eq => eq.status === 'compliant').length,
      overdue: groupEquipment.filter(eq => eq.status === 'overdue').length,
      upcoming: groupEquipment.filter(eq => eq.status === 'upcoming').length
    };
  });

  // Filter equipment by selected group
  const filteredEquipment = selectedGroup === 'all' 
    ? equipment 
    : equipment.filter(eq => eq.groupName === selectedGroup);

  const handleBulkSelect = (id: string, selected: boolean) => {
    if (selected) {
      setSelectedEquipmentIds(prev => [...prev, id]);
    } else {
      setSelectedEquipmentIds(prev => prev.filter(itemId => itemId !== id));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedEquipmentIds(filteredEquipment.map(eq => eq.id));
    } else {
      setSelectedEquipmentIds([]);
    }
  };

  const handleBulkDelete = async () => {
    console.log('handleBulkDelete called with:', selectedEquipmentIds.length, 'items');
    
    if (selectedEquipmentIds.length === 0) return;
    
    const equipmentCount = selectedEquipmentIds.length;
    const equipmentText = equipmentCount === 1 ? 'item' : 'items';
    
    // Show custom confirmation
    setBulkDeleteConfirmation({
      show: true,
      count: equipmentCount,
      equipmentText: equipmentText
    });
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteConfirmation) return;
    
    const { count, equipmentText } = bulkDeleteConfirmation;
    
    // Hide confirmation dialog
    setBulkDeleteConfirmation(null);
    
    console.log('User confirmed deletion, proceeding...');
    
    try {
      // Show loading toast
      const loadingToast = toast.loading(`Deleting ${count} ${equipmentText}...`);
      
      // Use Promise.allSettled to handle both successes and failures
      const deletePromises = selectedEquipmentIds.map(id => deleteEquipment(id));
      const results = await Promise.allSettled(deletePromises);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      const successful = results.filter(result => result.status === 'fulfilled' && !result.value.error);
      const failed = results.filter(result => result.status === 'rejected' || (result.status === 'fulfilled' && result.value.error));
      
      console.log('Delete results:', { successful: successful.length, failed: failed.length });
      
      if (failed.length > 0) {
        toast.error(`Failed to delete ${failed.length} item(s). ${successful.length} item(s) deleted successfully.`);
      } else {
        toast.success(`Successfully deleted ${successful.length} item(s)!`);
      }
      
      // Clear selections and reload
      setSelectedEquipmentIds([]);
      setBulkMode(false);
      await loadEquipment();
      
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete equipment. Please try again.');
    }
  };

  const generateEquipmentTemplateCSV = (): string => {
    const templateData = [{
      'Equipment Name': 'Life Ring - 001',
      'Auto ID': 'LR-001',
      'Group': 'PFD', 
      'Status': 'compliant',
      'Last Inspection': '01/06/2024',
      'Next Inspection': '01/09/2024',
      'Days Until Inspection': '30',
      'Schedule': 'Quarterly',
      'Location': 'Dock C'
    }];
    
    const headers = Object.keys(templateData[0]);
    const csvContent = [
      headers.join(','),
      Object.values(templateData[0]).join(',')
    ].join('\n');
    
    return csvContent;
  };

  const parseEquipmentCSV = (csvData: string): Partial<Equipment>[] => {
    try {
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      return lines.slice(1)
        .filter(line => line.trim() !== '')
        .map(line => {
          const values = line.split(',').map(v => v.trim());
          const equipment: Partial<Equipment> = {};
          
          headers.forEach((header, index) => {
            const value = values[index];
            if (!value) return;
            
            switch (header.toLowerCase()) {
              case 'equipment name':
              case 'name':
                equipment.name = value;
                break;
              case 'group':
                equipment.groupName = value as EquipmentGroup; // FIXED: use groupName
                break;
              case 'description':
                equipment.description = value;
                break;
              case 'schedule':
                equipment.scheduleName = value.toLowerCase() as Schedule; // FIXED: use scheduleName
                break;
              case 'last inspection':
              case 'lastinspection':
                if (value) {
                  // Handle DD/MM/YYYY format
                  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
                    const [day, month, year] = value.split('/');
                    equipment.lastInspection = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
                  } else {
                    equipment.lastInspection = new Date(value);
                  }
                }
                break;
              case 'location':
                equipment.location = value;
                break;
            }
          });
          
          return equipment;
        });
    } catch (error) {
      console.error('Error parsing CSV:', error);
      throw new Error('Invalid CSV format. Please check your file and try again.');
    }
  };

  // UPDATE the handleDownloadTemplate function:
  const handleDownloadTemplate = () => {
    const template = generateEquipmentTemplateCSV();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'equipment-import-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const equipmentList = parseEquipmentCSV(text);
      
      if (equipmentList.length === 0) {
        toast.error('No valid equipment data found in CSV');
        return;
      }
      
      const result = await createBulkEquipment(equipmentList);
      if (result.error) {
        toast.error('Failed to import equipment: ' + result.error);
      } else {
        toast.success(`Successfully imported ${equipmentList.length} equipment items`);
        setShowBulkImportModal(false);
        await loadEquipment();
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error(`Failed to import CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Reset the file input
    event.target.value = '';
  };

  // ADD THESE FUNCTIONS to your equipment/page.tsx:

  const handleExportAllFromTable = (data: Equipment[]) => {
    try {
      if (data.length === 0) {
        toast.error('No equipment data to export');
        return;
      }

      const exportData = prepareScheduleData(data);
      exportToCSV(exportData, `equipment-export-${new Date().toISOString().split('T')[0]}`);
      toast.success(`Exported ${data.length} equipment records to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export equipment data');
    }
  };

  const handleExportSelectedFromTable = (selectedIds: string[]) => {
    try {
      const selectedEquipment = filteredEquipment.filter(item => selectedIds.includes(item.id));

      if (selectedEquipment.length === 0) {
        toast.error('No selected equipment data to export');
        return;
      }

      const exportData = prepareScheduleData(selectedEquipment);
      exportToCSV(exportData, `selected-equipment-export-${new Date().toISOString().split('T')[0]}`);
      toast.success(`Exported ${selectedEquipment.length} selected equipment records to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export selected equipment data');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-800 dark:text-slate-200">Loading equipment...</div>
      </div>
    );
  }

  if (showView && viewingEquipment) {
    return (
      <EquipmentForm
        onSubmit={handleFormSubmit}
        onCancel={handleViewCancel}
        existingEquipment={equipment}
        equipment={viewingEquipment}
        groups={groups}
        schedules={schedules}
        readOnly={true}
        onEdit={() => handleEdit(viewingEquipment)}
      />
    );
  }

  if (showForm) {
    return (
      <EquipmentForm
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        existingEquipment={equipment}
        equipment={editingEquipment}
        groups={groups}
        schedules={schedules}
        readOnly={false}
      />
    );
  }

  return (
    <div className="container mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Equipment Management</h1>
          <p className="text-slate-600 dark:text-slate-400">Track and manage equipment compliance across all groups</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {offline && <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-300">Offline</span>}
          {pendingCount>0 && <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-300">Queued: {pendingCount}{syncing && ' • syncing'}</span>}
          {bulkMode && selectedEquipmentIds.length > 0 && (
            <>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleBulkDelete}
                className="text-white"
              >
                Delete ({selectedEquipmentIds.length})
              </Button>
            </>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Clear selections when exiting bulk mode
              if (bulkMode) {
                setSelectedEquipmentIds([]);
              }
              setBulkMode(!bulkMode);
            }}
            className={bulkMode ? 'bg-blue-100 border-blue-300' : ''}
          >
            {bulkMode ? 'Exit Bulk Mode' : 'Bulk Mode'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkImportModal(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          
          <Button
            onClick={handleAddEquipment}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Equipment
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <RefreshCw className="h-4 w-4 mr-2"/>}
            Refresh
          </Button>
        </div>
      </div>

      {/* CSV Import Modal */}
      {showBulkImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">Import Equipment</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  Upload a CSV file with equipment details. The CSV should have the following columns:
                </p>
                <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded text-xs font-mono dark:text-slate-300">
                  Name, Group, Description, Schedule, LastInspection, Location
                </div>
              </div>
              
              <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="flex flex-col items-center cursor-pointer"
                >
                  <Upload className="h-8 w-8 text-slate-400 dark:text-slate-500 mb-2" />
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Click to select CSV file</span>
                  <span className="text-slate-500 dark:text-slate-500 text-sm mt-1">or drag and drop</span>
                </label>
              </div>
              
              <div className="text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700"
                >
                  <FileCheck className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  Not sure of the format? Download our template with an example row.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowBulkImportModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteConfirmation && (
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
              Are you sure you want to delete <strong>{bulkDeleteConfirmation.count} {bulkDeleteConfirmation.equipmentText}</strong>?
            </p>
            
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setBulkDeleteConfirmation(null)}
                className="border-slate-300 dark:border-slate-600"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmBulkDelete}
                className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white"
              >
                Delete {bulkDeleteConfirmation.count} {bulkDeleteConfirmation.equipmentText}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Group Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        {groupStats.map((stats) => {
          const Icon = groupIcons[stats.group];
          return (
            <Card
              key={stats.group}
              className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                selectedGroup === stats.group
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 shadow-md'
                  : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm'
              }`}
              onClick={() => setSelectedGroup(selectedGroup === stats.group ? 'all' : stats.group)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${groupColors[stats.group]}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-600">
                    {stats.total}
                  </Badge>
                </div>
                <CardTitle className="text-slate-800 dark:text-slate-200 text-sm">{stats.group}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-green-600 dark:text-green-500">
                    <div className="font-semibold">{stats.compliant}</div>
                    <div className="text-slate-600 dark:text-slate-400">Compliant</div>
                  </div>
                  <div className="text-amber-600 dark:text-amber-500">
                    <div className="font-semibold">{stats.upcoming}</div>
                    <div className="text-slate-600 dark:text-slate-400">Upcoming</div>
                  </div>
                  <div className="text-red-600 dark:text-red-500">
                    <div className="font-semibold">{stats.overdue}</div>
                    <div className="text-slate-600 dark:text-slate-400">Overdue</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Equipment Table */}
      <EquipmentTable
        equipment={filteredEquipment}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView} // Make sure this is here
        bulkMode={bulkMode}
        selectedIds={selectedEquipmentIds}
        onBulkSelect={handleBulkSelect}
        onSelectAll={handleSelectAll}
        onExportAll={handleExportAllFromTable} 
        onExportSelected={handleExportSelectedFromTable} 
      />
    </div>
  );
}