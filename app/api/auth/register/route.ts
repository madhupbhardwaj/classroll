import { createSession, db, id, jsonError, passwordHash, safeEqualHex, sameOrigin, secret, sha } from '../../../../lib/attendance';
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError('Invalid request origin.',403);
 try {const data=await request.json() as Record<string,unknown>;
 const name=String(data.name||'').trim().slice(0,80),email=String(data.email||'').trim().toLowerCase(),password=String(data.password||''),code=String(data.code||'').trim();
 if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<12||password.length>200||!code)return jsonError('Enter your name, email, a password of at least 12 characters, and the setup or invitation code.');
 const exists=await db().prepare('SELECT id FROM teachers LIMIT 1').bind().first();
 let invited=false;
 if(!exists){const setup=process.env.TEACHER_SETUP_CODE;if(!setup||!safeEqualHex(await sha(code),await sha(setup)))return jsonError('Invalid setup code.',403)}
 else {const invite=await db().prepare('SELECT code_hash FROM invitations WHERE email=?').bind(email).first<{code_hash:string}>();if(!invite||!safeEqualHex(await sha(code),invite.code_hash))return jsonError('Invalid invitation code.',403);invited=true}
 const teacherId=id(),salt=secret();
 if(invited){await db().prepare('INSERT INTO teachers(id,email,name,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(teacherId,email,name,salt,await passwordHash(password,salt),Date.now()).run();await db().prepare('DELETE FROM invitations WHERE email=? AND code_hash=?').bind(email,await sha(code)).run()}
 else {const r=await db().prepare('INSERT INTO teachers(id,email,name,password_salt,password_hash,created_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM teachers) ON CONFLICT(email) DO NOTHING').bind(teacherId,email,name,salt,await passwordHash(password,salt),Date.now()).run();if(!r.meta.changes)return jsonError('Initial setup is already complete.',403)}
 const teacher=await db().prepare('SELECT id FROM teachers WHERE id=?').bind(teacherId).first();if(!teacher)return jsonError('Could not create this account.',409);
 await createSession(teacherId);return Response.json({ok:true});
 }catch(error){console.error('register',error);return jsonError('Could not create the teacher account. Please try again.',503)}
}
