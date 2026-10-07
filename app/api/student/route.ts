import { db, getStudentAccount, jsonError, newStudentPin, pinHash, sameOrigin, safeEqualHex, viewablePin } from '../../../lib/attendance';

export async function GET(){
 try {
  const account=await getStudentAccount();if(!account)return jsonError('Sign in to continue.',401);
  const classes=(await db().prepare("SELECT s.id AS student_id,s.roll,c.id AS class_id,c.name,c.code,(s.pin_salt LIKE 'v2:%') AS pin_ready FROM students s JOIN classes c ON c.id=s.class_id WHERE s.account_id=? AND s.email=? AND s.archived_at IS NULL AND c.archived_at IS NULL ORDER BY c.name").bind(account.id,account.email).all()).results;
  const items=[];
  for(const klass of classes){
   const [tasks,attendance]=await Promise.all([
    db().prepare('SELECT t.id,t.name,t.description,t.due_date,m.status FROM tasks t LEFT JOIN task_marks m ON m.task_id=t.id AND m.student_id=? WHERE t.class_id=? ORDER BY t.due_date DESC,t.created_at DESC').bind(klass.student_id,klass.class_id).all(),
    db().prepare('SELECT se.date,a.status,a.method,a.checked_at FROM sessions se LEFT JOIN attendance a ON a.session_id=se.id AND a.student_id=? WHERE se.class_id=? AND se.ends_at >= (SELECT created_at FROM students WHERE id=?) ORDER BY se.date DESC').bind(klass.student_id,klass.class_id,klass.student_id).all(),
   ]);
   items.push({...klass,tasks:tasks.results,attendance:attendance.results});
  }
  return Response.json({account:{name:account.name,email:account.email},classes:items},{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('student dashboard',error);return jsonError('Could not load classes. Please retry.',503)}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError('Invalid request origin.',403);
 try {
  const account=await getStudentAccount();if(!account)return jsonError('Sign in to continue.',401);
  const data=await request.json() as Record<string,unknown>;
  const action=String(data.action||'');
  if(action==='revealPin'||action==='rotatePin'){
   const classId=String(data.classId||'');
   const student=await db().prepare('SELECT s.id,s.pin_salt,s.pin_hash FROM students s JOIN classes c ON c.id=s.class_id WHERE c.id=? AND s.account_id=? AND s.email=? AND s.archived_at IS NULL AND c.archived_at IS NULL').bind(classId,account.id,account.email).first<{id:string,pin_salt:string,pin_hash:string}>();
   if(!student)return jsonError('Class not found.',404);
   if(action==='rotatePin'){
    if(!process.env.PIN_DISPLAY_KEY)return jsonError('PIN viewing is not configured. Ask the site owner to set PIN_DISPLAY_KEY.',503);
    const {pin:newPin,salt}=newStudentPin(student.id,true);
    await db().prepare('UPDATE students SET pin_salt=?,pin_hash=?,failed_count=0,failed_at=0 WHERE id=? AND account_id=? AND email=?').bind(salt,await pinHash(newPin,salt),student.id,account.id,account.email).run();
    return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}});
   }
   const currentPin=viewablePin(student.id,student.pin_salt);
   if(!currentPin)return jsonError(student.pin_salt.startsWith('v2:')?'PIN viewing is not configured. Ask the site owner for help.':'This older PIN cannot be displayed. Create a new viewable PIN first.',409);
   if(!safeEqualHex(await pinHash(currentPin,student.pin_salt),student.pin_hash))return jsonError('This PIN cannot be displayed. Create a new viewable PIN.',409);
   return Response.json({pin:currentPin},{headers:{'Cache-Control':'no-store'}});
  }
  if(action&&action!=='join')return jsonError('Unknown action.');
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
