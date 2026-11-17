import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, Banknote, CreditCard, FileText, History, Home, Landmark, LayoutGrid, ShieldAlert, UsersRound, WalletCards, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps { mobileOpen?: boolean; onMobileClose?: () => void; }

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onMobileClose }) => {
  const { role } = useAuth();
  const privileged = role === 'FRAUD_ANALYST' || role === 'ADMIN';
  const links = [
    { to: '/', label: 'Home', icon: Home }, { to: '/accounts', label: 'Accounts', icon: LayoutGrid },
    { to: '/cards', label: 'Cards', icon: CreditCard }, { to: '/transfer', label: 'Contacts', icon: UsersRound },
    { to: '/loans', label: 'Loans', icon: Banknote }, { to: '/deposits', label: 'Deposits', icon: Landmark },
  ];
  const content = <>
    <div>
      <div className="reference-brand"><span className="reference-brand-mark">◆</span><span>Mrraw Banking</span><button className="md:hidden ml-auto" onClick={onMobileClose}><X size={19}/></button></div>
      <div className="reference-menu-label">Menu</div>
      <nav className="reference-nav">
        {links.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} end={to === '/'} onClick={onMobileClose}><Icon size={17}/><span>{label}</span></NavLink>)}
        {privileged && <><NavLink to="/investigation" onClick={onMobileClose}><ShieldAlert size={17}/><span>Fraud Center</span></NavLink><NavLink to="/investigation/live" onClick={onMobileClose}><Activity size={17}/><span>Live Risk</span></NavLink><NavLink to="/investigation/audit" onClick={onMobileClose}><History size={17}/><span>Audit Trail</span></NavLink></>}
        <NavLink to="/accounts" onClick={onMobileClose}><FileText size={17}/><span>Statements</span></NavLink>
      </nav>
    </div>
    <div className="reference-scheduled">
      <h3>Scheduled Payments</h3>
      {[['Monthly Rent','#5b8cff'],['Food Payment','#ff6680'],['Utility Bills','#26c7ad']].map(([name,color]) => <div key={name}><i style={{borderColor:color}}/><span>{name}</span></div>)}
      <div className="reference-secure"><WalletCards size={16}/><span>Secure banking<br/><small>Protected 24/7</small></span></div>
    </div>
  </>;
  return <><aside className="reference-sidebar hidden md:flex">{content}</aside>{mobileOpen && <button className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={onMobileClose} aria-label="Close navigation overlay"/>}<aside className={`reference-sidebar reference-sidebar-mobile md:hidden ${mobileOpen ? 'open' : ''}`}>{content}</aside></>;
};
