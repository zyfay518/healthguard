import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import vitalRoutes from './routes/vitalRoutes';
import symptomRoutes from './routes/symptomRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// CORS configuration with explicit headers
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/vitals', vitalRoutes);
app.use('/api/symptoms', symptomRoutes);

app.get('/', (req, res) => {
    res.send('HealthGuard API is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
