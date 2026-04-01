import React, { useState, useEffect } from 'react';
import { cameraAPI } from '../utils/api';
import CameraView from '../components/CameraView';
import toast from 'react-hot-toast';
import './CameraPage.css';

const EMPTY = { camera_id:'', name:'', location:'', source_type:'webcam', stream_url:'', rtsp_fps:0, rtsp_quality:0 };

export default function CameraPage() {
  const [cameras, setCameras] = useState([]);
  const [form, setForm]       = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [fullscreenId, setFullscreenId] = useState(null);

  useEffect(() => { load(); }, []);
  const load = async () => { const r=await cameraAPI.list(); setCameras(r.data.results||r.data); };

  const save = async () => {
    if (!form.camera_id || !form.name || !form.location) {
      return toast.error('Camera ID, Name, and Location required');
    }
    if (form.source_type === 'rtsp' && !form.stream_url) {
      return toast.error('RTSP URL required for RTSP source');
    }
    try {
      await cameraAPI.create(form);
      toast.success('Camera added!');
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.response?.data?.message || 'Failed to add camera';
      toast.error(typeof msg === 'string' ? msg : 'Failed to add camera');
    }
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
            <div>
              <label>Camera ID</label>
              <input value={form.camera_id} placeholder="cam_01" onChange={e=>setForm({...form,camera_id:e.target.value})}/>
            </div>
            <div>
              <label>Name</label>
              <input value={form.name} placeholder="Main Gate" onChange={e=>setForm({...form,name:e.target.value})}/>
            </div>
            <div>
              <label>Location</label>
              <input value={form.location} placeholder="Factory Entrance" onChange={e=>setForm({...form,location:e.target.value})}/>
            </div>
            <div>
              <label>Source</label>
              <select
                value={form.source_type}
                onChange={e=>{
                  const v = e.target.value;
                  setForm({
                    ...form,
                    source_type: v,
                    stream_url: v==='rtsp' ? form.stream_url : '',
                    rtsp_fps: v==='rtsp' ? form.rtsp_fps : 0,
                    rtsp_quality: v==='rtsp' ? form.rtsp_quality : 0,
                  });
                }}
              >
                <option value="webcam">Webcam (Browser)</option>
                <option value="rtsp">RTSP / IP Camera</option>
              </select>
            </div>
            {form.source_type === 'rtsp' && (
              <>
                <div>
                  <label>RTSP URL</label>
                  <input value={form.stream_url} placeholder="rtsp://user:pass@ip:554/stream" onChange={e=>setForm({...form,stream_url:e.target.value})}/>
                </div>
                <div>
                  <label>RTSP FPS (optional)</label>
                  <input type="number" min="1" value={form.rtsp_fps} placeholder="5" onChange={e=>setForm({...form,rtsp_fps: Number(e.target.value)})}/>
                </div>
                <div>
                  <label>RTSP JPEG Quality (optional)</label>
                  <input type="number" min="30" max="95" value={form.rtsp_quality} placeholder="70" onChange={e=>setForm({...form,rtsp_quality: Number(e.target.value)})}/>
                </div>
              </>
            )}
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
              <thead><tr><th>Camera ID</th><th>Name</th><th>Location</th><th>Source</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {cameras.map(c=>(
                  <tr key={c.id}>
                    <td><code style={{color:'#60a5fa'}}>{c.camera_id}</code></td>
                    <td>{c.name}</td><td>{c.location}</td>
                    <td>{c.source_type === 'rtsp' ? 'RTSP' : 'Webcam'}</td>
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





