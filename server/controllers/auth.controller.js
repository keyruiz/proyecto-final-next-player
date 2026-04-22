import { supabase } from '../supabase.js';

export const loginWithSteam = async (req, res) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'steam',
    options: {
      redirectTo: 'http://localhost:3000/api/auth/callback',
    },
  });

  if (error) return res.status(500).json({ error: error.message });
  res.redirect(data.url);
};

export const authCallback = async (req, res) => {
  const { code } = req.query;
  const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);

  if (authError) return res.status(500).json({ error: authError.message });

  const { user, session } = data;

  try {
    // 1. Insertar en 'users'
    const { error: errUsers } = await supabase.from('users').upsert({
      id: user.id,
      email: user.email,
      role: 'player'
    });
    if (errUsers) throw new Error(`Error en users: ${errUsers.message}`);

    // 2. Insertar en 'external_accounts'
    const { error: errExternal } = await supabase.from('external_accounts').upsert({
      user_id: user.id,
      provider: user.app_metadata.provider || 'steam',
      external_user_id: user.user_metadata.sub,
      access_token: session.access_token
    });
    if (errExternal) throw new Error(`Error en external_accounts: ${errExternal.message}`);

    // 3. Insertar en 'profiles'
    const { error: errProfiles } = await supabase.from('profiles').upsert({
      user_id: user.id,
      username: user.user_metadata.full_name || user.user_metadata.name,
      avatar: user.user_metadata.avatar_url
    });
    if (errProfiles) throw new Error(`Error en profiles: ${errProfiles.message}`);

    // Si llegamos aquí, todo salió bien
    res.redirect('http://localhost:3000/dashboard');

  } catch (err) {
    // Si cualquiera de los "throw" de arriba se ejecuta, el código salta aquí directamente
    console.error("PROCESO DETENIDO:", err.message);
    
    // Aquí podrías decidir si borrar al usuario de Auth para que no quede "a medias"
    // await supabase.auth.admin.deleteUser(user.id); 

    res.status(500).json({ 
      status: "error", 
      message: "Se detuvo el registro por un fallo en la base de datos",
      detail: err.message 
    });
  }
};