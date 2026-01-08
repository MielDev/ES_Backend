const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// Récupère les statistiques pour le tableau de bord admin
const getAdminDashboardStats = async (req, res) => {
    try {
        // Récupération des statistiques en parallèle pour de meilleures performances
        const [
            totalAppointments,
            appointmentsByStatus,
            totalStudents,
            recentRegistrations,
            monthlyStats,
            countriesStats
        ] = await Promise.all([
            // Nombre total de rendez-vous
            sequelize.query(
                'SELECT COUNT(*) as count FROM appointments',
                { type: QueryTypes.SELECT }
            ),
            // Nombre de rendez-vous par statut
            sequelize.query(
                'SELECT status, COUNT(*) as count FROM appointments GROUP BY status',
                { type: QueryTypes.SELECT }
            ),
            // Nombre total d'étudiants
            sequelize.query(
                'SELECT COUNT(*) as count FROM students',
                { type: QueryTypes.SELECT }
            ),
            // Dernières inscriptions (7 derniers jours)
            sequelize.query(
                `SELECT 
                    DATE(createdAt) as date, 
                    COUNT(*) as count 
                FROM students 
                WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY DATE(createdAt)
                ORDER BY date ASC`,
                { type: QueryTypes.SELECT }
            ),
            // Statistiques mensuelles
            sequelize.query(
                `SELECT 
                    DATE_FORMAT(date, '%Y-%m') as month,
                    COUNT(*) as total_appointments,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
                FROM appointments
                WHERE date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY DATE_FORMAT(date, '%Y-%m')
                ORDER BY month ASC`,
                { type: QueryTypes.SELECT }
            ),
            // Statistiques par pays
            sequelize.query(
                `SELECT 
                    country,
                    COUNT(*) as count,
                    ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM students), 1) as percentage
                FROM students
                WHERE country IS NOT NULL
                GROUP BY country
                ORDER BY count DESC
                LIMIT 5`,
                { type: QueryTypes.SELECT }
            )
        ]);

        // Formatage de la réponse
        const stats = {
            overview: {
                totalAppointments: parseInt(totalAppointments[0].count),
                totalStudents: parseInt(totalStudents[0].count),
                appointmentsByStatus: appointmentsByStatus.reduce((acc, { status, count }) => ({
                    ...acc,
                    [status]: parseInt(count)
                }), {})
            },
            recentRegistrations: recentRegistrations.map(item => ({
                date: item.date,
                count: parseInt(item.count)
            })),
            monthlyStats: monthlyStats.map(stat => ({
                month: stat.month,
                total: parseInt(stat.total_appointments),
                completed: parseInt(stat.completed)
            })),
            topCountries: countriesStats.map(stat => ({
                country: stat.country,
                count: parseInt(stat.count),
                percentage: parseFloat(stat.percentage)
            }))
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques du tableau de bord:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques du tableau de bord',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
};

module.exports = {
    getAdminDashboardStats
};
