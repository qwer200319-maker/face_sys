import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import { employeeAPI, deptAPI, shiftAPI } from '../utils/api';
import toast from 'react-hot-toast';

const EMPTY = { employee_id:'', name:'', name_kh:'', department:'', shift:'', position:'', phone:'', email:'', hourly_rate:'' };
const ANGLES = ['ផ្ទាល់ (Straight)','ឆ្វេង (Left)','ស្តាំ (Right)','ពន្លឺ​ខ្លាំង (Bright)','ពន្លឺ​ខ្សោយ (Dim)'];

export default function EmployeePage() {
  const [employees, setEmployees] = useState([]);
  const [depts, setDepts]         = useState([]);
  const [shifts, setShifts]       = useState([]);
  const [search, setSearch]       = useState('');
  const [form, setForm]           = useState(EMPTY);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [faceEmp, setFaceEmp]     = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const webcamRef = useRef(null);

  useEffect(() => { load(); }, [search]);
  useEffect(() => {
    deptAPI.list().then(r=>setDepts(r.data.results||r.data));
    shiftAPI.list().then(r=>setShifts(r.data.results||r.data));
  }, []);

  const load = async () => {
    const p = {}; if (search) p.search = search;
    const r = await employeeAPI.list(p);
    setEmployees(r.data.results||r.data);
  };

  const save = async () => {
    if (!form.employee_id||!form.name) return toast.error('Employee ID and Name required');
    setSaving(true);
    try {
      await employeeAPI.create(form);
      toast.success('Employee created!'); setForm(EMPTY); setShowForm(false); load();
    } catch(e) { toast.error(e.response?.data?.employee_id?.[0]||'Error saving'); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete employee?')) return;
    await employeeAPI.delete(id); toast.success('Deleted'); load();
  };

  const clearFace = async (emp) => {
    if (!window.confirm(`Clear face data for ${emp.name}?`)) return;
    await employeeAPI.clearFace(emp.id);
    toast.success('Face data cleared'); load();
  };

  const captureOne = async () => {
    if (!webcamRef.current||!faceEmp) return;
    setCapturing(true);
    try {
      const img = webcamRef.current.getScreenshot();
      if (!img) return toast.error('Cannot capture');
      const res = await employeeAPI.registerFace(faceEmp.id, img);
      const cnt = res.data.face_count;
      setCaptureCount(cnt);
      toast.success(`✅ Angle ${cnt}/${res.data.max_angles} saved!`);
      if (cnt >= res.data.max_angles) {
        toast.success('🎉 All angles registered! Recognition ready.');
        setTimeout(()=>{ setFaceEmp(null); setCaptureCount(0); load(); }, 1500);
      }
    } catch(e) { toast.error(e.response?.data?.error||'Failed'); }
    finally { setCapturing(false); }
  };

  const filtered = employees.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.employee_id.includes(search)
  );

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div><h1>👥 Employees</h1><p>{filtered.length} employees</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?'✕ Cancel':'+ Add Employee'}</button>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom:20}}>
          <div className="card-title">New Employee</div>
          <div className="form-grid-3">
            {[['employee_id','Employee ID *','EMP001'],['name','Name (EN) *','Sophea Chan'],['name_kh','ឈ្មោះ (KH)','ចាន់ សូភា'],['position','Position','Operator'],['phone','Phone','012 345 678'],['email','Email','']].map(([k,l,p])=>(
              <div key={k}><label>{l}</label><input value={form[k]} placeholder={p} onChange={e=>setForm({...form,[k]:e.target.value})}/></div>
            ))}
            <div>
              <label>Department</label>
              <select value={form.department} onChange={e=>setForm({...form,department:e.target.value})}>
                <option value="">— Select —</option>
                {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label>Shift</label>
              <select value={form.shift} onChange={e=>setForm({...form,shift:e.target.value})}>
                <option value="">— Select —</option>
                {shifts.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label>Hourly Rate ($)</label><input type="number" value={form.hourly_rate} placeholder="0.00" onChange={e=>setForm({...form,hourly_rate:e.target.value})}/></div>
          </div>
          <div style={{marginTop:14,display:'flex',gap:10}}>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'Saving…':'💾 Save'}</button>
            <button className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        <input placeholder="🔍 Search name or ID…" value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:300}}/>
      </div>

      <div className="card">
        <div style={{overflowX:'auto'}}>
          <table className="tbl">
            <thead><tr>
              <th>Emp ID</th><th>Name</th><th>KH</th><th>Department</th><th>Shift</th><th>Position</th><th>Face</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(emp=>(
                <tr key={emp.id}>
                  <td><code style={{color:'#60a5fa'}}>{emp.employee_id}</code></td>
                  <td style={{fontWeight:500}}>{emp.name}</td>
                  <td>{emp.name_kh||'—'}</td>
                  <td>{emp.department_name||'—'}</td>
                  <td>{emp.shift_name||'—'}</td>
                  <td>{emp.position||'—'}</td>
                  <td>
                    <span className={`badge ${emp.has_face?'badge-green':'badge-red'}`}>
                      {emp.has_face?`✅ ${emp.face_count} angles`:'❌ None'}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:6}}>
                      <button className="btn btn-secondary btn-sm" onClick={()=>{setFaceEmp(emp);setCaptureCount(emp.face_count||0);}}>📷 Face</button>
                      {emp.has_face && <button className="btn btn-warning btn-sm" onClick={()=>clearFace(emp)}>🔄</button>}
                      <button className="btn btn-danger btn-sm" onClick={()=>del(emp.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'#475569'}}>No employees found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Face Register Modal */}
      {faceEmp && (
        <div className="modal-overlay" onClick={()=>setFaceEmp(null)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{fontWeight:700,fontSize:16}}>📷 Register Face — {faceEmp.name}</div>
                <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>Capture up to 5 angles for best accuracy</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={()=>setFaceEmp(null)}>✕</button>
            </div>

            {/* Angle progress */}
            <div style={{padding:'12px 20px',display:'flex',gap:8}}>
              {ANGLES.map((a,i)=>(
                <div key={i} style={{flex:1,textAlign:'center'}}>
                  <div style={{width:32,height:32,borderRadius:'50%',margin:'0 auto 4px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,background:i<captureCount?'#10b981':'#334155',color:i<captureCount?'#fff':'#64748b'}}>
                    {i<captureCount?'✓':i+1}
                  </div>
                  <div style={{fontSize:9,color:'#64748b',lineHeight:1.2}}>{a}</div>
                </div>
              ))}
            </div>

            <div style={{position:'relative',padding:'0 16px'}}>
              <Webcam ref={webcamRef} screenshotFormat="image/jpeg" width="100%"
                videoConstraints={{width:640,height:480,facingMode:'user'}}
                style={{borderRadius:8,display:'block'}}/>
              <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:170,height:210,border:'2px dashed rgba(59,130,246,.5)',borderRadius:'50%',pointerEvents:'none'}}/>
            </div>

            <div style={{padding:16,display:'flex',gap:10}}>
              <button className="btn btn-success" style={{flex:1}} onClick={captureOne} disabled={capturing||captureCount>=5}>
                {capturing?'⏳ Saving…':`📸 Capture Angle ${captureCount+1}/5`}
              </button>
              <button className="btn btn-secondary" onClick={()=>{setFaceEmp(null);setCaptureCount(0);load();}}>Done</button>
            </div>
            <div style={{padding:'0 16px 14px',fontSize:12,color:'#64748b'}}>
              💡 Capture straight first, then left, right, bright light, dim light
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
