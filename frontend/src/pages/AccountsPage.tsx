import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Download, Filter, FileSpreadsheet, ArrowRightLeft } from 'lucide-react';
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
      link.setAttribute('download', `statement-${selectedAccountId}.csv`);
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
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Accounts & Financial Statements
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Select an account to view its double-entry ledger activity and export official statements.
          </p>
        </div>

        <Button
          onClick={handleDownloadCSV}
          isLoading={downloading}
          variant="outline"
          disabled={!selectedAccountId}
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV Statement
        </Button>
      </div>

      {/* Account Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Immutable Transaction Ledger
          </h2>
          <span className="text-xs text-slate-400 font-mono">
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
