import React, { useState } from 'react';
import { ChevronRight, CreditCard, LogOut, Menu, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';

interface NavbarProps { onMenuClick: () => void; }

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const name = user?.customer ? `${user.customer.first_name} ${user.customer.last_name}` : user?.email?.split('@')[0] || 'User';
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <header className="reference-navbar">
      <button onClick={onMenuClick} className="reference-icon-button md:hidden" aria-label="Open navigation"><Menu size={20} /></button>
      <form className="reference-search" onSubmit={(event) => {
        event.preventDefault();
        const value = search.trim().toLowerCase();
        const destination = value.includes('card') ? '/cards' : value.includes('loan') ? '/loans' : value.includes('deposit') || value.includes('saving') ? '/deposits' : value.includes('transfer') || value.includes('contact') || value.includes('send') ? '/transfer' : value.includes('fraud') || value.includes('risk') ? '/investigation' : '/accounts';
        navigate(destination);
      }}><Search size={18} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search banking portal" placeholder="Search transactions, accounts, contacts..." /></form>
      <div className="reference-navbar-actions">
        <NotificationDropdown />
        <button onClick={() => setProfileOpen((value) => !value)} className="reference-avatar" title={`${name} profile`} aria-label="Open profile menu" aria-expanded={profileOpen}>{initials}</button>
        {profileOpen && <>
          <button className="reference-profile-backdrop" onClick={() => setProfileOpen(false)} aria-label="Close profile menu" />
          <div className="reference-profile-menu" role="menu">
            <div className="reference-profile-heading"><div className="reference-profile-large-avatar">{initials}</div><div><strong>{name}</strong><span>{user?.email}</span><small>{role?.replace(/_/g, ' ')}</small></div></div>
            <button role="menuitem" onClick={() => { navigate('/accounts'); setProfileOpen(false); }}><UserRound size={16}/><span>Account profile</span><ChevronRight size={15}/></button>
            <button role="menuitem" onClick={() => { navigate('/cards'); setProfileOpen(false); }}><CreditCard size={16}/><span>Cards & security</span><ChevronRight size={15}/></button>
            <button role="menuitem" className="danger" onClick={() => { setProfileOpen(false); void logout(); }}><LogOut size={16}/><span>Sign out</span></button>
          </div>
        </>}
      </div>
    </header>
  );
};
