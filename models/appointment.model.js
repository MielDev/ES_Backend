const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Appointment = sequelize.define('Appointment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    status: {
        type: DataTypes.ENUM('confirmé', 'annulé', 'terminé', 'validé_admin', 'refusé_admin', 'manqué'),
        defaultValue: 'confirmé'
    },
    date_rdv: {
        type: DataTypes.DATEONLY,
        allowNull: true // Temporairement nullable pour la migration
    },
    heure_debut: { type: DataTypes.TIME, allowNull: false },
    heure_fin: { type: DataTypes.TIME, allowNull: false },
    note: { type: DataTypes.STRING, allowNull: true },
    note_admin: { type: DataTypes.STRING, allowNull: true },
    valide_par_admin: { type: DataTypes.BOOLEAN, defaultValue: false },
    date_validation_admin: { type: DataTypes.DATE, allowNull: true }
}, { timestamps: true });

module.exports = Appointment;
