const sequelize = require('../config/db');
const User = require('./user.model');
const Admin = require('./admin.model');
const Slot = require('./slot.model');
const IntervalSlot = require('./intervalslot.model');
const Appointment = require('./appointment.model');
const AdminConfig = require('./adminconfig.model');
const Payment = require('./payment.model');

// relations
User.hasMany(Appointment, { foreignKey: 'userId' });
Appointment.belongsTo(User, { foreignKey: 'userId' });

Slot.hasMany(Appointment, { foreignKey: 'slotId' });
Appointment.belongsTo(Slot, { foreignKey: 'userId' });

Slot.hasMany(IntervalSlot, { foreignKey: 'slot_parent_id' });
IntervalSlot.belongsTo(Slot, { foreignKey: 'slot_parent_id' });

IntervalSlot.hasMany(Appointment, { foreignKey: 'intervalSlotId' });
Appointment.belongsTo(IntervalSlot, { foreignKey: 'intervalSlotId' });

User.hasMany(Payment, { foreignKey: 'userId' });
Payment.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
    sequelize, User, Admin, Slot, IntervalSlot, Appointment, AdminConfig, Payment
};
