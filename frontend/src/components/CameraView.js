import React, { useRef, useEffect, useState, useCallback } from 'react';
import './CameraView.css';
import { getWsBase } from '../utils/ws';
const FRAME_MS = 80;

export default function CameraView({
  camera,
  showActions = true,
  onFullScreen,
  onExitFull,
  isFullScreen = false,
  showHeader = true,
  showStats = true,
  className = '',
}) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const wsRef     = useRef(null);
  const timerRef  = useRef(null);
  const [faces, setFaces]         = useState([]);
  const [dim, setDim]             = useState({w:1280,h:720});
  const [connected, setConnected] = useState(false);
  const [stats, setStats]         = useState({detected:0,known:0,unknown:0,late:0});

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({video:{width:1280,height:720}});
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch(e) { console.error('Cam:', e); }
    })();
    return () => videoRef.current?.srcObject?.getTracks().forEach(t=>t.stop());
  }, []);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(`${getWsBase()}/ws/camera/${camera.camera_id}/`);
      wsRef.current = ws;
      ws.onopen    = () => { setConnected(true); timerRef.current = setInterval(sendFrame, FRAME_MS); };
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.type==='face_results') {
          setFaces(d.faces||[]);
          setDim({w:d.frame_width||1280, h:d.frame_height||720});
          setStats({
            detected:d.faces.length,
            known:   d.faces.filter(f=>!f.is_unknown).length,
            unknown: d.faces.filter(f=>f.is_unknown).length,
            late:    d.faces.filter(f=>f.is_late).length,
          });
        }
      };
      ws.onclose = () => { setConnected(false); clearInterval(timerRef.current); setTimeout(connect, 2500); };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { clearInterval(timerRef.current); wsRef.current?.close(); };
  }, [camera.camera_id]);

  const sendFrame = useCallback(() => {
    const v=videoRef.current, c=canvasRef.current;
    if (!v||!c||!v.videoWidth) return;
    if (wsRef.current?.readyState!==WebSocket.OPEN) return;
    const ctx=c.getContext('2d'); c.width=v.videoWidth; c.height=v.videoHeight;
    ctx.drawImage(v,0,0);
    c.toBlob(b=>b?.arrayBuffer().then(buf=>{
      if (wsRef.current?.readyState===WebSocket.OPEN) wsRef.current.send(buf);
    }),'image/jpeg',0.75);
  },[]);

  return (
    <div className={`cam-card ${className}`}>
      {showHeader && (
        <div className="cam-header">
          <div>
            <div className="cam-name">{camera.name}</div>
            <div className="cam-loc">📍 {camera.location}</div>
          </div>
          <div className="cam-right">
            <div className="cam-live-badge">
              <span className={`live-dot${connected?' on':''}`}/>{connected?'LIVE':'Connecting…'}
            </div>
            {showActions && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={isFullScreen ? onExitFull : onFullScreen}
              >
                {isFullScreen ? 'Exit Full' : 'Full Screen'}
              </button>
            )}
          </div>
        </div>
      )}
      {showStats && (
        <div className="cam-stats-bar">
          <span>👤 {stats.detected}</span>
          <span style={{color:'#10b981'}}>✅ {stats.known}</span>
          <span style={{color:'#ef4444'}}>❓ {stats.unknown}</span>
          {stats.late>0 && <span style={{color:'#f59e0b'}}>⏰ {stats.late} late</span>}
        </div>
      )}
      <div className="cam-video-wrap">
        <video ref={videoRef} autoPlay muted playsInline className="cam-video"/>
        <div className="cam-overlay">
          {faces.map((f,i)=><FaceBox key={i} face={f} fw={dim.w} fh={dim.h}/>)}
        </div>
        <canvas ref={canvasRef} style={{display:'none'}}/>
      </div>
    </div>
  );
}

function FaceBox({face,fw,fh}) {
  const [x1,y1,x2,y2]=face.bbox;
  const bc = face.is_unknown?'#ef4444':face.is_late?'#f59e0b':'#10b981';
  const bg = face.is_unknown?'#ef4444cc':face.is_late?'#f59e0bcc':'#10b981cc';
  return (
    <div className="face-box" style={{left:`${x1/fw*100}%`,top:`${y1/fh*100}%`,width:`${(x2-x1)/fw*100}%`,height:`${(y2-y1)/fh*100}%`,borderColor:bc}}>
      <div className="face-label" style={{background:bg}}>
        <div className="face-name">{face.label}{face.is_late?' ⏰':''}</div>
        {face.label_kh&&<div className="face-kh">{face.label_kh}</div>}
        {!face.is_unknown&&<div className="face-info">{face.department} · {face.confidence}%</div>}
      </div>
    </div>
  );
}
