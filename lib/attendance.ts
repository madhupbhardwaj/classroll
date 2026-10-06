import { db } from './db';
import { cookies } from 'next/headers';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export { db };
export function jsonError(message:string,status=400){return Response.json({error:message},{status})}
export function id(){return crypto.randomUUID()}
export function randomCode(length=6){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=crypto.getRandomValues(new Uint8Array(length));return [...bytes].map(x=>chars[x%chars.length]).join('')}
export function localDate(timezone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export async function sha(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function pinHash(pin:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:120000,hash:'SHA-256'},key,256);return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function qrToken(secret:string,slot:number){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const result=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(String(slot)));return [...new Uint8Array(result)].map(x=>x.toString(16).padStart(2,'0')).join('')}
export const slotNow=()=>Math.floor(Date.now()/30000);
export async function passwordHash(password:string,salt:string){return (await scrypt(password,salt,64) as Buffer).toString('hex')}
export function safeEqualHex(a:string,b:string){if(a.length!==b.length)return false;return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'))}
export function secret(){return randomBytes(32).toString('hex')}
export async function getTeacher(){const token=(await cookies()).get('classroll_session')?.value;if(!token)return null;const teacher=await db().prepare('SELECT t.id,t.email,t.name FROM teachers t JOIN teacher_sessions s ON s.teacher_id=t.id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha(token),Date.now()).first<{id:string,email:string,name:string}>();return teacher}
export async function currentTeacher(){const teacher=await getTeacher();return teacher?{teacher}:null}
export async function createSession(teacherId:string){const token=secret();await db().prepare('INSERT INTO teacher_sessions(token_hash,teacher_id,expires_at) VALUES(?,?,?)').bind(await sha(token),teacherId,Date.now()+30*86400000).run();(await cookies()).set('classroll_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:30*86400})}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin}
