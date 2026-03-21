import React, { useState, useEffect } from 'react';
import { overtimeAPI, saveBlob } from '../utils/api';
import toast from 'react-hot-toast';

export default function OvertimePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()+1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter,  setFilter]  = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => { load(); }, [month, year]);

  const load = async () => {
    const [r, s] = await Promise.all([
      overtimeAPI.list({ date__month:month, date__year:year }),
      overtimeAPI.summary(month, year),
    ]);
    setRecords(r.data.results||r.data);
    setSummary(s.data);
  };

  const approve = async (id) => {
    await overtimeAPI.approve(id); toast.success('✅ Approved'); load();
  };
  const reject = async (id) => {
    await overtimeAPI.reject(id); toast.success('Rejected'); load();
  };

  const exportXls = async () => {
    setExporting(true);
    try {
      const r = await overtimeAPI.exportExcel(month, year);
      saveBlob(r.data, `overtime_${year}_${String(month).padStart(2,'0')}.xlsx`);
      toast.success('Excel exported!');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const filtered = records.filter(r => !filter || r.status === filter);

  const statusBadge = (s) => s==='approved'?<span className="badge badge-green">✅ Approved</span>
    : s==='rejected'?<span className="badge badge-red">❌ Rejected</span>
    : <span className="badge badge-yellow">⏳ Pending</span>;

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div><h1>⏱️ Overtime Management</h1><p>Track and approve overtime hours</p></div>
        <button className="btn btn-success" onClick={exportXls} disabled={exporting}>
          {exporting?'⏳':'📊'} Export Excel
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid-3" style={{marginBottom:20}}>
          {[
            {icon:'📋',label:'OT Records',   val:summary.total_records,             color:'#3b82f6'},
            {icon:'⏱️',label:'Total OT Hours',val:`${summary.total_ot_hours}h`,      color:'#10b981'},
            {icon:'💰',label:'Total OT Pay',  val:`$${summary.total_ot_pay.toFixed(2)}`, color:'#f59e0b'},
          ].map(c=>(
            <div key={c.label} className="card" style={{display:'flex',alignItems:'center',gap:14,borderTop:`3px solid ${c.color}`}}>
              <span style={{fontSize:28}}>{c.icon}</span>
              <div><div style={{fontSize:22,fontWeight:700,color:c.color}}>{c.val}</div>
              <div style={{fontSize:12,color:'#94a3b8'}}>{c.label}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap',alignItems:'flex-end'}}>
        <div><label>Month</label><input type="number" value={month} min="1" max="12" onChange={e=>setMonth(+e.target.value)} style={{width:80}}/></div>
        <div><label>Year</label><input type="number" value={year} min="2020" max="2030" onChange={e=>setYear(+e.target.value)} style={{width:100}}/></div>
        <div>
          <label>Status</label>
          <select value={filter} onChange={e=>setFilter(e.target.value)} style={{width:140}}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={load}>🔍 Search</button>
      </div>

      <div className="card">
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr>
              <th>#</th><th>Emp ID</th><th>Name</th><th>Department</th>
              <th>Date</th><th>OT Hours</th><th>Rate</th><th>OT Pay</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((r,i)=>(
                <tr key={r.id}>
                  <td>{i+1}</td>
                  <td><code style={{color:'#60a5fa'}}>{r.employee_id}</code></td>
                  <td style={{fontWeight:500}}>{r.employee_name}</td>
                  <td>{r.department||'—'}</td>
                  <td>{r.date}</td>
                  <td><strong style={{color:'#10b981'}}>{r.ot_hours}h</strong></td>
                  <td>×{r.ot_rate}</td>
                  <td style={{color:'#f59e0b',fontWeight:600}}>${r.ot_pay?.toFixed(2)}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td>
                    {r.status==='pending' && (
                      <div style={{display:'flex',gap:6}}>
                        <button className="btn btn-success btn-sm" onClick={()=>approve(r.id)}>✅ Approve</button>
                        <button className="btn btn-danger btn-sm"  onClick={()=>reject(r.id)}>❌ Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={10} style={{textAlign:'center',padding:40,color:'#475569'}}>No overtime records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
