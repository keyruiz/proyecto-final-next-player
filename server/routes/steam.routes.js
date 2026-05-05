import { Router } from 'express';
import {
  getPlayerSummary,
  getGeneralStats,
  getWeaponStats,
  getMapStats,
  getExtraStats,
  getOwnedGames,
} from '../controllers/steam.controller.js';

const router = Router();

router.get('/summary/:steamid', getPlayerSummary);
router.get('/stats/general/:steamid', getGeneralStats);
router.get('/stats/weapons/:steamid', getWeaponStats);
router.get('/stats/maps/:steamid', getMapStats);
router.get('/stats/extra/:steamid', getExtraStats);
router.get('/owned-games/:steamid', getOwnedGames);

export default router;
