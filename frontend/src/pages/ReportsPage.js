import React, { useState, useEffect } from 'react';
import { attendanceAPI, saveBlob } from '../utils/api';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0,10);
  const [dateFrom,  setDateFrom]  = useState(today);
  const [dateTo,    setDateTo]    = useState(today);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState('');

  useEffect(() => { search(); }, []);

  const search = async () => {
    setLoading(true);
    try {
      const r = await attendanceAPI.list({ timestamp__date__gte:dateFrom, timestamp__date__lte:dateTo });
      setRecords(r.data.results||r.data);
    } finally { setLoading(false); }
  };

  const exportExcel = async () => {
    setExporting('xlsx');
    try { const r=await attendanceAPI.exportExcel(dateFrom,dateTo); saveBlob(r.data,`attendance_${dateFrom}_${dateTo}.xlsx`); toast.success('Excel exported!'); }
    catch { toast.error('Export failed'); } finally { setExporting(''); }
  };

  const exportPDF = async () => {
    setExporting('pdf');
    try { const r=await attendanceAPI.exportPDF(dateFrom,dateTo); saveBlob(r.data,`attendance_${dateFrom}_${dateTo}.pdf`); toast.success('PDF exported!'); }
    catch { toast.error('Export failed'); } finally { setExporting(''); }
  };

  const known   = records.filter(r=>!r.is_unknown);
  const late    = records.filter(r=>r.is_late);
  const unknown = records.filter(r=>r.is_unknown);

  return (
    <div>
      <div className="page-header"><h1>📋 Reports</h1><p>Filter attendance and export</p></div>

      <div className="card" style={{marginBottom:20}}>
        <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div><label>Date From</label><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></div>
          <div><label>Date To</label><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></div>
          <button className="btn btn-primary" onClick={search} disabled={loading}>{loading?'⏳':'🔍'} Search</button>
          <button className="btn btn-success" onClick={exportExcel} disabled={!!exporting}>{exporting==='xlsx'?'⏳':'📊'} Excel</button>
          <button className="btn btn-danger"  onClick={exportPDF}   disabled={!!exporting}>{exporting==='pdf'?'⏳':'📄'} PDF</button>
        </div>
      </div>

      <div className="grid-4" style={{marginBottom:20}}>
        {[
          {label:'Total Records', val:records.length, color:'#3b82f6'},
          {label:'Known',         val:known.length,   color:'#10b981'},
          {label:'Late',          val:late.length,    color:'#f59e0b'},
          {label:'Unknown',       val:unknown.length, color:'#ef4444'},
        ].map(c=>(
          <div key={c.label} className="card" style={{textAlign:'center',borderTop:`3px solid ${c.color}`}}>
            <div style={{fontSize:26,fontWeight:700,color:c.color}}>{c.val}</div>
            <div style={{fontSize:12,color:'#94a3b8',marginTop:4}}>{c.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Attendance Records ({records.length})</div>
        <div style={{overflowX:'auto',maxHeight:600,overflowY:'auto'}}>
          <table className="tbl">
            <thead><tr>
              <th>#</th><th>Date</th><th>Time</th><th>Emp ID</th>
              <th>Name</th><th>Department</th><th>Shift</th><th>Camera</th><th>Late</th><th>Conf%</th>
            </tr></thead>
            <tbody>
              {records.map((r,i)=>(
                <tr key={r.id} style={r.is_unknown?{background:'rgba(239,68,68,.04)'}:r.is_late?{background:'rgba(245,158,11,.04)'}:{}}>
                  <td style={{color:'#475569'}}>{i+1}</td>
                  <td>{new Date(r.timestamp).toLocaleDateString()}</td>
                  <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
                  <td><code style={{color:'#60a5fa'}}>{r.employee_id||'—'}</code></td>
                  <td style={{fontWeight:500}}>{r.is_unknown?<span style={{color:'#ef4444'}}>Unknown</span>:r.employee_name}</td>
                  <td>{r.department||'—'}</td>
                  <td>{r.shift_name||'—'}</td>
                  <td>{r.camera_name||'—'}</td>
                  <td>{r.is_late?<span className="badge badge-yellow">+{r.late_minutes}m</span>:<span className="badge badge-green">On Time</span>}</td>
                  <td>{r.confidence?(r.confidence*100).toFixed(1)+'%':'—'}</td>
                </tr>
              ))}
              {!records.length && !loading && <tr><td colSpan={10} style={{textAlign:'center',padding:40,color:'#475569'}}>No records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
