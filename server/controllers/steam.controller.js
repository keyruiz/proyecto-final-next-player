import dotenv from 'dotenv';
import { supabase } from '../supabase.js';

dotenv.config();

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const CS2_APPID = 730;
const STEAM_API_BASE = 'https://api.steampowered.com';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas en ms

function parseStats(statsArray) {
  const map = {};
  for (const s of statsArray) {
    map[s.name] = s.value;
  }
  return map;
}

// ── Helper: comprueba caché en Supabase ──
async function getCached(steamid, type) {
  const { data } = await supabase
    .from('stats')
    .select('*')
    .eq('steam_id', steamid)
    .eq('game_id', type)
    .maybeSingle();

  if (!data) return null;

  const age = Date.now() - new Date(data.updated_at).getTime();
  if (age < CACHE_TTL) {
    return data.data;
  }
  return null;
}

// ── Helper: guarda en caché Supabase ──
async function setCache(steamid, type, payload) {
  const { error } = await supabase
    .from('stats')
    .upsert(
      { steam_id: steamid, game_id: type, data: payload, updated_at: new Date().toISOString() },
      { onConflict: 'steam_id,game_id' }
    );
  if (error) console.error('Error guardando caché stats:', error.message);
}

// ── Helper: llama a Steam para stats CS2 (GetUserStatsForGame) ──
async function fetchRawStats(steamid) {
  const url = `${STEAM_API_BASE}/ISteamUserStats/GetUserStatsForGame/v2/?appid=${CS2_APPID}&key=${STEAM_API_KEY}&steamid=${steamid}`;
  const apiRes = await fetch(url);
  const json = await apiRes.json();
  if (!json.playerstats?.stats) return null;
  return parseStats(json.playerstats.stats);
}

// ── Bloque 1: Perfil básico (nombre, avatar, estado) ──
export const getPlayerSummary = async (req, res) => {
  const { steamid } = req.params;
  if (!steamid) return res.status(400).json({ error: 'steamid es obligatorio' });

  try {
    const cached = await getCached(steamid, 'summary');
    if (cached) return res.json(cached);

    const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steamid}`;
    const apiRes = await fetch(url);
    const json = await apiRes.json();

    const player = json.response?.players?.[0];
    if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

    const result = {
      personaname: player.personaname,
      avatar: player.avatarmedium,
      avatarfull: player.avatarfull,
      profileurl: player.profileurl,
      personastate: player.personastate,
      realname: player.realname || null,
      timecreated: player.timecreated,
      loccountrycode: player.loccountrycode || null,
    };

    await setCache(steamid, 'summary', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Bloque 2: Estadísticas generales (K/D, wins, precisión, tiempo) ──
export const getGeneralStats = async (req, res) => {
  const { steamid } = req.params;
  if (!steamid) return res.status(400).json({ error: 'steamid es obligatorio' });

  try {
    const cached = await getCached(steamid, 'general');
    if (cached) return res.json(cached);

    const m = await fetchRawStats(steamid);
    if (!m) return res.status(404).json({ error: 'Estadísticas no disponibles. Perfil privado o sin datos.' });

    const kills = m.total_kills || 0;
    const deaths = m.total_deaths || 1;
    const wins = m.total_wins || 0;
    const rounds = m.total_rounds_played || 0;
    const shots = m.total_shots_fired || 1;
    const hits = m.total_hits || 0;
    const timePlayed = m.total_time_played || 0;

    const result = {
      total_kills: kills,
      total_deaths: m.total_deaths || 0,
      kd_ratio: parseFloat((kills / deaths).toFixed(2)),
      total_wins: wins,
      total_rounds_played: rounds,
      accuracy: parseFloat(((hits / shots) * 100).toFixed(2)) + '%',
      total_shots_fired: shots,
      total_hits: hits,
      hours_played: parseFloat((timePlayed / 3600).toFixed(1)),
    };

    await setCache(steamid, 'general', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Bloque 3: Top armas por kills ──
export const getWeaponStats = async (req, res) => {
  const { steamid } = req.params;
  if (!steamid) return res.status(400).json({ error: 'steamid es obligatorio' });

  try {
    const cached = await getCached(steamid, 'weapons');
    if (cached) return res.json(cached);

    const m = await fetchRawStats(steamid);
    if (!m) return res.status(404).json({ error: 'Estadísticas no disponibles' });

    const weaponMap = {
      ak47: 'AK-47',
      m4a1: 'M4A1',
      awp: 'AWP',
      deagle: 'Desert Eagle',
      p90: 'P90',
      ump45: 'UMP-45',
      mac10: 'MAC-10',
      famas: 'FAMAS',
      aug: 'AUG',
      ssg08: 'SSG 08',
      glock: 'Glock',
      usp_silencer: 'USP-S',
      elite: 'Dual Berettas',
      fiveseven: 'Five-SeveN',
      xm1014: 'XM1014',
      negev: 'Negev',
      m249: 'M249',
      bizon: 'PP-Bizon',
      mp7: 'MP7',
      mp9: 'MP9',
      sg556: 'SG 553',
      g3sg1: 'G3SG1',
      scar20: 'SCAR-20',
      galilar: 'Galil AR',
      taser: 'Taser',
    };

    const weapons = [];
    for (const [key, label] of Object.entries(weaponMap)) {
      const kills = m[`total_kills_${key}`];
      if (kills && kills > 0) {
        const shots = m[`total_shots_${key}`] || 0;
        const hits = m[`total_hits_${key}`] || 0;
        weapons.push({
          name: label,
          kills,
          shots,
          hits,
          accuracy: shots > 0 ? parseFloat(((hits / shots) * 100).toFixed(2)) + '%' : '0%',
        });
      }
    }

    weapons.sort((a, b) => b.kills - a.kills);
    await setCache(steamid, 'weapons', weapons);
    res.json(weapons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Bloque 4: Estadísticas por mapa (wins, rondas, winrate) ──
export const getMapStats = async (req, res) => {
  const { steamid } = req.params;
  if (!steamid) return res.status(400).json({ error: 'steamid es obligatorio' });

  try {
    const cached = await getCached(steamid, 'maps');
    if (cached) return res.json(cached);

    const m = await fetchRawStats(steamid);
    if (!m) return res.status(404).json({ error: 'Estadísticas no disponibles' });

    const mapPrefixes = [
      'de_dust2', 'de_mirage', 'de_inferno', 'de_nuke', 'de_overpass',
      'de_vertigo', 'de_ancient', 'de_anubis', 'de_train',
    ];

    const maps = [];
    for (const map of mapPrefixes) {
      const rounds = m[`total_rounds_map_${map}`] || 0;
      const wins = m[`total_wins_map_${map}`] || 0;
      if (rounds > 0) {
        maps.push({
          map: map.replace('de_', '').replace('ar_', ''),
          rounds,
          wins,
          winrate: parseFloat(((wins / rounds) * 100).toFixed(2)) + '%',
        });
      }
    }

    maps.sort((a, b) => b.rounds - a.rounds);
    await setCache(steamid, 'maps', maps);
    res.json(maps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Bloque 5: Estadísticas extra (bombas, cuchillo, granadas, dominaciones) ──
export const getExtraStats = async (req, res) => {
  const { steamid } = req.params;
  if (!steamid) return res.status(400).json({ error: 'steamid es obligatorio' });

  try {
    const cached = await getCached(steamid, 'extra');
    if (cached) return res.json(cached);

    const m = await fetchRawStats(steamid);
    if (!m) return res.status(404).json({ error: 'Estadísticas no disponibles' });

    const result = {
      bombs_planted: m.total_planted_bombs || 0,
      bombs_defused: m.total_defused_bombs || 0,
      hostages_rescued: m.total_rescue_hostages || 0,
      kills_knife: m.total_kills_knife || 0,
      kills_enemy_blinded: m.total_kills_enemy_blinded || 0,
      kills_against_zoomed_sniper: m.total_kills_against_zoomed_sniper || 0,
      dominations: m.total_dominations || 0,
      revenge: m.total_revenge || 0,
      kills_headshot: m.total_kills_headshot || 0,
      kills_enemy_weapon: m.total_kills_enemy_weapon || 0,
      kills_while_last_alive: m.total_kills_while_last_alive || 0,
      mvps: m.total_mvps || 0,
      contributions_survived: m.total_contribution_survived || 0,
      rounds_won_pistol: m.total_wins_pistol || 0,
    };

    await setCache(steamid, 'extra', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Bloque 6: Horas jugadas y logros ──
export const getOwnedGames = async (req, res) => {
  const { steamid } = req.params;
  if (!steamid) return res.status(400).json({ error: 'steamid es obligatorio' });

  try {
    const cached = await getCached(steamid, 'owned');
    if (cached) return res.json(cached);

    const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamid}&include_appinfo=true&include_played_free_games=true`;
    const apiRes = await fetch(url);
    const json = await apiRes.json();

    const games = json.response?.games || [];
    const cs2 = games.find(g => g.appid === CS2_APPID);
    if (!cs2) return res.status(404).json({ error: 'CS2 no encontrado en la biblioteca del usuario' });

    const result = {
      appid: cs2.appid,
      name: cs2.name,
      playtime_forever: parseFloat((cs2.playtime_forever / 60).toFixed(1)) + ' horas',
      playtime_2weeks: cs2.playtime_2weeks ? parseFloat((cs2.playtime_2weeks / 60).toFixed(1)) + ' horas' : '0 horas',
      playtime_linux_forever: cs2.playtime_linux_forever || 0,
      playtime_windows_forever: cs2.playtime_windows_forever || 0,
      playtime_mac_forever: cs2.playtime_mac_forever || 0,
      has_community_visible_stats: cs2.has_community_visible_stats || false,
    };

    await setCache(steamid, 'owned', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
