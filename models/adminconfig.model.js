const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AdminConfig = sequelize.define('AdminConfig', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    jour_semaine: {
        type: DataTypes.ENUM('lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'),
        allowNull: false,
        unique: true
    },
    heure_debut: { type: DataTypes.TIME, allowNull: false },
    heure_fin: { type: DataTypes.TIME, allowNull: false },
    nombre_passages_max: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { timestamps: true });

module.exports = AdminConfig;
