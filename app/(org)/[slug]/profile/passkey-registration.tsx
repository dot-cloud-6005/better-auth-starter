"use client";
import { useState, useCallback } from 'react';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PasskeyRegistration() {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  // feature detect
  if (typeof window !== 'undefined' && supported === null) {
    const ok = !!window.PublicKeyCredential && typeof window.PublicKeyCredential === 'function';
    if (ok) setSupported(true); else setSupported(false);
  }

  const register = useCallback(async () => {
    setLoading(true);
    setJustAdded(false);
    try {
      const res: any = await authClient.passkey.addPasskey();
      if (!res?.data?.success) throw new Error(res?.error?.message || 'Passkey registration failed');
      toast.success('Passkey added');
      setJustAdded(true);
      // Notify any listeners (e.g., PasskeyList) to refresh without full page reload
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('passkey:refresh'));
      }
    } catch (e: any) {
      toast.error(e.message || 'Error adding passkey');
    } finally {
      setLoading(false);
    }
  }, []);

  if (supported === false) {
    return <p className="text-xs text-muted-foreground">This browser does not support WebAuthn / Passkeys.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Register a device-based passkey for faster, phishing-resistant sign-in.</p>
  <Button type="button" size="sm" disabled={loading} onClick={register}>
        {loading ? 'Adding…' : 'Add Passkey'}
      </Button>
      {justAdded && <p className="text-xs text-green-600 dark:text-green-400">Passkey registered.</p>}
    </div>
  );
}
