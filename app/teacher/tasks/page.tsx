import { getTeacher } from '../../../lib/attendance';
import TeacherTasks from './teacher-tasks';
import TeacherAccess from '../teacher-access';
export const dynamic='force-dynamic';
export default async function TasksPage(){const teacher=await getTeacher();return teacher?<TeacherTasks name={teacher.name}/>:<TeacherAccess/>}
