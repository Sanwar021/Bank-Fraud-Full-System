import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Download, Filter, FileSpreadsheet, ArrowRightLeft, Sparkles } from 'lucide-react';
import { bankingApi, Account } from '../api/banking';
import { AccountCard } from '../components/banking/AccountCard';
import { TransactionTable } from '../components/banking/TransactionTable';
import { Button } from '../components/common/Button';

export const AccountsPage: React.FC = () => {
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: bankingApi.getAccounts,
  });

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [downloading, setDownloading] = useState(false);

  React.useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const { data: txData } = useQuery({
    queryKey: ['account-transactions', selectedAccountId],
    queryFn: () => bankingApi.getAccountTransactions(selectedAccountId, 50, 0),
    enabled: !!selectedAccountId,
  });

  const transactions = txData?.transactions || [];

  const handleDownloadCSV = async () => {
    if (!selectedAccountId) return;
    setDownloading(true);
    try {
      const blob = await bankingApi.exportStatement(selectedAccountId, 'csv');
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bank-asia-zen-statement-${selectedAccountId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zen-600 dark:text-cyan-400 uppercase tracking-wider">
              Mrraw Bank Accounts
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
            Deposit Portfolio & E-Statements
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select an account to view its double-entry ledger activity and export certified bank statements.
          </p>
        </div>

        <Button
          onClick={handleDownloadCSV}
          isLoading={downloading}
          variant="outline"
          disabled={!selectedAccountId}
          className="font-bold shadow-xs"
        >
          <Download className="w-4 h-4 mr-2 text-zen-500" /> Export E-Statement (CSV)
        </Button>
      </div>

      {/* Account Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((acct) => (
          <AccountCard
            key={acct.id}
            account={acct}
            isSelected={selectedAccountId === acct.id}
            onSelect={() => setSelectedAccountId(acct.id)}
          />
        ))}
      </div>

      {/* Account Ledger Entries */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-zen-500" />
            <span>Immutable Double-Entry Ledger Entries</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono font-bold">
            {transactions.length} Recorded Entries
          </span>
        </div>

        <TransactionTable
          transactions={transactions}
          currentAccountId={selectedAccountId}
        />
      </div>
    </div>
  );
};
