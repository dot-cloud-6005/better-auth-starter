"use client";
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PasskeyMeta {
  id: string;
  credentialId: string;
  transports: string[];
  deviceType: string | null;
  backedUp: boolean | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export function PasskeyList() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PasskeyMeta[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res: any = await authClient.passkey.listUserPasskeys();
      const passkeys = res?.data?.passkeys ?? res?.data ?? [];
      if (!Array.isArray(passkeys)) throw new Error(res?.error?.message || 'Failed to load passkeys');
      const norm = passkeys.map((p: any) => ({
        id: p.id,
        credentialId: p.credentialID || p.credentialId || p.id,
        transports: (Array.isArray(p.transports) ? p.transports : (typeof p.transports === 'string' ? p.transports.split(',') : []))
          .filter(Boolean),
        deviceType: p.deviceType || null,
        backedUp: p.backedUp ?? null,
        createdAt: p.createdAt || new Date().toISOString(),
        lastUsedAt: p.lastUsedAt || null,
      }));
      setItems(norm.sort((a,b) => a.createdAt.localeCompare(b.createdAt)));
    } catch (e: any) {
      toast.error(e.message || 'Could not load passkeys');
    } finally { setLoading(false); }
  }

  async function remove(credentialId: string) {
    if (!confirm('Remove this passkey?')) return;
    setRemoving(credentialId);
    try {
      const target = items.find(i => i.credentialId === credentialId);
      if (!target) throw new Error('Unknown passkey');
      const res: any = await authClient.passkey.deletePasskey({ id: target.id });
      if (!res?.data?.success) throw new Error(res?.error?.message || 'Delete failed');
      toast.success('Passkey removed');
      setItems(prev => prev.filter(p => p.credentialId !== credentialId));
    } catch (e:any) { toast.error(e.message || 'Failed removing'); } finally { setRemoving(null); }
  }

  useEffect(() => {
    load();
    function onRefresh() { load(); }
    window.addEventListener('passkey:refresh', onRefresh);
    return () => window.removeEventListener('passkey:refresh', onRefresh);
  }, []);

  if (loading) return <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Loading passkeys…</div>;
  if (!items.length) return <p className="text-xs text-muted-foreground">No passkeys registered yet.</p>;

  return (
    <ul className="space-y-2">
      {items.map(p => (
        <li key={p.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs bg-muted/40 dark:bg-neutral-800">
          <div className="space-y-0.5 overflow-hidden">
            <div className="font-medium truncate max-w-[220px]" title={p.credentialId}>{p.credentialId}</div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2">
              <span>Added {new Date(p.createdAt).toLocaleDateString()}</span>
              {p.lastUsedAt && <span>Last used {new Date(p.lastUsedAt).toLocaleDateString()}</span>}
              {p.deviceType && <span>{p.deviceType}</span>}
              {p.backedUp && <span>Backed up</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" disabled={removing===p.credentialId} onClick={() => remove(p.credentialId)} className="hover:text-red-600">
            {removing===p.credentialId ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4"/>}
          </Button>
        </li>
      ))}
    </ul>
  );
}
