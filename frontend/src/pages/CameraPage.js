import React, { useState, useEffect } from 'react';
import { cameraAPI } from '../utils/api';
import CameraView from '../components/CameraView';
import toast from 'react-hot-toast';
import './CameraPage.css';

const EMPTY = { camera_id:'', name:'', location:'', stream_url:'' };

export default function CameraPage() {
  const [cameras, setCameras] = useState([]);
  const [form, setForm]       = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [fullscreenId, setFullscreenId] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => { const r=await cameraAPI.list(); setCameras(r.data.results||r.data); };

  const save = async () => {
    if (!form.camera_id||!form.name) return toast.error('Camera ID and Name required');
    try { await cameraAPI.create(form); toast.success('Camera added!'); setForm(EMPTY); setShowForm(false); load(); }
    catch { toast.error('Failed to add camera'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete camera?')) return;
    await cameraAPI.delete(id); toast.success('Deleted'); load();
  };

  const active = cameras.filter(c=>c.is_active);
  const fullCam = active.find(c => c.camera_id === fullscreenId);

  return (
    <div>
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div><h1>📹 Live Cameras</h1><p>{active.length} active cameras</p></div>
        <button className="btn btn-primary" onClick={()=>setShowForm(!showForm)}>{showForm?'✕ Cancel':'+ Add Camera'}</button>
      </div>

      {showForm && (
        <div className="card" style={{marginBottom:20}}>
          <div className="card-title">Add Camera</div>
          <div className="form-grid-2">
            {[['camera_id','Camera ID','cam_01'],['name','Name','Main Gate'],['location','Location','Factory Entrance'],['stream_url','RTSP URL (blank=webcam)','rtsp://...']].map(([k,l,p])=>(
              <div key={k}><label>{l}</label><input value={form[k]} placeholder={p} onChange={e=>setForm({...form,[k]:e.target.value})}/></div>
            ))}
          </div>
          <div style={{marginTop:14,display:'flex',gap:10}}>
            <button className="btn btn-primary" onClick={save}>💾 Save</button>
            <button className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {cameras.length > 0 && (
        <div className="card" style={{marginBottom:20}}>
          <div className="card-title">Camera List</div>
          <div style={{overflowX:'auto'}}>
            <table className="tbl">
              <thead><tr><th>Camera ID</th><th>Name</th><th>Location</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {cameras.map(c=>(
                  <tr key={c.id}>
                    <td><code style={{color:'#60a5fa'}}>{c.camera_id}</code></td>
                    <td>{c.name}</td><td>{c.location}</td>
                    <td><span className={`badge ${c.is_active?'badge-green':'badge-red'}`}>{c.is_active?'Active':'Inactive'}</span></td>
                    <td><button className="btn btn-danger btn-sm" onClick={()=>del(c.id)}>🗑️ Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Screen Overlay */}
      {fullscreenId && fullCam && (
        <div className="fs-overlay">
          <div className="fs-bar">
            <div style={{ fontWeight: 600 }}>🎥 Full Screen Camera</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                className="fs-select"
                value={fullscreenId}
                onChange={e => setFullscreenId(e.target.value)}
              >
                {active.map(c => (
                  <option key={c.camera_id} value={c.camera_id}>{c.name}</option>
                ))}
              </select>
              <button className="btn btn-secondary" onClick={() => setFullscreenId(null)}>Exit Full</button>
            </div>
          </div>
          <div className="fs-body">
            <CameraView camera={fullCam} showActions={false} showHeader={false} showStats={false} className="fs-cam-card" />
          </div>
        </div>
      )}

      {!fullscreenId && (active.length > 0 ? (
        <div className={active.length===1?'':active.length===2?'grid-2':'grid-2'}>
          {active.map(c=>(
            <CameraView
              key={c.camera_id}
              camera={c}
              onFullScreen={() => setFullscreenId(c.camera_id)}
            />
          ))}
        </div>
      ) : (
        <div className="card" style={{textAlign:'center',padding:60,color:'#475569'}}>
          <div style={{fontSize:48,marginBottom:12}}>📹</div>
          <div>No active cameras — Add one above</div>
        </div>
      ))}
    </div>
  );
}
