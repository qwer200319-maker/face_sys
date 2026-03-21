import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
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

export default function App() {
  return (
    <BrowserRouter>
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
