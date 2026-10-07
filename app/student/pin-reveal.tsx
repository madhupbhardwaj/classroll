'use client';
import { useEffect, useRef, useState } from 'react';

export default function PinReveal({classId,ready,onChanged}:{classId:string,ready:boolean,onChanged:()=>Promise<void>}){
 const [visible,setVisible]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const holding=useRef(false),requestId=useRef(0);
 function hide(){holding.current=false;requestId.current++;setVisible('')}
 useEffect(()=>{
  const onBlur=()=>hide();
  const onVisibility=()=>{if(document.hidden)hide()};
  window.addEventListener('blur',onBlur);
  document.addEventListener('visibilitychange',onVisibility);
  return()=>{window.removeEventListener('blur',onBlur);document.removeEventListener('visibilitychange',onVisibility);holding.current=false;requestId.current++};
 },[classId]);
 async function reveal(){
  if(!ready||holding.current)return;
  holding.current=true;const current=++requestId.current;setError('');
  try{
   const response=await fetch('/api/student',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action:'revealPin',classId})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not reveal PIN.');
   if(holding.current&&current===requestId.current)setVisible(data.pin);
  }catch(e){if(holding.current&&current===requestId.current)setError(e instanceof Error?e.message:'Could not reveal PIN.')}
 }
 async function rotate(){
  if(!confirm('Create a new PIN for this class? Your previous PIN will stop working immediately.'))return;
  hide();setBusy(true);setError('');
  try{
   const response=await fetch('/api/student',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({action:'rotatePin',classId})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not create a new PIN.');
   await onChanged();
  }catch(e){setError(e instanceof Error?e.message:'Could not create a new PIN.')}
  finally{setBusy(false)}
 }
 return <section className="panel student-pin-panel" aria-labelledby="student-pin-title">
  <div className="panel-head"><div><p className="eyebrow">CLASS ACCESS</p><h2 id="student-pin-title">Your six-digit PIN</h2></div></div>
  {ready?<><div className="pin-reveal-row"><code className="pin-mask" aria-label={visible?'PIN visible':'PIN hidden'}>{visible||'••••••'}</code><button type="button" className="button outline pin-eye" aria-label="Hold to reveal your PIN" aria-pressed={!!visible} onPointerDown={e=>{if(e.button===0)void reveal()}} onPointerUp={hide} onPointerCancel={hide} onPointerLeave={hide} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();void reveal()}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();hide()}}} onBlur={hide} onContextMenu={e=>e.preventDefault()}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg><span>Hold to view</span></button></div><p className="tiny">Hold the eye button to show the PIN. It hides as soon as you release. Use it for QR check-in.</p><button type="button" className="text-button pin-rotate" disabled={busy} onClick={rotate}>{busy?'Creating…':'Replace this PIN'}</button></>:<><p className="muted">Your older PIN cannot be shown because only its hash was saved. You can replace it with a new PIN that this portal can display.</p><button type="button" className="button outline" disabled={busy} onClick={rotate}>{busy?'Creating…':'Create a viewable PIN'}</button><p className="tiny">This replaces your current PIN for this class. Your teacher can also reset it for you.</p></>}
  {error&&<div className="notice error" role="alert">{error}</div>}
 </section>
}
