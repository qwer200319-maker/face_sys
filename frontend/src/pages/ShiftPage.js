import React, { useState, useEffect } from 'react';
import { shiftAPI } from '../utils/api';
import toast from 'react-hot-toast';

const EMPTY = { name:'', start_time:'06:00', end_time:'14:00', grace_minutes:15, is_overnight:false, color:'#3b82f6' };
const COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4'];

export default function ShiftPage() {
  const [shifts, setShifts]     = useState([]);
  const [form, setForm]         = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => { const r=await shiftAPI.list(); setShifts(r.data.results||r.data); };

  const save = async () => {
    if (!form.name||!form.start_time||!form.end_time) return toast.error('Fill all required fields');
    setSaving(true);
    try { await shiftAPI.create(form); toast.success('Shift created!'); setForm(EMPTY); setShowForm(false); load(); }
    catch { toast.error('Error saving shift'); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete shift?')) return;
    await shiftAPI.delete(id); toast.success('Deleted'); load();
  };

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div><h1>🕐 Shift Management</h1><p>{shifts.length} shifts configured</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?'✕ Cancel':'+ Add Shift'}</button>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom:20}}>
          <div className="card-title">New Shift</div>
          <div className="form-grid-3">
            <div><label>Shift Name *</label><input value={form.name} placeholder="e.g. Morning Shift" onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><label>Start Time *</label><input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></div>
            <div><label>End Time *</label><input type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></div>
            <div><label>Grace Period (minutes)</label><input type="number" value={form.grace_minutes} min="0" max="60" onChange={e=>setForm({...form,grace_minutes:parseInt(e.target.value)||0})}/></div>
            <div>
              <label>Color</label>
              <div style={{display:'flex',gap:8,marginTop:6}}>
                {COLORS.map(c=>(
                  <div key={c} onClick={()=>setForm({...form,color:c})}
                    style={{width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',border:form.color===c?'3px solid #fff':'3px solid transparent',transition:'border .15s'}}/>
                ))}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,paddingTop:20}}>
              <input type="checkbox" id="overnight" checked={form.is_overnight} onChange={e=>setForm({...form,is_overnight:e.target.checked})} style={{width:'auto'}}/>
              <label htmlFor="overnight" style={{margin:0,cursor:'pointer'}}>🌙 Overnight Shift</label>
            </div>
          </div>
          <div style={{marginTop:14,display:'flex',gap:10}}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'💾 Save Shift'}</button>
          </div>
        </div>
      )}

      <div className="grid-3">
        {shifts.map(s=>(
          <div key={s.id} className="card" style={{borderLeft:`5px solid ${s.color}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:'#f1f5f9'}}>{s.name}</div>
                {s.is_overnight && <span className="badge badge-purple" style={{marginTop:4}}>🌙 Overnight</span>}
              </div>
              <button className="btn btn-danger btn-sm" onClick={()=>del(s.id)}>🗑️</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {[['🕐 Start',s.start_time],['🕕 End',s.end_time],['⏱️ Duration',`${s.duration_hours}h`],['⏳ Grace',`${s.grace_minutes} min`]].map(([l,v])=>(
                <div key={l} style={{background:'#0f172a',borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:11,color:'#64748b'}}>{l}</div>
                  <div style={{fontSize:15,fontWeight:600,color:'#f1f5f9',marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {!shifts.length && (
          <div className="card" style={{gridColumn:'1/-1',textAlign:'center',padding:60,color:'#475569'}}>
            <div style={{fontSize:48,marginBottom:12}}>🕐</div>
            <div>No shifts yet — Add one above</div>
            <div style={{fontSize:12,color:'#334155',marginTop:8}}>Example: Morning 06:00–14:00, Afternoon 14:00–22:00, Night 22:00–06:00</div>
          </div>
        )}
      </div>
    </div>
  );
}
