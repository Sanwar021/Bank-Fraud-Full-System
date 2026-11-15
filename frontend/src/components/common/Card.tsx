import React from 'react';
import clsx from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs p-5 transition-colors',
        onClick && 'cursor-pointer hover:border-emerald-500/50 dark:hover:border-emerald-500/50',
        className
      )}
    >
      {children}
    </div>
  );
};
