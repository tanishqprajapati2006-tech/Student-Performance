const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

function calculateScore(data) {
    const attendanceScore = (data.attendancePercent / 100) * 30;
    const goalScore = data.totalGoals > 0 ? (data.completedGoals / data.totalGoals) * 25 : 0;
    const certScore = Math.min(data.certificateCount * 4, 20);
    const marksScore = (data.averageMarks / 100) * 10;
    const total = attendanceScore + goalScore + certScore + marksScore;
    return {
        total: Math.round(total),
        breakdown: {
            attendance: Math.round(attendanceScore),
            goals: Math.round(goalScore),
            certificates: Math.round(certScore),
            marks: Math.round(marksScore)
        }
    };
}

// Student dashboard — all real data, no demo fallback
router.get('/dashboard', async (req, res) => {
    try {
        const studentId = req.profile.id;

        const [marksRes, attendanceRes, goalsRes, certsRes] = await Promise.all([
            supabase.from('marks').select('*').eq('student_id', studentId),
            supabase.from('attendance').select('*').eq('student_id', studentId),
            supabase.from('goals').select('*').eq('student_id', studentId),
            supabase.from('certificates').select('*').eq('student_id', studentId)
        ]);

        const marks = marksRes.data || [];
        const attendance = attendanceRes.data || [];
        const goals = goalsRes.data || [];
        const certificates = certsRes.data || [];

        const avgMarks = marks.length ? (marks.reduce((s, m) => s + (m.obtained_marks || 0), 0) / marks.length) : 0;
        const totalClasses = attendance.length;
        const attendedClasses = attendance.filter(a => a.status === 'Present').length;
        const attendancePct = totalClasses ? (attendedClasses / totalClasses) * 100 : 0;
        const completedGoals = goals.filter(g => g.completed >= g.total).length;

        const score = calculateScore({
            attendancePercent: attendancePct,
            totalGoals: goals.length,
            completedGoals,
            certificateCount: certificates.length,
            averageMarks: avgMarks
        });

        res.json({
            profile: req.profile,
            score,
            bonusPoints: req.profile.bonus_points || 0,
            marks,
            attendance: { percentage: Math.round(attendancePct), total: totalClasses, attended: attendedClasses },
            goals: { list: goals, total: goals.length, completed: completedGoals },
            certificates,
            streak: 0
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
});

// Leaderboard — all real students from DB with their scores
router.get('/leaderboard', async (req, res) => {
    try {
        const { data: students, error } = await supabase
            .from('users')
            .select('id, name, roll_no, branch')
            .eq('role', 'student');

        if (error || !students || students.length === 0) {
            return res.json({ success: true, leaderboard: [] });
        }

        // For each student calculate their score
        const leaderboard = await Promise.all(students.map(async (s) => {
            const [attRes, goalsRes, certsRes, marksRes] = await Promise.all([
                supabase.from('attendance').select('status').eq('student_id', s.id),
                supabase.from('goals').select('completed,total').eq('student_id', s.id),
                supabase.from('certificates').select('id').eq('student_id', s.id),
                supabase.from('marks').select('obtained_marks,max_marks').eq('student_id', s.id)
            ]);

            const att = attRes.data || [];
            const goals = goalsRes.data || [];
            const certs = certsRes.data || [];
            const marks = marksRes.data || [];

            const attended = att.filter(a => a.status === 'Present').length;
            const attPct = att.length ? (attended / att.length) * 100 : 0;
            const completedGoals = goals.filter(g => g.completed >= g.total).length;
            const avgMarks = marks.length ? marks.reduce((sum, m) => sum + (m.obtained_marks || 0), 0) / marks.length : 0;

            const score = calculateScore({
                attendancePercent: attPct,
                totalGoals: goals.length,
                completedGoals,
                certificateCount: certs.length,
                averageMarks: avgMarks
            });

            return {
                id: s.id,
                name: s.name,
                roll_no: s.roll_no || '',
                score: score.total + (s.bonus_points || 0),
                baseScore: score.total,
                bonusPoints: s.bonus_points || 0,
                marks: Math.round(avgMarks),
                attendance: Math.round(attPct),
                certs: certs.length
            };
        }));

        // Sort by score descending
        leaderboard.sort((a, b) => b.score - a.score);

        res.json({ success: true, leaderboard });
    } catch (err) {
        console.error('Leaderboard error:', err);
        res.status(500).json({ success: false, leaderboard: [] });
    }
});

module.exports = router;
