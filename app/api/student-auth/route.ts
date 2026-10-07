import { cookies } from 'next/headers';
import { db, jsonError, sameOrigin, sha } from '../../../lib/attendance';

// Google is the only student sign-in method. This endpoint only ends sessions.
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError('Invalid request origin.',403);
 try{
  const data=await request.json() as {action?:string};
  if(data.action!=='logout')return jsonError('Student passwords are no longer used. Sign in with Google.',400);
  const jar=await cookies();
  const token=jar.get('classroll_student')?.value;
  if(token)await db().prepare('DELETE FROM student_sessions WHERE token_hash=?').bind(await sha(token)).run();
  jar.delete('classroll_student');
  return Response.json({ok:true});
 }catch(error){console.error('student logout',error);return jsonError('Could not sign out. Please retry.',503)}
}
