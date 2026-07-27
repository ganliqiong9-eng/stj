const API_BASE = `http://${window.location.hostname}:8086`;

function getDeviceToken(): string {
  let token = localStorage.getItem('sync_device_token');
  if (!token) {
    // Generate and register a new token
    token = crypto.randomUUID();
    localStorage.setItem('sync_device_token', token);
    // Async registration
    fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: navigator.platform || 'unknown' })
    }).then(r => r.json()).then(d => {
      if (d.token) localStorage.setItem('sync_device_token', d.token);
    }).catch(() => {});
  }
  return token;
}

const headers = () => ({
  'Content-Type': 'application/json',
  'x-device-token': getDeviceToken(),
  'x-device-name': navigator.platform || 'unknown',
});

export async function syncUpload(progress: Record<string, boolean>, stars: Record<string, boolean>, notes: any[]) {
  try {
    const res = await fetch(`${API_BASE}/api/sync`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ progress, stars, notes }),
    });
    return res.ok;
  } catch { return false; }
}

export async function syncDownload(): Promise<{ progress: Record<string, boolean>; stars: Record<string, boolean>; notes: any[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/sync`, { headers: headers() });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}
