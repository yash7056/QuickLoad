/**
 * server_gps.js  —  SSG Logistics backend WITH live GPS tracking
 *
 * This file is identical to server.js in all business logic, but:
 *   1. Uses  models/RideWithGPS.js  (adds driverLocation field)
 *   2. Calls attachGPS(app, io)  to mount the GPS REST + Socket.IO layer
 *
 * The original server.js and models/Ride.js are NOT modified.
 * To start the GPS-enabled backend:   node server_gps.js
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');

// Use the GPS-extended Ride model (same collection, superset of fields)
const Ride = require('./models/RideWithGPS');
const User = require('./models/User');

// GPS route layer
const { attachGPS } = require('./gps');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST', 'PATCH'] } });

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🟢 MongoDB Connected'))
    .catch((err) => console.error('🔴 DB Connection Error:', err));

// ==========================================
// Company / invoice constants
// ==========================================
const COMPANY = {
    name: 'SSG Logistics Pvt. Ltd.',
    address: 'Plot No. 14, MIDC Industrial Area, Latur, Maharashtra 413531, India',
    gstin: '27AASSG1234L1ZP',
    pan: 'AASSG1234L',
    email: 'billing@ssglogistics.in',
    phone: '+91 88888 00000',
    taxRatePercent: 18,
    useIGST: true,
};

const VEHICLE_BASE_FARE = { tempo: 80, minitruck: 120, trailer: 220 };
const VEHICLE_PER_KM    = { tempo: 18, minitruck: 26,  trailer: 38  };

function buildFareBreakdown({ vehicleType, distance, isRaining, isRushHour, aiPrice }) {
    const baseFare    = VEHICLE_BASE_FARE[vehicleType] ?? VEHICLE_BASE_FARE.tempo;
    const perKm       = VEHICLE_PER_KM[vehicleType]    ?? VEHICLE_PER_KM.tempo;
    const distanceFare = Math.round(perKm * (distance || 0) * 100) / 100;

    const aiPretax    = typeof aiPrice === 'number' && aiPrice > 0 ? aiPrice : baseFare + distanceFare;
    const floorSubtotal = baseFare + distanceFare;
    let remainder     = Math.max(0, Math.round((aiPretax - floorSubtotal) * 100) / 100);

    let rainSurcharge = 0, rushHourSurcharge = 0;
    if (isRaining && isRushHour) {
        rainSurcharge     = Math.round(remainder * 0.6 * 100) / 100;
        rushHourSurcharge = Math.round((remainder - rainSurcharge) * 100) / 100;
    } else if (isRaining)   { rainSurcharge     = remainder; }
    else if (isRushHour)    { rushHourSurcharge = remainder; }
    else if (remainder > 0) { remainder = 0; }

    const subtotal  = Math.round((baseFare + distanceFare + rainSurcharge + rushHourSurcharge) * 100) / 100;
    const taxAmount = Math.round(subtotal * (COMPANY.taxRatePercent / 100) * 100) / 100;
    const total     = Math.round((subtotal + taxAmount) * 100) / 100;

    return { baseFare, distanceFare, rainSurcharge, rushHourSurcharge, subtotal,
             taxRate: COMPANY.taxRatePercent, taxAmount, price: total };
}

async function getAiQuote(pickupLocation, dropoffLocation, vehicleType) {
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8000';
    const aiRes = await fetch(`${aiEngineUrl}/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup: pickupLocation, dropoff: dropoffLocation, vehicle_type: vehicleType }),
    });
    if (!aiRes.ok) throw new Error('AI engine error');
    const aiData = await aiRes.json();
    const breakdown = buildFareBreakdown({
        vehicleType,
        distance: aiData.distance,
        isRaining: aiData.is_raining,
        isRushHour: aiData.is_rush_hour,
        aiPrice: aiData.price,
    });
    return { distance: aiData.distance, isRaining: !!aiData.is_raining, isRushHour: !!aiData.is_rush_hour, ...breakdown };
}

async function nextInvoiceNumber() {
    const year  = new Date().getFullYear();
    const count = await Ride.countDocuments({ invoiceNumber: { $ne: null } });
    return `SSG/${year}/${String(count + 1).padStart(6, '0')}`;
}

const otpCache = new Map(); // key: email, value: { otp, expires }

async function sendEmailOtp(toEmail, otp) {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    let transporter;

    if (host && user && pass) {
        // Real SMTP configuration (e.g. Gmail)
        transporter = nodemailer.createTransport({
            host,
            port: parseInt(port),
            secure: parseInt(port) === 465, // true for 465, false for other ports
            auth: { user, pass }
        });
        console.log(`📧 [Email Dispatch] Configuring real SMTP server: ${host}`);
    } else {
        // Fallback: Ethereal Email auto-generated test account
        console.log("⚠️ SMTP credentials missing in .env. Configuring Ethereal Email test fallback.");
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    }

    const mailOptions = {
        from: user ? `"SSG Logistics" <${user}>` : '"SSG Logistics" <no-reply@ssglogistics.com>',
        to: toEmail,
        subject: '[QuickLoad] Verify your email address',
        text: `Your 6-digit registration verification OTP code is: ${otp}. It will expire in 5 minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #f59e0b; text-align: center; margin-bottom: 24px;">QuickLoad Email Verification</h2>
                <p>Hello,</p>
                <p>Thank you for registering with SSG Logistics. To complete your sign-up process, please enter the following 6-digit verification code:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-family: monospace; font-weight: bold; color: #0d1726; background: #f3f4f6; padding: 10px 24px; border-radius: 8px; letter-spacing: 4px;">
                        ${otp}
                    </span>
                </div>
                <p style="color: #6b7280; font-size: 13px;">This code will expire in 5 minutes. If you did not request this code, you can safely ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                <p style="color: #9ca3af; font-size: 11px; text-align: center;">SSG Logistics Pvt. Ltd., Plot No. 14, MIDC Industrial Area, Latur, India</p>
            </div>
        `
    };

    const info = await transporter.sendMail(mailOptions);

    if (!host || !user || !pass) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`\n==================================================`);
        console.log(`📨 [Ethereal Email Dispatch Successful]`);
        console.log(`📧 Preview URL: ${previewUrl}`);
        console.log(`==================================================\n`);
        return { isReal: false, previewUrl };
    }

    console.log(`📧 [Email Dispatch] Real verification email successfully sent to ${toEmail}.`);
    return { isReal: true };
}

app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email, phone, role } = req.body;
        if (!email || !phone) {
            return res.status(400).json({ error: 'Email and phone number are required.' });
        }

        // Check if user already exists with this email
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ error: 'An account with this email already exists' });
        }

        // Check unique vehicleNumber for driver
        if (role === 'driver' && req.body.vehicleNumber) {
            const cleanNumber = req.body.vehicleNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const existingVehicle = await User.findOne({ vehicleNumber: cleanNumber });
            if (existingVehicle) {
                return res.status(400).json({ error: `Vehicle number ${req.body.vehicleNumber} is already registered by another driver.` });
            }
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 5 * 60 * 1000; // 5 minutes

        otpCache.set(email, { otp, expires });

        console.log(`\n========================================`);
        console.log(`🔑 [OTP GENERATED] Role: ${role}`);
        console.log(`📧 Email: ${email} | 📱 Phone: ${phone}`);
        console.log(`🔢 6-Digit OTP Code: ${otp}`);
        console.log(`========================================\n`);

        const result = await sendEmailOtp(email, otp);

        if (result.isReal) {
            res.status(200).json({ message: 'OTP sent successfully to your email' });
        } else {
            res.status(200).json({ message: 'OTP generated (simulated)', mockOtp: otp, previewUrl: result.previewUrl });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { role, vehicleNumber, email, otp } = req.body;

        if (!otp) {
            return res.status(400).json({ error: 'Verification OTP code is required.' });
        }

        // Retrieve and verify cached OTP
        const cached = otpCache.get(email);
        if (!cached || cached.otp !== otp) {
            return res.status(400).json({ error: 'Invalid verification OTP code.' });
        }
        if (Date.now() > cached.expires) {
            otpCache.delete(email);
            return res.status(400).json({ error: 'Verification OTP has expired. Please request a new one.' });
        }

        // OTP is valid, remove it from cache
        otpCache.delete(email);

        if (role === 'driver' && vehicleNumber) {
            const cleanNumber = vehicleNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            req.body.vehicleNumber = cleanNumber; // Save normalized version

            const existing = await User.findOne({ vehicleNumber: cleanNumber });
            if (existing) {
                return res.status(400).json({ error: `Vehicle number ${vehicleNumber} is already registered by another driver.` });
            }
        }

        const user = new User(req.body);
        await user.save();
        res.status(201).json({ message: 'Registered', user });
    } catch (e) {
        if (e.code === 11000) {
            const isVehicleNum = e.message.includes('vehicleNumber') || (e.keyPattern && e.keyPattern.vehicleNumber);
            return res.status(400).json({
                error: isVehicleNum
                    ? 'This vehicle number is already registered by another driver.'
                    : 'An account with this email already exists'
            });
        }
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { role, email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

        if (role && user.role !== role) {
            return res.status(403).json({ error: `This account is registered as a ${user.role}. Use the ${user.role} portal to sign in.` });
        }
        res.status(200).json({ user });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

app.get('/api/company', (req, res) => res.status(200).json(COMPANY));

// ==========================================
// Ride Routes
// ==========================================
app.post('/api/quote', async (req, res) => {
    try {
        const { pickupLocation, dropoffLocation, vehicleType } = req.body;
        if (!pickupLocation || !dropoffLocation)
            return res.status(400).json({ error: 'Enter both a pickup and a drop-off location.' });
        const quote = await getAiQuote(pickupLocation, dropoffLocation, vehicleType);
        res.status(200).json(quote);
    } catch (e) {
        res.status(500).json({ error: 'Could not price this trip. Is the AI pricing engine running?' });
    }
});

app.post('/api/rides', async (req, res) => {
    try {
        const quote = await getAiQuote(req.body.pickupLocation, req.body.dropoffLocation, req.body.vehicleType);
        const ride  = new Ride({
            customerId: req.body.customerId,
            customerName: req.body.customerName || 'Guest User',
            customerPhone: req.body.customerPhone || '',
            customerGSTIN: req.body.customerGSTIN || '',
            pickupLocation: req.body.pickupLocation,
            dropoffLocation: req.body.dropoffLocation,
            vehicleType: req.body.vehicleType,
            customerLocation: req.body.customerLocation || null,
            ...quote,
            status: 'searching',
        });
        await ride.save();
        io.emit('rideUpdated', ride);
        res.status(201).json(ride);
    } catch (e) {
        res.status(500).json({ error: 'Booking Failed. Is the AI pricing engine running?' });
    }
});

app.patch('/api/rides/:id/accept', async (req, res) => {
    try {
        const { driverId, driverName, driverVehicleNumber } = req.body;
        const ride = await Ride.findOne({ _id: req.params.id, status: 'searching' });
        if (!ride) return res.status(409).json({ error: 'This ride was already taken by another driver.' });
        
        // Fetch driver's phone number
        const driver = await User.findById(driverId);
        const driverPhone = driver ? driver.phone : '';

        ride.status = 'accepted';
        ride.driverId = driverId;
        ride.driverName = driverName;
        ride.driverVehicleNumber = driverVehicleNumber;
        ride.driverPhone = driverPhone;
        
        await ride.save();
        io.emit('rideUpdated', ride);
        res.status(200).json(ride);
    } catch (e) { res.status(500).json({ error: 'Accept Failed' }); }
});

app.patch('/api/rides/:id', async (req, res) => {
    try {
        const update = { status: req.body.status };
        if (req.body.status === 'delivered') update.invoiceNumber = await nextInvoiceNumber();
        const ride = await Ride.findByIdAndUpdate(req.params.id, update, { new: true });
        io.emit('rideUpdated', ride);
        res.status(200).json(ride);
    } catch (e) { res.status(500).json({ error: 'Update Failed' }); }
});

app.patch('/api/rides/:id/rate', async (req, res) => {
    try {
        const ride = await Ride.findByIdAndUpdate(req.params.id, { rating: req.body.rating }, { new: true });
        io.emit('rideUpdated', ride);
        res.status(200).json(ride);
    } catch (e) { res.status(500).json({ error: 'Rating Failed' }); }
});

app.get('/api/rides', async (req, res) => {
    try {
        const filter = {};
        if (req.query.customerId) filter.customerId = req.query.customerId;
        if (req.query.driverId)   filter.driverId   = req.query.driverId;
        if (req.query.status)     filter.status     = req.query.status;
        const rides = await Ride.find(filter).sort({ createdAt: -1 });
        res.status(200).json(rides);
    } catch (e) { res.status(500).json({ error: 'Fetch Failed' }); }
});

// ==========================================
// Attach GPS tracking routes
// ==========================================
attachGPS(app, io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 GPS-enabled server running on port ${PORT}`));
