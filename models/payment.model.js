const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    nombre_kilos: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    prix_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    date_achat: { type: DataTypes.DATEONLY, defaultValue: DataTypes.NOW },
    status: {
        type: DataTypes.ENUM('payé', 'impayé', 'annulé'),
        defaultValue: 'payé'
    },
    note: { type: DataTypes.STRING, allowNull: true }
}, { timestamps: true });

module.exports = Payment;
