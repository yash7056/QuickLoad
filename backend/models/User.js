const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

userSchema.index(
    { vehicleNumber: 1 },
    { unique: true, partialFilterExpression: { vehicleNumber: { $gt: "" } } }
);

userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
