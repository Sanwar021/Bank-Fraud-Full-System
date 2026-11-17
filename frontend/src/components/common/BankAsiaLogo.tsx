import React from 'react';

interface BankAsiaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon-only' | 'light' | 'dark';
  showSubtitle?: boolean;
}

export const BankAsiaLogo: React.FC<BankAsiaLogoProps> = ({
  size = 'md',
  showSubtitle = true,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  };

  const badgeSizes = {
    sm: 'text-[9px] px-1.5 py-0.2',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-xs px-2.5 py-0.5',
    xl: 'text-sm px-3 py-1',
  };

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Bank Asia Emblem Icon */}
      <div
        className={`${iconSizes[size]} rounded-2xl bg-gradient-to-br from-[#2061AE] via-[#164e91] to-[#090B28] p-1.5 flex items-center justify-center shadow-md shadow-zen-500/25 relative overflow-hidden shrink-0 group`}
      >
        {/* Modern Vector Geometric Emblem */}
        <svg
          viewBox="0 0 40 40"
          className="w-full h-full text-white"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Bank Asia Stylized Geometric Waves */}
          <path
            d="M8 28C8 18 16 10 26 10C29 10 32 11 34 13"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M6 34C6 22 15 14 27 14"
            stroke="#60A5FA"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeOpacity="0.8"
          />
          <path
            d="M14 34C14 26 20 20 28 20"
            stroke="#93C5FD"
            strokeWidth="2"
            strokeLinecap="round"
            strokeOpacity="0.6"
          />
          {/* Signature Bank Asia Ruby Red Accent Dot */}
          <circle cx="28" cy="11" r="4" fill="#ED1C24" className="filter drop-shadow" />
        </svg>

        {/* Ambient Gloss Highlight */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/20 pointer-events-none rounded-2xl" />
      </div>

      {/* Typography */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-tight">
          <span className={`font-black tracking-tight text-slate-900 dark:text-white ${textSizes[size]}`}>
            Bank Asia
          </span>
          <span
            className={`font-extrabold uppercase bg-gradient-to-r from-zen-500 to-cyan-500 text-white rounded-full tracking-wider shadow-xs ${badgeSizes[size]}`}
          >
            ZEN
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 tracking-wide flex items-center gap-1">
            <span>Smart Digital Banking</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-zen-600 dark:text-cyan-400 font-semibold">AI Shield</span>
          </span>
        )}
      </div>
    </div>
  );
};

