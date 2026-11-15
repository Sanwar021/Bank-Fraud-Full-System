import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ShieldCheck, Filter } from 'lucide-react';
import { investigationApi, AuditLog } from '../api/investigation';
import { Badge } from '../components/common/Badge';

export const AuditLogsPage: React.FC = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', actionFilter, outcomeFilter, page],
    queryFn: () => investigationApi.getAuditLogs(actionFilter, outcomeFilter, page, 25),
    refetchInterval: 10000,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            Immutable Security Audit Trail
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete append-only audit log tracking every user authentication, transfer event, and fraud decision.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Filter by action..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-mono"
          />
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs font-mono"
          >
            <option value="">All Outcomes</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="HOLD">HOLD</option>
            <option value="CHALLENGE">CHALLENGE</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-mono tracking-wider bg-slate-50/50 dark:bg-slate-800/30">
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Actor & Role</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Target</th>
              <th className="py-3 px-4">Outcome</th>
              <th className="py-3 px-4">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">Loading audit logs...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">No audit log records found.</td>
              </tr>
            ) : (
              logs.map((log: AuditLog) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {log.actor?.email ? log.actor.email.split('@')[0] : 'System'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">{log.actor_role}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                    {log.target_type} ({log.target_id.slice(0, 8)}...)
                  </td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={
                        log.outcome === 'SUCCESS'
                          ? 'success'
                          : log.outcome === 'BLOCKED'
                          ? 'danger'
                          : log.outcome === 'HOLD' || log.outcome === 'CHALLENGE'
                          ? 'warning'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {log.outcome}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                    {log.ip_address || '127.0.0.1'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

