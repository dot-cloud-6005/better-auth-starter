/* 'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Anchor, Flame, Heart, Package, Settings, MapPin, Calendar, Edit, Trash2 } from 'lucide-react';
import { Equipment } from '@/types/equipment';

interface EquipmentListProps {
  equipment: Equipment[];
}

const groupIcons = {
  PFD: Anchor,
  'Heights Safety': Shield,
  Fire: Flame,
  'First Aid': Heart,
  Racking: Package,
  Other: Settings
};

const statusColors = {
  compliant: 'bg-green-500',
  upcoming: 'bg-yellow-500',
  overdue: 'bg-red-500'
};

const statusLabels = {
  compliant: 'Compliant',
  upcoming: 'Upcoming',
  overdue: 'Overdue'
};

const EquipmentList = ({ equipment }: EquipmentListProps) => {
  if (equipment.length === 0) {
    return (
      <Card className="bg-slate-600/50 border-slate-500">
        <CardContent className="p-8 text-center">
          <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Equipment Found</h3>
          <p className="text-slate-300">Try adjusting your search criteria or add some equipment to get started.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {equipment.map((item) => {
        const Icon = groupIcons[item.group];
        const daysUntilInspection = Math.ceil((item.nextInspection.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        return (
          <Card key={item.id} className="bg-slate-600/50 border-slate-500 hover:bg-slate-600/70 transition-colors">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-500 rounded-lg">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-white text-lg">{item.name}</CardTitle>
                    <CardDescription className="text-slate-200 flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs bg-slate-500 text-white border-slate-400">
                        {item.autoId}
                      </Badge>
                      <Badge variant="secondary" className="text-xs bg-slate-500 text-white border-slate-400">
                        {item.group}
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${statusColors[item.status]} text-white`}>
                    {statusLabels[item.status]}
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-500">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-slate-300 hover:text-red-400 hover:bg-slate-500">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="h-4 w-4" />
                    <span>Schedule: {item.schedule}</span>
                  </div>
                  {item.location && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <MapPin className="h-4 w-4" />
                      <span>Location: {item.location}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="text-slate-300">
                    <span className="font-medium">Last Inspection:</span>
                    <div className="text-white">
                      {item.lastInspection ? item.lastInspection.toLocaleDateString() : 'Never'}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-slate-300">
                    <span className="font-medium">Next Inspection:</span>
                    <div className={`font-medium ${
                      item.status === 'overdue' ? 'text-red-400' : 
                      item.status === 'upcoming' ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {item.nextInspection.toLocaleDateString()}
                      {daysUntilInspection < 0 ? 
                        ` (${Math.abs(daysUntilInspection)} days overdue)` :
                        ` (${daysUntilInspection} days)`
                      }
                    </div>
                  </div>
                </div>
              </div>
              {item.description && (
                <div className="mt-4 p-3 bg-slate-700 rounded-lg">
                  <p className="text-slate-200 text-sm">{item.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default EquipmentList; */