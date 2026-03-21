import React, { useState } from 'react';
import { employeeAPI } from '../utils/api';

export default function MobilePage() {
  const [empId,  setEmpId]  = useState('');
  const [data,   setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,  setError]  = useState('');

  const lookup = async () => {
    if (!empId.trim()) return;
    setLoading(true); setError(''); setData(null);
    try {
      const r = await employeeAPI.mobileInfo(empId.trim());
      setData(r.data);
    } catch { setError('Employee not found. Check your ID.'); }
    finally { setLoading(false); }
  };

  const emp     = data?.employee;
  const records = data?.today_records || [];
  const otHours = data?.monthly_ot_hours || 0;
  const checkedIn = records.some(r=>r.status==='check_in'&&!r.is_unknown);

  return (
    <div style={{maxWidth:480,margin:'0 auto'}}>
      <div className="page-header" style={{textAlign:'center'}}>
        <h1>📱 Mobile Self-Service</h1>
        <p>Check your attendance and overtime</p>
      </div>

      {/* Search box */}
      <div className="card" style={{marginBottom:20}}>
        <div className="card-title">🔍 Enter Your Employee ID</div>
        <div style={{display:'flex',gap:10}}>
          <input value={empId} placeholder="e.g. EMP001" onChange={e=>setEmpId(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&lookup()} style={{flex:1}}/>
          <button className="btn btn-primary" onClick={lookup} disabled={loading}>{loading?'⏳':'Search'}</button>
        </div>
        {error && <div style={{marginTop:10,color:'#ef4444',fontSize:13}}>{error}</div>}
      </div>

      {emp && (
        <>
          {/* Employee card */}
          <div className="card" style={{marginBottom:16,textAlign:'center',background:'linear-gradient(135deg,#1e3a5f,#1e293b)'}}>
            <div style={{width:72,height:72,borderRadius:'50%',background:'#334155',margin:'0 auto 12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:32}}>
              👤
            </div>
            <div style={{fontSize:20,fontWeight:700,color:'#f1f5f9'}}>{emp.name}</div>
            {emp.name_kh && <div style={{fontSize:15,color:'#94a3b8',marginTop:2}}>{emp.name_kh}</div>}
            <div style={{fontSize:13,color:'#64748b',marginTop:6}}>{emp.department_name} · {emp.position||'—'}</div>
            <div style={{marginTop:10}}>
              <span className="badge badge-blue">{emp.employee_id}</span>
              {emp.shift_name && <span className="badge badge-purple" style={{marginLeft:8}}>🕐 {emp.shift_name}</span>}
            </div>
          </div>

          {/* Today status */}
          <div className="card" style={{marginBottom:16}}>
            <div className="card-title">📅 Today's Status</div>
            <div style={{textAlign:'center',padding:'16px 0'}}>
              {checkedIn ? (
                <div>
                  <div style={{fontSize:48}}>✅</div>
                  <div style={{fontSize:18,fontWeight:700,color:'#10b981',marginTop:8}}>Present</div>
                  <div style={{fontSize:13,color:'#64748b',marginTop:4}}>
                    Checked in at {new Date(records.find(r=>!r.is_unknown)?.timestamp).toLocaleTimeString()}
                  </div>
                  {records.find(r=>r.is_late) && (
                    <div style={{marginTop:8}}><span className="badge badge-yellow">⏰ Late +{records.find(r=>r.is_late)?.late_minutes} min</span></div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{fontSize:48}}>❌</div>
                  <div style={{fontSize:18,fontWeight:700,color:'#ef4444',marginTop:8}}>Not Yet Checked In</div>
                  <div style={{fontSize:13,color:'#64748b',marginTop:4}}>Walk past any camera to check in</div>
                </div>
              )}
            </div>
          </div>

          {/* Today records */}
          {records.length > 0 && (
            <div className="card" style={{marginBottom:16}}>
              <div className="card-title">🕐 Today's Records ({records.length})</div>
              {records.map(r=>(
                <div key={r.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #334155',fontSize:13}}>
                  <div>
                    <div style={{fontWeight:500,color:'#f1f5f9'}}>{new Date(r.timestamp).toLocaleTimeString()}</div>
                    <div style={{color:'#64748b',fontSize:11,marginTop:2}}>{r.camera_name||'—'}</div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    {r.is_late && <span className="badge badge-yellow">Late</span>}
                    <span className="badge badge-green">Check In</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Monthly OT */}
          <div className="card">
            <div className="card-title">⏱️ Monthly Overtime</div>
            <div style={{textAlign:'center',padding:'12px 0'}}>
              <div style={{fontSize:36,fontWeight:700,color:'#10b981'}}>{otHours}h</div>
              <div style={{fontSize:13,color:'#94a3b8',marginTop:4}}>Approved OT this month</div>
              {emp.hourly_rate > 0 && (
                <div style={{fontSize:13,color:'#f59e0b',marginTop:8,fontWeight:600}}>
                  OT Pay ≈ ${(otHours * emp.hourly_rate * 1.5).toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {!data && !loading && !error && (
        <div className="card" style={{textAlign:'center',padding:60,color:'#475569'}}>
          <div style={{fontSize:48,marginBottom:12}}>📱</div>
          <div>Enter your Employee ID to view your attendance</div>
        </div>
      )}
    </div>
  );
}
