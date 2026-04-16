const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS — allow your Vercel frontend URL
// Update FRONTEND_URL in Railway environment variables after deploying frontend
const allowedOrigins = [
    process.env.FRONTEND_URL,       // e.g. https://edudash.vercel.app
    'http://localhost:3000',         // local dev
    'http://localhost:5500',         // VS Code Live Server
    'http://127.0.0.1:5500'
].filter(Boolean);

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' })); // 10mb for base64 certificate uploads

// Health check — Railway uses this
app.get('/', (req, res) => {
    res.json({ status: 'EduDash API running', version: '1.0.0' });
});

// Mount Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/announcements', require('./routes/announcements'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`EduDash API running on port ${PORT}`);
});
