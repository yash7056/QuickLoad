const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // In production, hash this with bcrypt!
    role: { type: String, enum: ['customer', 'driver'], required: true },
    phone: { type: String, default: '' },
    gstin: { type: String, default: '' },
    vehicleType: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
