import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller.js';

const router = Router();

router.get('/:user_id', getProfile);
router.put('/:user_id', updateProfile);

export default router;
