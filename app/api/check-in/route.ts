import { db, jsonError, pinHash, qrToken, slotNow, id, sameOrigin, safeEqualHex } from '../../../lib/attendance';
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return jsonError('Invalid request origin.',403);
    const data = await request.json() as Record<string, unknown>;
    const code = String(data.code || '').trim().toUpperCase(), roll = String(data.roll || '').trim(), pin = String(data.pin || ''), token = String(data.token || ''), sessionId = String(data.sessionId || '');
    if (!code || !roll || !/^\d{6}$/.test(pin) || !/^[a-f0-9]{64}$/.test(token) || !sessionId) return jsonError('Check the class code, roll number, PIN, and QR link.');
    const klass = await db().prepare('SELECT id FROM classes WHERE code = ? AND archived_at IS NULL').bind(code).first<{id:string}>();
    if (!klass) return jsonError('Class or student details could not be verified.',403);
    const student = await db().prepare('SELECT id,pin_salt,pin_hash,failed_at,failed_count FROM students WHERE class_id = ? AND roll = ? AND archived_at IS NULL').bind(klass.id,roll).first<{id:string,pin_salt:string,pin_hash:string,failed_at:number,failed_count:number}>();
    if (!student) return jsonError('Class or student details could not be verified.',403);
    const now = Date.now();
    if (student.failed_count >= 5 && now - student.failed_at < 15*60000) return jsonError('Too many attempts. Ask your teacher to reset your PIN or wait 15 minutes.',429);
    const hash = await pinHash(pin,student.pin_salt);
    if (!safeEqualHex(hash, student.pin_hash)) {
      const failures = now-student.failed_at > 15*60000 ? 1 : student.failed_count+1;
      await db().prepare('UPDATE students SET failed_count = ?,failed_at = ? WHERE id = ?').bind(failures,now,student.id).run();
      return jsonError('Class or student details could not be verified.',403);
    }
    const session = await db().prepare('SELECT id,class_id,starts_at,ends_at,closed_at,secret FROM sessions WHERE id = ?').bind(sessionId).first<{id:string,class_id:string,starts_at:number,ends_at:number,closed_at:number|null,secret:string}>();
    if (!session || session.class_id !== klass.id || session.closed_at || now < session.starts_at || now >= session.ends_at) return jsonError('This attendance session is closed. Ask your teacher for help.',410);
    const slot = slotNow();
    const valid = token === await qrToken(session.secret,slot) || token === await qrToken(session.secret,slot-1);
    if (!valid) return jsonError('That QR code has expired. Scan the code on the teacher’s screen again.',410);
    await db().prepare('UPDATE students SET failed_count = 0 WHERE id = ?').bind(student.id).run();
    const result = await db().prepare('INSERT INTO attendance(id,session_id,student_id,status,method,checked_at) VALUES(?,?,?,?,?,?) ON CONFLICT(session_id,student_id) DO NOTHING').bind(id(),session.id,student.id,'present','qr',now).run();
    return Response.json({ok:true,already:!result.meta.changes,checkedAt:now});
  } catch (error) { console.error('checkin',error); return jsonError('Could not check in. Please retry or tell your teacher.',503); }
}
