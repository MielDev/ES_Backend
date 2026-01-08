const express = require('express');
const router = express.Router();
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// Récupérer les statistiques globales
router.get('/', async (req, res) => {
    try {
        // Récupération des statistiques en parallèle pour de meilleures performances
        const [
            totalAppointments,
            appointmentsByStatus,
            slotsStats,
            totalStudents,
            totalRevenue
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
            // Statistiques des créneaux
            sequelize.query(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_available = true THEN 1 ELSE 0 END) as available,
                    SUM(CASE WHEN is_available = false THEN 1 ELSE 0 END) as booked
                FROM slots`,
                { type: QueryTypes.SELECT }
            ),
            // Nombre total d'étudiants
            sequelize.query(
                'SELECT COUNT(*) as count FROM students',
                { type: QueryTypes.SELECT }
            ),
            // Revenus totaux (si vous avez une table de paiements)
            sequelize.query(
                'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = \'completed\'',
                { type: QueryTypes.SELECT }
            )
        ]);

        // Formatage de la réponse
        const stats = {
            appointments: {
                total: parseInt(totalAppointments[0].count),
                byStatus: appointmentsByStatus.reduce((acc, { status, count }) => ({
                    ...acc,
                    [status]: parseInt(count)
                }), {})
            },
            slots: {
                total: parseInt(slotsStats[0].total),
                available: parseInt(slotsStats[0].available),
                booked: parseInt(slotsStats[0].booked)
            },
            users: {
                students: parseInt(totalStudents[0].count)
            },
            revenue: {
                total: parseFloat(totalRevenue[0].total) || 0
            }
        };

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Statistiques mensuelles pour les rendez-vous
router.get('/monthly', async (req, res) => {
    try {
        const monthlyStats = await sequelize.query(
            `SELECT 
                DATE_FORMAT(date, '%Y-%m') as month,
                COUNT(*) as total_appointments,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
            FROM appointments
            WHERE date >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(date, '%Y-%m')
            ORDER BY month ASC`,
            { type: QueryTypes.SELECT }
        );

        res.json({
            success: true,
            data: monthlyStats.map(stat => ({
                ...stat,
                total_appointments: parseInt(stat.total_appointments),
                completed: parseInt(stat.completed),
                cancelled: parseInt(stat.cancelled)
            }))
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques mensuelles:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques mensuelles',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

// Récupérer les statistiques par pays d'origine des étudiants
router.get('/by-country', async (req, res) => {
    try {
        const countriesStats = await sequelize.query(
            `SELECT 
                country,
                COUNT(*) as count,
                ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM students), 1) as percentage
            FROM students
            WHERE country IS NOT NULL
            GROUP BY country
            ORDER BY count DESC`,
            { type: QueryTypes.SELECT }
        );

        res.json({
            success: true,
            data: countriesStats.map(stat => ({
                country: stat.country,
                count: parseInt(stat.count),
                percentage: parseFloat(stat.percentage)
            }))
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques par pays:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des statistiques par pays',
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
});

module.exports = router;
