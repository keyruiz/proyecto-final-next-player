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
      // 1. Verificar si la cuenta de Steam ya existe
      const { data: existingAccount } = await supabase
        .from('external_accounts')
        .select('user_id')
        .eq('provider', 'steam')
        .eq('external_user_id', steamId)
        .maybeSingle();

      // SI EL USUARIO YA EXISTE: Cortamos aquí el proceso de inserción.
      if (existingAccount) {
        return res.json({ 
          message: 'Inicio de sesión exitoso (Usuario existente)', 
          user_id: existingAccount.user_id 
        });
      }

      // SI EL USUARIO NO EXISTE: Empezamos el proceso de registro único.
      
      // Obtener datos de Steam solo para el registro inicial
      let username = `SteamUser_${steamId.substring(0, 8)}`;
      let avatar = null;

      const steamResponse = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${process.env.STEAM_API_KEY}&steamids=${steamId}`);
      const steamText = await steamResponse.text();
      const contentType = steamResponse.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const steamData = JSON.parse(steamText);
        const player = steamData.response?.players?.[0];
        if (player) {
          username = player.personaname;
          avatar = player.avatarfull || player.avatar;
        } else {
          console.log("Steam API JSON sin jugadores:", steamText);
          throw new Error('No se pudieron obtener datos de Steam para el registro');
        }
      } else {
        console.log("Steam API devolvió HTML (posible bloqueo o API Key inválida):", steamText.substring(0, 200));
      }

      const userId = randomUUID();

      // A) Insertar en 'users' con rol 'user'
      const { error: errUsers } = await supabase.from('users').insert({
        id: userId,
        email: null,
        role: 'user' // Cambiado a 'user' como pediste
      });
      if (errUsers) throw new Error(`Error en users: ${errUsers.message}`);

      // B) Insertar en 'external_accounts' (sin tokens innecesarios)
      const { error: errExternal } = await supabase.from('external_accounts').insert({
        user_id: userId,
        provider: 'steam',
        external_user_id: steamId
      });
      if (errExternal) throw new Error(`Error en external_accounts: ${errExternal.message}`);

      // C) Insertar en 'profiles'
      const { error: errProfiles } = await supabase.from('profiles').insert({
        user_id: userId,
        username: username,
        avatar: avatar
      });
      if (errProfiles) throw new Error(`Error en profiles: ${errProfiles.message}`);

      res.json({ message: 'Usuario creado y autenticado', user_id: userId });

    } catch (err) {
      console.error("ERROR EN REGISTRO:", err.message);
      res.status(500).json({
        status: "error",
        message: "Error en el proceso de registro",
        detail: err.message
      });
    }
  });
};