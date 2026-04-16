const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET my certificates
router.get('/my', async (req, res) => {
    const studentId = req.profile.id;
    const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, certificates: data || [] });
});

// GET all certificates — teacher view
router.get('/all', async (req, res) => {
    const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, certificates: data || [] });
});

// POST upload a certificate
router.post('/upload', async (req, res) => {
    const { title, issuer, issued_date, category, file_url } = req.body;
    const studentId = req.profile.id;
    const studentName = req.profile.name;
    const { data, error } = await supabase
        .from('certificates')
        .insert([{ student_id: studentId, student_name: studentName, title, issuer, issued_date, category, file_url: file_url || null }])
        .select();
    if (error) return res.status(500).json({ success: false, error: error.message });
    res.json({ success: true, certificate: data[0] });
});

// DELETE a certificate
router.delete('/:id', async (req, res) => {
    const { error } = await supabase.from('certificates').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ success: false });
    res.json({ success: true });
});

module.exports = router;
