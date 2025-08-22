'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Package, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Calendar,
  Truck
} from 'lucide-react'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Equipment } from '@/types/equipment/equipment'
import { Plant } from '@/types/equipment/plant'

export default function DashboardPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [plant, setPlant] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)

  // Safe date formatter for Date | string | undefined
  const fmtDate = (v?: Date | string) => {
    if (!v) return ''
    const d = typeof v === 'string' ? new Date(v) : v
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString()
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [eqRes, plantRes] = await Promise.all([
        fetch(`/api/equipment?slug=${encodeURIComponent(String(slug))}`, { cache: 'no-store' }),
        fetch(`/api/plant?slug=${encodeURIComponent(String(slug))}`, { cache: 'no-store' })
      ])
      const eqJson = await eqRes.json()
      const plantJson = await plantRes.json()
      if (eqRes.ok && Array.isArray(eqJson.data)) setEquipment(eqJson.data)
      if (plantRes.ok && Array.isArray(plantJson.data)) setPlant(plantJson.data)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Equipment stats
  const equipmentStats = {
    total: equipment.length,
    compliant: equipment.filter(eq => eq.status === 'compliant').length,
    upcoming: equipment.filter(eq => eq.status === 'upcoming').length,
    overdue: equipment.filter(eq => eq.status === 'overdue').length,
  }

  // Plant stats
  const plantStats = {
    total: plant.length,
    compliant: plant.filter(p => p.status === 'compliant').length,
    upcoming: plant.filter(p => p.status === 'upcoming').length,
    overdue: plant.filter(p => p.status === 'overdue').length,
  }

  // Combined stats
  const totalStats = {
    total: equipmentStats.total + plantStats.total,
    compliant: equipmentStats.compliant + plantStats.compliant,
    upcoming: equipmentStats.upcoming + plantStats.upcoming,
    overdue: equipmentStats.overdue + plantStats.overdue,
  }

  const recentInspections = equipment
    .filter(eq => eq.lastInspection)
    .sort((a, b) => new Date(b.lastInspection!).getTime() - new Date(a.lastInspection!).getTime())
    .slice(0, 5)

  const upcomingInspections = equipment
    .filter(eq => eq.status === 'upcoming')
    .sort((a, b) => new Date(a.nextInspection).getTime() - new Date(b.nextInspection).getTime())
    .slice(0, 3)

  const upcomingServices = plant
    .filter(p => p.status === 'upcoming' && p.serviceDueDate)
    .sort((a, b) => new Date(a.serviceDueDate!).getTime() - new Date(b.serviceDueDate!).getTime())
    .slice(0, 2)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-800">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-4 sm:space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1 sm:mb-2">Dashboard</h1>
          <p className="text-sm sm:text-base text-slate-600">Overview of your equipment and plant compliance status</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href={`/${slug}/equipment`}>
            <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm">
              <Package className="h-4 w-4 mr-2" />
              <span className="sm:inline">Manage Equipment</span>
              <span className="sm:hidden">Equipment</span>
            </Button>
          </Link>
          <Link href={`/${slug}/plant`}>
            <Button className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white text-sm">
              <Truck className="h-4 w-4 mr-2" />
              <span className="sm:inline">Manage Plant</span>
              <span className="sm:hidden">Plant</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card className="bg-white/80 border-slate-200 shadow-md">
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800 text-xs sm:text-sm">Total Items</CardTitle>
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-3xl font-bold text-slate-900">{totalStats.total}</div>
            <p className="text-slate-600 text-xs sm:text-sm">Equipment & Plant</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200 shadow-md">
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800 text-xs sm:text-sm">Compliant</CardTitle>
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-3xl font-bold text-green-600">{totalStats.compliant}</div>
            <p className="text-slate-600 text-xs sm:text-sm">Up to date</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200 shadow-md">
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800 text-xs sm:text-sm">Upcoming</CardTitle>
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-3xl font-bold text-amber-600">{totalStats.upcoming}</div>
            <p className="text-slate-600 text-xs sm:text-sm">Due soon</p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200 shadow-md">
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800 text-xs sm:text-sm">Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-3xl font-bold text-red-600">{totalStats.overdue}</div>
            <p className="text-slate-600 text-xs sm:text-sm">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Equipment vs Plant Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="bg-white/80 border-slate-200 shadow-md">
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <Package className="h-4 w-4 sm:h-5 sm:w-5" />
                Equipment Status
              </CardTitle>
              <Link href={`/${slug}/equipment`}>
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs sm:text-sm">
                  <span className="hidden sm:inline">View All</span>
                  <span className="sm:hidden">View</span>
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{equipmentStats.total}</div>
                <div className="text-xs sm:text-sm text-slate-600">Total Equipment</div>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs sm:text-sm text-green-600">Compliant</span>
                  <span className="text-xs sm:text-sm font-medium">{equipmentStats.compliant}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs sm:text-sm text-amber-600">Upcoming</span>
                  <span className="text-xs sm:text-sm font-medium">{equipmentStats.upcoming}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs sm:text-sm text-red-600">Overdue</span>
                  <span className="text-xs sm:text-sm font-medium">{equipmentStats.overdue}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200 shadow-md">
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5" />
                Plant Status
              </CardTitle>
              <Link href={`/${slug}/plant`}>
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs sm:text-sm">
                  <span className="hidden sm:inline">View All</span>
                  <span className="sm:hidden">View</span>
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
                <div className="text-xl sm:text-2xl font-bold text-slate-900">{plantStats.total}</div>
                <div className="text-xs sm:text-sm text-slate-600">Total Plant</div>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs sm:text-sm text-green-600">Compliant</span>
                  <span className="text-xs sm:text-sm font-medium">{plantStats.compliant}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs sm:text-sm text-amber-600">Upcoming</span>
                  <span className="text-xs sm:text-sm font-medium">{plantStats.upcoming}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs sm:text-sm text-red-600">Overdue</span>
                  <span className="text-xs sm:text-sm font-medium">{plantStats.overdue}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity - Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="bg-white/80 border-slate-200 shadow-md">
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800 text-sm sm:text-base">Recent Inspections</CardTitle>
              <Link href={`/${slug}/inspections`}>
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs sm:text-sm">
                  <span className="hidden sm:inline">View All</span>
                  <span className="sm:hidden">View</span>
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 sm:space-y-3">
              {recentInspections.length > 0 ? (
                recentInspections.map((equipment) => (
                  <div key={equipment.id} className="flex items-center justify-between p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-800 font-medium text-sm sm:text-base truncate">{equipment.name}</div>
                      <div className="text-slate-600 text-xs sm:text-sm">{equipment.autoId}</div>
                    </div>
                    <div className="text-right ml-2">
                      <div className="text-slate-600 text-xs sm:text-sm">
                        {fmtDate(equipment.lastInspection)}   {/* was equipment.lastInspection?.toLocaleDateString() */}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-center py-4 text-sm">No recent inspections</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 border-slate-200 shadow-md">
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-800 text-sm sm:text-base">Upcoming Due Dates</CardTitle>
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs sm:text-sm">
                <span className="hidden sm:inline">View All</span>
                <span className="sm:hidden">View</span>
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 sm:space-y-3">
              {/* Equipment Inspections */}
              {upcomingInspections.map((equipment) => (
                <div key={`eq-${equipment.id}`} className="flex items-center justify-between p-2 sm:p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-800 font-medium text-sm sm:text-base truncate">{equipment.name}</div>
                    <div className="text-slate-600 text-xs sm:text-sm flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      <span className="truncate">Equipment - {equipment.autoId}</span>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-amber-600 text-xs sm:text-sm font-medium">
                      {fmtDate(equipment.nextInspection)}  {/* was equipment.nextInspection.toLocaleDateString() */}
                    </div>
                    <div className="text-xs text-slate-500">Inspection</div>
                  </div>
                </div>
              ))}
              {/* Plant Services */}
              {upcomingServices.map((plantItem) => (
                <div key={`plant-${plantItem.id}`} className="flex items-center justify-between p-2 sm:p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="min-w-0 flex-1">
                    <div className="text-slate-800 font-medium text-sm sm:text-base truncate">{plantItem.name}</div>
                    <div className="text-slate-600 text-xs sm:text-sm flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      <span className="truncate">{plantItem.groupName} - {plantItem.autoId}</span>
                    </div>
                  </div>
                  <div className="text-right ml-2">
                    <div className="text-amber-600 text-xs sm:text-sm font-medium">
                      {fmtDate(plantItem.serviceDueDate)}  {/* was plantItem.serviceDueDate?.toLocaleDateString() */}
                    </div>
                    <div className="text-xs text-slate-500">Service</div>
                  </div>
                </div>
              ))}
              
              {upcomingInspections.length === 0 && upcomingServices.length === 0 && (
                <div className="text-slate-500 text-center py-4 text-sm">No upcoming due dates</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-white/80 border-slate-200 shadow-md">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-slate-800 text-sm sm:text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Link href={`/${slug}/equipment`}>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm">
                <Package className="h-4 w-4 mr-2" />
                Manage Equipment
              </Button>
            </Link>
            <Link href={`/${slug}/plant`}>
              <Button className="w-full bg-orange-600 hover:bg-orange-700 text-white text-sm">
                <Truck className="h-4 w-4 mr-2" />
                Manage Plant
              </Button>
            </Link>
            <Link href={`/${slug}/analytics`}>
              <Button className="w-full bg-green-600 hover:bg-green-700 text-white text-sm sm:col-span-2 lg:col-span-1">
                <TrendingUp className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
            </Link>            
          </div>
        </CardContent>
      </Card>
    </div>
  )
}