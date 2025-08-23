"use client";
import { startRegistration } from '@simplewebauthn/browser';
import { useState, useCallback } from 'react';
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
      const beginRes = await fetch('/api/auth/passkey/register-begin', { method: 'POST' });
      if (!beginRes.ok) throw new Error('Failed to start');
      const { options } = await beginRes.json();
      const attestation = await startRegistration(options);
      const complete = await fetch('/api/auth/passkey/register-complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(attestation) });
      if (!complete.ok) throw new Error('Passkey registration failed');
      toast.success('Passkey added');
      setJustAdded(true);
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
