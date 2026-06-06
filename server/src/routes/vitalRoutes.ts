import express from 'express';
import { z } from 'zod';
import { supabase } from '../supabaseClient';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { formatError } from '../utils/errors';

const router = express.Router();

// Validation schema - allow null for skipped fields
const vitalSchema = z.object({
    systolic: z.number().int().min(0).max(300).nullable().optional(),
    diastolic: z.number().int().min(0).max(200).nullable().optional(),
    heart_rate: z.number().int().min(0).max(250).nullable().optional(),
    recorded_at: z.string().optional(), // Optional timestamp, defaults to now
});

// Get all vitals for the authenticated user
router.get('/', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;

        const { data, error } = await supabase
            .from('vital_records')
            .select('*')
            .eq('user_id', userId)
            .order('recorded_at', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error('Error fetching vitals:', error);
        res.status(400).json({ error: formatError(error) });
    }
});

// Add a new vital record
router.post('/', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const validatedData = vitalSchema.parse(req.body);

        const insertData: any = {
            user_id: userId,
            systolic: validatedData.systolic,
            diastolic: validatedData.diastolic,
            heart_rate: validatedData.heart_rate,
        };

        // Use provided recorded_at or default to now
        if (validatedData.recorded_at) {
            insertData.recorded_at = validatedData.recorded_at;
        }

        let { data, error } = await supabase
            .from('vital_records')
            .insert([insertData])
            .select();

        if (error && String(error.message || '').includes('null value')) {
            const fallbackData = {
                ...insertData,
                systolic: insertData.systolic ?? 0,
                diastolic: insertData.diastolic ?? 0,
                heart_rate: insertData.heart_rate ?? 0,
            };
            const fallbackResult = await supabase
                .from('vital_records')
                .insert([fallbackData])
                .select();
            data = fallbackResult.data;
            error = fallbackResult.error;
        }

        if (error) throw error;

        res.json(data?.[0] || null);
    } catch (error: any) {
        res.status(400).json({ error: formatError(error) });
    }
});

// Delete vital records
router.delete('/', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const ids = req.body.ids;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid IDs provided' });
        }

        const { data, error } = await supabase
            .from('vital_records')
            .delete()
            .in('id', ids)
            .eq('user_id', userId);

        if (error) throw error;

        res.json({ message: `${ids.length} records deleted successfully` });
    } catch (error: any) {
        res.status(400).json({ error: formatError(error) });
    }
});

export default router;
