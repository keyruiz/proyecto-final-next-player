import { supabase } from '../supabase.js';
import OpenID from 'openid';
import { randomUUID } from 'crypto';

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
      // Verificar si ya existe un usuario con este Steam ID
      const { data: existingAccount } = await supabase
        .from('external_accounts')
        .select('user_id')
        .eq('provider', 'steam')
        .eq('external_user_id', steamId)
        .maybeSingle();

      let userId;
      if (existingAccount) {
        // Usuario ya existe, usar su user_id
        userId = existingAccount.user_id;
      } else {
        // Nuevo usuario, generar UUID
        userId = randomUUID();

        // 1. Insertar en 'users'
        const { error: errUsers } = await supabase.from('users').upsert({
          id: userId,
          email: null, // Steam no proporciona email
          role: 'users'
        });
        if (errUsers) throw new Error(`Error en users: ${errUsers.message}`);
      }

      // Obtener datos del usuario de Steam API
      const steamResponse = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`);
      const steamData = await steamResponse.json();
      const player = steamData.response.players[0];

      if (!player) {
        return res.status(400).json({ error: 'No se pudo obtener datos de Steam' });
      }

      // 2. Insertar/actualizar en 'external_accounts'
      const { error: errExternal } = await supabase.from('external_accounts').upsert({
        user_id: userId,
        provider: 'steam',
        external_user_id: steamId,
        access_token: null, // No hay token persistente en OpenID
        token_expires_at: null
      });
      if (errExternal) throw new Error(`Error en external_accounts: ${errExternal.message}`);

      // 3. Insertar/actualizar en 'profiles'
      const { error: errProfiles } = await supabase.from('profiles').upsert({
        user_id: userId,
        username: player.personaname,
        avatar: player.avatarfull || player.avatar
      });
      if (errProfiles) throw new Error(`Error en profiles: ${errProfiles.message}`);

      res.json({ message: 'Autenticación exitosa', user_id: userId });
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