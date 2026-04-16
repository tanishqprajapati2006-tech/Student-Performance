const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET all students (for teacher attendance sheet)
router.get('/students', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, roll_no, branch')
            .eq('role', 'student');
        if (error) throw error;
        res.json({ success: true, students: data || [] });
    } catch (err) {
        res.json({ success: true, students: [] });
    }
});

// POST bulk attendance (array of { student_id, name, subject, date, status })
router.post('/mark-bulk', async (req, res) => {
    const { records } = req.body;
    if (!records || !records.length) {
        return res.status(400).json({ success: false, message: 'No records provided' });
    }
    try {
        const { data, error } = await supabase
            .from('attendance')
            .insert(records)
            .select();
        if (error) {
            console.error('Attendance insert error:', JSON.stringify(error));
            return res.status(500).json({ success: false, message: error.message });
        }
        res.json({ success: true, saved: data ? data.length : records.length });
    } catch (err) {
        console.error('Attendance exception:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET my attendance (student view)
router.get('/my', async (req, res) => {
    const studentId = req.profile ? req.profile.id : null;
    try {
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('student_id', studentId)
            .order('date', { ascending: false });

        if (error) throw error;

        const total = data.length;
        const present = data.filter(r => r.status === 'Present').length;
        const aggregate = total === 0 ? 0 : Math.round((present / total) * 100);

        res.json({ success: true, records: data, aggregate, total_missed: total - present });
    } catch (err) {
        console.error(err);
        res.json({ success: true, records: [], aggregate: 0, total_missed: 0 });
    }
});

// POST single attendance record
router.post('/mark', async (req, res) => {
    const { student_id, subject, date, status } = req.body;
    try {
        const { data, error } = await supabase
            .from('attendance')
            .insert([{ student_id, subject, date, status }])
            .select();
        if (error) throw error;
        res.json({ success: true, record: data ? data[0] : null });
    } catch (err) {
        console.error(err);
        res.json({ success: true });
    }
});

module.exports = router;
