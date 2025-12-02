const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Users',
            key: 'id'
        }
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
        defaultValue: 'pending'
    },
    paymentMethod: {
        type: DataTypes.ENUM('sumup', 'card', 'cash', 'other'),
        defaultValue: 'sumup'
    },
    paymentDetails: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    reference: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: true
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: 'transactions'
});

// Définition des associations
const User = require('./user.model');
Transaction.belongsTo(User, { foreignKey: 'userId' });

// Méthode pour marquer une transaction comme complétée
Transaction.markAsCompleted = async function(transactionId, paymentDetails = {}) {
    const transaction = await this.findByPk(transactionId);
    if (transaction) {
        transaction.status = 'completed';
        transaction.paymentDetails = paymentDetails;
        return transaction.save();
    }
    throw new Error('Transaction non trouvée');
};

// Méthode pour marquer une transaction comme échouée
Transaction.markAsFailed = async function(transactionId, error) {
    const transaction = await this.findByPk(transactionId);
    if (transaction) {
        transaction.status = 'failed';
        transaction.error = error?.message || 'Erreur inconnue';
        return transaction.save();
    }
    throw new Error('Transaction non trouvée');
};

module.exports = Transaction;
