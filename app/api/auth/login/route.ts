import { createSession, db, jsonError, passwordHash, safeEqualHex, sameOrigin } from '../../../../lib/attendance';
export async function POST(request:Request){if(!sameOrigin(request))return jsonError('Invalid request origin.',403);
 try{const data=await request.json() as Record<string,unknown>;const email=String(data.email||'').trim().toLowerCase(),password=String(data.password||'');
 const teacher=await db().prepare('SELECT id,password_salt,password_hash,failed_at,failed_count FROM teachers WHERE email=?').bind(email).first<{id:string,password_salt:string,password_hash:string,failed_at:number,failed_count:number}>();
 if(!teacher)return jsonError('Email or password is incorrect.',403);
 const now=Date.now();if(teacher.failed_count>=5&&now-teacher.failed_at<15*60000)return jsonError('Too many attempts. Wait 15 minutes.',429);
 const match=safeEqualHex(await passwordHash(password,teacher.password_salt),teacher.password_hash);
 if(!match){await db().prepare('UPDATE teachers SET failed_count=?,failed_at=? WHERE id=?').bind(now-teacher.failed_at>15*60000?1:teacher.failed_count+1,now,teacher.id).run();return jsonError('Email or password is incorrect.',403)}
 await db().prepare('UPDATE teachers SET failed_count=0 WHERE id=?').bind(teacher.id).run();await createSession(teacher.id);return Response.json({ok:true});
 }catch(error){console.error('login',error);return jsonError('Could not sign in. Please try again.',503)}}
