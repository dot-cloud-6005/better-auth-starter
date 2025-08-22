'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Phone, Edit, Save, X, Trash2 } from 'lucide-react';

interface User {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: {
    display_name?: string;
  };
  created_at: string;
  phone_confirmed_at?: string;
  email_confirmed_at?: string;
}

interface UserRowProps {
  user: User;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (displayName: string) => void;
  onDelete: () => void;
}

export function UserRow({ 
  user, 
  isEditing, 
  onEdit, 
  onCancelEdit, 
  onSave, 
  onDelete 
}: UserRowProps) {
  const [displayName, setDisplayName] = useState(user.user_metadata?.display_name || '');
  
  const handleSave = () => {
    onSave(displayName);
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
            {(user.user_metadata?.display_name || user.email || 'U')[0].toUpperCase()}
          </div>
          <div>
            {isEditing ? (
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
                className="w-40"
              />
            ) : (
              <div>
                <p className="font-medium text-slate-900">
                  {user.user_metadata?.display_name || 'No name set'}
                </p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone className="h-3 w-3" />
            {user.phone || 'No phone'}
          </div>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="space-y-1">
          <Badge 
            variant={user.phone_confirmed_at ? "default" : "secondary"}
            className={user.phone_confirmed_at ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}
          >
            {user.phone_confirmed_at ? 'Verified' : 'Pending'}
          </Badge>
        </div>
      </td>
      <td className="py-4 px-4">
        <p className="text-sm text-slate-600">
          {new Date(user.created_at).toLocaleDateString()}
        </p>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleSave}>
                <Save className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// Export the User type for reuse
export type { User };