'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Activity, 
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Mail,
  Shield,
  Database
} from 'lucide-react';

interface SystemLog {
  id: string;
  event_type: string;
  user_email?: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface SystemSettingsProps {
  systemLogs: SystemLog[];
  onRefreshLogs: () => void;
}

export function SystemSettings({ systemLogs, onRefreshLogs }: SystemSettingsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshLogs();
    setIsRefreshing(false);
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'user_login':
      case 'user_logout':
        return <User className="h-4 w-4 text-blue-500" />;
      case 'user_created':
        return <User className="h-4 w-4 text-green-500" />;
      case 'admin_action':
        return <Shield className="h-4 w-4 text-orange-500" />;
      case 'email_sent':
        return <Mail className="h-4 w-4 text-purple-500" />;
      case 'system_error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'data_export':
        return <Download className="h-4 w-4 text-indigo-500" />;
      case 'inspection_created':
      case 'equipment_created':
      case 'plant_service':
        return <Database className="h-4 w-4 text-emerald-500" />;
      default:
        return <Activity className="h-4 w-4 text-slate-500" />;
    }
  };

  const getEventBadgeColor = (eventType: string) => {
    switch (eventType) {
      case 'system_error':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'admin_action':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'user_created':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'email_sent':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">System Status</p>
                <p className="text-lg font-semibold text-green-700">Operational</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Recent Activity</p>
                <p className="text-lg font-semibold text-slate-900">{systemLogs.length} events</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Database</p>
                <p className="text-lg font-semibold text-green-700">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Activity Log
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                Recent system events and user activities
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systemLogs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No system logs available</p>
              </div>
            ) : (
              systemLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                  <div className="flex-shrink-0 mt-1">
                    {getEventIcon(log.event_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getEventBadgeColor(log.event_type)}`}
                      >
                        {log.event_type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <span className="text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-900 mb-1">{log.description}</p>
                    
                    {log.user_email && (
                      <p className="text-xs text-slate-600">
                        User: {log.user_email}
                      </p>
                    )}
                    
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                          View details
                        </summary>
                        <pre className="text-xs text-slate-600 mt-1 bg-white p-2 rounded border overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="justify-start h-auto p-4">
              <Download className="h-4 w-4 mr-3" />
              <div className="text-left">
                <div className="font-medium">Export System Logs</div>
                <div className="text-sm text-slate-500">Download recent activity logs</div>
              </div>
            </Button>
            
            <Button variant="outline" className="justify-start h-auto p-4">
              <Database className="h-4 w-4 mr-3" />
              <div className="text-left">
                <div className="font-medium">Database Backup</div>
                <div className="text-sm text-slate-500">Create system backup</div>
              </div>
            </Button>
            
            <Button variant="outline" className="justify-start h-auto p-4">
              <RefreshCw className="h-4 w-4 mr-3" />
              <div className="text-left">
                <div className="font-medium">Refresh Cache</div>
                <div className="text-sm text-slate-500">Clear system cache</div>
              </div>
            </Button>
            
            <Button variant="outline" className="justify-start h-auto p-4">
              <Activity className="h-4 w-4 mr-3" />
              <div className="text-left">
                <div className="font-medium">System Health Check</div>
                <div className="text-sm text-slate-500">Run diagnostic tests</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}