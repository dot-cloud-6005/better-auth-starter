"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type StorageItem = {
  id: string;
  name: string;
  type: 'folder' | 'file';
  parentId: string | null;
  organizationId: string;
  ownerUserId: string;
  size: number | null;
  mimeType: string | null;
  visibility: 'org' | 'private' | 'custom';
};

export function StorageBrowser({ organizationId }: { organizationId: string }) {
  const [stack, setStack] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Root' }]);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpenFor, setShareOpenFor] = useState<StorageItem | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderVis, setNewFolderVis] = useState<'org'|'private'|'custom'>("org");
  const [newFolderUserIds, setNewFolderUserIds] = useState("");
  const [shareVis, setShareVis] = useState<'org'|'private'|'custom'>("org");
  const [shareUserIds, setShareUserIds] = useState("");
  const parentId = stack[stack.length - 1]?.id ?? null;

  const refresh = async () => {
    setLoading(true);
    try {
  const res = await fetch('/api/storage/list', { method: 'POST', body: JSON.stringify({ organizationId, parentId }), headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, parentId]);

  const submitCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.error('Folder name is required');
      return;
    }
    const userIds = newFolderVis === 'custom' ? newFolderUserIds.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const res = await fetch('/api/storage/folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ organizationId, parentId, name, visibility: newFolderVis, userIds }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed to create folder');
    toast.success('Folder created');
    setCreateOpen(false);
    setNewFolderName("");
    setNewFolderUserIds("");
    setNewFolderVis('org');
    refresh();
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const visibility = (prompt('Visibility: org | private | custom', 'org') || 'org') as 'org'|'private'|'custom';
    const userIds = visibility === 'custom' ? (prompt('Comma-separated user IDs allowed?') || '').split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const fd = new FormData();
    fd.set('organizationId', organizationId);
    if (parentId) fd.set('parentId', parentId);
    fd.set('visibility', visibility);
    if (userIds?.length) fd.set('userIds', userIds.join(','));
    fd.set('file', file);
  const res = await fetch('/api/storage/upload', { method: 'POST', body: fd, credentials: 'include' });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Upload failed');
    toast.success('Uploaded');
    refresh();
  };

  const rename = async (item: StorageItem) => {
    const name = prompt('Rename to:', item.name);
    if (!name || name === item.name) return;
  const res = await fetch('/api/storage/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ itemId: item.id, name, organizationId }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed to rename');
    toast.success('Renamed');
    refresh();
  };

  const del = async (item: StorageItem) => {
    if (!confirm(`Delete ${item.name}?`)) return;
  const res = await fetch('/api/storage/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ itemId: item.id, organizationId }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Delete failed');
    toast.success('Deleted');
    refresh();
  };

  const submitShare = async () => {
    if (!shareOpenFor) return;
    const userIds = shareVis === 'custom' ? shareUserIds.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const res = await fetch('/api/storage/visibility', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ itemId: shareOpenFor.id, visibility: shareVis, userIds, organizationId }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed to update');
    toast.success('Updated');
    setShareOpenFor(null);
    refresh();
  };

  const open = (item: StorageItem) => {
    if (item.type === 'folder') {
      setStack([...stack, { id: item.id, name: item.name }]);
    } else {
      window.open(`/api/storage/download?itemId=${item.id}&organizationId=${organizationId}`, '_blank');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setStack([{ id: null, name: 'Root' }])}>Home</Button>
        {stack.slice(1).map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span>/</span>
            <Button variant="ghost" onClick={() => setStack(stack.slice(0, i + 2))}>{s.name}</Button>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setCreateOpen(true)}>New Folder</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create folder</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Name</label>
                  <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g. Project docs" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Visibility</label>
                  <Select value={newFolderVis} onValueChange={(v: 'org'|'private'|'custom') => setNewFolderVis(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="org">All org members</SelectItem>
                      <SelectItem value="private">Just me</SelectItem>
                      <SelectItem value="custom">Specific users</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newFolderVis === 'custom' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Allowed user IDs (comma-separated)</label>
                    <Input value={newFolderUserIds} onChange={(e) => setNewFolderUserIds(e.target.value)} placeholder="uid1, uid2" />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={submitCreateFolder}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <label className="inline-flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm hover:bg-accent">
            <span>Upload</span>
            <input type="file" onChange={onUpload} className="hidden" />
          </label>
        </div>
      </div>
      <Card className="p-3">
        {loading ? (
          <div>Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground">Empty</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((it) => (
              <div key={it.id} className="border rounded p-3 hover:bg-accent/30 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div onClick={() => open(it)}>
                    <div className="font-medium">{it.type === 'folder' ? '📁' : '📄'} {it.name}</div>
                    <div className="text-xs text-muted-foreground">{it.visibility.toUpperCase()}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => rename(it)}>Rename</Button>
                    <Button size="sm" variant="secondary" onClick={() => {
                      setShareOpenFor(it);
                      setShareVis(it.visibility);
                      setShareUserIds("");
                    }}>Share</Button>
                    <Button size="sm" variant="destructive" onClick={() => del(it)}>Delete</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Share dialog */}
      <Dialog open={!!shareOpenFor} onOpenChange={(o) => setShareOpenFor(o ? shareOpenFor : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share “{shareOpenFor?.name}”</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Visibility</label>
              <Select value={shareVis} onValueChange={(v: 'org'|'private'|'custom') => setShareVis(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org">All org members</SelectItem>
                  <SelectItem value="private">Just me</SelectItem>
                  <SelectItem value="custom">Specific users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {shareVis === 'custom' && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Allowed user IDs (comma-separated)</label>
                <Input value={shareUserIds} onChange={(e) => setShareUserIds(e.target.value)} placeholder="uid1, uid2" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={submitShare}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
