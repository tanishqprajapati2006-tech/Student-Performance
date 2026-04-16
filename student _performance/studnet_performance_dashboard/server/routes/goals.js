const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET all goals for logged-in student
router.get('/my', async (req, res) => {
    const studentId = req.profile.id;
    const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, goals: data || [] });
});

// GET all goals — teacher view
router.get('/all', async (req, res) => {
    const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, goals: data || [] });
});

// POST create a goal
router.post('/create', async (req, res) => {
    const { title, description, category, target_date, total } = req.body;
    const studentId = req.profile.id;
    const studentName = req.profile.name;
    const { data, error } = await supabase
        .from('goals')
        .insert([{ student_id: studentId, student_name: studentName, title, description, category, target_date, total: total || 10, completed: 0 }])
        .select();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, goal: data[0] });
});

// PUT increment completed count
router.put('/:id/increment', async (req, res) => {
    // fetch current value first
    const { data: existing } = await supabase.from('goals').select('completed,total').eq('id', req.params.id).single();
    if (!existing) return res.status(404).json({ success: false });
    const newVal = Math.min(existing.completed + 1, existing.total);
    const { data, error } = await supabase.from('goals').update({ completed: newVal }).eq('id', req.params.id).select();
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true, goal: data[0] });
});

// DELETE a goal
router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('goals').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true });
});

module.exports = router;
