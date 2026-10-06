import { cookies } from 'next/headers';
import { db, sameOrigin, sha } from '../../../../lib/attendance';
export async function POST(request:Request){if(!sameOrigin(request))return Response.json({error:'Invalid origin'},{status:403});const cookieStore=await cookies();const token=cookieStore.get('classroll_session')?.value;if(token)await db().prepare('DELETE FROM teacher_sessions WHERE token_hash=?').bind(await sha(token)).run();cookieStore.delete('classroll_session');return Response.json({ok:true})}
