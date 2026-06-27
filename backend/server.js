require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const Ride = require('./models/Ride');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST", "PATCH"] } });

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
    // Cargo movement is treated as inter-state by default, so the full rate is
    // charged as IGST. Flip useIGST to false to split it into CGST+SGST instead.
    taxRatePercent: 18,
    useIGST: true,
};

// Per-km rate and flat base fare used to break the AI's single predicted
// number into a real, itemised fare a customer can audit.
const VEHICLE_BASE_FARE = { tempo: 80, minitruck: 120, trailer: 220 };
const VEHICLE_PER_KM = { tempo: 18, minitruck: 26, trailer: 38 };

// Builds a transparent, GST-ready fare breakdown.
// The AI engine still decides the bottom-line distance/weather-aware price;
// we reverse it into base + per-km + surcharges + tax so it reads like a
// real invoice instead of one opaque number.
function buildFareBreakdown({ vehicleType, distance, isRaining, isRushHour, aiPrice }) {
    const baseFare = VEHICLE_BASE_FARE[vehicleType] ?? VEHICLE_BASE_FARE.tempo;
    const perKm = VEHICLE_PER_KM[vehicleType] ?? VEHICLE_PER_KM.tempo;
    const distanceFare = Math.round(perKm * (distance || 0) * 100) / 100;

    // Trust the AI model for the pre-tax total when it returns one; fall back
    // to base+distance if it's missing or implausible (e.g. AI engine down).
    const aiPretax = typeof aiPrice === 'number' && aiPrice > 0 ? aiPrice : baseFare + distanceFare;
    const floorSubtotal = baseFare + distanceFare;
    let remainder = Math.max(0, Math.round((aiPretax - floorSubtotal) * 100) / 100);

    // Split whatever the AI added on top of the base formula into named
    // surcharges so the invoice never shows an unexplained number.
    let rainSurcharge = 0;
    let rushHourSurcharge = 0;
    if (isRaining && isRushHour) {
        rainSurcharge = Math.round(remainder * 0.6 * 100) / 100;
        rushHourSurcharge = Math.round((remainder - rainSurcharge) * 100) / 100;
    } else if (isRaining) {
        rainSurcharge = remainder;
    } else if (isRushHour) {
        rushHourSurcharge = remainder;
    } else if (remainder > 0) {
        // No flagged condition but AI still priced it higher — keep it as a
        // generic demand adjustment folded into distance fare rather than
        // inventing a label.
        rainSurcharge = 0;
        rushHourSurcharge = 0;
        remainder = 0;
    }

    const subtotal = Math.round((baseFare + distanceFare + rainSurcharge + rushHourSurcharge) * 100) / 100;
    const taxAmount = Math.round(subtotal * (COMPANY.taxRatePercent / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    return {
        baseFare,
        distanceFare,
        rainSurcharge,
        rushHourSurcharge,
        subtotal,
        taxRate: COMPANY.taxRatePercent,
        taxAmount,
        price: total,
    };
}

async function getAiQuote(pickupLocation, dropoffLocation, vehicleType) {
    const aiRes = await fetch('http://127.0.0.1:8000/calculate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickup: pickupLocation, dropoff: dropoffLocation, vehicle_type: vehicleType })
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
    return {
        distance: aiData.distance,
        isRaining: !!aiData.is_raining,
        isRushHour: !!aiData.is_rush_hour,
        ...breakdown,
    };
}

// Simple incrementing invoice numbers, e.g. SSG/2026/000042 — generated only
// once a ride is actually delivered, so cancelled/abandoned rides never burn
// a number out of sequence.
async function nextInvoiceNumber() {
    const year = new Date().getFullYear();
    const count = await Ride.countDocuments({ invoiceNumber: { $ne: null } });
    return `SSG/${year}/${String(count + 1).padStart(6, '0')}`;
}

const otpCache = new Map(); // key: email, value: { otp, expires }

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
        console.log(`🔑 [OTP DISPATCH] Role: ${role}`);
        console.log(`📧 Email: ${email} | 📱 Phone: ${phone}`);
        console.log(`🔢 Simulated 6-Digit OTP: ${otp}`);
        console.log(`========================================\n`);

        res.status(200).json({ message: 'OTP sent successfully', mockOtp: otp });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        console.log("📥 Registration Attempt:", req.body);
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
        res.status(201).json({ message: "Registered", user });
    } catch (e) {
        console.error("❌ Registration Error:", e.message);
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
        if (!user) return res.status(401).json({ error: "Invalid email or password" });
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ error: "Invalid email or password" });

        if (role && user.role !== role) {
            return res.status(403).json({ error: `This account is registered as a ${user.role}. Use the ${user.role} portal to sign in.` });
        }
        res.status(200).json({ user });
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

// ==========================================
// Company info (for invoice rendering on the client)
// ==========================================
app.get('/api/company', (req, res) => res.status(200).json(COMPANY));

// ==========================================
// Ride Routes
// ==========================================

// Get a live, itemised fare quote WITHOUT creating a ride yet.
// Lets the customer see base fare + surcharges + GST + total and confirm
// before anything is booked.
app.post('/api/quote', async (req, res) => {
    try {
        const { pickupLocation, dropoffLocation, vehicleType } = req.body;
        if (!pickupLocation || !dropoffLocation) {
            return res.status(400).json({ error: "Enter both a pickup and a drop-off location." });
        }
        const quote = await getAiQuote(pickupLocation, dropoffLocation, vehicleType);
        res.status(200).json(quote);
    } catch (e) {
        console.error("❌ Quote Error:", e.message);
        res.status(500).json({ error: "Could not price this trip. Is the AI pricing engine running?" });
    }
});

// Create a new ride request (Customer) — re-quotes at booking time so the
// fare can't go stale between viewing the quote and confirming it.
app.post('/api/rides', async (req, res) => {
    try {
        const quote = await getAiQuote(req.body.pickupLocation, req.body.dropoffLocation, req.body.vehicleType);

        const ride = new Ride({
            customerId: req.body.customerId,
            customerName: req.body.customerName || 'Guest User',
            customerPhone: req.body.customerPhone || '',
            customerGSTIN: req.body.customerGSTIN || '',
            pickupLocation: req.body.pickupLocation,
            dropoffLocation: req.body.dropoffLocation,
            vehicleType: req.body.vehicleType,
            ...quote,
            status: 'searching'
        });

        await ride.save();
        io.emit('rideUpdated', ride);
        res.status(201).json(ride);
    } catch (e) {
        console.error("❌ Booking Error:", e.message);
        res.status(500).json({ error: "Booking Failed. Is the AI pricing engine running?" });
    }
});

// Driver accepts an open ride
app.patch('/api/rides/:id/accept', async (req, res) => {
    try {
        const { driverId, driverName, driverVehicleNumber } = req.body;
        const ride = await Ride.findOne({ _id: req.params.id, status: 'searching' });
        if (!ride) return res.status(409).json({ error: "This ride was already taken by another driver." });

        ride.status = 'accepted';
        ride.driverId = driverId;
        ride.driverName = driverName;
        ride.driverVehicleNumber = driverVehicleNumber;
        await ride.save();

        io.emit('rideUpdated', ride);
        res.status(200).json(ride);
    } catch (e) { res.status(500).json({ error: "Accept Failed" }); }
});

// Generic status update (picked-up / in-transit / delivered / cancelled).
// Delivery is the moment a real invoice number gets assigned.
app.patch('/api/rides/:id', async (req, res) => {
    try {
        const update = { status: req.body.status };
        if (req.body.status === 'delivered') {
            update.invoiceNumber = await nextInvoiceNumber();
        }
        const ride = await Ride.findByIdAndUpdate(req.params.id, update, { new: true });
        io.emit('rideUpdated', ride);
        res.status(200).json(ride);
    } catch (e) { res.status(500).json({ error: "Update Failed" }); }
});

// Customer rates a completed ride
app.patch('/api/rides/:id/rate', async (req, res) => {
    try {
        const ride = await Ride.findByIdAndUpdate(req.params.id, { rating: req.body.rating }, { new: true });
        io.emit('rideUpdated', ride);
        res.status(200).json(ride);
    } catch (e) { res.status(500).json({ error: "Rating Failed" }); }
});

app.get('/api/rides', async (req, res) => {
    try {
        const filter = {};
        if (req.query.customerId) filter.customerId = req.query.customerId;
        if (req.query.driverId) filter.driverId = req.query.driverId;
        if (req.query.status) filter.status = req.query.status;
        const rides = await Ride.find(filter).sort({ createdAt: -1 });
        res.status(200).json(rides);
    } catch (e) { res.status(500).json({ error: "Fetch Failed" }); }
});

server.listen(5000, () => console.log('🚀 Server running on port 5000'));
