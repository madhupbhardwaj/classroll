import { currentTeacher, db, id, jsonError, sameOrigin } from '../../../lib/attendance';

async function ownedClass(classId:string,teacherId:string){return await db().prepare('SELECT id,name FROM classes WHERE id=? AND teacher_id=? AND archived_at IS NULL').bind(classId,teacherId).first<{id:string,name:string}>()}
async function ownedTask(taskId:string,classId:string){return await db().prepare('SELECT id,name,due_date,description FROM tasks WHERE id=? AND class_id=?').bind(taskId,classId).first<{id:string,name:string,due_date:string,description:string|null}>()}
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;

export async function GET(request:Request){
 try {
  const auth=await currentTeacher();if(!auth)return jsonError('Sign in to continue.',401);
  const classId=new URL(request.url).searchParams.get('classId')||'';
  if(!await ownedClass(classId,auth.teacher.id))return jsonError('Class not found.',404);
  const [tasks,students,marks]=await Promise.all([
   db().prepare('SELECT id,name,due_date,description,created_at FROM tasks WHERE class_id=? ORDER BY due_date DESC,created_at DESC').bind(classId).all(),
   db().prepare('SELECT id,name,roll,email FROM students WHERE class_id=? AND archived_at IS NULL ORDER BY roll').bind(classId).all(),
   db().prepare('SELECT m.task_id,m.student_id,m.status FROM task_marks m JOIN tasks t ON t.id=m.task_id WHERE t.class_id=?').bind(classId).all(),
  ]);
  return Response.json({tasks:tasks.results,students:students.results,marks:marks.results});
 }catch(error){console.error('tasks GET',error);return jsonError('Could not load tasks. Please retry.',503)}
}

export async function POST(request:Request){
 if(!sameOrigin(request))return jsonError('Invalid request origin.',403);
 try {
  const auth=await currentTeacher();if(!auth)return jsonError('Sign in to continue.',401);
  const data=await request.json() as Record<string,unknown>;
  const classId=String(data.classId||''),action=String(data.action||'');
  if(!await ownedClass(classId,auth.teacher.id))return jsonError('Class not found.',404);
  if(action==='create'||action==='edit'){
   const name=String(data.name||'').trim().slice(0,120),dueDate=String(data.dueDate||''),description=String(data.description||'').trim().slice(0,1000);
   if(!name||!validDate(dueDate))return jsonError('Enter a task name and a valid date.');
   if(action==='create'){
    const taskId=id();await db().prepare('INSERT INTO tasks(id,class_id,name,due_date,description,created_at) VALUES(?,?,?,?,?,?)').bind(taskId,classId,name,dueDate,description||null,Date.now()).run();return Response.json({ok:true,taskId});
   }
   const taskId=String(data.taskId||'');if(!await ownedTask(taskId,classId))return jsonError('Task not found.',404);
   await db().prepare('UPDATE tasks SET name=?,due_date=?,description=? WHERE id=? AND class_id=?').bind(name,dueDate,description||null,taskId,classId).run();return Response.json({ok:true});
  }
  const taskId=String(data.taskId||'');if(!await ownedTask(taskId,classId))return jsonError('Task not found.',404);
  if(action==='delete'){
   await db().prepare('DELETE FROM tasks WHERE id=? AND class_id=?').bind(taskId,classId).run();return Response.json({ok:true});
  }
  if(action==='mark'){
   const studentId=String(data.studentId||''),status=String(data.status||'');
   if(!['submitted','missing','unmarked'].includes(status))return jsonError('Invalid status.');
   const student=await db().prepare('SELECT id FROM students WHERE id=? AND class_id=? AND archived_at IS NULL').bind(studentId,classId).first();
   if(!student)return jsonError('Student not found.',404);
   if(status==='unmarked')await db().prepare('DELETE FROM task_marks WHERE task_id=? AND student_id=?').bind(taskId,studentId).run();
   else await db().prepare('INSERT INTO task_marks(task_id,student_id,status,updated_at) VALUES(?,?,?,?) ON CONFLICT(task_id,student_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at').bind(taskId,studentId,status,Date.now()).run();
   return Response.json({ok:true});
  }
  return jsonError('Unknown action.');
 }catch(error){console.error('tasks POST',error);return jsonError('Could not save task. Please retry.',503)}
}
