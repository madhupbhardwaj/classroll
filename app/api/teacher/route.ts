import { currentTeacher, db, id, jsonError, localDate, pinHash, qrToken, randomCode, slotNow, secret, sha, sameOrigin } from '../../../lib/attendance';

export async function GET(request: Request) {
  try {
    const auth = await currentTeacher();
    if (!auth) return jsonError('Sign in to continue.', 401);
    const url = new URL(request.url);
    const selected = url.searchParams.get('classId');
    const classes = (await db().prepare('SELECT id, name, code, timezone FROM classes ORDER BY created_at DESC').bind().all()).results;
    const studentId = url.searchParams.get('studentId');
    if (studentId) {
      const classId = String(selected || '');
      const klass = classes.find(c => c.id === classId);
      if (!klass) return jsonError('Class not found.', 404);
      const student = await db().prepare('SELECT id, name, roll, created_at FROM students WHERE id = ? AND class_id = ?').bind(studentId, classId).first();
      if (!student) return jsonError('Student not found.', 404);
      const history = (await db().prepare('SELECT s.date, a.status, a.method, a.checked_at, a.note FROM sessions s LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = ? WHERE s.class_id = ? AND s.ends_at >= ? ORDER BY s.date DESC').bind(studentId, classId, student.created_at).all()).results;
      return Response.json({ student, className: klass.name, history });
    }
    const activeClass = classes.find((c) => c.id === selected) || classes[0];
    if (!activeClass) return Response.json({ teacher: auth.teacher, classes: [], students: [], session: null, attendance: [], invitations: [] });
    const classId = String(activeClass.id);
    const today = localDate(String(activeClass.timezone));
    const requestedDate = url.searchParams.get('date');
    const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today ? requestedDate : today;
    const [studentRows, session, inviteRows] = await Promise.all([
      db().prepare('SELECT id, name, roll, created_at FROM students WHERE class_id = ? ORDER BY roll').bind(classId).all(),
      db().prepare('SELECT id, starts_at, ends_at, closed_at, secret FROM sessions WHERE class_id = ? AND date = ?').bind(classId, date).first<{id:string,starts_at:number,ends_at:number,closed_at:number|null,secret:string}>(),
      db().prepare('SELECT email FROM invitations ORDER BY created_at DESC').bind().all(),
    ]);
    const attendance = session ? (await db().prepare('SELECT student_id, status, method, checked_at, note FROM attendance WHERE session_id = ?').bind(session.id).all()).results : [];
    const now = Date.now();
    const open = !!session && !session.closed_at && now < session.ends_at;
    const visibleStudents = session ? studentRows.results.filter(s => Number(s.created_at) <= session.ends_at) : date === today ? studentRows.results : [];
    return Response.json({ teacher: auth.teacher, classes, students: visibleStudents, session: session ? { id: session.id, date, startsAt: session.starts_at, endsAt: session.ends_at, closedAt: session.closed_at, open, token: open ? await qrToken(session.secret, slotNow()) : null } : null, attendance, invitations: inviteRows.results });
  } catch (error) { console.error('teacher GET', error); return jsonError('Attendance is temporarily unavailable. Please try again.', 503); }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return jsonError('Invalid request origin.', 403);
    const auth = await currentTeacher();
    if (!auth) return jsonError('Sign in to continue.', 401);
    const data = await request.json() as Record<string, unknown>;
    const action = String(data.action || '');
    if (!auth.teacher) return jsonError('Teacher access required.', 403);
    if (action === 'invite') {
      const email = String(data.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Enter a valid email.');
      const inviteCode = secret();
      await db().prepare('INSERT INTO invitations(email,invited_by,code_hash,created_at) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET invited_by=EXCLUDED.invited_by,code_hash=EXCLUDED.code_hash,created_at=EXCLUDED.created_at').bind(email, auth.teacher.id, await sha(inviteCode), Date.now()).run();
      return Response.json({ ok: true, inviteCode, email });
    }
    if (action === 'createClass') {
      const name = String(data.name || '').trim().slice(0, 80);
      if (!name) return jsonError('Enter a class name.');
      const code = randomCode(7);
      const classId = id();
      await db().prepare('INSERT INTO classes(id,teacher_id,name,code,timezone,created_at) VALUES(?,?,?,?,?,?)').bind(classId, auth.teacher.id, name, code, 'Asia/Kolkata', Date.now()).run();
      return Response.json({ ok: true, classId });
    }
    const classId = String(data.classId || '');
    const klass = await db().prepare('SELECT id,timezone FROM classes WHERE id = ?').bind(classId).first<{id:string,timezone:string}>();
    if (!klass) return jsonError('Class not found.', 404);
    if (action === 'addStudent') {
      const name = String(data.name || '').trim().slice(0, 80), roll = String(data.roll || '').trim().slice(0, 30);
      if (!name || !roll) return jsonError('Name and roll number are required.');
      const pin = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
      const salt = id();
      try { await db().prepare('INSERT INTO students(id,class_id,name,roll,pin_salt,pin_hash,created_at) VALUES(?,?,?,?,?,?,?)').bind(id(), classId, name, roll, salt, await pinHash(pin, salt), Date.now()).run(); }
      catch { return jsonError('That roll number is already in the class.'); }
      return Response.json({ ok: true, pin, name, roll });
    }
    if (action === 'resetPin') {
      const studentId = String(data.studentId || '');
      const student = await db().prepare('SELECT id,name,roll FROM students WHERE id = ? AND class_id = ?').bind(studentId, classId).first<{id:string,name:string,roll:string}>();
      if (!student) return jsonError('Student not found.', 404);
      const pin = String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000), salt = id();
      await db().prepare('UPDATE students SET pin_salt = ?, pin_hash = ?, failed_count = 0 WHERE id = ?').bind(salt, await pinHash(pin, salt), studentId).run();
      return Response.json({ ok: true, pin, name: student.name, roll: student.roll });
    }
    const today = localDate(klass.timezone);
    const requestedDate = String(data.date || '');
    const date = action === 'manual' && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today ? requestedDate : today;
    const session = await db().prepare('SELECT id,closed_at,ends_at FROM sessions WHERE class_id = ? AND date = ?').bind(classId,date).first<{id:string,closed_at:number|null,ends_at:number}>();
    if (action === 'start') {
      if (session) return jsonError('A session already exists for this class today.');
      const now = Date.now();
      await db().prepare('INSERT INTO sessions(id,class_id,date,starts_at,ends_at,secret) VALUES(?,?,?,?,?,?)').bind(id(),classId,date,now,now+Number(Math.min(120,Math.max(5,Number(data.minutes)||20)))*60000,id()+id()).run();
      return Response.json({ok:true});
    }
    if (!session) return jsonError('Start today’s session first.');
    if (action === 'close') {
      await db().prepare('UPDATE sessions SET closed_at = ? WHERE id = ? AND closed_at IS NULL').bind(Date.now(),session.id).run();
      return Response.json({ok:true});
    }
    if (action === 'manual') {
      const studentId = String(data.studentId || ''), status = String(data.status || ''), note = String(data.note || '').trim().slice(0,200);
      if (!['present','late','absent','excused'].includes(status) || !note) return jsonError('Choose a status and add a reason.');
      const student = await db().prepare('SELECT id FROM students WHERE id = ? AND class_id = ?').bind(studentId,classId).first();
      if (!student) return jsonError('Student not found.',404);
      await db().prepare('INSERT INTO attendance(id,session_id,student_id,status,method,checked_at,note) VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status,method=excluded.method,checked_at=excluded.checked_at,note=excluded.note').bind(id(),session.id,studentId,status,'manual',Date.now(),note).run();
      return Response.json({ok:true});
    }
    return jsonError('Unknown action.');
  } catch (error) { console.error('teacher POST', error); return jsonError('Could not save your change. Please retry.',503); }
}
