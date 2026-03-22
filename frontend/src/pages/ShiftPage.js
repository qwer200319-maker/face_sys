import React, { useState, useEffect } from 'react';
import { shiftAPI } from '../utils/api';
import toast from 'react-hot-toast';

const EMPTY = {
  name:'', start_time:'08:00', end_time:'17:00',
  grace_minutes:15,
  checkin_before:30, checkin_after:120,
  checkout_before:30, checkout_after:120,
  break_start:'', break_end:'',
  is_overnight:false, color:'#3b82f6'
};
const COLORS = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#06b6d4'];

// Full Time preset
const PRESETS = [
  { label:'Full Time (08–17)', data:{ name:'Full Time', start_time:'08:00', end_time:'17:00', grace_minutes:15, checkin_before:30, checkin_after:120, checkout_before:30, checkout_after:120, break_start:'12:00', break_end:'13:00', is_overnight:false, color:'#3b82f6' }},
  { label:'Morning (06–14)',   data:{ name:'Morning Shift', start_time:'06:00', end_time:'14:00', grace_minutes:15, checkin_before:30, checkin_after:120, checkout_before:30, checkout_after:120, break_start:'', break_end:'', is_overnight:false, color:'#f59e0b' }},
  { label:'Afternoon (14–22)',  data:{ name:'Afternoon Shift', start_time:'14:00', end_time:'22:00', grace_minutes:15, checkin_before:30, checkin_after:120, checkout_before:30, checkout_after:120, break_start:'', break_end:'', is_overnight:false, color:'#10b981' }},
  { label:'Night (22–06)',      data:{ name:'Night Shift', start_time:'22:00', end_time:'06:00', grace_minutes:15, checkin_before:30, checkin_after:120, checkout_before:30, checkout_after:120, break_start:'', break_end:'', is_overnight:true, color:'#8b5cf6' }},
];

export default function ShiftPage() {
  const [shifts, setShifts]     = useState([]);
  const [form, setForm]         = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => { const r = await shiftAPI.list(); setShifts(r.data.results || r.data); };

  const applyPreset = (preset) => setForm({ ...EMPTY, ...preset.data });

  const save = async () => {
    if (!form.name || !form.start_time || !form.end_time) return toast.error('Fill required fields');
    setSaving(true);
    try {
      const payload = {
        ...form,
        break_start: form.break_start || null,
        break_end: form.break_end || null,
      };
      await shiftAPI.create(payload);
      toast.success('Shift created!'); setForm(EMPTY); setShowForm(false); load();
    } catch (e) {
      const msg = e?.response?.data;
      toast.error(typeof msg === 'string' ? msg : (msg ? JSON.stringify(msg) : 'Error saving'));
    }
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

          {/* Quick Presets */}
          <div style={{marginBottom:16}}>
            <label>⚡ Quick Presets</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
              {PRESETS.map(p=>(
                <button key={p.label} className="btn btn-secondary btn-sm" onClick={()=>applyPreset(p)}>{p.label}</button>
              ))}
            </div>
          </div>

          <div className="form-grid-3">
            {/* Basic */}
            <div><label>Shift Name *</label><input value={form.name} placeholder="e.g. Full Time" onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><label>Start Time *</label><input type="time" value={form.start_time} onChange={e=>setForm({...form,start_time:e.target.value})}/></div>
            <div><label>End Time *</label><input type="time" value={form.end_time} onChange={e=>setForm({...form,end_time:e.target.value})}/></div>
            <div><label>Grace Period (min) ⏳</label><input type="number" value={form.grace_minutes} min="0" max="60" onChange={e=>setForm({...form,grace_minutes:+e.target.value})}/></div>

            {/* Check-In Window */}
            <div><label>Check-In Open (min before start) 🟢</label><input type="number" value={form.checkin_before} min="0" onChange={e=>setForm({...form,checkin_before:+e.target.value})}/></div>
            <div><label>Check-In Close (min after start) 🟢</label><input type="number" value={form.checkin_after} min="0" onChange={e=>setForm({...form,checkin_after:+e.target.value})}/></div>

            {/* Check-Out Window */}
            <div><label>Check-Out Open (min before end) 🔵</label><input type="number" value={form.checkout_before} min="0" onChange={e=>setForm({...form,checkout_before:+e.target.value})}/></div>
            <div><label>Check-Out Close (min after end) 🔵</label><input type="number" value={form.checkout_after} min="0" onChange={e=>setForm({...form,checkout_after:+e.target.value})}/></div>

            {/* Break */}
            <div><label>Break Start 🟣 (optional)</label><input type="time" value={form.break_start} onChange={e=>setForm({...form,break_start:e.target.value})}/></div>
            <div><label>Break End 🟣 (optional)</label><input type="time" value={form.break_end} onChange={e=>setForm({...form,break_end:e.target.value})}/></div>

            {/* Color + Overnight */}
            <div>
              <label>Color</label>
              <div style={{display:'flex',gap:8,marginTop:6}}>
                {COLORS.map(c=>(
                  <div key={c} onClick={()=>setForm({...form,color:c})}
                    style={{width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',border:form.color===c?'3px solid #fff':'3px solid transparent'}}/>
                ))}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,paddingTop:20}}>
              <input type="checkbox" id="overnight" checked={form.is_overnight} onChange={e=>setForm({...form,is_overnight:e.target.checked})} style={{width:'auto'}}/>
              <label htmlFor="overnight" style={{margin:0,cursor:'pointer'}}>🌙 Overnight Shift</label>
            </div>
          </div>

          {/* Timeline Preview */}
          <div style={{marginTop:16,background:'#0f172a',borderRadius:10,padding:14}}>
            <div style={{fontSize:12,color:'#64748b',marginBottom:10}}>📅 Timeline Preview</div>
            <div style={{fontSize:12,color:'#94a3b8',fontFamily:'monospace',lineHeight:2}}>
              <span style={{color:'#10b981'}}>🟢 Check-In window: </span>
              {form.start_time ? `${calcTime(form.start_time,-form.checkin_before)} → ${calcTime(form.start_time,+form.checkin_after)}` : '—'}
              <br/>
              {form.break_start && <><span style={{color:'#8b5cf6'}}>🟣 Break: </span>{form.break_start} → {form.break_end}<br/></>}
              <span style={{color:'#3b82f6'}}>🔵 Check-Out window: </span>
              {form.end_time ? `${calcTime(form.end_time,-form.checkout_before)} → ${calcTime(form.end_time,+form.checkout_after)}` : '—'}
              <br/>
              <span style={{color:'#f59e0b'}}>⏳ Grace: </span>Late after {calcTime(form.start_time,+form.grace_minutes)}
            </div>
          </div>

          <div style={{marginTop:14,display:'flex',gap:10}}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'💾 Save Shift'}</button>
            <button className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Shift Cards */}
      <div className="grid-3">
        {shifts.map(s=>(
          <div key={s.id} className="card" style={{borderLeft:`5px solid ${s.color}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:'#f1f5f9'}}>{s.name}</div>
                {s.is_overnight && <span className="badge badge-purple" style={{marginTop:4}}>🌙 Overnight</span>}
              </div>
              <button className="btn btn-danger btn-sm" onClick={()=>del(s.id)}>🗑️</button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
              {[
                ['🕐 Start', s.start_time],
                ['🕕 End',   s.end_time],
                ['⏱️ Duration', `${s.duration_hours}h`],
                ['⏳ Grace', `${s.grace_minutes} min`],
              ].map(([l,v])=>(
                <div key={l} style={{background:'#0f172a',borderRadius:8,padding:'8px 10px'}}>
                  <div style={{fontSize:10,color:'#64748b'}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:600,color:'#f1f5f9',marginTop:2}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Windows */}
            <div style={{fontSize:11,color:'#64748b',lineHeight:1.8}}>
              <div><span style={{color:'#10b981'}}>🟢 Check-In:</span> {calcTime(s.start_time,-s.checkin_before)} → {calcTime(s.start_time,+s.checkin_after)}</div>
              {s.break_start && <div><span style={{color:'#8b5cf6'}}>🟣 Break:</span> {s.break_start} → {s.break_end}</div>}
              <div><span style={{color:'#3b82f6'}}>🔵 Check-Out:</span> {calcTime(s.end_time,-s.checkout_before)} → {calcTime(s.end_time,+s.checkout_after)}</div>
            </div>
          </div>
        ))}
        {!shifts.length && (
          <div className="card" style={{gridColumn:'1/-1',textAlign:'center',padding:60,color:'#475569'}}>
            <div style={{fontSize:48,marginBottom:12}}>🕐</div>
            <div style={{marginBottom:12}}>No shifts yet</div>
            <button className="btn btn-primary" onClick={()=>setShowForm(true)}>+ Add First Shift</button>
          </div>
        )}
      </div>
    </div>
  );
}

function calcTime(base, addMin) {
  if (!base) return '—';
  const [h, m] = base.split(':').map(Number);
  const total  = h * 60 + m + addMin;
  const hh     = Math.floor(((total % 1440) + 1440) % 1440 / 60);
  const mm     = ((total % 60) + 60) % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}
