'use client'

import { useState, useEffect } from 'react'
import { Equipment } from '@/types/equipment/equipment'
import { Plant } from '@/types/equipment/plant'
import { UnifiedInspection, getAllInspections, getUnifiedInspectionStats } from '@/lib/equipment/actions/unified-inspections'
import { getEquipment } from '@/lib/equipment/actions/equipment'
import { getPlant } from '@/lib/equipment/actions/plant'
import { createInspection, createBulkInspection } from '@/lib/equipment/actions/inspection'
import { createPlantInspection } from '@/lib/equipment/actions/plant-inspection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Plus, Calendar, Clock, ClipboardCheck, Wrench, RefreshCw, Loader2, Search, Download, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { PlantInspectionFormSelector, EquipmentInspectionFormSelector } from '@/components/equipment/inspectionForms'
import { getLocalEquipment, getLocalPlant, getLocalInspections, upsertLocalEquipment, upsertLocalPlant, addLocalInspection, enqueue, runSync, getQueue } from '@/lib/client-db/sqlite'

interface Props {
  orgId: string
  orgSlug: string
  initialEquipment: Equipment[]
  initialPlant: Plant[]
  initialUnifiedInspections: UnifiedInspection[]
  initialUnifiedStats: any
}

type ItemStatus = 'compliant' | 'upcoming' | 'overdue'
// UI union types that retain original domain properties so forms can use them
type EquipmentUIItem = Equipment & { type: 'equipment'; group: string; nextInspection?: Date | string }
type PlantUIItem = Plant & { type: 'plant'; group: string; nextInspection?: Date | string }
type InspectableItem = EquipmentUIItem | PlantUIItem

const statusColors: Record<string, string> = {
  pass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  fail: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  needs_repair: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  conditional: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
}

export default function InspectionsClient({ orgId, orgSlug, initialEquipment, initialPlant, initialUnifiedInspections, initialUnifiedStats }: Props) {
  const [equipment, setEquipment] = useState(initialEquipment)
  const [plant, setPlant] = useState(initialPlant)
  const [unifiedInspections, setUnifiedInspections] = useState(initialUnifiedInspections)
  const [unifiedStats, setUnifiedStats] = useState(initialUnifiedStats)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<InspectableItem[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'completed'>('all')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'equipment' | 'plant'>('all')
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | 'equipment' | 'plant'>('all')
  const [focusedFormMode, setFocusedFormMode] = useState(false)
  const [selectedInspection, setSelectedInspection] = useState<UnifiedInspection | null>(null)
  const [showInspectionView, setShowInspectionView] = useState(false)
  const [offline, setOffline] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    // Hydrate from local sqlite first for instant display
    let cancelled = false
    ;(async () => {
      try {
        const [le, lp, li] = await Promise.all([
          getLocalEquipment().catch(()=>[]),
          getLocalPlant().catch(()=>[]),
          getLocalInspections().catch(()=>[])
        ])
        if (!cancelled) {
          if (le.length) setEquipment(prev => prev.length ? prev : le)
          if (lp.length) setPlant(prev => prev.length ? prev : lp)
          if (li.length) setUnifiedInspections(prev => prev.length ? prev : [...li, ...prev])
        }
      } catch {}
      // Always kick a remote refresh to ensure freshness
      reloadAll()
    })()
    return () => { cancelled = true }
  }, [])

  // Network status tracking
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Periodic slow-network aware sync (every 60s, jittered) and on visibility return
  useEffect(() => {
    let cancelled = false
    async function tick() {
      if (cancelled) return
      if (!offline) await attemptSync()
      const delay = 60000 + Math.random()*15000 // 60-75s
      setTimeout(tick, delay)
    }
    tick()
    const vis = () => { if (document.visibilityState === 'visible' && !offline) attemptSync() }
    document.addEventListener('visibilitychange', vis)
    return () => { cancelled = true; document.removeEventListener('visibilitychange', vis) }
  }, [offline])

  async function attemptSync() {
    try {
      setSyncing(true)
      const queueBefore = await getQueue()
      setPendingCount(queueBefore.length)
      if (!queueBefore.length) { setSyncing(false); return }
      await runSync({
        inspection: async (op) => {
          try {
            if (op.operation !== 'create') return true
            const payload = op.payload
            if (payload.kind === 'equipment') {
              const r = await createInspection({
                equipmentId: payload.input.itemId,
                inspectionDate: new Date(payload.input.inspectionDate || payload.input.date || new Date()),
                inspectorName: payload.input.inspectorName,
                status: payload.input.status,
                notes: payload.input.notes || '',
                orgId
              })
              return !r.error
            } else if (payload.kind === 'plant') {
              const r = await createPlantInspection({
                plantId: payload.input.itemId,
                serviceDate: new Date(payload.input.inspectionDate || payload.input.date || new Date()),
                serviceType: 'inspection',
                servicedBy: payload.input.inspectorName,
                status: payload.input.status,
                notes: payload.input.notes,
                inspectionData: payload.input.inspectionData
              } as any)
              return !r.error
            } else if (payload.kind === 'bulkEquipment') {
              const r = await createBulkInspection({
                equipmentIds: payload.input.equipmentIds,
                inspectionDate: new Date(payload.input.date || new Date()),
                inspectorName: payload.input.inspectorName,
                status: payload.input.status,
                notes: payload.input.notes,
                orgId
              })
              return !r.error
            }
            return true
          } catch (e) {
            console.warn('Sync op failed', e)
            return false
          }
        }
      })
      const queueAfter = await getQueue()
      setPendingCount(queueAfter.length)
      if (queueAfter.length === 0) reloadAll()
    } finally {
      setSyncing(false)
    }
  }

  async function reloadAll() {
    setRefreshing(true)
    try {
      const [eqRes, plantRes, unifiedRes, statsRes] = await Promise.all([
        getEquipment(orgId, true), // force fresh bypass cache
        getPlant(orgId, true), // force fresh bypass cache
        getAllInspections({ orgSlug }),
        getUnifiedInspectionStats({ orgSlug })
      ])
      if (eqRes.data) setEquipment(eqRes.data)
      if (plantRes.data) setPlant(plantRes.data)
      if (unifiedRes.data) setUnifiedInspections(unifiedRes.data)
      if (statsRes.data) setUnifiedStats(statsRes.data)
      // persist to local for next fast load
      Promise.all([
        ...(eqRes.data||[]).map((e:any)=> upsertLocalEquipment(e,1)),
        ...(plantRes.data||[]).map((p:any)=> upsertLocalPlant(p,1)),
        ...(unifiedRes.data||[]).map((i:any)=> addLocalInspection(i,1))
      ])
    } catch (e) {
      console.error(e)
      toast.error('Failed to refresh data')
    } finally {
      setRefreshing(false)
    }
  }

  const equipmentItems: EquipmentUIItem[] = equipment.map(eq => ({
    ...eq,
    group: (eq as any).groupName || 'Unknown',
    status: (eq as any).status as ItemStatus, // ensure casting
    nextInspection: (eq as any).nextInspection,
    type: 'equipment'
  }))
  const plantItems: PlantUIItem[] = plant.map(p => ({
    ...p,
    group: p.groupName || 'Unknown',
    status: (p.status || 'compliant') as ItemStatus,
    nextInspection: p.serviceDueDate,
    type: 'plant'
  }))
  const allItems = [...equipmentItems, ...plantItems]

  function daysUntil(date?: Date | string) {
    if (!date) return 0
    const d = typeof date === 'string' ? new Date(date) : date
    return Math.ceil((d.getTime() - Date.now()) / 86400000)
  }
  function formatDate(date?: Date | string) {
    if (!date) return 'N/A'
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  function filterItems() {
    let f = allItems
    if (typeFilter !== 'all') f = f.filter(i => i.type === typeFilter)
    if (groupFilter !== 'all') f = f.filter(i => i.group === groupFilter)
    if (searchTerm) f = f.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.autoId.toLowerCase().includes(searchTerm.toLowerCase()) || i.group.toLowerCase().includes(searchTerm.toLowerCase()))
    if (statusFilter !== 'all') {
      const map: any = { pending: 'upcoming', overdue: 'overdue', completed: 'compliant' }
      f = f.filter(i => i.status === map[statusFilter])
    }
    return f
  }
  function getGroups() {
    return Array.from(new Set(allItems.map(i => i.group))).filter(Boolean).sort()
  }

  function handleItemSelect(item: InspectableItem, checked: boolean) {
    setSelectedItems(prev => checked ? [...prev, item] : prev.filter(p => p.id !== item.id))
  }
  function startInlineInspect(item: InspectableItem) {
    setSelectedItems([item])
    setFocusedFormMode(true)
  }
  function handleInspectionRowClick(i: UnifiedInspection) {
    setSelectedInspection(i)
    setShowInspectionView(true)
  }
  function handleItemRowClick(item: InspectableItem) {
    const recents = unifiedInspections.filter(u => u.itemId === item.id && u.type === item.type)
    if (!recents.length) return toast.info('No inspection history for item')
    setSelectedInspection(recents[0])
    setShowInspectionView(true)
  }

  async function submitEquipmentInspection(fd: FormData) {
  const item = selectedItems[0]
    if (!item) return
    // optimistic local create
    const tempId = 'temp_'+crypto.randomUUID()
    const optimistic = {
      id: tempId,
      type: 'equipment',
      itemId: item.id,
      itemName: item.name,
      itemAutoId: item.autoId,
      groupName: item.group,
      inspectionDate: new Date(fd.get('inspectionDate') as string),
      inspectorName: fd.get('inspectorName') as string,
      status: fd.get('status') as any,
      notes: fd.get('notes') as string || '',
      createdAt: new Date(),
      nextInspectionDate: undefined
    }
    addLocalInspection(optimistic)
    setUnifiedInspections(prev => [optimistic as any, ...prev])
    enqueue({ entity:'inspection', operation:'create', payload:{ kind:'equipment', input:{ ...optimistic, equipmentId:item.id } } })
    const res = await createInspection({
      equipmentId: item.id,
      inspectionDate: new Date(fd.get('inspectionDate') as string),
      inspectorName: fd.get('inspectorName') as string,
      status: fd.get('status') as any,
      notes: (fd.get('notes') as string) || '',
      orgId
    })
    if (res.error) toast.error('Failed to record inspection')
    else {
      toast.success('Inspection recorded')
      setFocusedFormMode(false); setShowForm(false); setSelectedItems([])
      reloadAll()
    }
  }
  function buildInspectionData(fd: FormData, exclude: string[] = []) {
    const obj: Record<string, any> = {}
    for (const [k, v] of fd.entries()) {
      if (exclude.includes(k)) continue
      // Skip empty strings
      if (typeof v === 'string') {
        if (v === '') continue
        obj[k] = v
      } else {
        obj[k] = v
      }
    }
    return obj
  }

  async function submitPlantInspection(fd: FormData) {
    const item = selectedItems[0]
    if (!item) return
    const inspectionData = buildInspectionData(fd, ['inspectionDate','inspectorName','status','notes','itemId'])
    const tempId = 'temp_'+crypto.randomUUID()
    const optimistic = {
      id: tempId,
      type: 'plant',
      itemId: item.id,
      itemName: item.name,
      itemAutoId: item.autoId,
      groupName: item.group,
      inspectionDate: new Date(fd.get('inspectionDate') as string),
      inspectorName: fd.get('inspectorName') as string,
      status: fd.get('status') as any,
      notes: fd.get('notes') as string || '',
      createdAt: new Date(),
      nextInspectionDate: undefined
    }
    addLocalInspection(optimistic)
    setUnifiedInspections(prev => [optimistic as any, ...prev])
    enqueue({ entity:'inspection', operation:'create', payload:{ kind:'plant', input:{ ...optimistic, plantId:item.id, inspectionData } } })
    const res = await createPlantInspection({
      plantId: item.id,
      serviceDate: new Date(fd.get('inspectionDate') as string),
      serviceType: 'inspection',
      servicedBy: fd.get('inspectorName') as string,
      status: fd.get('status') as any,
      notes: fd.get('notes') as string | undefined,
      inspectionData
    } as any)
    if (res.error) toast.error('Failed to record plant inspection')
    else {
      toast.success('Plant inspection recorded')
      setFocusedFormMode(false); setShowForm(false); setSelectedItems([])
      reloadAll()
    }
  }
  async function submitBulk(fd: FormData) {
    const date = new Date(fd.get('inspectionDate') as string)
    const inspector = fd.get('inspectorName') as string
    const status = fd.get('status') as any
    const notes = (fd.get('notes') as string)||''
    // optimistic records for each equipment
    const optimisticRecords = selectedItems.filter(i=>i.type==='equipment').map(eq => ({
      id: 'temp_'+crypto.randomUUID(),
      type: 'equipment',
      itemId: eq.id,
      itemName: eq.name,
      itemAutoId: eq.autoId,
      groupName: eq.group,
      inspectionDate: date,
      inspectorName: inspector,
      status,
      notes,
      createdAt: new Date(),
      nextInspectionDate: undefined
    }))
    optimisticRecords.forEach(r => addLocalInspection(r))
    setUnifiedInspections(prev => [...optimisticRecords as any, ...prev])
    enqueue({ entity:'inspection', operation:'create', payload:{ kind:'bulkEquipment', input:{ equipmentIds: selectedItems.filter(i=>i.type==='equipment').map(i=>i.id), date, inspectorName: inspector, status, notes } } })
    const res = await createBulkInspection({
      equipmentIds: selectedItems.filter(i => i.type === 'equipment').map(i => i.id),
      inspectionDate: date,
      inspectorName: inspector,
      status,
      notes,
      orgId
    })
    if (res.error) toast.error('Bulk inspection failed')
    else {
      toast.success('Bulk inspection recorded')
      setShowBulkForm(false); setBulkMode(false); setSelectedItems([])
      reloadAll()
    }
  }

  if (focusedFormMode && selectedItems[0]) {
    const item = selectedItems[0]
    const isPlant = item.type === 'plant'
  return (
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inspect: {item.name} ({item.autoId})</h1>
          <Button variant="outline" onClick={() => { setFocusedFormMode(false); setSelectedItems([]) }} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Back</Button>
        </div>
  <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-4">
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); isPlant ? submitPlantInspection(fd) : submitEquipmentInspection(fd) }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Inspection Date</label>
                <input name="inspectionDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Inspector</label>
                <input name="inspectorName" type="text" className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" required />
              </div>
            </div>
            <div className="mt-4">{isPlant ? <PlantInspectionFormSelector selectedItem={item as any} /> : <EquipmentInspectionFormSelector selectedItem={item as any} />}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Result</label>
                <select name="status" className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" required>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="needs_repair">Needs Repair</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Notes</label>
                <textarea name="notes" rows={3} className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button type="button" variant="outline" onClick={() => { setFocusedFormMode(false); setSelectedItems([]) }} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white">Record Inspection</Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inspections Management</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Org: {orgSlug}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={reloadAll} disabled={refreshing} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>} Refresh
          </Button>
          <Button variant="outline" onClick={() => setBulkMode(b => !b)} className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
            {bulkMode ? 'Exit Bulk' : 'Bulk Mode'}
          </Button>
          {bulkMode && selectedItems.length > 0 && 
            <Button onClick={() => setShowBulkForm(true)} className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white">
              Bulk Inspect ({selectedItems.length})
            </Button>
          }
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white">
            <Plus className="h-4 w-4 mr-1"/>Record
          </Button>
          {offline && <span className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">Offline mode</span>}
          {pendingCount>0 && <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Queued: {pendingCount}{syncing && ' • syncing...'}</span>}
        </div>
      </div>

      {unifiedStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <CardHeader className="pb-2 flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-800 dark:text-slate-300">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-slate-600 dark:text-slate-400"/>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">{unifiedStats.thisWeek.total}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{unifiedStats.thisWeek.equipment} eq • {unifiedStats.thisWeek.plant} pl</p>
            </CardContent>
          </Card>
          <Card className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <CardHeader className="pb-2 flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-800 dark:text-slate-300">This Month</CardTitle>
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-500"/>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-500">{unifiedStats.thisMonth.total}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{unifiedStats.thisMonth.equipment} eq • {unifiedStats.thisMonth.plant} pl</p>
            </CardContent>
          </Card>
          <Card className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <CardHeader className="pb-2 flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-800 dark:text-slate-300">Equipment Total</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-500"/>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-500">{unifiedInspections.filter(i=>i.type==='equipment').length}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">All time</p>
            </CardContent>
          </Card>
          <Card className="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <CardHeader className="pb-2 flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-slate-800 dark:text-slate-300">Plant Total</CardTitle>
              <Wrench className="h-4 w-4 text-green-600 dark:text-green-500"/>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-600 dark:text-green-500">{unifiedInspections.filter(i=>i.type==='plant').length}</div>
              <p className="text-xs text-slate-600 dark:text-slate-400">All time</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-slate-100">Items</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:text-slate-100">History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded-md">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500"/>
              <input 
                value={searchTerm} 
                onChange={e=>setSearchTerm(e.target.value)} 
                placeholder="Search" 
                className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md text-sm"
              />
            </div>
            <select 
              value={typeFilter} 
              onChange={e=>setTypeFilter(e.target.value as any)} 
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-2 py-2 text-sm"
            >
              <option value="all">All Types</option>
              <option value="equipment">Equipment</option>
              <option value="plant">Plant</option>
            </select>
            <select 
              value={groupFilter} 
              onChange={e=>setGroupFilter(e.target.value)} 
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-2 py-2 text-sm"
            >
              <option value="all">All Groups</option>
              {getGroups().map(g=> <option key={g} value={g}>{g}</option>)}
            </select>
            <select 
              value={statusFilter} 
              onChange={e=>setStatusFilter(e.target.value as any)} 
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-2 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700">
                <tr>
                  {bulkMode && <th className="p-2"/>}
                  <th className="text-left p-2 text-slate-700 dark:text-slate-300">Item</th>
                  <th className="text-left p-2 text-slate-700 dark:text-slate-300">Type/Group</th>
                  <th className="text-left p-2 text-slate-700 dark:text-slate-300">Status</th>
                  <th className="text-left p-2 text-slate-700 dark:text-slate-300">Next</th>
                  <th className="text-left p-2 text-slate-700 dark:text-slate-300">Days</th>
                  {!bulkMode && <th className="p-2"/>}
                </tr>
              </thead>
              <tbody>
                {filterItems().map(it=>{
                  const d=daysUntil(it.nextInspection);
                  const selected=selectedItems.some(s=>s.id===it.id);
                  return (
                    <tr key={it.id} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={e=>{ if((e.target as HTMLElement).closest('button,input')) return; handleItemRowClick(it) }}>
                      {bulkMode && <td className="p-2"><input type="checkbox" checked={selected} onChange={e=>handleItemSelect(it,e.target.checked)} onClick={e=>e.stopPropagation()}/></td>}
                      <td className="p-2">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{it.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{it.autoId}</div>
                      </td>
                      <td className="p-2">
                        <div className="capitalize text-slate-800 dark:text-slate-200">{it.type}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{it.group}</div>
                      </td>
                      <td className="p-2"><Badge className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">{it.status}</Badge></td>
                      <td className="p-2 text-slate-800 dark:text-slate-200">{formatDate(it.nextInspection)}</td>
                      <td className="p-2 text-slate-600 dark:text-slate-400">{d<0? <span className="text-red-600 dark:text-red-400 font-medium">{Math.abs(d)} overdue</span>: d}</td>
                      {!bulkMode && <td className="p-2"><Button size="sm" className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white" onClick={e=>{e.stopPropagation(); startInlineInspect(it)}}>Inspect</Button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Unified Inspection History</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">First 50 records</p>
            </div>
            <div className="flex gap-2">
              <select 
                value={historyTypeFilter} 
                onChange={e=>setHistoryTypeFilter(e.target.value as any)} 
                className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-md px-2 py-2 text-sm"
              >
                <option value="all">All Types ({unifiedInspections.length})</option>
                <option value="equipment">Equipment ({unifiedInspections.filter(i=>i.type==='equipment').length})</option>
                <option value="plant">Plant ({unifiedInspections.filter(i=>i.type==='plant').length})</option>
              </select>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md overflow-x-auto max-h-[500px]">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-700">
                <tr>
                  <th className="p-2 text-left text-slate-700 dark:text-slate-300">Date</th>
                  <th className="p-2 text-left text-slate-700 dark:text-slate-300">Type</th>
                  <th className="p-2 text-left text-slate-700 dark:text-slate-300">Item</th>
                  <th className="p-2 text-left text-slate-700 dark:text-slate-300">Group</th>
                  <th className="p-2 text-left text-slate-700 dark:text-slate-300">Inspector</th>
                  <th className="p-2 text-left text-slate-700 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {unifiedInspections.filter(u=> historyTypeFilter==='all'||u.type===historyTypeFilter).slice(0,100).map(u=> 
                  <tr key={`${u.type}-${u.id}`} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer" onClick={()=>handleInspectionRowClick(u)}>
                    <td className="p-2 text-slate-800 dark:text-slate-200">{formatDate(u.inspectionDate)}</td>
                    <td className="p-2 capitalize text-slate-800 dark:text-slate-200">{u.type}</td>
                    <td className="p-2">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{u.itemName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{u.itemAutoId}</div>
                    </td>
                    <td className="p-2 text-slate-800 dark:text-slate-200">{u.groupName}</td>
                    <td className="p-2 text-slate-800 dark:text-slate-200">{u.inspectorName}</td>
                    <td className="p-2">
                      <Badge className={`text-xs ${statusColors[u.status]||''} dark:bg-opacity-30 dark:text-opacity-90`}>
                        {u.status}
                      </Badge>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">Record Inspection</h2>
            <form onSubmit={e=>{e.preventDefault(); const fd=new FormData(e.currentTarget); const item=selectedItems[0]; if(!item){toast.error('Select an item'); return;} item.type==='plant'? submitPlantInspection(fd): submitEquipmentInspection(fd)}}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Group Filter</label>
                  <select 
                    value={groupFilter} 
                    onChange={e=>setGroupFilter(e.target.value)} 
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm"
                  >
                    <option value="all">All</option>
                    {getGroups().map(g=> <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Item</label>
                  <select 
                    name="itemId" 
                    value={selectedItems[0]?.id||''} 
                    onChange={e=>{const it=allItems.find(i=>i.id===e.target.value); setSelectedItems(it?[it]:[])}} 
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" 
                    required
                  >
                    <option value="">Select item...</option>
                    {allItems.filter(i=> groupFilter==='all'||i.group===groupFilter).map(i=> <option key={i.id} value={i.id}>{i.name} ({i.autoId}) - {i.type}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Date</label>
                    <input 
                      type="date" 
                      name="inspectionDate" 
                      defaultValue={new Date().toISOString().split('T')[0]} 
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" 
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Inspector</label>
                    <input 
                      name="inspectorName" 
                      className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" 
                      required
                    />
                  </div>
                </div>
                {selectedItems[0] && (selectedItems[0].type==='plant'? <PlantInspectionFormSelector selectedItem={selectedItems[0] as any} /> : <EquipmentInspectionFormSelector selectedItem={selectedItems[0] as any} />)}
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Result</label>
                  <select 
                    name="status" 
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" 
                    required
                  >
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="needs_repair">Needs Repair</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Notes</label>
                  <textarea 
                    name="notes" 
                    rows={3} 
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={()=>{setShowForm(false); setSelectedItems([])}}
                  className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
                >
                  Record
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-slate-100">Bulk Inspection ({selectedItems.length})</h2>
            <form onSubmit={e=>{e.preventDefault(); const fd=new FormData(e.currentTarget); submitBulk(fd)}}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Date</label>
                  <input 
                    type="date" 
                    name="inspectionDate" 
                    defaultValue={new Date().toISOString().split('T')[0]} 
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Inspector</label>
                  <input 
                    name="inspectorName" 
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" 
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Status</label>
                  <select 
                    name="status" 
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm" 
                    required
                  >
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="conditional">Conditional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Notes</label>
                  <textarea 
                    name="notes" 
                    rows={3} 
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={()=>{setShowBulkForm(false)}}
                  className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white"
                >
                  Record {selectedItems.length}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInspectionView && selectedInspection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedInspection.itemName}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">{formatDate(selectedInspection.inspectionDate)} • {selectedInspection.inspectorName}</p>
              </div>
              <button 
                onClick={()=>{setShowInspectionView(false); setSelectedInspection(null)}} 
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              >
                <X className="h-6 w-6"/>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded">
                  <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Item Details</h3>
                  <div className="text-sm text-slate-700 dark:text-slate-300">ID: {selectedInspection.itemAutoId}</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300">Group: {selectedInspection.groupName}</div>
                  <div className="text-sm capitalize text-slate-700 dark:text-slate-300">Type: {selectedInspection.type}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded">
                  <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Status</h3>
                  <Badge className={`text-xs ${statusColors[selectedInspection.status]||''} dark:bg-opacity-30 dark:text-opacity-90`}>
                    {selectedInspection.status}
                  </Badge>
                  {selectedInspection.nextInspectionDate && 
                    <div className="text-sm mt-2 text-slate-700 dark:text-slate-300">
                      Next: {formatDate(selectedInspection.nextInspectionDate)}
                    </div>
                  }
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded">
                  <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Inspection</h3>
                  <div className="text-sm text-slate-700 dark:text-slate-300">Created: {formatDate(selectedInspection.createdAt)}</div>
                  <div className="text-sm text-slate-700 dark:text-slate-300">Inspector: {selectedInspection.inspectorName}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 p-3 rounded">
                  <h3 className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Notes</h3>
                  <div className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {selectedInspection.notes || '—'}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button 
                onClick={()=>{setShowInspectionView(false); setSelectedInspection(null)}} 
                variant="outline"
                className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
