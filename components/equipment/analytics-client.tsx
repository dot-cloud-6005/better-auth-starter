// Client-side analytics visualization component extracted from original page
// Accepts pre-fetched, organization-scoped data from server component

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { Equipment } from '@/types/equipment/equipment'
import { Plant } from '@/types/equipment/plant'
import { UnifiedInspection } from '@/lib/equipment/actions/unified-inspections'
import {
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface AnalyticsClientProps {
  equipment: Equipment[]
  plant: Plant[]
  unifiedInspections: UnifiedInspection[]
  unifiedStats: any
}

export function AnalyticsClient({ equipment, plant, unifiedInspections, unifiedStats }: AnalyticsClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedItems, setSelectedItems] = useState<(Equipment | Plant)[]>([])
  const [trendsTimeRange, setTrendsTimeRange] = useState<'1month' | '6month' | '1year' | 'all'>('6month')
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('status')
  const [dataType, setDataType] = useState<'equipment' | 'plant'>('equipment')

  const getCurrentItems = () => dataType === 'equipment' ? equipment : plant
  const getCurrentInspections = () => unifiedInspections.filter(i => i.type === dataType)

  const statusData = [
    { name: 'Compliant', value: getCurrentItems().filter(item => item.status === 'compliant').length, color: '#10b981' },
    { name: 'Upcoming', value: getCurrentItems().filter(item => item.status === 'upcoming').length, color: '#f59e0b' },
    { name: 'Overdue', value: getCurrentItems().filter(item => item.status === 'overdue').length, color: '#ef4444' },
  ]

  const getGroupData = () => {
    if (dataType === 'equipment') {
      return [
        { name: 'PFD', total: equipment.filter(eq => eq.groupName === 'PFD').length },
        { name: 'Heights Safety', total: equipment.filter(eq => eq.groupName === 'Heights Safety').length },
        { name: 'Fire', total: equipment.filter(eq => eq.groupName === 'Fire').length },
        { name: 'First Aid', total: equipment.filter(eq => eq.groupName === 'First Aid').length },
        { name: 'Racking', total: equipment.filter(eq => eq.groupName === 'Racking').length },
        { name: 'Other', total: equipment.filter(eq => eq.groupName === 'Other').length },
      ].filter(group => group.total > 0).sort((a, b) => b.total - a.total)
    } else {
      return [
        { name: 'Vehicle', total: plant.filter(p => p.groupName === 'Vehicle').length },
        { name: 'Truck', total: plant.filter(p => p.groupName === 'Truck').length },
        { name: 'Trailer', total: plant.filter(p => p.groupName === 'Trailer').length },
        { name: 'Vessel', total: plant.filter(p => p.groupName === 'Vessel').length },
        { name: 'Petrol Plant', total: plant.filter(p => p.groupName === 'Petrol Plant').length },
      ].filter(group => group.total > 0).sort((a, b) => b.total - a.total)
    }
  }

  const getScheduleData = () => {
    if (dataType === 'equipment') {
      return [
        { name: 'Monthly', total: equipment.filter(eq => eq.scheduleName === 'Monthly').length },
        { name: 'Quarterly', total: equipment.filter(eq => eq.scheduleName === 'Quarterly').length },
        { name: '6-Monthly', total: equipment.filter(eq => eq.scheduleName === '6-Monthly').length },
        { name: 'Annual', total: equipment.filter(eq => eq.scheduleName === 'Annual').length },
        { name: 'Biennial', total: equipment.filter(eq => eq.scheduleName === 'Biennial').length },
      ].filter(schedule => schedule.total > 0).sort((a, b) => b.total - a.total)
    } else {
      const vehiclesWithService = plant.filter(p => ['Vehicle', 'Truck'].includes(p.groupName || ''))
      const vesselsWithSurvey = plant.filter(p => p.groupName === 'Vessel' && p.vesselSurveyDueDate)
      const hiabEquipped = plant.filter(p => p.hiabFitted)
      return [
        { name: 'Vehicle Service Due', total: vehiclesWithService.filter(p => p.serviceDueDate).length, subtitle: `of ${vehiclesWithService.length} vehicles/trucks` },
        { name: 'Vessel Survey Due', total: vesselsWithSurvey.length, subtitle: `of ${plant.filter(p => p.groupName === 'Vessel').length} vessels` },
        { name: 'HIAB Service Due', total: hiabEquipped.filter(p => p.hiabServiceDueDate).length, subtitle: `of ${hiabEquipped.length} HIAB equipped` },
        { name: 'Certificate of Operation', total: plant.filter(p => p.certificateOfOperationDueDate).length, subtitle: 'items with certificates' },
      ].filter(item => item.total > 0).sort((a, b) => b.total - a.total)
    }
  }

  const getTrendData = () => {
    const now = new Date()
    let periods: { label: string; fullDate: Date }[] = []
    switch (trendsTimeRange) {
      case '1month':
        for (let i = 3; i >= 0; i--) { const date = new Date(now); date.setDate(date.getDate() - (i * 7)); periods.push({ label: `Week ${4 - i}`, fullDate: date }) }
        break
      case '6month':
        for (let i = 5; i >= 0; i--) { const date = new Date(now); date.setMonth(date.getMonth() - i); periods.push({ label: date.toLocaleString('default', { month: 'short', year: '2-digit' }), fullDate: date }) }
        break
      case '1year':
        for (let i = 11; i >= 0; i--) { const date = new Date(now); date.setMonth(date.getMonth() - i); periods.push({ label: date.toLocaleString('default', { month: 'short', year: '2-digit' }), fullDate: date }) }
        break
      case 'all':
        const allDates = getCurrentInspections().map(i => new Date(i.inspectionDate)).sort((a, b) => a.getTime() - b.getTime())
        if (allDates.length) {
          const earliest = allDates[0]
          const months = Math.ceil((now.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24 * 30))
          for (let i = Math.min(months, 24); i >= 0; i--) { const date = new Date(now); date.setMonth(date.getMonth() - i); periods.push({ label: date.toLocaleString('default', { month: 'short', year: '2-digit' }), fullDate: date }) }
        }
        break
    }
    return periods.map(({ label, fullDate }, index) => {
      let periodStart: Date
      let periodEnd: Date
      if (trendsTimeRange === '1month') { periodStart = new Date(fullDate); periodEnd = new Date(fullDate); periodEnd.setDate(periodEnd.getDate() + 6) }
      else { periodStart = new Date(fullDate.getFullYear(), fullDate.getMonth(), 1); periodEnd = new Date(fullDate.getFullYear(), fullDate.getMonth() + 1, 0) }
      const inspectionsInPeriod = getCurrentInspections().filter(i => { const d = new Date(i.inspectionDate); return d >= periodStart && d <= periodEnd }).length
      return { period: label, inspections: inspectionsInPeriod, key: `${dataType}-${fullDate.getFullYear()}-${fullDate.getMonth()}-${index}` }
    })
  }

  const getComplianceTrendData = () => {
    const trendData = getTrendData()
    return trendData.map(p => {
      const items = getCurrentItems()
      const total = items.length
      const compliant = items.filter(i => i.status === 'compliant').length
      return { period: p.period, complianceRate: total ? Math.round((compliant / total) * 100) : 100, totalItems: total, compliantItems: compliant, key: p.key }
    })
  }

  const getEnhancedStats = () => {
    const items = getCurrentItems()
    const inspections = getCurrentInspections()
    const base = { complianceRate: items.length ? Math.round((items.filter(i => i.status === 'compliant').length / items.length) * 100) : 0, overdueCount: items.filter(i => i.status === 'overdue').length }
    if (dataType === 'equipment') {
      const scheduleData = getScheduleData()
      return { ...base, type: 'equipment' as const, averageSchedule: scheduleData.length ? scheduleData.find(s => s.total === Math.max(...scheduleData.map(i => i.total)))?.name || 'N/A' : 'N/A', totalInspections: inspections.length, thisMonthInspections: unifiedStats?.thisMonth?.equipment || 0, thisWeekInspections: unifiedStats?.thisWeek?.equipment || 0 }
    } else {
      const vehicles = plant.filter(p => ['Vehicle', 'Truck'].includes(p.groupName || ''))
      const withServiceDates = plant.filter(p => p.serviceDueDate).length
      return { ...base, type: 'plant' as const, serviceSchedule: `${withServiceDates}/${plant.length}`, totalServices: inspections.length, thisMonthServices: unifiedStats?.thisMonth?.plant || 0, thisWeekServices: unifiedStats?.thisWeek?.plant || 0, vehicleFleetSize: vehicles.length, hiabCount: plant.filter(p => p.hiabFitted).length }
    }
  }

  const getInsights = () => {
    const stats = getEnhancedStats() as any
    const groupData = getGroupData()
    const scheduleData = getScheduleData()
    if (stats.type === 'equipment') {
      return {
        primary: stats.complianceRate >= 90 ? `Excellent compliance rate of ${stats.complianceRate}%!` : stats.complianceRate >= 70 ? `Good compliance rate of ${stats.complianceRate}%. Review overdue items.` : `Compliance rate of ${stats.complianceRate}% needs attention.` ,
        secondary: groupData.length ? `${groupData[0].name} is your largest equipment group with ${groupData[0].total} items.` : 'No equipment groups found.',
        trend: stats.thisMonthInspections > 0 ? `${stats.thisMonthInspections} inspections completed this month.` : 'No inspections recorded this month.',
        schedule: scheduleData.length ? `Most equipment follows ${scheduleData[0].name.toLowerCase()} inspection schedules.` : 'No inspection schedules defined.'
      }
    } else {
      return {
        primary: stats.complianceRate >= 90 ? `Excellent service compliance rate of ${stats.complianceRate}%!` : stats.complianceRate >= 70 ? `Good service compliance rate of ${stats.complianceRate}%.` : `Service compliance rate of ${stats.complianceRate}% needs attention.` ,
        secondary: groupData.length ? `${groupData[0].name} is your largest plant group with ${groupData[0].total} items.` : 'No plant groups found.',
        trend: stats.thisMonthServices > 0 ? `${stats.thisMonthServices} services completed this month.` : 'No services recorded this month.',
        fleet: stats.vehicleFleetSize > 0 ? `Managing ${stats.vehicleFleetSize} vehicles/trucks${stats.hiabCount ? ` (${stats.hiabCount} with HIAB)` : ''}.` : 'No vehicles in fleet.'
      }
    }
  }

  const handleTabChange = (tab: string) => { setActiveTab(tab); setMobileDropdownOpen(false) }
  const handlePieClick = (data: any) => {
    setSelectedStatus(data.name)
    const map: Record<string, string> = { Compliant: 'compliant', Upcoming: 'upcoming', Overdue: 'overdue' }
    const actual = map[data.name] || data.name
    const filtered = getCurrentItems().filter(item => item.status === actual)
    setSelectedItems(filtered)
    setModalOpen(true)
  }

  const groupData = getGroupData()
  const scheduleData = getScheduleData()
  const inspectionTrendData = getTrendData()
  const complianceTrendData = getComplianceTrendData()
  const enhancedStats = getEnhancedStats()
  const insights = getInsights()

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Analytics</h1>
          <p className="text-slate-600 dark:text-slate-400">{dataType === 'equipment' ? 'Equipment compliance analytics and trends' : 'Plant service analytics and trends'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 dark:text-slate-400">View:</span>
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button onClick={() => setDataType('equipment')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${dataType === 'equipment' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>Equipment</button>
            <button onClick={() => setDataType('plant')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${dataType === 'plant' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}>Plant</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-slate-900 dark:text-slate-100 text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500" />Compliance Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{getCurrentItems().length ? Math.round((getCurrentItems().filter(i => i.status === 'compliant').length / getCurrentItems().length) * 100) : 0}%</div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Of your {dataType} is currently compliant</p>
          </CardContent>
        </Card>
        <Card className="bg-white/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-slate-900 dark:text-slate-100 text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600 dark:text-blue-500" />{dataType === 'equipment' ? 'Average Inspection Interval' : 'Service Schedule'}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{dataType === 'equipment' ? (scheduleData.find(s => s.total === Math.max(...scheduleData.map(i => i.total)))?.name || 'N/A') : `${plant.filter(p => p.serviceDueDate).length}/${plant.length}`}</div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">{dataType === 'equipment' ? 'Most common inspection frequency' : 'Items with service dates'}</p>
          </CardContent>
        </Card>
        <Card className="bg-white/80 dark:bg-slate-900/80 border-slate-300 dark:border-slate-800 shadow-md">
          <CardHeader className="pb-2"><CardTitle className="text-slate-900 dark:text-slate-100 text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />Attention Needed</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{getCurrentItems().filter(i => i.status === 'overdue').length}</div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">{dataType === 'equipment' ? 'Items currently overdue for inspection' : 'Items currently overdue for service'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="bg-white/80 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 shadow-md rounded-lg p-6">
        <TabsList className="hidden md:grid grid-cols-5 gap-4 mb-6">
          <TabsTrigger value="status" className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white">Status Overview</TabsTrigger>
          <TabsTrigger value="groups" className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white">{dataType === 'equipment' ? 'Equipment Groups' : 'Plant Groups'}</TabsTrigger>
          <TabsTrigger value="trends" className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white">{dataType === 'equipment' ? 'Inspection Trends' : 'Service Trends'}</TabsTrigger>
          <TabsTrigger value="compliance" className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white">Compliance Trends</TabsTrigger>
          <TabsTrigger value="schedule" className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 data-[state=active]:bg-blue-600 data-[state=active]:text-white">{dataType === 'equipment' ? 'Schedule Distribution' : 'Service Overview'}</TabsTrigger>
        </TabsList>
        <div className="md:hidden mb-6" id="mobile-dropdown">
          <div className="relative">
            <button onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md flex items-center justify-between">
              <span>{activeTab === 'status' && 'Status Overview'}{activeTab === 'groups' && (dataType === 'equipment' ? 'Equipment Groups' : 'Plant Groups')}{activeTab === 'trends' && (dataType === 'equipment' ? 'Inspection Trends' : 'Service Trends')}{activeTab === 'compliance' && 'Compliance Trends'}{activeTab === 'schedule' && (dataType === 'equipment' ? 'Schedule Distribution' : 'Service Overview')}</span>
              <svg className={`w-4 h-4 transition-transform ${mobileDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {mobileDropdownOpen && (
              <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md shadow-lg mt-1 z-10">
                {['status','groups','trends','compliance','schedule'].map(t => (
                  <button key={t} onClick={() => handleTabChange(t)} className={`w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 ${activeTab === t ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{t === 'status' && 'Status Overview'}{t === 'groups' && (dataType === 'equipment' ? 'Equipment Groups' : 'Plant Groups')}{t === 'trends' && (dataType === 'equipment' ? 'Inspection Trends' : 'Service Trends')}{t === 'compliance' && 'Compliance Trends'}{t === 'schedule' && (dataType === 'equipment' ? 'Schedule Distribution' : 'Service Overview')}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <TabsContent value="status" className="mt-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Current {dataType === 'equipment' ? 'Equipment' : 'Plant'} Status</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 italic">Click on the pie chart sections to view the list of equipment for each status</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-center h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie width={400} height={400}>
                  <Pie data={statusData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`} onClick={handlePieClick} style={{ cursor: 'pointer' }}>
                    {statusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 23, 23, 0.8)', borderColor: '#333', color: 'white' }} />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-slate-900 dark:text-slate-100 font-medium mb-4">Status Breakdown</h4>
              <div className="space-y-4">
                {statusData.map(status => (
                  <div key={status.name} className="flex justify-between items-center">
                    <div className="flex items-center"><div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: status.color }}></div><span className="text-slate-800 dark:text-slate-200">{status.name}</span></div>
                    <div className="flex items-center gap-2"><span className="font-medium text-slate-900 dark:text-slate-100">{status.value}</span><span className="text-sm text-slate-500 dark:text-slate-400">({getCurrentItems().length ? Math.round((status.value / getCurrentItems().length) * 100) : 0}%)</span></div>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-md p-4 mt-6"><h5 className="text-blue-800 dark:text-blue-300 font-medium mb-2">Insights:</h5><p className="text-blue-700 dark:text-blue-400 text-sm">{statusData[0].name === 'Compliant' && statusData[0].value > 0 ? `${statusData[0].value} items are compliant. Maintain your current inspection schedule to keep compliance high.` : 'Focus on scheduling inspections for overdue equipment to improve your compliance rate.'}</p></div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="groups" className="mt-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{dataType === 'equipment' ? 'Equipment by Group' : 'Plant by Group'}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getGroupData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 23, 23, 0.8)', borderColor: '#333', color: 'white' }} />
                <Bar dataKey="total" name="Equipment Count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
        <TabsContent value="trends" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Inspection Trends</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Time Range:</span>
              <select 
                value={trendsTimeRange} 
                onChange={e => setTrendsTimeRange(e.target.value as any)} 
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1month">Last Month (Weekly)</option>
                <option value="6month">Last 6 Months</option>
                <option value="1year">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLine data={getTrendData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="period" angle={trendsTimeRange === 'all' ? -45 : 0} textAnchor={trendsTimeRange === 'all' ? 'end' : 'middle'} height={trendsTimeRange === 'all' ? 60 : 30} stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 23, 23, 0.8)', borderColor: '#333', color: 'white' }} />
                <Legend />
                <Line type="monotone" dataKey="inspections" name="Inspections Performed" stroke="#3b82f6" activeDot={{ r: 8 }} strokeWidth={2} />
              </RechartsLine>
            </ResponsiveContainer>
          </div>
        </TabsContent>
        <TabsContent value="compliance" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Compliance Trends</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-slate-400">Time Range:</span>
              <select 
                value={trendsTimeRange} 
                onChange={e => setTrendsTimeRange(e.target.value as any)} 
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1month">Last Month (Weekly)</option>
                <option value="6month">Last 6 Months</option>
                <option value="1year">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsLine data={getComplianceTrendData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="period" angle={trendsTimeRange === 'all' ? -45 : 0} textAnchor={trendsTimeRange === 'all' ? 'end' : 'middle'} height={trendsTimeRange === 'all' ? 60 : 30} stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 23, 23, 0.8)', borderColor: '#333', color: 'white' }} />
                <Legend />
                <Line type="monotone" dataKey="complianceRate" name="Compliance Rate %" stroke="#10b981" activeDot={{ r: 8 }} strokeWidth={2} />
              </RechartsLine>
            </ResponsiveContainer>
          </div>
        </TabsContent>
        <TabsContent value="schedule" className="mt-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">{dataType === 'equipment' ? 'Inspection Schedule Distribution' : 'Service Overview'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-center h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getScheduleData()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="name" type="category" width={90} stroke="#9ca3af" />
                  <Legend />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(23, 23, 23, 0.8)', borderColor: '#333', color: 'white' }} />
                  <Bar dataKey="total" name="Equipment Count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-slate-900 dark:text-slate-100 font-medium mb-4">Schedule Insights</h4>
              <div className="space-y-4">
                {getScheduleData().map(schedule => (
                  <div key={schedule.name} className="flex justify-between items-center">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-purple-600 dark:text-purple-500 mr-2" />
                      <span className="text-slate-800 dark:text-slate-200">{schedule.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{schedule.total}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">({equipment.length ? Math.round((schedule.total / equipment.length) * 100) : 0}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${selectedStatus} ${dataType === 'equipment' ? 'Equipment' : 'Plant'} (${selectedItems.length} items)`}>
        <div className="space-y-4">
          {selectedItems.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-slate-700">
                    <th className="text-left font-medium text-slate-700 dark:text-slate-300 pb-2">{dataType === 'equipment' ? 'Equipment' : 'Plant'}</th>
                    <th className="text-left font-medium text-slate-700 dark:text-slate-300 pb-2">Group</th>
                    <th className="text-left font-medium text-slate-700 dark:text-slate-300 pb-2">Location</th>
                    <th className="text-left font-medium text-slate-700 dark:text-slate-300 pb-2">{dataType === 'equipment' ? 'Last Inspection' : 'Last Service'}</th>
                    <th className="text-left font-medium text-slate-700 dark:text-slate-300 pb-2">{dataType === 'equipment' ? 'Next Due' : 'Service Due'}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItems.map(item => (
                    <tr key={item.id} className="border-b dark:border-slate-700">
                      <td className="py-2 text-slate-800 dark:text-slate-200">{item.name}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-400">{'groupName' in item ? item.groupName || 'N/A' : 'N/A'}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-400">{(item as any).location || 'N/A'}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-400">{dataType === 'equipment' ? (('lastInspection' in item) && (item as any).lastInspection ? new Date((item as any).lastInspection).toLocaleDateString() : 'Never') : 'N/A'}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-400">{dataType === 'equipment' ? (('nextInspection' in item) && (item as any).nextInspection ? new Date((item as any).nextInspection).toLocaleDateString() : 'N/A') : (('serviceDueDate' in item) && (item as any).serviceDueDate ? new Date((item as any).serviceDueDate).toLocaleDateString() : 'N/A')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (<p className="text-slate-600 dark:text-slate-400">No {dataType} found for this status.</p>)}
        </div>
      </Modal>
    </div>
  )
}

interface ModalProps { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800 transform translate-y-0">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default AnalyticsClient
