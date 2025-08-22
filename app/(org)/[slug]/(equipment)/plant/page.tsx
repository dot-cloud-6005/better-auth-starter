'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Plus,  
  Upload, 
  Car, 
  Truck,   
  Ship, 
  Fuel,
  TypeOutline,
  Calendar,
  MapPin,
  User,
  RefreshCw,
  Loader2
} from 'lucide-react';

import { Plant, PlantGroup } from '@/types/equipment/plant';
import { deletePlant, updatePlantStatuses, createPlant, updatePlant } from '@/lib/equipment/actions/plant';
import { useParams } from 'next/navigation';
import PlantForm from '@/components/equipment/PlantForm';
import PlantTable from '@/components/equipment/PlantTable';
import { toast } from 'sonner';
import { exportPlantToCSV } from '@/lib/equipment/utils/PlantExport';
import { getLocalPlant, upsertLocalPlant, enqueue, runSync, getQueue } from '@/lib/client-db/sqlite';

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
  compliant: 'bg-green-100 text-green-800 border-green-200',
  upcoming: 'bg-amber-100 text-amber-800 border-amber-200',
  overdue: 'bg-red-100 text-red-800 border-red-200'
};

interface GroupStats {
  group: PlantGroup;
  total: number;
  compliant: number;
  upcoming: number;
  overdue: number;
}

export default function PlantPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug
  const [plant, setPlant] = useState<Plant[]>([]);
  const [offline, setOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | undefined>(undefined);
  const [selectedGroup, setSelectedGroup] = useState<PlantGroup | 'all'>('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([]);
  const [viewingPlant, setViewingPlant] = useState<Plant | undefined>(undefined);
  const [showView, setShowView] = useState(false);
  const [groups, setGroups] = useState<Array<{id: string, name: PlantGroup}>>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load plant on component mount
  useEffect(() => {
    (async () => {
      try { const local = await getLocalPlant(); if (local.length) setPlant(local); } catch {}
      loadPlant();
      loadGroupsAndSchedules();
    })();
  }, [slug]); // Add slug as dependency since it's used in loadPlant
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  // Define the attemptSync function
  const attemptSync = async () => {
    try {
      setSyncing(true);
      const qBefore = await getQueue();
      setPendingCount(qBefore.length);
      if (!qBefore.length) return;
      await runSync({
        plant: async (op) => {
          try {
            const payload = op.payload;
            if (op.operation === 'create') {
              const r = await createPlant(payload.input);
              return !(r as any).error;
            } else if (op.operation === 'update') {
              const r = await updatePlant(payload.id, payload.input);
              return !(r as any).error;
            } else if (op.operation === 'delete') {
              const r = await deletePlant(payload.id);
              return !(r as any).error;
            }
            return true;
          } catch { return false; }
        }
      })
      const qAfter = await getQueue();
      setPendingCount(qAfter.length);
      if (qAfter.length===0) loadPlant();
    } finally { setSyncing(false); }
  };

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
  }, [offline]); // Remove attemptSync from dependencies as it's defined in the component scope

  // Update plant statuses on component mount
  useEffect(() => {
    updatePlantStatuses().catch(console.error);
  }, []);

  const loadPlant = async (forceFresh = false) => {
    try {
      setLoading(true);
      const url = `/api/plant?slug=${encodeURIComponent(String(slug))}${forceFresh ? '&forceFresh=1' : ''}`;
  const res = await fetch(url, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setPlant(json.data as Plant[]);
        Promise.all((json.data as Plant[]).map(p => upsertLocalPlant(p,1)));
      } else {
        console.error('Error loading plant:', json.error);
        toast.error('Failed to load plant');
      }
    } catch (error) {
      console.error('Error loading plant:', error);
      toast.error('Failed to load plant data');
    } finally {
      setLoading(false);
    }
  };

  // Replace the loadGroupsAndSchedules function with this:
  const loadGroupsAndSchedules = async () => {
    try {
      // Use the actual getPlantGroups function from your actions
      const { getPlantGroups } = await import('@/lib/equipment/actions/plant');
      const result = await getPlantGroups();
      
      if (result.data && result.data.length > 0) {
        // Use actual groups from database
        const transformedGroups = result.data.map((group: any) => ({
          id: group.id,
          name: group.name as PlantGroup
        }));
        setGroups(transformedGroups);
        console.log('Loaded plant groups from database:', transformedGroups);
      } else if (result.error) {
        console.error('Error loading plant groups:', result.error);
        toast.error('Failed to load plant groups');
      } else {
        console.log('No plant groups found in database');
        toast.error('Plant groups not found. Please contact administrator.');
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      toast.error('Failed to load plant groups');
    }
  };

  const handleFormSubmit = async (plantData: Omit<Plant, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      let result;
      
      if (editingPlant) {
        // Optimistic update
        setPlant(prev => prev.map(p => p.id===editingPlant.id ? { ...p, ...plantData } as Plant : p));
        upsertLocalPlant({ ...editingPlant, ...plantData });
        if (offline) {
          enqueue({ entity:'plant', operation:'update', payload:{ id: editingPlant.id, input: plantData }});
          toast.success('Plant update queued (offline)');
        } else {
          const { updatePlant } = await import('@/lib/equipment/actions/plant');
          result = await updatePlant(editingPlant.id, plantData);
          if (result.error) {
            toast.error(`Failed to update plant: ${result.error}`);
            return;
          }
          toast.success('Plant updated successfully');
        }
      } else {
        const tempId = 'temp_'+crypto.randomUUID();
        const optimistic: Plant = { ...(plantData as any), id: tempId };
        setPlant(prev => [optimistic, ...prev]);
        upsertLocalPlant(optimistic);
        if (offline) {
          enqueue({ entity:'plant', operation:'create', payload:{ input: plantData }});
          toast.success('Plant created (queued)');
        } else {
          const res = await fetch(`/api/plant?slug=${encodeURIComponent(String(slug))}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(plantData) })
          const json = await res.json();
          if (!res.ok) {
            toast.error(`Failed to create plant: ${json?.error || 'Unknown error'}`);
            setPlant(prev => prev.filter(p => p.id!==tempId));
            return;
          }
          toast.success('Plant created successfully');
        }
      }
      
      await loadPlant();
      handleFormCancel();
    } catch (error) {
      console.error('Error submitting plant form:', error);
      toast.error('Failed to save plant');
    }
  };

  const handleEdit = (plant: Plant) => {
    if (showView) {
      // If we're in view mode, switch to edit mode
      setViewingPlant(undefined);
      setShowView(false);
      setEditingPlant(plant);
      setShowForm(true);
    } else {
      // Normal edit flow
      setEditingPlant(plant);
      setShowForm(true);
    }
  };

  const handleView = (plant: Plant) => {
    setViewingPlant(plant);
    setShowView(true);
  };

  const handleDelete = async (id: string): Promise<{ error?: string }> => {
    const prev = plant;
    setPlant(plant.filter(p => p.id!==id));
    if (offline) {
      enqueue({ entity:'plant', operation:'delete', payload:{ id }});
      toast.success('Plant delete queued');
  return {};
    }
    try {
      const result = await deletePlant(id);
      if (result.error) {
        toast.error('Delete failed');
        setPlant(prev);
        return { error: result.error };
      }
      toast.success('Plant deleted');
  return {};
    } catch (error) {
      console.error('Error deleting plant:', error);
      setPlant(prev);
      return { error: 'Failed to delete plant' };
    }
  };

  const handleViewCancel = () => {
  setShowView(false);
  setViewingPlant(undefined);
};

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingPlant(undefined);
  };

  const handleAddPlant = () => {
    setEditingPlant(undefined);
    setShowForm(true);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await loadPlant(true);
      toast.success('Plant refreshed');
    } catch {
      toast.error('Refresh failed');
    } finally { setRefreshing(false); }
  };

  const handleBulkSelect = (id: string, selected: boolean) => {
    setSelectedPlantIds(prev => 
      selected 
        ? [...prev, id]
        : prev.filter(plantId => plantId !== id)
    );
  };

  const handleSelectAll = (selected: boolean) => {
    const filteredPlant = selectedGroup === 'all' 
      ? plant 
      : plant.filter(p => p.groupName === selectedGroup); // CHANGED: group → groupName
      
    setSelectedPlantIds(selected ? filteredPlant.map(p => p.id) : []);
  };

  const handleExportAll = (data: Plant[]) => {
    try {
      if (data.length === 0) {
        toast.error('No plant data to export');
        return;
      }

      const filename = selectedGroup === 'all'
        ? `all_plant_export_${new Date().toISOString().split('T')[0]}.csv`
        : `${selectedGroup.toLowerCase().replace(' ', '_')}_plant_export_${new Date().toISOString().split('T')[0]}.csv`;

      exportPlantToCSV(data, filename);
      toast.success(`Exported ${data.length} plant records to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export plant data');
    }
  };

  const handleExportSelected = (selectedIds: string[]) => {
    try {
      const filteredData = getFilteredPlant();
      const selectedPlant = filteredData.filter((item: Plant) => selectedIds.includes(item.id));

      if (selectedPlant.length === 0) {
        toast.error('No selected plant data to export');
        return;
      }

      const filename = `selected_plant_export_${new Date().toISOString().split('T')[0]}.csv`;
      exportPlantToCSV(selectedPlant, filename);
      toast.success(`Exported ${selectedPlant.length} selected plant records to CSV`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export selected plant data');
    }
  };

  // Helper function to get filtered plant data based on selected group
  const getFilteredPlant = () => {
    return selectedGroup === 'all' 
      ? plant 
      : plant.filter(p => p.groupName === selectedGroup);
  };

  // Calculate group statistics similar to equipment page
  const groupStats: GroupStats[] = ['Vehicle', 'Truck', 'Trailer', 'Vessel', 'Petrol Plant'].map(group => {
    const groupPlant = plant.filter(p => p.groupName === group); // CHANGED: group → groupName
    return {
      group: group as PlantGroup,
      total: groupPlant.length,
      compliant: groupPlant.filter(p => (p.status || 'compliant') === 'compliant').length, // Handle optional status
      upcoming: groupPlant.filter(p => (p.status || 'compliant') === 'upcoming').length, // Handle optional status
      overdue: groupPlant.filter(p => (p.status || 'compliant') === 'overdue').length, // Handle optional status
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-800 dark:text-slate-200">Loading plant data...</div>
      </div>
    );
  }

  if (showView && viewingPlant) {
    return (
      <PlantForm
        onSubmit={handleFormSubmit}
        onCancel={handleViewCancel}
        existingPlant={plant}
        plant={viewingPlant}
        groups={groups} // Make sure this is here
        readOnly={true}
        onEdit={() => handleEdit(viewingPlant)}
      />
    );
  }

  if (showForm) {
    return (
      <PlantForm
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
        existingPlant={plant}
        plant={editingPlant}
        groups={groups} // Make sure this is here too
        readOnly={false} // Edit mode
      />
    );
  }

  return (
    <div className="container mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Plant Management</h1>
          <p className="text-slate-600 dark:text-slate-400">Track and manage plant compliance across all categories</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {offline && <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">Offline</span>}
          {pendingCount>0 && <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">Queued: {pendingCount}{syncing && ' • syncing'}</span>}
          {bulkMode && selectedPlantIds.length > 0 && (
            <>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => {
                  // TODO: Implement bulk delete for plant
                  toast.info('Bulk delete coming soon');
                }}
                className="text-white dark:bg-red-800 dark:hover:bg-red-700"
              >
                Delete ({selectedPlantIds.length})
              </Button>
            </>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Clear selections when exiting bulk mode
              if (bulkMode) {
                setSelectedPlantIds([]);
              }
              setBulkMode(!bulkMode);
            }}
            className={bulkMode ? 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'}
          >
            {bulkMode ? 'Exit Bulk Mode' : 'Bulk Mode'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO: Implement CSV import for plant
              toast.info('CSV import coming soon');
            }}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          
          <Button
            onClick={handleAddPlant}
            className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Plant
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleManualRefresh} 
            disabled={refreshing}
            className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 disabled:dark:bg-slate-900 disabled:dark:text-slate-600"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <RefreshCw className="h-4 w-4 mr-2"/>}
            Refresh
          </Button>
        </div>
      </div>

      {/* Group Statistics - Similar to Equipment Page */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {groupStats.map((stats) => {
          const Icon = groupIcons[stats.group];
          return (
            <Card
              key={stats.group}
              className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                selectedGroup === stats.group
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-900/30 dark:border-blue-700 shadow-md'
                  : 'border-slate-200 bg-white/80 dark:bg-slate-900/80 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm'
              }`}
              onClick={() => setSelectedGroup(selectedGroup === stats.group ? 'all' : stats.group)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${groupColors[stats.group]}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                    {stats.total}
                  </Badge>
                </div>
                <CardTitle className="text-slate-800 dark:text-slate-200 text-sm">{stats.group}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-green-600 dark:text-green-400">
                    <div className="font-semibold">{stats.compliant}</div>
                    <div className="text-slate-600 dark:text-slate-400">Compliant</div>
                  </div>
                  <div className="text-amber-600 dark:text-amber-400">
                    <div className="font-semibold">{stats.upcoming}</div>
                    <div className="text-slate-600 dark:text-slate-400">Upcoming</div>
                  </div>
                  <div className="text-red-600 dark:text-red-400">
                    <div className="font-semibold">{stats.overdue}</div>
                    <div className="text-slate-600 dark:text-slate-400">Overdue</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Plant Table */}
      <PlantTable
        plant={getFilteredPlant()}
        onEdit={handleEdit}
        onView={handleView}
        onDelete={handleDelete}
        bulkMode={bulkMode}
        selectedIds={selectedPlantIds}
        onBulkSelect={handleBulkSelect}
        onSelectAll={handleSelectAll}
        onExportAll={handleExportAll}
        onExportSelected={handleExportSelected}
      />
    </div>
  );
}

// Safe formatters for Date | string | undefined
const fmtDate = (v?: Date | string) => {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString()
}
const fmtDateTime = (v?: Date | string) => {
  if (!v) return ''
  const d = typeof v === 'string' ? new Date(v) : v
  return isNaN(d.getTime()) ? '' : d.toLocaleString()
}