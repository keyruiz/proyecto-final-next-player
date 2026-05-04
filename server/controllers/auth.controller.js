import { supabase } from '../supabase.js';
import OpenID from 'openid';

const steam = new OpenID.RelyingParty(
  'http://localhost:3000/api/auth/callback',
  'http://localhost:3000',
  true,
  false,
  []
);

export const loginWithSteam = async (req, res) => {
  steam.authenticate('https://steamcommunity.com/openid', false, (error, authUrl) => {
    if (error) return res.status(500).json({ error: error.message });
    res.redirect(authUrl);
  });
};

export const authCallback = async (req, res) => {
  steam.verifyAssertion(req, async (error, result) => {
    if (error || !result.authenticated) {
      return res.status(400).json({ error: 'Steam authentication failed' });
    }

    const steamId = result.claimedIdentifier.split('/').pop();

    try {
      // Obtener datos del usuario de Steam API
      const steamResponse = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`);
      const steamData = await steamResponse.json();
      const player = steamData.response.players[0];

      if (!player) {
        return res.status(400).json({ error: 'No se pudo obtener datos de Steam' });
      }

      // 1. Insertar en 'users'
      const { error: errUsers } = await supabase.from('users').upsert({
        id: steamId,
        email: null, // Steam no proporciona email
        role: 'player'
      });
      if (errUsers) throw new Error(`Error en users: ${errUsers.message}`);

      // 2. Insertar en 'external_accounts'
      const { error: errExternal } = await supabase.from('external_accounts').upsert({
        user_id: steamId,
        provider: 'steam',
        external_user_id: steamId,
        access_token: null // No hay token persistente en OpenID
      });
      if (errExternal) throw new Error(`Error en external_accounts: ${errExternal.message}`);

      // 3. Insertar en 'profiles'
      const { error: errProfiles } = await supabase.from('profiles').upsert({
        user_id: steamId,
        username: player.personaname,
        avatar: player.avatarfull || player.avatar
      });
      if (errProfiles) throw new Error(`Error en profiles: ${errProfiles.message}`);

      res.redirect('http://localhost:3000/dashboard');
    } catch (err) {
      console.error("PROCESO DETENIDO:", err.message);
      res.status(500).json({
        status: "error",
        message: "Se detuvo el registro por un fallo en la base de datos",
        detail: err.message
      });
    }
  });
};