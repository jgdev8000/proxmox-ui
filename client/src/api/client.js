const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:expired'));
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (username, password, realm) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, realm }),
    }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  getVMs: () => request('/vms'),
  getVM: (node, type, vmid) => request(`/vms/${node}/${type}/${vmid}`),
  getRRD: (node, type, vmid, timeframe = 'hour') =>
    request(`/vms/${node}/${type}/${vmid}/rrddata?timeframe=${timeframe}`),
  vmAction: (node, type, vmid, action) =>
    request(`/vms/${node}/${type}/${vmid}/${action}`, { method: 'POST' }),

  getConsoleTicket: (node, type, vmid) =>
    request(`/console/${node}/${type}/${vmid}`, { method: 'POST' }),

  // Admin
  admin: {
    getUsers: () => request('/admin/users'),
    createUser: (userid, password, comment) =>
      request('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ userid, password, comment }),
      }),
    deleteUser: (userid) =>
      request(`/admin/users/${encodeURIComponent(userid)}`, { method: 'DELETE' }),
    changePassword: (userid, password) =>
      request(`/admin/users/${encodeURIComponent(userid)}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
      }),
    getVMs: () => request('/admin/vms'),
    getACLs: () => request('/admin/acls'),
    setACL: (path, users, roles) =>
      request('/admin/acls', {
        method: 'PUT',
        body: JSON.stringify({ path, users, roles }),
      }),
    removeACL: (path, users, roles) =>
      request('/admin/acls', {
        method: 'DELETE',
        body: JSON.stringify({ path, users, roles }),
      }),
    uploadLogo: async (userid, file) => {
      const form = new FormData();
      form.append('logo', file);
      const res = await fetch(`${BASE}/admin/users/${encodeURIComponent(userid)}/logo`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Upload failed');
      }
      return res.json();
    },
    deleteLogo: (userid) =>
      request(`/admin/users/${encodeURIComponent(userid)}/logo`, { method: 'DELETE' }),
  },
};
