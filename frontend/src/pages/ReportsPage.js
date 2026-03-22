import React, { useState, useEffect } from 'react';
import { attendanceAPI, dailyReportAPI, deptAPI, saveBlob } from '../utils/api';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  present:        <span className="badge badge-green">✅ Present</span>,
  present_no_out: <span className="badge badge-yellow">🟡 No Out</span>,
  absent:         <span className="badge badge-red">❌ Absent</span>,
  undertime:      <span className="badge badge-yellow">⚠️ Undertime</span>,
  overtime:       <span className="badge badge-blue">⏱️ OT</span>,
};

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [tab,      setTab]      = useState('daily');   // 'daily' | 'range'
  const [date,     setDate]     = useState(today);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo,   setDateTo]   = useState(today);
  const [deptId,   setDeptId]   = useState('');
  const [depts,    setDepts]    = useState([]);
  const [data,     setData]     = useState(null);      // daily report
  const [records,  setRecords]  = useState([]);         // range records
  const [loading,  setLoading]  = useState(false);
  const [exporting,setExporting]= useState('');

  useEffect(() => { deptAPI.list().then(r => setDepts(r.data.results || r.data)); }, []);
  useEffect(() => { if (tab === 'daily') searchDaily(); else searchRange(); }, [tab]);

  // ── Daily report ──────────────────────────────────────────
  const searchDaily = async () => {
    setLoading(true); setData(null);
    try {
      const r = await dailyReportAPI.json(date, deptId || undefined);
      setData(r.data);
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  const exportDailyExcel = async () => {
    setExporting('daily-xlsx');
    try {
      const r = await dailyReportAPI.excel(date, deptId || undefined);
      saveBlob(r.data, `daily_report_${date}.xlsx`);
      toast.success('Excel exported!');
    } catch { toast.error('Export failed'); }
    finally { setExporting(''); }
  };

  const exportDailyPDF = async () => {
    setExporting('daily-pdf');
    try {
      const r = await dailyReportAPI.pdf(date, deptId || undefined);
      saveBlob(r.data, `daily_report_${date}.pdf`);
      toast.success('PDF exported!');
    } catch { toast.error('Export failed'); }
    finally { setExporting(''); }
  };

  // ── Range report ──────────────────────────────────────────
  const searchRange = async () => {
    setLoading(true); setRecords([]);
    try {
      const r = await attendanceAPI.list({
        timestamp__date__gte: dateFrom,
        timestamp__date__lte: dateTo,
      });
      setRecords(r.data.results || r.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const exportRangeExcel = async () => {
    setExporting('range-xlsx');
    try {
      const r = await attendanceAPI.exportExcel(dateFrom, dateTo);
      saveBlob(r.data, `attendance_${dateFrom}_${dateTo}.xlsx`);
      toast.success('Excel exported!');
    } catch { toast.error('Export failed'); }
    finally { setExporting(''); }
  };

  const exportRangePDF = async () => {
    setExporting('range-pdf');
    try {
      const r = await attendanceAPI.exportPDF(dateFrom, dateTo);
      saveBlob(r.data, `attendance_${dateFrom}_${dateTo}.pdf`);
      toast.success('PDF exported!');
    } catch { toast.error('Export failed'); }
    finally { setExporting(''); }
  };

  return (
    <div>
      <div className="page-header"><h1>📋 Reports</h1><p>Attendance reports with In/Out and work hours</p></div>

      {/* Tab switcher */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['daily','📅 Daily Report (In/Out)'],['range','📆 Date Range Report']].map(([k,l])=>(
          <button key={k} className={`btn ${tab===k?'btn-primary':'btn-secondary'}`} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ── DAILY TAB ─────────────────────────────────────── */}
      {tab === 'daily' && (
        <>
          <div className="card" style={{marginBottom:20}}>
            <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
              <div>
                <label>Department</label>
                <select value={deptId} onChange={e=>setDeptId(e.target.value)} style={{minWidth:160}}>
                  <option value="">All Departments</option>
                  {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={searchDaily} disabled={loading}>{loading?'⏳':'🔍'} Search</button>
              <button className="btn btn-success" onClick={exportDailyExcel} disabled={!!exporting}>{exporting==='daily-xlsx'?'⏳':'📊'} Excel</button>
              <button className="btn btn-danger"  onClick={exportDailyPDF}   disabled={!!exporting}>{exporting==='daily-pdf'?'⏳':'📄'} PDF</button>
            </div>
          </div>

          {/* Summary cards */}
          {data && (
            <div className="grid-4" style={{marginBottom:20}}>
              {[
                {label:'Total',   val:data.count,   color:'#3b82f6', icon:'👥'},
                {label:'Present', val:data.present, color:'#10b981', icon:'✅'},
                {label:'Absent',  val:data.absent,  color:'#ef4444', icon:'❌'},
                {label:'Late',    val:data.late,    color:'#f59e0b', icon:'⏰'},
              ].map(c=>(
                <div key={c.label} className="card" style={{display:'flex',alignItems:'center',gap:14,borderTop:`3px solid ${c.color}`}}>
                  <span style={{fontSize:28}}>{c.icon}</span>
                  <div>
                    <div style={{fontSize:26,fontWeight:700,color:c.color}}>{c.val}</div>
                    <div style={{fontSize:12,color:'#94a3b8'}}>{c.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Daily table — In/Out/WorkHours */}
          {data && (
            <div className="card">
              <div className="card-title">📅 {date} — Employee In/Out Report ({data.count})</div>
              <div style={{overflowX:'auto'}}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Emp ID</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Shift</th>
                      <th style={{color:'#10b981'}}>Check-In ✅</th>
                      <th style={{color:'#3b82f6'}}>Check-Out 🔵</th>
                      <th>Net Work(h)</th>
                      <th>Break(h)</th>
                      <th>OT(h)</th>
                      <th>Late</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.records || []).map((r, i) => (
                      <tr key={i} style={
                        r.status==='absent'         ? {background:'rgba(239,68,68,.06)'}    :
                        r.is_late                   ? {background:'rgba(245,158,11,.06)'}   :
                        r.ot_hours > 0              ? {background:'rgba(16,185,129,.06)'}   :
                        r.status==='present_no_out' ? {background:'rgba(251,191,36,.06)'}   : {}
                      }>
                        <td style={{color:'#475569'}}>{i+1}</td>
                        <td><code style={{color:'#60a5fa'}}>{r.employee_id}</code></td>
                        <td style={{fontWeight:500}}>
                          <div>{r.name}</div>
                          {r.name_kh && <div style={{fontSize:11,color:'#64748b'}}>{r.name_kh}</div>}
                        </td>
                        <td>{r.department || '—'}</td>
                        <td>{r.shift_name || '—'}</td>
                        <td>
                          {r.check_in_time !== '—'
                            ? <span style={{color:'#10b981',fontWeight:600}}>{r.check_in_time}</span>
                            : <span style={{color:'#475569'}}>—</span>}
                          {r.is_late && <span className="badge badge-yellow" style={{marginLeft:6}}>+{r.late_minutes}m</span>}
                        </td>
                        <td>
                          {r.check_out_time !== '—'
                            ? <span style={{color:'#3b82f6',fontWeight:600}}>{r.check_out_time}</span>
                            : <span style={{color:'#475569'}}>—</span>}
                        </td>
                        <td style={{fontWeight:600,color: r.net_hours > 0 ? '#10b981' : '#475569'}}>
                          {r.net_hours > 0 ? `${r.net_hours}h` : '—'}
                        </td>
                        <td style={{color:'#8b5cf6'}}>{r.break_hours > 0 ? `${r.break_hours}h` : '—'}</td>
                        <td style={{fontWeight:600,color:'#f59e0b'}}>{r.ot_hours > 0 ? `${r.ot_hours}h` : '—'}</td>
                        <td>{r.is_late ? <span style={{color:'#f59e0b',fontWeight:600}}>+{r.late_minutes}m</span> : <span style={{color:'#10b981'}}>OK</span>}</td>
                        <td>{STATUS_BADGE[r.status] || r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── RANGE TAB ─────────────────────────────────────── */}
      {tab === 'range' && (
        <>
          <div className="card" style={{marginBottom:20}}>
            <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div><label>From</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></div>
              <div><label>To</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></div>
              <button className="btn btn-primary" onClick={searchRange} disabled={loading}>{loading?'⏳':'🔍'} Search</button>
              <button className="btn btn-success" onClick={exportRangeExcel} disabled={!!exporting}>{exporting==='range-xlsx'?'⏳':'📊'} Excel</button>
              <button className="btn btn-danger"  onClick={exportRangePDF}   disabled={!!exporting}>{exporting==='range-pdf'?'⏳':'📄'} PDF</button>
            </div>
          </div>

          <div className="grid-3" style={{marginBottom:20}}>
            {[
              {label:'Total Records', val:records.length,                          color:'#3b82f6'},
              {label:'Known',         val:records.filter(r=>!r.is_unknown).length, color:'#10b981'},
              {label:'Unknown',       val:records.filter(r=>r.is_unknown).length,  color:'#ef4444'},
            ].map(c=>(
              <div key={c.label} className="card" style={{textAlign:'center',borderTop:`3px solid ${c.color}`}}>
                <div style={{fontSize:24,fontWeight:700,color:c.color}}>{c.val}</div>
                <div style={{fontSize:12,color:'#94a3b8',marginTop:4}}>{c.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{overflowX:'auto',maxHeight:600,overflowY:'auto'}}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th><th>Date</th><th>Time</th><th>Emp ID</th>
                    <th>Name</th><th>Dept</th><th>Shift</th>
                    <th>Status</th><th>Late</th><th>Work(h)</th><th>Conf%</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r,i)=>(
                    <tr key={r.id} style={r.is_unknown?{background:'rgba(239,68,68,.04)'}:r.is_late?{background:'rgba(245,158,11,.04)'}:{}}>
                      <td style={{color:'#475569'}}>{i+1}</td>
                      <td>{new Date(r.timestamp).toLocaleDateString()}</td>
                      <td style={{fontFamily:'monospace'}}>{new Date(r.timestamp).toLocaleTimeString()}</td>
                      <td><code style={{color:'#60a5fa'}}>{r.employee_id||'—'}</code></td>
                      <td style={{fontWeight:500}}>{r.is_unknown?<span style={{color:'#ef4444'}}>Unknown</span>:r.employee_name}</td>
                      <td>{r.department||'—'}</td>
                      <td>{r.shift_name||'—'}</td>
                      <td>
                        {r.status==='check_in'
                          ? <span className="badge badge-green">IN</span>
                          : r.status==='check_out'
                          ? <span className="badge badge-blue">OUT</span>
                          : <span className="badge badge-gray">{r.status}</span>}
                      </td>
                      <td>{r.is_late?<span className="badge badge-yellow">+{r.late_minutes}m</span>:<span style={{color:'#10b981'}}>OK</span>}</td>
                      <td style={{color:'#10b981',fontWeight:600}}>{r.work_hours ? `${r.work_hours}h` : '—'}</td>
                      <td>{r.confidence?(r.confidence*100).toFixed(1)+'%':'—'}</td>
                    </tr>
                  ))}
                  {!records.length && !loading && (
                    <tr><td colSpan={11} style={{textAlign:'center',padding:40,color:'#475569'}}>No records</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
