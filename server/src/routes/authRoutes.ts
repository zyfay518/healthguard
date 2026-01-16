import express from 'express';
import { z } from 'zod';
import { supabase } from '../supabaseClient';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Validation schema for profile update
const profileSchema = z.object({
    full_name: z.string().optional(),
    age: z.number().int().optional(),
    gender: z.string().optional(),
    height: z.number().optional(),
    weight: z.number().optional(),
    avatar_url: z.string().optional(),
});

// Get current user profile
router.get('/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Update user profile
router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
        const userId = req.user.id;
        const validatedData = profileSchema.parse(req.body);

        const { data, error } = await supabase
            .from('profiles')
            .update(validatedData)
            .eq('id', userId)
            .select();

        if (error) throw error;

        res.json(data[0]);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
