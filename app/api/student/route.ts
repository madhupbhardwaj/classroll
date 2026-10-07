import { db, getStudentAccount, jsonError, pinHash, sameOrigin, safeEqualHex } from '../../../lib/attendance';

export async function GET(){
 try {
  const account=await getStudentAccount();if(!account)return jsonError('Sign in to continue.',401);
  const classes=(await db().prepare('SELECT s.id AS student_id,s.roll,c.id AS class_id,c.name,c.code FROM students s JOIN classes c ON c.id=s.class_id WHERE s.account_id=? AND s.email=? AND s.archived_at IS NULL AND c.archived_at IS NULL ORDER BY c.name').bind(account.id,account.email).all()).results;
  const items=[];
  for(const klass of classes){
   const [tasks,attendance]=await Promise.all([
    db().prepare('SELECT t.id,t.name,t.description,t.due_date,m.status FROM tasks t LEFT JOIN task_marks m ON m.task_id=t.id AND m.student_id=? WHERE t.class_id=? ORDER BY t.due_date DESC,t.created_at DESC').bind(klass.student_id,klass.class_id).all(),
    db().prepare('SELECT se.date,a.status,a.method,a.checked_at FROM sessions se LEFT JOIN attendance a ON a.session_id=se.id AND a.student_id=? WHERE se.class_id=? AND se.ends_at >= (SELECT created_at FROM students WHERE id=?) ORDER BY se.date DESC').bind(klass.student_id,klass.class_id,klass.student_id).all(),
   ]);
   items.push({...klass,tasks:tasks.results,attendance:attendance.results});
  }
  return Response.json({account:{name:account.name,email:account.email},classes:items});
 }catch(error){console.error('student dashboard',error);return jsonError('Could not load classes. Please retry.',503)}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError('Invalid request origin.',403);
 try {
  const account=await getStudentAccount();if(!account)return jsonError('Sign in to continue.',401);
  const data=await request.json() as Record<string,unknown>;
  const code=String(data.code||'').trim().toUpperCase(),roll=String(data.roll||'').trim(),pin=String(data.pin||'');
  if(!code||!roll||!/^\d{6}$/.test(pin))return jsonError('Enter the class code, roll number and six-digit PIN.');
  const student=await db().prepare('SELECT s.id,s.account_id,s.pin_salt,s.pin_hash,s.failed_at,s.failed_count FROM students s JOIN classes c ON c.id=s.class_id WHERE c.code=? AND s.roll=? AND s.email=? AND s.archived_at IS NULL AND c.archived_at IS NULL').bind(code,roll,account.email).first<{id:string,account_id:string|null,pin_salt:string,pin_hash:string,failed_at:number,failed_count:number}>();
  if(!student||student.account_id&&student.account_id!==account.id)return jsonError('Class or student details could not be verified.',403);
  const now=Date.now();if(student.failed_count>=5&&now-student.failed_at<15*60000)return jsonError('Too many attempts. Ask your teacher to reset your PIN or wait 15 minutes.',429);
  if(!safeEqualHex(await pinHash(pin,student.pin_salt),student.pin_hash)){
   await db().prepare('UPDATE students SET failed_count=?,failed_at=? WHERE id=?').bind(now-student.failed_at>15*60000?1:student.failed_count+1,now,student.id).run();
   return jsonError('Class or student details could not be verified.',403);
  }
  const linked=await db().prepare('UPDATE students SET account_id=?,failed_count=0 WHERE id=? AND email=? AND (account_id IS NULL OR account_id=?)').bind(account.id,student.id,account.email,account.id).run();
  if(!linked.meta.changes)return jsonError('Class membership changed. Ask your teacher to verify your email.',409);
  return Response.json({ok:true});
 }catch(error){console.error('student join',error);return jsonError('Could not join class. Please retry.',503)}
}
