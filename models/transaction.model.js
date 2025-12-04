const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    reference: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
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
            min: 0.01
        }
    },
    currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'EUR',
        validate: {
            len: [3, 3],
            isUppercase: true
        }
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded'),
        defaultValue: 'pending',
        allowNull: false
    },
    paymentMethod: {
        type: DataTypes.ENUM('card', 'cash', 'transfer', 'other'),
        allowNull: false,
        defaultValue: 'card'
    },
    paymentDetails: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const value = this.getDataValue('paymentDetails');
            return value ? JSON.parse(value) : {};
        },
        set(value) {
            this.setDataValue('paymentDetails', JSON.stringify(value || {}));
        },
        defaultValue: '{}'
    },
    metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const value = this.getDataValue('metadata');
            return value ? JSON.parse(value) : {};
        },
        set(value) {
            this.setDataValue('metadata', JSON.stringify(value || {}));
        },
        defaultValue: '{}'
    },
    error: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    refundedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    timestamps: true,
    tableName: 'transactions',
    indexes: [
        { fields: ['reference'] },
        { fields: ['userId'] },
        { fields: ['status'] },
        { fields: ['createdAt'] },
        { 
            name: 'transactions_user_status_idx',
            fields: ['userId', 'status'] 
        }
    ]
});

// Définition des associations
const User = require('./user.model');

Transaction.belongsTo(User, {
    foreignKey: 'userId',
    as: 'user',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE'
});

// Méthodes utilitaires
Transaction.prototype.complete = async function(paymentDetails = {}) {
    this.status = 'completed';
    this.completedAt = new Date();
    this.paymentDetails = { ...this.paymentDetails, ...paymentDetails };
    return this.save();
};

Transaction.prototype.fail = async function(error) {
    this.status = 'failed';
    this.error = error?.message || String(error) || 'Erreur inconnue';
    return this.save();
};

Transaction.prototype.cancel = async function(reason) {
    if (this.status !== 'pending') {
        throw new Error('Seules les transactions en attente peuvent être annulées');
    }
    this.status = 'cancelled';
    this.cancelledAt = new Date();
    if (reason) {
        this.error = reason;
    }
    return this.save();
};

Transaction.prototype.refund = async function(amount, reason) {
    if (this.status !== 'completed') {
        throw new Error('Seules les transactions complétées peuvent être remboursées');
    }
    
    // Créer une nouvelle transaction de remboursement
    const refundTransaction = await Transaction.create({
        userId: this.userId,
        amount: amount || this.amount,
        currency: this.currency,
        description: `Remboursement: ${this.description}`,
        status: 'refunded',
        paymentMethod: this.paymentMethod,
        paymentDetails: {
            originalTransactionId: this.id,
            reason: reason || 'Remboursement client',
            refundedAt: new Date()
        },
        reference: `refund_${this.reference}_${Date.now()}`
    });

    // Mettre à jour la transaction originale
    this.refundedAt = new Date();
    this.paymentDetails = {
        ...this.paymentDetails,
        refunds: [
            ...(this.paymentDetails.refunds || []),
            {
                id: refundTransaction.id,
                amount: refundTransaction.amount,
                date: refundTransaction.createdAt,
                reason: reason
            }
        ]
    };
    
    await this.save();
    return refundTransaction;
};

// Méthodes statiques
Transaction.findByReference = async function(reference) {
    return this.findOne({ 
        where: { reference },
        include: [
            { 
                model: sequelize.models.User, 
                attributes: ['id', 'email', 'firstName', 'lastName'],
                as: 'user' 
            }
        ]
    });
};

Transaction.listForUser = async function(userId, { limit = 10, offset = 0, status } = {}) {
    const where = { userId };
    if (status) {
        where.status = status;
    }
    
    return this.findAndCountAll({
        where,
        limit: Math.min(parseInt(limit), 100),
        offset: Math.max(0, parseInt(offset) || 0),
        order: [['createdAt', 'DESC']],
        include: [
            { 
                model: sequelize.models.User, 
                attributes: ['id', 'email', 'firstName', 'lastName'],
                as: 'user' 
            }
        ]
    });
};

// Hooks
Transaction.beforeCreate(async (transaction, options) => {
    if (!transaction.reference) {
        transaction.reference = `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    
    // Enregistrer les informations de la requête si disponibles
    if (options?.req) {
        transaction.ipAddress = options.req.ip || options.req.connection?.remoteAddress;
        transaction.userAgent = options.req.get('user-agent');
    }
});

module.exports = Transaction;
