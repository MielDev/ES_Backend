const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AcademicYearStats = sequelize.define('AcademicYearStats', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    academic_year: { 
        type: DataTypes.STRING, // format "2025-2026"
        allowNull: false,
        unique: true
    },
    total_students: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_confirmed_passages: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_cancelled_appointments: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_missed_appointments: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_students_paid: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_slots_created: { type: DataTypes.INTEGER, defaultValue: 0 },
    archived_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { 
    timestamps: true 
});

module.exports = AcademicYearStats;
