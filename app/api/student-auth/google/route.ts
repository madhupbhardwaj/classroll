import { cookies } from 'next/headers';
import { createStudentSession, db, id } from '../../../../lib/attendance';
import { verifyGoogleIdToken } from '../../../../lib/google';

function back(request:Request, error:string){
 const url=new URL('/student',request.url);
 url.searchParams.set('auth_error',error);
 return Response.redirect(url,303);
}

export async function POST(request:Request){
 try{
  const form=await request.formData();
  const csrf=form.get('g_csrf_token');
  const cookie=(await cookies()).get('g_csrf_token')?.value;
  if(typeof csrf!=='string'||!csrf||!cookie||csrf!==cookie)return back(request,'Google sign-in could not be verified. Please try again.');
  const credential=form.get('credential');
  if(typeof credential!=='string')return back(request,'Google did not return a sign-in credential.');
  const clientId=process.env.GOOGLE_CLIENT_ID||'';
  const profile=await verifyGoogleIdToken(credential,clientId);
  let account=await db().prepare('SELECT id,email FROM student_accounts WHERE google_sub=?').bind(profile.sub).first<{id:string;email:string}>();
  if(account){
   if(account.email!==profile.email){
    try{await db().prepare('UPDATE student_accounts SET email=? WHERE id=?').bind(profile.email,account.id).run()}
    catch{return back(request,'This email is already registered to a different Google account. Ask the site owner for help.')}
   }
  }else{
   const newId=id();
   const result=await db().prepare('INSERT INTO student_accounts(id,email,name,google_sub,created_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').bind(newId,profile.email,profile.name,profile.sub,Date.now()).run();
   account=result.meta.changes?{id:newId,email:profile.email}:await db().prepare('SELECT id,email FROM student_accounts WHERE google_sub=?').bind(profile.sub).first<{id:string;email:string}>();
   if(!account)return back(request,'This email is already registered. Ask the site owner to clear the old test account.');
  }
  await createStudentSession(account.id);
  return Response.redirect(new URL('/student',request.url),303);
 }catch(error){
  console.error('Google student sign-in',error);
  const message=error instanceof Error&&error.message.startsWith('Use a Gmail')?error.message:'Could not sign in with Google. Please retry.';
  return back(request,message);
 }
}
