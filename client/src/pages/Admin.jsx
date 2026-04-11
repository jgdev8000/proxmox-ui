import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

// ── Modals ──

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [username, setUsername] = useState('');
  const [realm, setRealm] = useState('pve');
  const [password, setPassword] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.admin.createUser(`${username}@${realm}`, password, comment);
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Create User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">{error}</div>}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Username</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="john" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Realm</label>
          <select value={realm} onChange={(e) => setRealm(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <option value="pve">Proxmox VE (pve)</option>
            <option value="pam">Linux PAM (pam)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={5}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Comment</label>
          <input type="text" value={comment} onChange={(e) => setComment(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" placeholder="Full name or description" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer disabled:opacity-50">
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChangePasswordModal({ userid, onClose }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.admin.changePassword(userid, password);
      setSuccess(true);
      setTimeout(onClose, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Change Password — ${userid}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm border border-green-200">Password changed</div>}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">New Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={5}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
          <button type="submit" disabled={loading || success}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer disabled:opacity-50">
            {loading ? 'Saving...' : 'Change Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssignVMsModal({ userid, onClose }) {
  const [vms, setVMs] = useState([]);
  const [acls, setACLs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [role, setRole] = useState('PVEVMUser');

  const fetchData = useCallback(async () => {
    try {
      const [vmData, aclData] = await Promise.all([
        api.admin.getVMs(),
        api.admin.getACLs(),
      ]);
      setVMs(vmData.sort((a, b) => a.vmid - b.vmid));
      setACLs(aclData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userACLs = acls.filter((a) => a.ugid === userid && a.type === 'user');
  const assignedPaths = new Set(userACLs.map((a) => a.path));

  const isAssigned = (vm) => {
    const type = vm.type === 'lxc' ? 'lxc' : 'qemu';
    return assignedPaths.has(`/vms/${vm.vmid}`);
  };

  const toggleVM = async (vm) => {
    setActing(true);
    const vmPath = `/vms/${vm.vmid}`;
    try {
      if (isAssigned(vm)) {
        const acl = userACLs.find((a) => a.path === vmPath);
        await api.admin.removeACL(vmPath, userid, acl?.roleid || role);
      } else {
        await api.admin.setACL(vmPath, userid, role);
      }
      await fetchData();
    } catch (err) {
      alert(err.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <Modal title={`Assign VMs — ${userid}`} onClose={onClose}>
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full" />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Assign VMs — ${userid}`} onClose={onClose}>
      <div className="mb-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Role for new assignments</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
          <option value="PVEVMUser">PVEVMUser (console + power)</option>
          <option value="PVEVMAdmin">PVEVMAdmin (full control)</option>
          <option value="PVEAuditor">PVEAuditor (view only)</option>
        </select>
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {vms.map((vm) => {
          const assigned = isAssigned(vm);
          const acl = userACLs.find((a) => a.path === `/vms/${vm.vmid}`);
          return (
            <label key={vm.vmid}
              className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${assigned ? 'bg-blue-50' : 'hover:bg-gray-50'} ${acting ? 'opacity-50 pointer-events-none' : ''}`}>
              <input type="checkbox" checked={assigned} onChange={() => toggleVM(vm)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900">{vm.name || `VM ${vm.vmid}`}</span>
                <span className="text-xs text-gray-400 ml-2">({vm.vmid})</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${vm.status === 'running' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {vm.status}
              </span>
              {acl && <span className="text-[10px] text-gray-400">{acl.roleid}</span>}
            </label>
          );
        })}
      </div>
      <div className="flex justify-end pt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer">Done</button>
      </div>
    </Modal>
  );
}

// ── Main Admin Page ──

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [assignUser, setAssignUser] = useState(null);
  const fileInputRef = useRef(null);
  const [logoTarget, setLogoTarget] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.admin.getUsers();
      setUsers(data.sort((a, b) => (a.userid || '').localeCompare(b.userid || '')));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const deleteUser = async (userid) => {
    if (!confirm(`Delete user ${userid}? This cannot be undone.`)) return;
    try {
      await api.admin.deleteUser(userid);
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogoClick = (userid) => {
    setLogoTarget(userid);
    fileInputRef.current?.click();
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !logoTarget) return;
    try {
      await api.admin.uploadLogo(logoTarget, file);
      alert('Logo uploaded');
    } catch (err) {
      alert(err.message);
    }
    e.target.value = '';
    setLogoTarget(null);
  };

  const deleteLogo = async (userid) => {
    try {
      await api.admin.deleteLogo(userid);
      alert('Logo removed');
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-7 h-7 border-2 border-gray-200 border-t-blue-600 rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-400 mt-1">Create accounts, assign VMs, and manage access</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create User
        </button>
      </div>

      <input type="file" ref={fileInputRef} accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleLogoUpload} />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-gray-200">
              <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">User</th>
              <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Realm</th>
              <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Comment</th>
              <th className="py-3 px-5 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => {
              const username = u.userid?.split('@')[0];
              const realm = u.userid?.split('@')[1];
              return (
                <tr key={u.userid} className={`border-t border-gray-100 hover:bg-blue-50/40 transition-colors ${i % 2 === 1 ? 'bg-slate-50/70' : ''}`}>
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden">
                        <img
                          src={`/logos/${username}.png`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = ''; }}
                        />
                        <span style={{ display: 'none' }}>{(username || '?').slice(0, 2).toUpperCase()}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{username}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5">
                    <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded">{realm}</span>
                  </td>
                  <td className="py-3.5 px-5 text-sm text-gray-500">{u.comment || '-'}</td>
                  <td className="py-3.5 px-5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setAssignUser(u.userid)} title="Assign VMs"
                        className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors">
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-1.243 1.007-2.25 2.25-2.25h13.5" />
                        </svg>
                      </button>
                      <button onClick={() => setPasswordUser(u.userid)} title="Change Password"
                        className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors">
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                        </svg>
                      </button>
                      <button onClick={() => handleLogoClick(u.userid)} title="Upload Logo"
                        className="p-1.5 rounded-md text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors">
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                      </button>
                      <button onClick={() => deleteLogo(u.userid)} title="Remove Logo"
                        className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 cursor-pointer transition-colors">
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                      </button>
                      <button onClick={() => deleteUser(u.userid)} title="Delete User"
                        className="p-1.5 rounded-md text-red-600 hover:bg-red-50 cursor-pointer transition-colors">
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={fetchUsers} />}
      {passwordUser && <ChangePasswordModal userid={passwordUser} onClose={() => setPasswordUser(null)} />}
      {assignUser && <AssignVMsModal userid={assignUser} onClose={() => setAssignUser(null)} />}
    </div>
  );
}
