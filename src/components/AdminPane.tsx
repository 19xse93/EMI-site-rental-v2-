import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Shield, 
  Trash2, 
  User as UserIcon, 
  Building, 
  History,
  Key,
  Unlock,
  Plus
} from 'lucide-react';
import { AppUser, AuditLog, UserPermissions } from '../types';

interface AdminPaneProps {
  appUsers: AppUser[];
  auditLogs: AuditLog[];
  activeSubTab: 'users' | 'logs';
  onEditUserAccess: (user: AppUser) => void;
  onDeleteUser: (email: string) => void;
  onAddUserManually: () => void;
  globalSearch: string;
}

export default function AdminPane({
  appUsers,
  auditLogs,
  activeSubTab,
  onEditUserAccess,
  onDeleteUser,
  onAddUserManually,
  globalSearch
}: AdminPaneProps) {
  const query = globalSearch.toLowerCase().trim();

  // Search filter for audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (!query) return true;
      return (log.user && log.user.toLowerCase().includes(query)) ||
        (log.action && log.action.toLowerCase().includes(query)) ||
        (log.entityType && log.entityType.toLowerCase().includes(query)) ||
        (log.entityId && log.entityId.toLowerCase().includes(query)) ||
        (log.details && log.details.toLowerCase().includes(query));
    });
  }, [auditLogs, query]);

  const getActionColor = (action: string) => {
    const act = action.toUpperCase();
    if (act === 'CREATE' || act === 'UPDATE_ACCESS') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (act === 'UPDATE' || act === 'UPDATE_CHECK' || act === 'FUND') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (act === 'DELETE' || act === 'REMOVE_ACCESS' || act === 'CLEAR_ALL') return 'bg-red-50 text-red-700 border-red-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  if (activeSubTab === 'users') {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
      >
        <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Shield className="text-emerald-600" size={18} />
            <span className="font-bold text-slate-800 text-sm md:text-base">System Access controls ({appUsers.length})</span>
          </div>
          <button 
            onClick={onAddUserManually}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition shadow-sm"
          >
            <Plus size={14} /> Add User Manually
          </button>
        </div>

        <div className="p-4 bg-emerald-50/30 border-b border-emerald-150 flex items-start text-xs text-slate-600 leading-normal gap-2.5">
          <Shield size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <strong>Rule Synced Architecture Enabled:</strong> Use custom gates to map access levels. View-Only privileges determine the sub-modules each account views, whilst action roles authorize writing, funding, or deletion audits.
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50/20 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">Staff Member Details</th>
                <th className="p-4">Access Authorizations Included</th>
                <th className="p-4 text-center">Desk action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
              {appUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-400 italic">No registered team members found.</td>
                </tr>
              ) : (
                appUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-800 text-[13px]">{user.name || 'Unknown Staff'}</div>
                      <div className="text-[10px] text-slate-500 font-medium font-mono">{user.email}</div>
                      {user.department && (
                        <div className="text-[9px] text-indigo-600 mt-1 font-extrabold flex items-center gap-1 bg-indigo-50/30 px-1.5 py-0.5 rounded border border-indigo-150/20 w-max">
                          <Building size={10} /> {user.department}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {user.accessLevels?.includes(3) && (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[9px] font-extrabold shadow-sm">Admin (Superuse)</span>
                        )}
                        {user.accessLevels?.includes(4) && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-extrabold shadow-sm">Treasury Staff</span>
                        )}
                        {user.accessLevels?.includes(2) && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[9px] font-extrabold shadow-sm">Sourcing Desk</span>
                        )}
                        {user.accessLevels?.includes(5) && (
                          <span className="px-2 py-0.5 bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 rounded text-[9px] font-extrabold shadow-sm">Accounts Payable Desk</span>
                        )}
                        {user.accessLevels?.includes(1) && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-extrabold shadow-sm">Export Data</span>
                        )}
                        {user.accessLevels?.includes(10) && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[8px] font-bold">View POs</span>
                        )}
                        {user.accessLevels?.includes(11) && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[8px] font-bold">View APVs</span>
                        )}
                        {user.accessLevels?.includes(12) && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[8px] font-bold">View Treasury</span>
                        )}
                        {user.accessLevels?.includes(13) && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[8px] font-bold">View Reports</span>
                        )}
                        {(!user.accessLevels || user.accessLevels.length === 0) && (
                          <span className="text-[9px] text-slate-400 italic">No access levels registered</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => onEditUserAccess(user)}
                          className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
                        >
                          Permissions
                        </button>
                        <button 
                          onClick={() => onDeleteUser(user.id)}
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition cursor-pointer"
                          title="Revoke access"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  } else {
    // Transactional Audit logs
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <History className="text-purple-600" size={18} /> System Audit Journals
          </h3>
          <p className="text-xs text-slate-500 mt-1">Chronological audits track modifications, updates, logins, and wipes across the system.</p>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50/20 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4">Journal Timestamp</th>
                <th className="p-4">Operator Info</th>
                <th className="p-4">Action</th>
                <th className="p-4">Target document</th>
                <th className="p-4">Description details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">No audit transactions matched queries.</td>
                </tr>
              ) : (
                filteredAuditLogs.map(log => {
                  const date = new Date(log.timestamp);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors align-top text-xs">
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-extrabold text-slate-800">{date.toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{date.toLocaleTimeString()}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-semibold font-mono">
                          <UserIcon size={12} className="text-indigo-400" />
                          <span className="truncate max-w-[140px]" title={log.user}>{log.user}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 font-mono">{log.entityId}</div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5">{log.entityType}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-[10px] text-slate-500 leading-tight font-sans italic p-2 bg-slate-50 rounded border border-slate-100 break-words/max-w-xs">
                          {log.details}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  }
}
