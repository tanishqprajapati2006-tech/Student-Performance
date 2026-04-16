const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config()

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Serve frontend static files from root
app.use(express.static(path.join(__dirname, '../')))

// Mount Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/students', require('./routes/students'))
app.use('/api/attendance', require('./routes/attendance'))
app.use('/api/goals', require('./routes/goals'))
app.use('/api/certificates', require('./routes/certificates'))
app.use('/api/teacher', require('./routes/teacher'))
app.use('/api/announcements', require('./routes/announcements'))

// Catch-all — serve the new app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`EduDash running on :${PORT}`)
})
