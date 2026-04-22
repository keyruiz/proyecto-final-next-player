import { Router } from 'express';
import { loginWithSteam, authCallback } from '../controllers/auth.controller.js';

const router = Router();

// Inicia el proceso
router.get('/steam', loginWithSteam);

// Recibe la respuesta de Supabase/Steam
router.get('/callback', authCallback);

export default router;