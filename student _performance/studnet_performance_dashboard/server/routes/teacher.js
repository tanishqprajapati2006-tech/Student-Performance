const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET class stats for teacher dashboard
router.get('/stats', async (req, res) => {
    try {
        const [studentsRes, marksRes, attendanceRes] = await Promise.all([
            supabase.from('users').select('id, name, roll_no, bonus_points').eq('role', 'student'),
            supabase.from('marks').select('obtained_marks, max_marks, student_id'),
            supabase.from('attendance').select('student_id, status')
        ]);

        const students = studentsRes.data || [];
        const marks = marksRes.data || [];
        const attendance = attendanceRes.data || [];

        // Average mark across all
        const avgMark = marks.length
            ? Math.round(marks.reduce((s, m) => s + (m.obtained_marks || 0), 0) / marks.length)
            : 0;

        // Average attendance
        const totalAtt = attendance.length;
        const presentAtt = attendance.filter(a => a.status === 'Present').length;
        const avgAttendance = totalAtt ? Math.round((presentAtt / totalAtt) * 100) : 0;

        // Per-student attendance % to find at-risk (below 75%)
        const attByStudent = {};
        attendance.forEach(function(a) {
            if (!attByStudent[a.student_id]) attByStudent[a.student_id] = { total: 0, present: 0 };
            attByStudent[a.student_id].total++;
            if (a.status === 'Present') attByStudent[a.student_id].present++;
        });

        // Per-student avg marks
        const marksByStudent = {};
        marks.forEach(function(m) {
            if (!marksByStudent[m.student_id]) marksByStudent[m.student_id] = [];
            marksByStudent[m.student_id].push(m.obtained_marks || 0);
        });

        const atRisk = [];
        students.forEach(function(s) {
            const att = attByStudent[s.id];
            const pct = att ? Math.round((att.present / att.total) * 100) : null;
            // Only flag if student has at least 5 attendance records
            if (pct !== null && att.total >= 5 && pct < 75) {
                atRisk.push({ name: s.name + (s.roll_no ? ' (' + s.roll_no + ')' : ''), reason: 'Attendance at ' + pct + '% (below 75% threshold)' });
            }
            const studentMarks = marksByStudent[s.id];
            if (studentMarks && studentMarks.length > 0) {
                const avg = Math.round(studentMarks.reduce((a, b) => a + b, 0) / studentMarks.length);
                if (avg < 40) {
                    atRisk.push({ name: s.name + (s.roll_no ? ' (' + s.roll_no + ')' : ''), reason: 'Average marks at ' + avg + '% (failing)' });
                }
            }
        });

        // Top students by avg marks
        const topStudents = students.map(function(s) {
            const sm = marksByStudent[s.id] || [];
            const avg = sm.length ? Math.round(sm.reduce((a, b) => a + b, 0) / sm.length) : 0;
            return { name: s.name, roll_no: s.roll_no || '', avg };
        }).filter(s => s.avg > 0).sort((a, b) => b.avg - a.avg).slice(0, 5);

        res.json({
            success: true,
            totalStudents: students.length,
            avgMark,
            avgAttendance,
            atRisk,
            topStudents
        });
    } catch (err) {
        console.error('Teacher stats error:', err);
        res.status(500).json({ success: false });
    }
});

// GET all students with their stats (for student cards grid)
router.get('/students-full', async (req, res) => {
    try {
        const { data: students, error } = await supabase
            .from('users').select('id, name, roll_no, branch, year, bonus_points').eq('role', 'student');
        if (error || !students) return res.json({ success: true, students: [] });

        const [allMarks, allAtt, allCerts, allGoals] = await Promise.all([
            supabase.from('marks').select('student_id, obtained_marks'),
            supabase.from('attendance').select('student_id, status'),
            supabase.from('certificates').select('student_id'),
            supabase.from('goals').select('student_id, completed, total')
        ]);

        const marks = allMarks.data || [];
        const att = allAtt.data || [];
        const certs = allCerts.data || [];
        const goals = allGoals.data || [];

        const result = students.map(function(s, idx) {
            const sm = marks.filter(m => m.student_id === s.id);
            const sa = att.filter(a => a.student_id === s.id);
            const sc = certs.filter(c => c.student_id === s.id);
            const sg = goals.filter(g => g.student_id === s.id);

            const avgMarks = sm.length ? Math.round(sm.reduce((x, m) => x + (m.obtained_marks || 0), 0) / sm.length) : 0;
            const present = sa.filter(a => a.status === 'Present').length;
            const attPct = sa.length ? Math.round((present / sa.length) * 100) : 0;
            const completedGoals = sg.filter(g => g.completed >= g.total).length;

            const score = Math.round(
                (attPct / 100) * 30 +
                (sg.length > 0 ? (completedGoals / sg.length) * 25 : 0) +
                Math.min(sc.length * 4, 20) +
                (avgMarks / 100) * 10
            ) + (s.bonus_points || 0);

            return {
                id: s.id,
                name: s.name,
                roll_no: s.roll_no || '',
                branch: s.branch || '',
                year: s.year || '',
                avgMarks,
                attendance: attPct,
                certs: sc.length,
                goals: sg.length,
                completedGoals,
                score,
                bonusPoints: s.bonus_points || 0,
                atRisk: sa.length >= 5 && attPct < 75  // only flag if enough data exists
            };
        });

        result.sort((a, b) => b.score - a.score);
        res.json({ success: true, students: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, students: [] });
    }
});

// GET single student full detail (for student detail panel)
router.get('/student/:id', async (req, res) => {
    try {
        const sid = req.params.id;
        const [userRes, marksRes, attRes, certsRes, goalsRes] = await Promise.all([
            supabase.from('users').select('id, name, roll_no, branch, year, bonus_points').eq('id', sid).single(),
            supabase.from('marks').select('*').eq('student_id', sid),
            supabase.from('attendance').select('*').eq('student_id', sid).order('date', { ascending: false }),
            supabase.from('certificates').select('*').eq('student_id', sid),
            supabase.from('goals').select('*').eq('student_id', sid)
        ]);
        res.json({
            success: true,
            student: userRes.data,
            marks: marksRes.data || [],
            attendance: attRes.data || [],
            certificates: certsRes.data || [],
            goals: goalsRes.data || []
        });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

router.post('/marks', async (req, res) => {
    const { student_id, subject_code, subject_name, exam_type, max_marks, obtained_marks } = req.body;
    try {
        const pct = (obtained_marks / max_marks) * 100;
        let grade = 'F';
        if (pct >= 90) grade = 'A+';
        else if (pct >= 80) grade = 'A';
        else if (pct >= 70) grade = 'B+';
        else if (pct >= 60) grade = 'B';
        else if (pct >= 50) grade = 'C';
        else if (pct >= 40) grade = 'D';

        const { data, error } = await supabase
            .from('marks')
            .insert([{ student_id, subject_code, subject_name, exam_type, max_marks, obtained_marks, grade }])
            .select();
        if (error) throw error;
        res.json({ success: true, mark: data[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to save marks' });
    }
});

router.post('/announce', async (req, res) => {
    const { title, message, priority } = req.body;
    try {
        const { data, error } = await supabase
            .from('announcements')
            .insert([{ title, message, priority, author_name: req.profile.name || 'Teacher', posted_date: new Date().toISOString().split('T')[0] }])
            .select();
        if (error) throw error;
        res.json({ success: true, announcement: data[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// Award bonus points to a student
router.post('/award-points', async (req, res) => {
    const { student_id, points, reason } = req.body;
    if (!student_id || !points) return res.status(400).json({ success: false, error: 'student_id and points required' });
    try {
        // Get current points
        const { data: user } = await supabase.from('users').select('bonus_points, name').eq('id', student_id).single();
        if (!user) return res.status(404).json({ success: false, error: 'Student not found' });
        const newPoints = (user.bonus_points || 0) + parseInt(points);
        const { error } = await supabase.from('users').update({ bonus_points: newPoints }).eq('id', student_id);
        if (error) throw error;
        res.json({ success: true, student: user.name, newTotal: newPoints });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
