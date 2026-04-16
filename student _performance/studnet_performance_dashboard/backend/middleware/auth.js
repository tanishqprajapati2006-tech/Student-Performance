const supabase = require('../config/supabase');

const DEMO_USERS = {}; // removed hardcoded demo — all users go through DB now

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.split(' ')[1];

        // Check demo tokens first (for class project)
        if (DEMO_USERS[token]) {
            req.user = { id: DEMO_USERS[token].id, email: DEMO_USERS[token].email };
            req.profile = DEMO_USERS[token].profile;
            return next();
        }

        // Handle real registered users — token is 'user_<id>'
        if (token.startsWith('user_')) {
            const userId = token.replace('user_', '');
            const { data: user } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (!user) return res.status(401).json({ error: 'Unauthorized: User not found' });

            req.user = { id: user.id, email: user.email };
            req.profile = { id: user.id, name: user.name, role: user.role, roll_no: user.roll_no, branch: user.branch, year: user.year, bonus_points: user.bonus_points || 0 };
            return next();
        }

        // Otherwise verify with real Supabase JWT
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

        req.user = user;
        req.profile = profile || null;

        next();
    } catch (err) {
        console.error("Auth Middleware Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = authMiddleware;
