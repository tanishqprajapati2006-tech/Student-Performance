const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

// Register — saves directly to users table, no email confirmation needed
router.post('/register', async (req, res) => {
    try {
        const { email, password, role, name, roll_no, branch, year } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Name, email and password are required.' });
        }

        // Insert directly — if email already exists the unique constraint will catch it
        const { data, error } = await supabase
            .from('users')
            .insert([{
                email,
                password,
                name,
                role: role || 'student',
                roll_no: role === 'student' ? (roll_no || null) : null,
                branch: role === 'student' ? (branch || null) : null,
                year: role === 'student' ? (parseInt(year) || null) : null
            }])
            .select();

        if (error) {
            console.error('Register DB error:', JSON.stringify(error));
            // Duplicate email
            if (error.code === '23505' || (error.message && error.message.includes('duplicate'))) {
                return res.status(400).json({ error: 'An account with this email already exists.' });
            }
            // Table doesn't exist
            if (error.code === '42P01' || (error.message && error.message.includes('does not exist'))) {
                return res.status(500).json({ error: 'Database table not set up. Please create the users table in Supabase first.' });
            }
            return res.status(500).json({ error: 'Registration failed: ' + error.message });
        }

        res.json({ success: true, message: 'Account created! You can now sign in.' });

    } catch (err) {
        console.error('Register exception:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
});

// Login — checks users table directly
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        // Use user id as token (simple approach for class project)
        const token = 'user_' + user.id;

        // Store user in auth middleware cache
        res.json({
            token,
            profile: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                roll_no: user.roll_no,
                branch: user.branch,
                year: user.year
            },
            role: user.role
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

router.get('/profile', authMiddleware, async (req, res) => {
    res.json({ user: req.user, profile: req.profile });
});

module.exports = router;
