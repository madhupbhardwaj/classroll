'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import PinReveal from './pin-reveal';

type Task={id:string,name:string,description:string|null,due_date:string,status:string|null};
type Attendance={date:string,status:string|null,method:string|null,checked_at:number|null};
type ClassItem={class_id:string,student_id:string,name:string,code:string,roll:string,pin_ready:boolean,tasks:Task[],attendance:Attendance[]};

export default function StudentApp({signedIn,googleClientId,googleCallbackUrl}:{signedIn:boolean;googleClientId:string;googleCallbackUrl:string}){
 const [loggedIn,setLoggedIn]=useState(signedIn);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [classes,setClasses]=useState<ClassItem[]>([]),[account,setAccount]=useState<{name:string,email:string}|null>(null);
 const [code,setCode]=useState(''),[roll,setRoll]=useState(''),[pin,setPin]=useState(''),[active,setActive]=useState('');
 const load=useCallback(async()=>{
  try{
   const res=await fetch('/api/student',{cache:'no-store'});
   const data=await res.json();
   if(!res.ok)throw new Error(data.error);
   setAccount(data.account);setClasses(data.classes);
   setActive((old:string)=>data.classes.some((c:ClassItem)=>c.class_id===old)?old:data.classes[0]?.class_id||'');
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Could not load your classes')}
 },[]);
 useEffect(()=>{if(loggedIn)load()},[loggedIn,load]);
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const authError=params.get('auth_error');
  if(authError){setError(authError);window.history.replaceState(null,'',window.location.pathname)}
 },[]);

 async function join(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{
   const r=await fetch('/api/student',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,roll,pin})});
   const d=await r.json();if(!r.ok)throw new Error(d.error);
   setCode('');setRoll('');setPin('');setNotice('Class joined.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Could not join class')}finally{setBusy(false)}
 }
 const selected=classes.find(c=>c.class_id===active);
 return <>
  <header className="topbar"><div className="topbar-inner">
   <Link className="brand" href="/"><img className="brand-mark" src="/favicon.svg" width="34" height="34" alt=""/>classroll</Link>
   <nav>{loggedIn&&<button className="text-button" onClick={async()=>{
    try{const r=await fetch('/api/student-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});if(!r.ok)throw new Error();setClasses([]);setAccount(null);setLoggedIn(false);setNotice('Signed out.')}catch{setError('Could not sign out. Please retry.')}
   }}>Sign out</button>}</nav>
  </div></header>
  <main className="workspace">
   <div className="page-head"><div><p className="eyebrow">STUDENT PORTAL</p><h1>{loggedIn?'Your classes':'Student sign in'}</h1>
    <p className="muted">{loggedIn?`Welcome${account?' back, '+account.name:''}. See your tasks and attendance for each class.`:'Choose the Google account whose email your teacher will add to the class roster.'}</p></div>
    {loggedIn&&<Link className="button outline" href="/check-in">Scan QR for attendance</Link>}
   </div>
   {error&&<div className="notice error" role="alert">{error}</div>}{notice&&<div className="notice success" role="status">{notice}</div>}
   {!loggedIn?<section className="panel student-auth google-auth"><h2>Continue with Google</h2><p className="muted">The same button creates your student account the first time and signs you in afterward.</p>
    {googleClientId&&googleCallbackUrl?<>
     <div id="g_id_onload" data-client_id={googleClientId} data-login_uri={googleCallbackUrl} data-ux_mode="redirect" data-auto_prompt="false"/>
     <div className="g_id_signin" data-type="standard" data-size="large" data-theme="outline" data-text="continue_with" data-shape="rectangular" data-logo_alignment="left" data-width="300"/>
     <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive"/>
    </>:<p className="notice error">Google sign-in is not configured yet. Ask the site owner to add the Google client ID and callback URL in Vercel.</p>}
    <p className="field-hint">Use a Gmail or Google Workspace account. Your teacher must enter this exact email in the roster.</p>
   </section>:<div className="student-layout">
    <aside>
     <section className="panel"><h2>Enrolled classes</h2>{classes.length?classes.map(c=><button className={'task-item '+(active===c.class_id?'active':'')} key={c.class_id} onClick={()=>setActive(c.class_id)}><span><strong>{c.name}</strong><small>Roll {c.roll}</small></span></button>):<p className="muted">No classes joined yet.</p>}</section>
     <section className="panel"><h2>Join a class</h2><p className="muted">Ask your teacher to add your Google account email <strong>{account?.email}</strong> to the roster. Then enter your class code, roll number and private PIN.</p>
      <form className="stack" onSubmit={join}><label className="field">Class code<input required value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/></label><label className="field">Roll number<input required value={roll} onChange={e=>setRoll(e.target.value)}/></label><label className="field">Your six-digit PIN<input required type="password" inputMode="numeric" pattern="[0-9]{6}" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/></label><button className="button primary" disabled={busy}>{busy?'Joining…':'Join class'}</button></form>
     </section>
    </aside>
    <div>{selected?<>
     <PinReveal key={selected.class_id} classId={selected.class_id} ready={selected.pin_ready} onChanged={load}/>
     <section className="panel"><h2>{selected.name} · Tasks</h2>{selected.tasks.length?<div className="task-cards">{selected.tasks.map(t=><article className="task-card" key={t.id}><div><h3>{t.name}</h3><p className="tiny">Due {t.due_date}</p>{t.description&&<p className="muted">{t.description}</p>}</div><span className={'pill '+(t.status==='submitted'?'present':t.status==='missing'?'absent':'')}>{t.status==='submitted'?'Submitted':t.status==='missing'?'Not submitted':'Not checked yet'}</span></article>)}</div>:<p className="muted">No tasks have been assigned yet.</p>}</section>
     <section className="panel"><h2>Attendance</h2>{selected.attendance.length?<div className="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Recorded by</th></tr></thead><tbody>{selected.attendance.map(a=><tr key={a.date}><td>{a.date}</td><td><span className={'pill '+(a.status||'absent')}>{a.status||'Absent'}</span></td><td>{a.method||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">No attendance sessions recorded for this class yet.</p>}</section>
    </>:<section className="panel empty-state"><h2>Your class dashboard will appear here</h2><p>Join your first class to see its tasks and attendance.</p></section>}</div>
   </div>}
  </main>
 </>
}
