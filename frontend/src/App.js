import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard    from './pages/Dashboard';
import CameraPage   from './pages/CameraPage';
import EmployeePage from './pages/EmployeePage';
import ReportsPage  from './pages/ReportsPage';
import OvertimePage from './pages/OvertimePage';
import ShiftPage    from './pages/ShiftPage';
import MobilePage   from './pages/MobilePage';
import './App.css';

const NAV = [
  { to:'/',          icon:'📊', label:'Dashboard'   },
  { to:'/cameras',   icon:'📹', label:'Live Cameras' },
  { to:'/employees', icon:'👥', label:'Employees'    },
  { to:'/shifts',    icon:'🕐', label:'Shifts'       },
  { to:'/overtime',  icon:'⏱️', label:'Overtime'     },
  { to:'/reports',   icon:'📋', label:'Reports'      },
  { to:'/mobile',    icon:'📱', label:'Mobile View'  },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span style={{fontSize:28}}>🏭</span>
        <div>
          <div className="logo-title">FactoryFace</div>
          <div className="logo-sub">Attendance Pro v2</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(l => (
          <NavLink key={l.to} to={l.to} end={l.to==='/'}
            className={({isActive})=>`nav-link${isActive?' active':''}`}>
            <span>{l.icon}</span><span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">v2.0.0 · 2000+ Employees</div>
    </aside>
  );
}

function TopBar({ onOpenMenu }) {
  const { pathname } = useLocation();
  const current = NAV.find(n => n.to === pathname) || NAV.find(n => n.to === '/');
  return (
    <div className="app-topbar">
      <div className="topbar-brand">
        <span className="topbar-logo">🏭</span>
        <div>
          <div className="logo-title">FactoryFace</div>
          <div className="logo-sub">Attendance Pro v2</div>
        </div>
      </div>
      <div className="topbar-title">{current?.label || 'Page'}</div>
      <button className="btn btn-secondary btn-sm" onClick={onOpenMenu}>☰ Menu</button>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <BrowserRouter>
      {/* Mobile/Tablet Top Bar */}
      <TopBar onOpenMenu={() => setMenuOpen(true)} />

      {/* Right Drawer Menu */}
      <div className={`drawer-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`left-drawer${menuOpen ? ' open' : ''}`}>
        <div className="drawer-header">
          <div style={{ fontWeight: 700 }}>Menu</div>
          <button className="btn btn-secondary btn-sm" onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        <nav className="drawer-nav">
          {NAV.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to==='/'}
              onClick={() => setMenuOpen(false)}
              className={({isActive})=>`nav-link${isActive?' active':''}`}>
              <span>{l.icon}</span><span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-layout">
        <Sidebar/>
        <main className="app-main">
          <Routes>
            <Route path="/"          element={<Dashboard/>}    />
            <Route path="/cameras"   element={<CameraPage/>}   />
            <Route path="/employees" element={<EmployeePage/>}  />
            <Route path="/shifts"    element={<ShiftPage/>}    />
            <Route path="/overtime"  element={<OvertimePage/>} />
            <Route path="/reports"   element={<ReportsPage/>}  />
            <Route path="/mobile"    element={<MobilePage/>}   />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" toastOptions={{style:{background:'#1e293b',color:'#e2e8f0',border:'1px solid #334155'}}}/>
    </BrowserRouter>
  );
}
