// public/js/services/scoreService.js
app.service('scoreService', function() {
    
    this.calculateScore = function(data) {
        // Attendance score (30 points)
        const attendanceScore = (data.attendancePercent / 100) * 30;

        // Goal completion (25 points)
        const goalScore = data.totalGoals > 0 
            ? (data.completedGoals / data.totalGoals) * 25 
            : 0;

        // Certificates (20 points) - Each cert = 4 points, max 20
        const certScore = Math.min(data.certificateCount * 4, 20);

        // Streak (15 points) - 15+ day streak = full 15 points
        const streakScore = Math.min(data.currentStreak, 15);

        // Academic marks (10 points)
        const marksScore = (data.averageMarks / 100) * 10;

        const total = attendanceScore + goalScore + certScore + streakScore + marksScore;

        return {
            total: Math.round(total),
            breakdown: {
                attendance: Math.round(attendanceScore),
                goals: Math.round(goalScore),
                certificates: Math.round(certScore),
                streak: Math.round(streakScore),
                marks: Math.round(marksScore)
            }
        };
    };

});
