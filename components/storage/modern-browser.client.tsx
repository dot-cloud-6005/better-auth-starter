"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
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
import {
  FolderIcon,
  FileIcon,
  PlusIcon,
  UploadIcon,
  HomeIcon,
  ChevronRightIcon,
  ShareIcon,
  Edit3Icon,
  Trash2Icon,
  GridIcon,
  ListIcon,
  SearchIcon,
  FilterIcon,
  SortAscIcon,
  InfoIcon,
} from 'lucide-react';

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
  createdAt?: string;
  updatedAt?: string;
};

export type OrgMember = {
  id: string;
  name: string | null;
  email: string;
};

type ViewMode = 'grid' | 'list';
type SortBy = 'name' | 'type' | 'modified' | 'size';

export function ModernStorageBrowser({ organizationId }: { organizationId: string }) {
  const [stack, setStack] = useState<{ id: string | null; name: string }[]>([{ id: null, name: 'Home' }]);
  const [items, setItems] = useState<StorageItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<StorageItem[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'org' | 'private' | 'custom'>('all');

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [shareOpenFor, setShareOpenFor] = useState<StorageItem | null>(null);
  const [renameOpenFor, setRenameOpenFor] = useState<StorageItem | null>(null);
  const [infoOpenFor, setInfoOpenFor] = useState<StorageItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Form states
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderVis, setNewFolderVis] = useState<'org'|'private'|'custom'>("org");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [shareVis, setShareVis] = useState<'org'|'private'|'custom'>("org");
  const [shareSelectedIds, setShareSelectedIds] = useState<string[]>([]);
  const [uploadVis, setUploadVis] = useState<'org'|'private'|'custom'>("org");
  const [uploadSelectedIds, setUploadSelectedIds] = useState<string[]>([]);
  const [newItemName, setNewItemName] = useState("");

  const parentId = stack[stack.length - 1]?.id ?? null;

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/storage/members', { 
        method: 'POST', 
        body: JSON.stringify({ organizationId }), 
        headers: { 'Content-Type': 'application/json' }, 
        credentials: 'include' 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load members');
      setMembers(data.members);
    } catch (e: unknown) {
      console.error('Failed to fetch members:', e);
    }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/storage/list', { 
        method: 'POST', 
        body: JSON.stringify({ organizationId, parentId }), 
        headers: { 'Content-Type': 'application/json' }, 
        credentials: 'include' 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems(data.items);
      setSelectedItems(new Set());
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort items
  useEffect(() => {
    let filtered = [...items];
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply visibility filter
    if (visibilityFilter !== 'all') {
      filtered = filtered.filter(item => item.visibility === visibilityFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        case 'size':
          return (b.size || 0) - (a.size || 0);
        case 'modified':
          return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
        default:
          return 0;
      }
    });

    setFilteredItems(filtered);
  }, [items, searchQuery, visibilityFilter, sortBy]);

  useEffect(() => {
    refresh();
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, parentId]);

  const submitCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      toast.error('Folder name is required');
      return;
    }
    const userIds = newFolderVis === 'custom' ? selectedMemberIds : undefined;
    const res = await fetch('/api/storage/folder', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      credentials: 'include', 
      body: JSON.stringify({ organizationId, parentId, name, visibility: newFolderVis, userIds }) 
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed to create folder');
    toast.success('Folder created');
    setCreateOpen(false);
    setNewFolderName("");
    setSelectedMemberIds([]);
    setNewFolderVis('org');
    refresh();
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const userIds = uploadVis === 'custom' ? uploadSelectedIds : undefined;
    const fd = new FormData();
    fd.set('organizationId', organizationId);
    if (parentId) fd.set('parentId', parentId);
    fd.set('visibility', uploadVis);
    if (userIds?.length) fd.set('userIds', userIds.join(','));
    fd.set('file', file);
    
    const res = await fetch('/api/storage/upload', { method: 'POST', body: fd, credentials: 'include' });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Upload failed');
    toast.success('File uploaded successfully');
    setUploadOpen(false);
    setUploadVis('org');
    setUploadSelectedIds([]);
    refresh();
  };

  const submitShare = async () => {
    if (!shareOpenFor) return;
    const userIds = shareVis === 'custom' ? shareSelectedIds : undefined;
    const res = await fetch('/api/storage/visibility', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      credentials: 'include', 
      body: JSON.stringify({ itemId: shareOpenFor.id, visibility: shareVis, userIds, organizationId }) 
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed to update');
    toast.success('Sharing updated successfully');
    setShareOpenFor(null);
    setShareVis('org');
    setShareSelectedIds([]);
    refresh();
  };

  const rename = async (item: StorageItem) => {
    setRenameOpenFor(item);
    setNewItemName(item.name);
  };

  const submitRename = async () => {
    if (!renameOpenFor) return;
    const name = newItemName.trim();
    if (!name || name === renameOpenFor.name) {
      setRenameOpenFor(null);
      return;
    }
    
    const res = await fetch('/api/storage/rename', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      credentials: 'include', 
      body: JSON.stringify({ itemId: renameOpenFor.id, name, organizationId }) 
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed to rename');
    toast.success('Renamed successfully');
    setRenameOpenFor(null);
    setNewItemName("");
    refresh();
  };

  const showInfo = (item: StorageItem) => {
    setInfoOpenFor(item);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const deleteItems = async (itemIds: string[]) => {
    if (!confirm(`Delete ${itemIds.length} item${itemIds.length > 1 ? 's' : ''}?`)) return;
    
    const promises = itemIds.map(itemId => 
      fetch('/api/storage/delete', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        credentials: 'include', 
        body: JSON.stringify({ itemId, organizationId }) 
      })
    );
    
    const results = await Promise.all(promises);
    const failed = results.filter(r => !r.ok);
    
    if (failed.length > 0) {
      toast.error(`Failed to delete ${failed.length} item${failed.length > 1 ? 's' : ''}`);
    } else {
      toast.success('Items deleted successfully');
    }
    
    setSelectedItems(new Set());
    refresh();
  };

  const open = (item: StorageItem) => {
    if (item.type === 'folder') {
      setStack([...stack, { id: item.id, name: item.name }]);
    } else {
      window.open(`/api/storage/download?itemId=${item.id}&organizationId=${organizationId}`, '_blank');
    }
  };

  const toggleSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Storage
            </h1>
            <p className="text-slate-600 mt-1">Organise and share your files</p>
          </div>
        </div>

        {/* Navigation Breadcrumbs */}
        <Card className="p-4 shadow-sm border-0 bg-white/70 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStack([{ id: null, name: 'Home' }])}
                className="hover:bg-blue-100"
              >
                <HomeIcon className="h-4 w-4 mr-2" />
                Home
              </Button>
              {stack.slice(1).map((folder, i) => (
                <div key={folder.id} className="flex items-center">
                  <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStack(stack.slice(0, i + 2))}
                    className="hover:bg-blue-100"
                  >
                    {folder.name}
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex items-center space-x-2">
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-lg p-1 bg-slate-100">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 w-8 p-0"
                >
                  <GridIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 w-8 p-0"
                >
                  <ListIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Toolbar */}
        <Card className="p-4 shadow-sm border-0 bg-white/70 backdrop-blur-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4 flex-1">
              {/* Search */}
              <div className="relative min-w-[300px]">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-slate-200 focus:border-blue-500"
                />
              </div>

              {/* Filters */}
              <Select value={visibilityFilter} onValueChange={(v: 'all' | 'org' | 'private' | 'custom') => setVisibilityFilter(v)}>
                <SelectTrigger className="w-40 bg-white border-slate-200">
                  <FilterIcon className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
                  <SelectItem value="org">Organisation</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v: SortBy) => setSortBy(v)}>
                <SelectTrigger className="w-40 bg-white border-slate-200">
                  <SortAscIcon className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="modified">Modified</SelectItem>
                  <SelectItem value="size">Size</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              {selectedItems.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteItems(Array.from(selectedItems))}
                  className="shadow-sm"
                >
                  <Trash2Icon className="h-4 w-4 mr-2" />
                  Delete ({selectedItems.size})
                </Button>
              )}

              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="shadow-sm bg-blue-600 hover:bg-blue-700">
                    <PlusIcon className="h-4 w-4 mr-2" />
                    New Folder
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">Create New Folder</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">Folder Name</label>
                      <Input 
                        value={newFolderName} 
                        onChange={(e) => setNewFolderName(e.target.value)} 
                        placeholder="Enter folder name"
                        className="border-slate-200 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">Visibility</label>
                      <Select value={newFolderVis} onValueChange={(v: 'org'|'private'|'custom') => setNewFolderVis(v)}>
                        <SelectTrigger className="border-slate-200 focus:border-blue-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="org">🏢 All organisation members</SelectItem>
                          <SelectItem value="private">🔒 Just me</SelectItem>
                          <SelectItem value="custom">👥 Specific members</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newFolderVis === 'custom' && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-3 block">Select Members</label>
                        <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 bg-slate-50">
                          {members.map(member => (
                            <div key={member.id} className="flex items-center space-x-3">
                              <Checkbox
                                checked={selectedMemberIds.includes(member.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedMemberIds([...selectedMemberIds, member.id]);
                                  } else {
                                    setSelectedMemberIds(selectedMemberIds.filter(id => id !== member.id));
                                  }
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900">{member.name || 'Unnamed User'}</p>
                                <p className="text-xs text-slate-500 truncate">{member.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={submitCreateFolder} className="bg-blue-600 hover:bg-blue-700">
                      Create Folder
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="shadow-sm border-blue-200 hover:bg-blue-50">
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Upload File
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">Upload File</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="text-sm font-medium text-slate-700 mb-2 block">Visibility</label>
                      <Select value={uploadVis} onValueChange={(v: 'org'|'private'|'custom') => setUploadVis(v)}>
                        <SelectTrigger className="border-slate-200 focus:border-blue-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="org">🏢 All organisation members</SelectItem>
                          <SelectItem value="private">🔒 Just me</SelectItem>
                          <SelectItem value="custom">👥 Specific members</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {uploadVis === 'custom' && (
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-3 block">Select Members</label>
                        <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 bg-slate-50">
                          {members.map(member => (
                            <div key={member.id} className="flex items-center space-x-3">
                              <Checkbox
                                checked={uploadSelectedIds.includes(member.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setUploadSelectedIds([...uploadSelectedIds, member.id]);
                                  } else {
                                    setUploadSelectedIds(uploadSelectedIds.filter(id => id !== member.id));
                                  }
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900">{member.name || 'Unnamed User'}</p>
                                <p className="text-xs text-slate-500 truncate">{member.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        onChange={onUpload}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </Card>

        {/* Content */}
        <Card className="shadow-sm border-0 bg-white/70 backdrop-blur-sm min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
              <FolderIcon className="h-16 w-16 mb-4 text-slate-300" />
              <p className="text-lg font-medium">No items found</p>
              <p className="text-sm">Create a folder or upload a file to get started</p>
            </div>
          ) : (
            <div className="p-6">
              {/* Select All Checkbox */}
              <div className="flex items-center mb-4 pb-4 border-b border-slate-200">
                <Checkbox
                  checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                  onCheckedChange={selectAll}
                />
                <label className="ml-3 text-sm font-medium text-slate-700">
                  Select all ({filteredItems.length} items)
                </label>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="group relative">
                      <Card className="p-4 hover:shadow-lg transition-all duration-200 border-slate-200 hover:border-blue-300 bg-white">
                        <div className="flex items-start space-x-3">
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleSelection(item.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div 
                              className="cursor-pointer"
                              onClick={() => open(item)}
                            >
                              <div className="flex items-center mb-2">
                                {item.type === 'folder' ? (
                                  <FolderIcon className="h-8 w-8 text-blue-500" />
                                ) : (
                                  <FileIcon className="h-8 w-8 text-slate-500" />
                                )}
                              </div>
                              <h3 className="font-medium text-slate-900 truncate mb-1">
                                {item.name}
                              </h3>
                              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                <span>{item.type}</span>
                                {item.size && <span>{formatFileSize(item.size)}</span>}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <VisibilityBadge visibility={item.visibility} />
                              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setShareOpenFor(item);
                                    setShareVis(item.visibility);
                                  }}
                                  className="h-8 w-8 p-0"
                                >
                                  <ShareIcon className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => showInfo(item)}
                                  className="h-8 w-8 p-0"
                                >
                                  <InfoIcon className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => rename(item)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit3Icon className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="group">
                      <Card className="p-4 hover:shadow-md transition-all duration-200 border-slate-200 hover:border-blue-300 bg-white">
                        <div className="flex items-center space-x-4">
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleSelection(item.id)}
                          />
                          <div 
                            className="flex items-center space-x-3 flex-1 cursor-pointer"
                            onClick={() => open(item)}
                          >
                            {item.type === 'folder' ? (
                              <FolderIcon className="h-6 w-6 text-blue-500" />
                            ) : (
                              <FileIcon className="h-6 w-6 text-slate-500" />
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-slate-900 truncate">
                                {item.name}
                              </h3>
                            </div>
                          </div>
                          <div className="text-sm text-slate-500 min-w-0">
                            {item.size ? formatFileSize(item.size) : '—'}
                          </div>
                          <VisibilityBadge visibility={item.visibility} />
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShareOpenFor(item);
                                setShareVis(item.visibility);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <ShareIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => showInfo(item)}
                              className="h-8 w-8 p-0"
                            >
                              <InfoIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rename(item)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit3Icon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Share Dialog */}
        <Dialog open={!!shareOpenFor} onOpenChange={(o) => setShareOpenFor(o ? shareOpenFor : null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Share &quot;{shareOpenFor?.name}&quot;
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Visibility</label>
                <Select value={shareVis} onValueChange={(v: 'org'|'private'|'custom') => setShareVis(v)}>
                  <SelectTrigger className="border-slate-200 focus:border-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org">🏢 All organisation members</SelectItem>
                    <SelectItem value="private">🔒 Just me</SelectItem>
                    <SelectItem value="custom">👥 Specific members</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {shareVis === 'custom' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-3 block">Select Members</label>
                  <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 bg-slate-50">
                    {members.map(member => (
                      <div key={member.id} className="flex items-center space-x-3">
                        <Checkbox
                          checked={shareSelectedIds.includes(member.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setShareSelectedIds([...shareSelectedIds, member.id]);
                            } else {
                              setShareSelectedIds(shareSelectedIds.filter(id => id !== member.id));
                            }
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{member.name || 'Unnamed User'}</p>
                          <p className="text-xs text-slate-500 truncate">{member.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShareOpenFor(null)}>
                Cancel
              </Button>
              <Button onClick={submitShare} className="bg-blue-600 hover:bg-blue-700">
                Update Sharing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={!!renameOpenFor} onOpenChange={(o) => setRenameOpenFor(o ? renameOpenFor : null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                Rename &quot;{renameOpenFor?.name}&quot;
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  {renameOpenFor?.type === 'folder' ? 'Folder Name' : 'File Name'}
                </label>
                <Input 
                  value={newItemName} 
                  onChange={(e) => setNewItemName(e.target.value)} 
                  placeholder={`Enter ${renameOpenFor?.type || 'item'} name`}
                  className="border-slate-200 focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitRename();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameOpenFor(null)}>
                Cancel
              </Button>
              <Button 
                onClick={submitRename} 
                className="bg-blue-600 hover:bg-blue-700"
                disabled={!newItemName.trim() || newItemName === renameOpenFor?.name}
              >
                Rename {renameOpenFor?.type === 'folder' ? 'Folder' : 'File'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Info Dialog */}
        <Dialog open={!!infoOpenFor} onOpenChange={(o) => setInfoOpenFor(o ? infoOpenFor : null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                {infoOpenFor?.type === 'folder' ? (
                  <FolderIcon className="h-5 w-5 text-blue-500" />
                ) : (
                  <FileIcon className="h-5 w-5 text-slate-500" />
                )}
                {infoOpenFor?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-slate-600 font-medium">Type</label>
                  <p className="text-slate-900 capitalize">{infoOpenFor?.type}</p>
                </div>
                <div>
                  <label className="text-slate-600 font-medium">Visibility</label>
                  <div className="mt-1">
                    <VisibilityBadge visibility={infoOpenFor?.visibility || 'private'} />
                  </div>
                </div>
                {infoOpenFor?.size && (
                  <div>
                    <label className="text-slate-600 font-medium">Size</label>
                    <p className="text-slate-900">{formatFileSize(infoOpenFor.size)}</p>
                  </div>
                )}
                {infoOpenFor?.mimeType && (
                  <div>
                    <label className="text-slate-600 font-medium">Type</label>
                    <p className="text-slate-900 text-xs">{infoOpenFor.mimeType}</p>
                  </div>
                )}
                <div>
                  <label className="text-slate-600 font-medium">Created</label>
                  <p className="text-slate-900 text-xs">{formatDate(infoOpenFor?.createdAt)}</p>
                </div>
                <div>
                  <label className="text-slate-600 font-medium">Modified</label>
                  <p className="text-slate-900 text-xs">{formatDate(infoOpenFor?.updatedAt || infoOpenFor?.createdAt)}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <label className="text-slate-600 font-medium">Location</label>
                <div className="flex items-center mt-1 text-sm text-slate-600">
                  <HomeIcon className="h-4 w-4 mr-1" />
                  {stack.slice(1).map((folder, i) => (
                    <span key={folder.id}>
                      {i > 0 && <ChevronRightIcon className="h-3 w-3 mx-1" />}
                      {folder.name}
                    </span>
                  ))}
                  {stack.length === 1 && <span>Root</span>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setInfoOpenFor(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
