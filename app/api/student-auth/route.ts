import { cookies } from 'next/headers';
import { createStudentSession, db, getStudentAccount, id, jsonError, passwordHash, safeEqualHex, sameOrigin, secret, sha } from '../../../lib/attendance';

export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError('Invalid request origin.',403);
 try {
  const data=await request.json() as Record<string,unknown>;
  const action=String(data.action||'');
  if(action==='logout'){
   const token=(await cookies()).get('classroll_student')?.value;
   if(token)await db().prepare('DELETE FROM student_sessions WHERE token_hash=?').bind(await sha(token)).run();
   (await cookies()).delete('classroll_student');return Response.json({ok:true});
  }
  const email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return jsonError('Enter a valid email.');
  if(action==='register'){
   const name=String(data.name||'').trim().slice(0,80);
   if(!name||password.length<12||password.length>200)return jsonError('Enter your name and a password of 12–200 characters.');
   const accountId=id(),salt=secret();
   const result=await db().prepare('INSERT INTO student_accounts(id,email,name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(accountId,email,name,salt,await passwordHash(password,salt),Date.now()).run();
   if(!result.meta.changes)return jsonError('An account with this email already exists.',409);
   await createStudentSession(accountId);return Response.json({ok:true});
  }
  if(action==='login'){
   const account=await db().prepare('SELECT id,password_salt,password_hash,failed_at,failed_count FROM student_accounts WHERE email=?').bind(email).first<{id:string,password_salt:string,password_hash:string,failed_at:number,failed_count:number}>();
   if(!account)return jsonError('Email or password is incorrect.',403);
   const now=Date.now();if(account.failed_count>=5&&now-account.failed_at<15*60000)return jsonError('Too many attempts. Wait 15 minutes.',429);
   const match=safeEqualHex(await passwordHash(password,account.password_salt),account.password_hash);
   if(!match){await db().prepare('UPDATE student_accounts SET failed_count=?,failed_at=? WHERE id=?').bind(now-account.failed_at>15*60000?1:account.failed_count+1,now,account.id).run();return jsonError('Email or password is incorrect.',403)}
   await db().prepare('UPDATE student_accounts SET failed_count=0 WHERE id=?').bind(account.id).run();
   await createStudentSession(account.id);return Response.json({ok:true});
  }
  return jsonError('Unknown action.');
 }catch(error){console.error('student auth',error);return jsonError('Could not continue. Please try again.',503)}
}
