import React, { useState, useEffect } from 'react';
import { getNEON, postNEON, deleteNEON } from '../utils/neon';
import { ArrowLeft, Plus, Trash2, Check, Loader2, Building2, Users, RefreshCw } from 'lucide-react';

interface SuperAdminViewProps {
  onBack: () => void;
}

const SuperAdminView: React.FC<SuperAdminViewProps> = ({ onBack }) => {
  const [groups, setGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [accessMap, setAccessMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, usersRes, accessRes] = await Promise.all([
        getNEON({ table: 'groups' }),
        getNEON({ table: 'users' }),
        getNEON({ table: 'usergroupaccess' }),
      ]);
      setGroups(groupsRes.rows || []);
      setUsers(usersRes.rows || []);

      const map: Record<string, number> = {};
      (accessRes.rows || []).forEach((row: any) => {
        const uid = row.userId || row.user_id;
        const gid = row.groupId || row.group_id;
        map[`${uid}_${gid}`] = row.id;
      });
      setAccessMap(map);
    } catch (e) {
      console.error('SuperAdmin load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const toggleAccess = async (userId: number, groupId: number) => {
    const key = `${userId}_${groupId}`;
    setSaving(key);
    try {
      if (accessMap[key]) {
        await deleteNEON({ table: 'usergroupaccess', data: accessMap[key] });
        setAccessMap(prev => { const next = { ...prev }; delete next[key]; return next; });
      } else {
        const res = await postNEON({ table: 'usergroupaccess', data: { user_id: userId, group_id: groupId } });
        const newId = res.inserted?.[0]?.id;
        if (newId) setAccessMap(prev => ({ ...prev, [key]: newId }));
      }
    } catch (e) {
      console.error('Toggle access error:', e);
    } finally {
      setSaving(null);
    }
  };

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      const res = await postNEON({ table: 'groups', data: { name: newGroupName.trim() } });
      if (res.inserted?.[0]) {
        setGroups(prev => [...prev, res.inserted[0]]);
        setNewGroupName('');
      }
    } catch (e) {
      console.error('Add group error:', e);
    } finally {
      setAddingGroup(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-sky-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Laster AdminView...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
              Tilbake
            </button>
            <div className="w-px h-6 bg-slate-700" />
            <h1 className="text-xl font-bold text-white">SuperAdmin — Konserntilganger</h1>
          </div>
          <button onClick={loadData} className="text-slate-500 hover:text-slate-300 transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Add new group */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Building2 size={14} />
            Legg til nytt konsern
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGroup()}
              placeholder="Konsernnavn..."
              className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 outline-none focus:border-sky-500 transition-colors text-sm"
            />
            <button
              onClick={addGroup}
              disabled={addingGroup || !newGroupName.trim()}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              {addingGroup ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Opprett
            </button>
          </div>
        </div>

        {/* Access matrix */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50 flex items-center gap-2">
            <Users size={14} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Brukertilganger per konsern</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left px-5 py-3 text-slate-400 font-medium w-64">Bruker</th>
                  {groups.map(g => (
                    <th key={g.id} className="px-4 py-3 text-center text-slate-400 font-medium min-w-[120px]">
                      <div className="truncate max-w-[120px]" title={g.name}>{g.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr key={user.id} className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-800/20'}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-white">{user.fullName || user.full_name || '—'}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                      <div className="text-xs text-slate-600 mt-0.5 capitalize">{user.role}</div>
                    </td>
                    {groups.map(group => {
                      const key = `${user.id}_${group.id}`;
                      const hasAccess = !!accessMap[key];
                      const isSaving = saving === key;
                      return (
                        <td key={group.id} className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggleAccess(user.id, group.id)}
                            disabled={isSaving}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-all ${
                              hasAccess
                                ? 'bg-sky-500/20 border border-sky-500/50 text-sky-400 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400'
                                : 'bg-slate-700/50 border border-slate-600/50 text-slate-600 hover:bg-sky-500/20 hover:border-sky-500/50 hover:text-sky-400'
                            }`}
                          >
                            {isSaving ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : hasAccess ? (
                              <Check size={14} />
                            ) : (
                              <Plus size={14} />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminView;
