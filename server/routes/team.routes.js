import { Router } from 'express';
import {
  getTeams,
  createTeam,
  updateTeam,
  deleteTeam,
} from '../controllers/team.controller.js';

const router = Router();

router.get('/', getTeams);
router.post('/', createTeam);
router.put('/:id', updateTeam);
router.delete('/:id', deleteTeam);

export default router;