import { getTeacher } from '../../lib/attendance';
import TeacherApp from './teacher-app';
import TeacherAccess from './teacher-access';
export const dynamic='force-dynamic';
export default async function TeacherPage(){const teacher=await getTeacher();return teacher?<TeacherApp name={teacher.name}/>:<TeacherAccess/>}
