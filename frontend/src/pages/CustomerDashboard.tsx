import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CreditCard, Landmark, MoreHorizontal, Plus, Send, Trash2, UserRound, WalletCards, Wifi } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { bankingApi } from '../api/banking';
import { useAuth } from '../context/AuthContext';

const flow = [
  {m:'Jan',in:38,out:12},{m:'Feb',in:58,out:19},{m:'Mar',in:33,out:13},{m:'Apr',in:47,out:17},
  {m:'May',in:32,out:14},{m:'Jun',in:41,out:16},{m:'Jul',in:29,out:10},{m:'Aug',in:51,out:22},
  {m:'Sep',in:35,out:13},{m:'Oct',in:44,out:18},{m:'Nov',in:27,out:9},{m:'Dec',in:39,out:14},
];

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [showChartDetails, setShowChartDetails] = useState(false);
  const [contacts, setContacts] = useState([['Angela Taylor','12788980890','AT'],['Dani Daniels','12788980890','DD'],['Natasha Malkova','12788980890','NM']]);
  const [selectedTheme, setSelectedTheme] = useState(0);
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: bankingApi.getAccounts });
  const { data: transfers = [] } = useQuery({ queryKey: ['transfers'], queryFn: bankingApi.getTransfers });
  const { data: cards = [] } = useQuery({ queryKey: ['cards'], queryFn: bankingApi.getCards });
  const balance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const firstName = user?.customer?.first_name || 'Customer';
  const account = accounts[0];
  const cardThemes = [
    { name:'Cyber World', tier:'SIGNATURE', image:'/card-themes/cyber-cyan.png' },
    { name:'Corporate Wave', tier:'CORPORATE', image:'/card-themes/corporate-emerald.png' },
    { name:'Private Black', tier:'PRIVATE', image:'/card-themes/private-black.png' },
    { name:'Business Bronze', tier:'BUSINESS', image:'/card-themes/business-bronze.png' },
    { name:'Midnight Prepaid', tier:'PREPAID', image:'/card-themes/prepaid-navy.png' },
  ];
  const activeTheme = cardThemes[selectedTheme];
  const activeCard = cards[selectedTheme % Math.max(cards.length, 1)];
  const actions = [
    {label:'Transfer via card number', icon:CreditCard, to:'/transfer', color:'green'},
    {label:'Transfer to another bank', icon:WalletCards, to:'/transfer', color:'purple'},
    {label:'Transfer to the same bank', icon:UserRound, to:'/transfer', color:'orange'},
    {label:'Transfer to another bank', icon:Landmark, to:'/transfer', color:'cyan'},
  ];
  const fallback = [
    {name:'Water Bill', status:'Unsuccessfully', amount:'-$280', icon:'◆'},
    {name:'Income: Salary Oct', status:'', amount:'+$1200', icon:'▣'},
    {name:'Electric Bill', status:'Successfully', amount:'-$480', icon:'↗'},
    {name:'Income: Jane transfers', status:'', amount:'+$500', icon:'▥'},
    {name:'Internet Bill', status:'Successfully', amount:'-$100', icon:'▦'},
  ];
  const recent = transfers.length ? transfers.slice(0,5).map((t:any) => ({name:t.description || 'Bank transfer',status:t.status || 'Processed',amount:`${Number(t.amount) >= 0 ? '-' : ''}$${Math.abs(Number(t.amount || 0)).toLocaleString()}`,icon:'↗'})) : fallback;

  return (
    <div className="reference-dashboard">
      <section className="reference-center-column">
        <h1>Welcome back {firstName}!</h1>
        <div className="reference-action-grid">
          {actions.map(({label,icon:Icon,to,color}) => <Link to={to} key={label+color} className={`reference-action ${color}`}><Icon/><span>{label}</span><ArrowRight size={15}/></Link>)}
        </div>
        <div className="reference-chart-head"><div><span>Balance</span><strong>${balance.toLocaleString('en-US',{maximumFractionDigits:0})}</strong><small>USD</small></div><button onClick={() => setShowChartDetails((value) => !value)} aria-label="Toggle chart details" aria-pressed={showChartDetails}><MoreHorizontal/></button></div>
        {showChartDetails && <div className="reference-chart-summary"><span>Average monthly inflow <b>$4,360</b></span><span>Average monthly outflow <b>$1,480</b></span></div>}
        <div className="reference-chart">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={flow} barGap={-10}><XAxis dataKey="m" axisLine={false} tickLine={false} tick={{fill:'#727b84',fontSize:11}}/><Tooltip cursor={{fill:'rgba(255,255,255,.03)'}} contentStyle={{background:'#151b21',border:'1px solid #343b42',borderRadius:10,color:'#fff'}}/><Bar dataKey="in" fill="#5f6870" radius={[3,3,0,0]} barSize={7}/><Bar dataKey="out" fill="#ff6819" radius={[3,3,0,0]} barSize={7}/></BarChart></ResponsiveContainer>
        </div>
        <div className="reference-contacts">
          {contacts.map(([name,phone,initials],index) => <div className="reference-contact" key={name}><div className={`contact-avatar c${index}`}>{initials}</div><span><strong>{name}</strong><small>{phone}</small></span><div className="contact-actions"><button onClick={() => setContacts((items) => items.filter((item) => item[0] !== name))} aria-label={`Remove ${name}`}><Trash2/></button><Link to="/transfer" aria-label={`Transfer to ${name}`}><Send/></Link></div></div>)}
        </div>
      </section>

      <aside className="reference-right-column">
        <div className="premium-card-heading"><div><span>My card collection</span><strong>{activeTheme.name}</strong></div><Link to="/cards">Manage cards</Link></div>
        <div className="premium-bank-card" style={{backgroundImage:`linear-gradient(105deg,rgba(0,0,0,.08),rgba(0,0,0,.28)),url(${activeTheme.image})`}}>
          <div className="premium-card-top"><b>MRRAW</b><span>{activeTheme.tier}</span></div>
          <div className="premium-card-chip"><i/><Wifi/></div>
          <div className="premium-card-number">{activeCard?.card_number_masked || `4756 •••• •••• ${account?.account_number?.slice(-4) || '9018'}`}</div>
          <div className="premium-card-bottom"><div><small>CARD HOLDER</small><strong>{firstName} {user?.customer?.last_name || ''}</strong></div><div><small>EXPIRES</small><strong>{activeCard?.expiry_date || '12/29'}</strong></div><div className="mastercard-mark"><i/><i/></div></div>
          <div className="premium-card-status">{activeCard?.status || 'ACTIVE'}</div>
        </div>
        <div className="card-theme-picker" aria-label="Choose card design">
          {cardThemes.map((theme,index) => <button key={theme.name} onClick={() => setSelectedTheme(index)} className={selectedTheme === index ? 'active' : ''} aria-label={`Show ${theme.name} card`} aria-pressed={selectedTheme === index}><img src={theme.image} alt=""/><span>{theme.name}</span></button>)}
        </div>
        <Link className="reference-add-card" to="/cards"><Plus size={16}/> Add or manage cards</Link>
        <div className="reference-activity">
          <h3>Recent activity</h3>
          {recent.map((item:any,index:number) => <div className="activity-row" key={`${item.name}-${index}`}><div className="activity-icon">{item.icon}</div><span><strong>{item.name}</strong><small>{item.status}</small></span><b className={String(item.amount).startsWith('+') ? 'positive' : ''}>{item.amount}</b></div>)}
        </div>
        <Link to="/accounts" className="reference-view-all"><Building2 size={15}/> View all transactions</Link>
      </aside>
    </div>
  );
};
