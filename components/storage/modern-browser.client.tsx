"use client";

import { useEffect, useState, useCallback } from 'react';
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
  MenuIcon,
  XIcon,
  Loader2,
} from 'lucide-react';
import { getFileTypeIcon, getFileTypeColor } from '@/lib/file-icons';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  
  // Loading states for operations
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingItem, setRenamingItem] = useState(false);

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

  // Optimistic update helpers
  const addItemOptimistically = useCallback((newItem: StorageItem) => {
    setItems(current => [...current, newItem]);
  }, []);

  const updateItemOptimistically = useCallback((itemId: string, updates: Partial<StorageItem>) => {
    setItems(current => 
      current.map(item => 
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  }, []);

  const removeItemOptimistically = useCallback((itemId: string) => {
    setItems(current => current.filter(item => item.id !== itemId));
  }, []);

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
    
    setCreatingFolder(true);
    
    // Create optimistic folder item
    const tempId = `temp-${Date.now()}`;
    const optimisticFolder: StorageItem = {
      id: tempId,
      name,
      type: 'folder',
      parentId,
      organizationId,
      ownerUserId: 'current-user', // TODO: Get actual user ID
      size: 0,
      mimeType: null,
      visibility: newFolderVis,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add optimistically
    addItemOptimistically(optimisticFolder);
    
    try {
      const userIds = newFolderVis === 'custom' ? selectedMemberIds : undefined;
      const res = await fetch('/api/storage/folder', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        credentials: 'include', 
        body: JSON.stringify({ organizationId, parentId, name, visibility: newFolderVis, userIds }) 
      });
      const data = await res.json();
      
      if (!res.ok) {
        // Remove optimistic item on error
        removeItemOptimistically(tempId);
        toast.error(data.error || 'Failed to create folder');
        return;
      }
      
      // Replace optimistic item with real data
      updateItemOptimistically(tempId, { id: data.folder.id });
      
      toast.success('Folder created');
      setCreateOpen(false);
      setNewFolderName("");
      setSelectedMemberIds([]);
      setNewFolderVis('org');
    } catch (error) {
      // Remove optimistic item on error
      removeItemOptimistically(tempId);
      toast.error('Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
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
    
    setRenamingItem(true);
    
    // Store original name for rollback
    const originalName = renameOpenFor.name;
    
    // Update optimistically
    updateItemOptimistically(renameOpenFor.id, { name });
    
    try {
      const res = await fetch('/api/storage/rename', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        credentials: 'include', 
        body: JSON.stringify({ itemId: renameOpenFor.id, name, organizationId }) 
      });
      const data = await res.json();
      
      if (!res.ok) {
        // Rollback on error
        updateItemOptimistically(renameOpenFor.id, { name: originalName });
        toast.error(data.error || 'Failed to rename');
        return;
      }
      
      toast.success('Renamed successfully');
      setRenameOpenFor(null);
      setNewItemName("");
    } catch (error) {
      // Rollback on error
      updateItemOptimistically(renameOpenFor.id, { name: originalName });
      toast.error('Failed to rename');
    } finally {
      setRenamingItem(false);
    }
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
    <div className="min-h-screen bg-background p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 lg:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Storage
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Organise and share your files</p>
          </div>
        </div>

        {/* Navigation Breadcrumbs */}
  <Card className="p-3 sm:p-4 shadow-sm border bg-card/70 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStack([{ id: null, name: 'Home' }])}
                className="shrink-0"
              >
                <HomeIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Home</span>
              </Button>
              {stack.slice(1).map((folder, i) => (
                <div key={folder.id} className="flex items-center shrink-0">
                  <ChevronRightIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStack(stack.slice(0, i + 2))}
                    className="max-w-[120px] sm:max-w-none"
                  >
                    <span className="truncate text-xs sm:text-sm">{folder.name}</span>
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2 ml-2">
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-lg p-1 bg-muted">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <GridIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                >
                  <ListIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Toolbar */}
  <Card className="p-3 sm:p-4 shadow-sm border bg-card/70 backdrop-blur-sm">
          <div className="space-y-3 sm:space-y-4">
            {/* Mobile Menu Toggle */}
            <div className="flex items-center justify-between lg:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="h-9"
              >
                {mobileMenuOpen ? <XIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
                <span className="ml-2">Filters</span>
              </Button>
              
              <div className="flex items-center space-x-2">
                {selectedItems.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteItems(Array.from(selectedItems))}
                      className="shadow-sm h-9"
                    >
                    <Trash2Icon className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Delete ({selectedItems.size})</span>
                    <span className="sm:hidden">({selectedItems.size})</span>
                  </Button>
                )}

                <Dialog open={createOpen} onOpenChange={(open) => {
                  setCreateOpen(open);
                  if (!open) setCreatingFolder(false);
                }}>
                  <DialogTrigger asChild>
                    <Button className="shadow-sm h-9">
                      <PlusIcon className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">New Folder</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold">Create New Folder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Folder Name</label>
                        <Input 
                          value={newFolderName} 
                          onChange={(e) => setNewFolderName(e.target.value)} 
                          placeholder="Enter folder name"
                          className=""
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Visibility</label>
                        <Select value={newFolderVis} onValueChange={(v: 'org'|'private'|'custom') => setNewFolderVis(v)}>
                          <SelectTrigger className="border-border">
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
                          <label className="text-sm font-medium text-foreground mb-3 block">Select Members</label>
                          <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted">
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
                                  <p className="text-sm font-medium text-foreground">{member.name || 'Unnamed User'}</p>
                                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
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
                      <Button onClick={submitCreateFolder} disabled={creatingFolder}>
                        {creatingFolder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {creatingFolder ? 'Creating...' : 'Create Folder'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                  <DialogTrigger asChild>
        <Button variant="outline" className="shadow-sm h-9">
                      <UploadIcon className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Upload File</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold">Upload File</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
      <label className="text-sm font-medium text-foreground mb-2 block">Visibility</label>
                        <Select value={uploadVis} onValueChange={(v: 'org'|'private'|'custom') => setUploadVis(v)}>
        <SelectTrigger className="border-border">
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
        <label className="text-sm font-medium text-foreground mb-3 block">Select Members</label>
        <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted">
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
          <p className="text-sm font-medium text-foreground">{member.name || 'Unnamed User'}</p>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
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
        className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent file:text-accent-foreground hover:file:bg-accent/80"
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Desktop Toolbar */}
            <div className="hidden lg:flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-4 flex-1">
                {/* Search */}
                <div className="relative min-w-[300px]">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search files and folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Filters */}
                <Select value={visibilityFilter} onValueChange={(v: 'all' | 'org' | 'private' | 'custom') => setVisibilityFilter(v)}>
                  <SelectTrigger className="w-40 bg-background border-border">
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
                  <SelectTrigger className="w-40 bg-background border-border">
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

                <Dialog open={createOpen} onOpenChange={(open) => {
                  setCreateOpen(open);
                  if (!open) setCreatingFolder(false);
                }}>
                  <DialogTrigger asChild>
                    <Button className="shadow-sm">
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
                        <label className="text-sm font-medium text-foreground mb-2 block">Folder Name</label>
                        <Input 
                          value={newFolderName} 
                          onChange={(e) => setNewFolderName(e.target.value)} 
                          placeholder="Enter folder name"
                          className=""
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Visibility</label>
                        <Select value={newFolderVis} onValueChange={(v: 'org'|'private'|'custom') => setNewFolderVis(v)}>
                          <SelectTrigger className="border-border">
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
                          <label className="text-sm font-medium text-foreground mb-3 block">Select Members</label>
                          <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted">
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
                                  <p className="text-sm font-medium text-foreground">{member.name || 'Unnamed User'}</p>
                                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
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
                      <Button onClick={submitCreateFolder} disabled={creatingFolder}>
                        {creatingFolder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {creatingFolder ? 'Creating...' : 'Create Folder'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                  <DialogTrigger asChild>
        <Button variant="outline" className="shadow-sm">
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
      <label className="text-sm font-medium text-foreground mb-2 block">Visibility</label>
                        <Select value={uploadVis} onValueChange={(v: 'org'|'private'|'custom') => setUploadVis(v)}>
        <SelectTrigger className="border-border">
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
        <label className="text-sm font-medium text-foreground mb-3 block">Select Members</label>
        <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted">
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
          <p className="text-sm font-medium text-foreground">{member.name || 'Unnamed User'}</p>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
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
        className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent file:text-accent-foreground hover:file:bg-accent/80"
                        />
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Mobile Collapsible Filters */}
            {mobileMenuOpen && (
              <div className="lg:hidden space-y-4 border-t pt-4">
                {/* Search */}
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search files and folders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Filters */}
                  <Select value={visibilityFilter} onValueChange={(v: 'all' | 'org' | 'private' | 'custom') => setVisibilityFilter(v)}>
                    <SelectTrigger className="bg-background border-border">
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
                    <SelectTrigger className="bg-background border-border">
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
              </div>
            )}
          </div>
        </Card>

        {/* Content */}
  <Card className="shadow-sm border bg-card backdrop-blur-sm min-h-[400px] sm:min-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-32 sm:h-64">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 sm:h-64 text-muted-foreground px-4">
              <FolderIcon className="h-12 w-12 sm:h-16 sm:w-16 mb-4 text-muted-foreground/40" />
              <p className="text-base sm:text-lg font-medium">No items found</p>
              <p className="text-sm text-center">Create a folder or upload a file to get started</p>
            </div>
          ) : (
            <div className="p-3 sm:p-4 lg:p-6">
              {/* Select All Checkbox */}
              <div className="flex items-center mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-border">
                <Checkbox
                  checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                  onCheckedChange={selectAll}
                />
                <label className="ml-3 text-xs sm:text-sm font-medium text-foreground">
                  Select all ({filteredItems.length} items)
                </label>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="group relative">
                      <Card className="p-3 sm:p-4 hover:shadow-lg transition-all duration-200 border-border hover:border-primary/50 bg-card">
                        <div className="flex items-start space-x-2 sm:space-x-3">
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
                                  <FolderIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                                ) : (
                                  (() => {
                                    const Icon = getFileTypeIcon(item.name);
                                    const color = getFileTypeColor(item.mimeType);
                                    return <Icon className={`h-6 w-6 sm:h-8 sm:w-8 ${color}`} />;
                                  })()
                                )}
                              </div>
                              <h3 className="font-medium text-foreground truncate mb-1 text-sm sm:text-base">
                                {item.name}
                              </h3>
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                                <span className="capitalize">{item.type}</span>
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
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                  title="Share"
                                >
                                  <ShareIcon className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => showInfo(item)}
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                  title="Info"
                                >
                                  <InfoIcon className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => rename(item)}
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                  title="Rename"
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
                      <Card className="p-3 sm:p-4 hover:shadow-md transition-all duration-200 border-border hover:border-primary/50 bg-card">
                        <div className="flex items-center space-x-2 sm:space-x-4">
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={() => toggleSelection(item.id)}
                          />
                          <div 
                            className="flex items-center space-x-2 sm:space-x-3 flex-1 cursor-pointer min-w-0"
                            onClick={() => open(item)}
                          >
                            {item.type === 'folder' ? (
                              <FolderIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
                            ) : (
                              (() => {
                                const Icon = getFileTypeIcon(item.name);
                                const color = getFileTypeColor(item.mimeType);
                                return <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${color} shrink-0`} />;
                              })()
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-foreground truncate text-sm sm:text-base">
                                {item.name}
                              </h3>
                            </div>
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground min-w-0 hidden sm:block">
                            {item.size ? formatFileSize(item.size) : '—'}
                          </div>
                          <div className="hidden sm:block">
                            <VisibilityBadge visibility={item.visibility} />
                          </div>
                          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setShareOpenFor(item);
                                setShareVis(item.visibility);
                              }}
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                              title="Share"
                            >
                              <ShareIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => showInfo(item)}
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                              title="Info"
                            >
                              <InfoIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rename(item)}
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                              title="Rename"
                            >
                              <Edit3Icon className="h-3 w-3 sm:h-4 sm:w-4" />
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
          <DialogContent className="max-w-md mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold">
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
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShareOpenFor(null)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={submitShare} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                Update Sharing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={!!renameOpenFor} onOpenChange={(o) => {
          setRenameOpenFor(o ? renameOpenFor : null);
          if (!o) setRenamingItem(false);
        }}>
          <DialogContent className="max-w-md mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold">
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
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setRenameOpenFor(null)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button 
                onClick={submitRename} 
                className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                disabled={!newItemName.trim() || newItemName === renameOpenFor?.name || renamingItem}
              >
                {renamingItem && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {renamingItem ? 'Renaming...' : `Rename ${renameOpenFor?.type === 'folder' ? 'Folder' : 'File'}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Info Dialog */}
        <Dialog open={!!infoOpenFor} onOpenChange={(o) => setInfoOpenFor(o ? infoOpenFor : null)}>
          <DialogContent className="max-w-md mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold flex items-center gap-2">
                {infoOpenFor?.type === 'folder' ? (
                  <FolderIcon className="h-5 w-5 text-primary" />
                ) : (
                  (() => {
                    const Icon = getFileTypeIcon(infoOpenFor?.name || '');
                    const color = getFileTypeColor(infoOpenFor?.mimeType || null);
                    return <Icon className={`h-5 w-5 ${color}`} />;
                  })()
                )}
                <span className="truncate">{infoOpenFor?.name}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-muted-foreground font-medium">Type</label>
                  <p className="text-foreground capitalize">{infoOpenFor?.type}</p>
                </div>
                <div>
                  <label className="text-muted-foreground font-medium">Visibility</label>
                  <div className="mt-1">
                    <VisibilityBadge visibility={infoOpenFor?.visibility || 'private'} />
                  </div>
                </div>
                {infoOpenFor?.size && (
                    <div>
                      <label className="text-muted-foreground font-medium">Size</label>
                      <p className="text-foreground">{formatFileSize(infoOpenFor.size)}</p>
                    </div>
                )}
                {infoOpenFor?.mimeType && (
                  <div className="sm:col-span-2">
                    <label className="text-muted-foreground font-medium">Type</label>
                    <p className="text-foreground text-xs break-all">{infoOpenFor.mimeType}</p>
                  </div>
                )}
                <div>
                  <label className="text-muted-foreground font-medium">Created</label>
                  <p className="text-foreground text-xs">{formatDate(infoOpenFor?.createdAt)}</p>
                </div>
                <div>
                  <label className="text-muted-foreground font-medium">Modified</label>
                  <p className="text-foreground text-xs">{formatDate(infoOpenFor?.updatedAt || infoOpenFor?.createdAt)}</p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <label className="text-muted-foreground font-medium">Location</label>
                <div className="flex items-center mt-1 text-sm text-muted-foreground">
                  <HomeIcon className="h-4 w-4 mr-1 shrink-0" />
                  <div className="overflow-hidden">
                    {stack.slice(1).map((folder, i) => (
                      <span key={folder.id} className="inline-flex items-center">
                        {i > 0 && <ChevronRightIcon className="h-3 w-3 mx-1 shrink-0" />}
                        <span className="truncate">{folder.name}</span>
                      </span>
                    ))}
                    {stack.length === 1 && <span>Root</span>}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setInfoOpenFor(null)} className="w-full sm:w-auto">
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
