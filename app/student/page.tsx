import { getStudentAccount } from '../../lib/attendance';
import StudentApp from './student-app';
export const dynamic='force-dynamic';
export default async function StudentPage(){const account=await getStudentAccount();return <StudentApp signedIn={!!account} googleClientId={process.env.GOOGLE_CLIENT_ID||''} googleCallbackUrl={process.env.GOOGLE_CALLBACK_URL||''}/>}
