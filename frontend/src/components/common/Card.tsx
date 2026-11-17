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
        'bg-white/90 dark:bg-[#082b27]/85 backdrop-blur-xl border border-emerald-950/10 dark:border-white/10 rounded-2xl shadow-zen p-5 transition-all duration-200',
        onClick && 'cursor-pointer hover:border-emerald-500/50 dark:hover:border-emerald-500/50',
        className
      )}
    >
      {children}
    </div>
  );
};

