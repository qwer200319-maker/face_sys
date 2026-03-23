import React, { useState, useEffect, useCallback } from 'react';
import { attendanceAPI, employeeAPI } from '../utils/api';
import useWebSocket from '../hooks/useWebSocket';
import { getWsBase } from '../utils/ws';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [empStats, setEmpStats] = useState(null);
  const [shiftSummary, setShiftSummary] = useState([]);
  const [log, setLog] = useState([]);

  const load = async () => {
    const [s, e, sh, f] = await Promise.all([
      attendanceAPI.todaySummary(), employeeAPI.stats(),
      attendanceAPI.shiftSummary(), attendanceAPI.liveFeed(),
    ]);
    setSummary(s.data); setEmpStats(e.data);
    setShiftSummary(sh.data); setLog(f.data);
  };

  useEffect(() => { load(); const t=setInterval(load,30000); return()=>clearInterval(t); }, []);

  const onWs = useCallback((d) => {
    if (d.type==='attendance_update') {
      setLog(prev => [{
        id:Date.now(), employee_name:d.name, employee_name_kh:d.name_kh,
        department:d.department, shift_name:d.shift, employee_id:d.employee_id,
        timestamp:d.timestamp, camera_name:d.camera_id,
        is_unknown:false, is_late:d.is_late, late_minutes:d.late_minutes,
      }, ...prev.slice(0,99)]);
    }
  }, []);

  useWebSocket(`${getWsBase()}/ws/dashboard/`, onWs);

  const today = new Date().toLocaleDateString('km-KH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  return (
    <div>
      <div className="page-header"><h1>📊 Dashboard</h1><p>{today}</p></div>

      {/* Stat cards */}
      <div className="grid-4" style={{marginBottom:20}}>
        {[
          {icon:'👥',label:'Total Employees', val:summary?.total_employees??'—', color:'#3b82f6'},
          {icon:'✅',label:'Present Today',   val:summary?.present??'—',         color:'#10b981', sub:`${summary?.attendance_rate??0}%`},
          {icon:'⏰',label:'Late Today',       val:summary?.late??'—',            color:'#f59e0b'},
          {icon:'⚠️',label:'Unknown Alerts',  val:summary?.unknown_detections??'—', color:'#ef4444'},
        ].map(c=>(
          <div key={c.label} className="card" style={{borderTop:`3px solid ${c.color}`,display:'flex',alignItems:'center',gap:14}}>
            <span style={{fontSize:32}}>{c.icon}</span>
            <div>
              <div style={{fontSize:28,fontWeight:700,color:c.color}}>{c.val}</div>
              <div style={{fontSize:12,color:'#94a3b8'}}>{c.label}</div>
              {c.sub && <div style={{fontSize:11,color:'#64748b'}}>{c.sub} rate</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Shift summary */}
      {shiftSummary.length > 0 && (
        <div className="card" style={{marginBottom:20}}>
          <div className="card-title">🕐 Shift Summary</div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
            {shiftSummary.map(s=>(
              <div key={s.shift_id} style={{flex:'1 1 180px',background:'#0f172a',borderRadius:10,padding:'14px 16px',borderLeft:`4px solid ${s.color}`}}>
                <div style={{fontWeight:600,color:'#f1f5f9',marginBottom:6}}>{s.shift_name}</div>
                <div style={{fontSize:12,color:'#64748b',marginBottom:8}}>{s.start_time} – {s.end_time}</div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13}}>
                  <span style={{color:'#10b981'}}>✅ {s.present}</span>
                  <span style={{color:'#ef4444'}}>❌ {s.absent}</span>
                  <span style={{color:'#94a3b8'}}>/{s.total}</span>
                </div>
                <div style={{marginTop:8,background:'#1e293b',borderRadius:4,height:6,overflow:'hidden'}}>
                  <div style={{width:`${s.total?s.present/s.total*100:0}%`,height:'100%',background:s.color,borderRadius:4}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Face registration progress */}
      <div className="grid-2" style={{marginBottom:20}}>
        <div className="card">
          <div className="card-title">📸 Face Registration</div>
          {empStats && <>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:13,color:'#94a3b8'}}>
              <span>Registered</span><span className="badge badge-green">{empStats.face_registered}</span>
            </div>
            <div style={{background:'#0f172a',borderRadius:999,height:10,overflow:'hidden',marginBottom:10}}>
              <div style={{width:`${empStats.total?(empStats.face_registered/empStats.total*100):0}%`,height:'100%',background:'#3b82f6',borderRadius:999,transition:'width .5s'}}/>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#94a3b8'}}>
              <span>Not Registered</span><span className="badge badge-red">{empStats.not_registered}</span>
            </div>
          </>}
        </div>
        <div className="card">
          <div className="card-title">⚡ Quick Stats</div>
          {[
            {l:'Attendance Rate', v:`${summary?.attendance_rate??0}%`, c:'#10b981'},
            {l:'On Time',         v:summary?.on_time??0,               c:'#3b82f6'},
            {l:'Late',            v:summary?.late??0,                  c:'#f59e0b'},
            {l:'Absent',          v:summary?.absent??0,                c:'#ef4444'},
          ].map(r=>(
            <div key={r.l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #334155',fontSize:13,color:'#94a3b8'}}>
              <span>{r.l}</span><span style={{color:r.c,fontWeight:700}}>{r.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live feed */}
      <div className="card">
        <div className="card-title">🔴 Live Attendance Feed</div>
        <div style={{overflowX:'auto',maxHeight:400,overflowY:'auto'}}>
          <table className="tbl">
            <thead><tr>
              <th>Time</th><th>Emp ID</th><th>Name</th><th>Khmer</th>
              <th>Department</th><th>Shift</th><th>Camera</th><th>Status</th>
            </tr></thead>
            <tbody>
              {log.map((r,i)=>(
                <tr key={r.id||i} style={r.is_unknown?{background:'rgba(239,68,68,.05)'}:r.is_late?{background:'rgba(245,158,11,.05)'}:{}}>
                  <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
                  <td><code style={{color:'#60a5fa'}}>{r.employee_id||'—'}</code></td>
                  <td style={{fontWeight:500}}>{r.is_unknown?<span style={{color:'#ef4444'}}>Unknown</span>:r.employee_name}</td>
                  <td>{r.employee_name_kh||'—'}</td>
                  <td>{r.department||'—'}</td>
                  <td>{r.shift_name||'—'}</td>
                  <td>{r.camera_name||'—'}</td>
                  <td>
                    {r.is_unknown ? <span className="badge badge-red">Unknown</span>
                     : r.is_late  ? <span className="badge badge-yellow">Late +{r.late_minutes}m</span>
                     : <span className="badge badge-green">On Time</span>}
                  </td>
                </tr>
              ))}
              {!log.length && <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'#475569'}}>No records yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
