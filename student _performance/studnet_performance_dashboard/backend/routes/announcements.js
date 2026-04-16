const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Get all announcements
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        res.json({ success: true, announcements: data });
    } catch (err) {
        console.error("Error fetching announcements:", err);
        res.status(500).json({ success: false, message: "Failed to fetch announcements" });
    }
});

module.exports = router;
