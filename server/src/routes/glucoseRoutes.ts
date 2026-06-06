import express from 'express';
import { z } from 'zod';
import { supabase } from '../supabaseClient';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { formatError } from '../utils/errors';

const router = express.Router();

const glucoseSchema = z.object({
    value: z.number().min(0).max(40),
    unit: z.literal('mmol/L').default('mmol/L'),
    measurement_context: z.enum(['fasting', 'pre_meal', 'post_meal', 'random']).optional().nullable(),
    post_meal_timing: z.enum(['within_30_min', 'one_hour', 'two_hours', 'over_two_hours']).optional().nullable(),
    note: z.string().optional().nullable(),
    recorded_at: z.string().optional(),
});

const isMissingGlucoseTable = (error: any) => (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    String(error?.message || '').includes('glucose_records')
);

router.get('/', requireAuth, async (req: AuthRequest, res) => {
    try {
        const { data, error } = await supabase
            .from('glucose_records')
            .select('*')
            .eq('user_id', req.user.id)
            .order('recorded_at', { ascending: false });

        if (error) {
            if (isMissingGlucoseTable(error)) return res.json([]);
            throw error;
        }

        res.json(data || []);
    } catch (error: any) {
        res.status(400).json({ error: formatError(error), code: error.code });
    }
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
    try {
        const validatedData = glucoseSchema.parse(req.body);
        const { data, error } = await supabase
            .from('glucose_records')
            .insert([{
                user_id: req.user.id,
                ...validatedData,
                recorded_at: validatedData.recorded_at || new Date().toISOString(),
            }])
            .select();

        if (error) throw error;

        res.json(data[0]);
    } catch (error: any) {
        res.status(400).json({ error: formatError(error), code: error.code });
    }
});

router.delete('/', requireAuth, async (req: AuthRequest, res) => {
    try {
        const ids = req.body.ids;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid IDs provided' });
        }

        const { error } = await supabase
            .from('glucose_records')
            .delete()
            .in('id', ids)
            .eq('user_id', req.user.id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: formatError(error), code: error.code });
    }
});

export default router;
