const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AdminConfig = sequelize.define('AdminConfig', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    date_specifique: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true
    },
    heure_debut: { type: DataTypes.TIME, allowNull: false },
    heure_fin: { type: DataTypes.TIME, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { timestamps: true });

module.exports = AdminConfig;
