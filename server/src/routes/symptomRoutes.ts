import express from 'express';
import { z } from 'zod';
import { supabase } from '../supabaseClient';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Validation schema
const symptomSchema = z.object({
    symptoms: z.array(z.string()),
    note: z.string().optional(),
    recorded_at: z.string().optional(), // Maps to created_at in database
});

// Get all symptoms for the authenticated user
router.get('/', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabase
            .from('symptom_logs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Add a new symptom log
router.post('/', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const validatedData = symptomSchema.parse(req.body);

        const insertData: any = {
            user_id: userId,
            symptoms: validatedData.symptoms,
            note: validatedData.note,
        };

        if (validatedData.recorded_at) {
            insertData.created_at = validatedData.recorded_at;
        }

        const { data, error } = await supabase
            .from('symptom_logs')
            .insert([insertData])
            .select();

        if (error) throw error;

        res.json(data[0]);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Delete symptom logs
router.delete('/', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const ids = req.body.ids;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Invalid IDs provided' });
        }

        const { data, error } = await supabase
            .from('symptom_logs')
            .delete()
            .in('id', ids)
            .eq('user_id', userId);

        if (error) throw error;

        res.json({ message: `${ids.length} records deleted successfully` });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
