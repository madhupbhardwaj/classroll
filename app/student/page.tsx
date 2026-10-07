import { getStudentAccount } from '../../lib/attendance';
import StudentApp from './student-app';
export const dynamic='force-dynamic';
export default async function StudentPage(){const account=await getStudentAccount();return <StudentApp signedIn={!!account}/>}
