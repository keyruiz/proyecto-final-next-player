import { supabase } from '../supabase.js';

export const getProfile = async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id es obligatorio' });
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Perfil no encontrado' });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  const { user_id } = req.params;
  const { authenticated_user_id, avatar, bio, country, created_at, username } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'user_id es obligatorio' });
  }

  if (!authenticated_user_id) {
    return res.status(400).json({ error: 'authenticated_user_id es obligatorio' });
  }

  if (authenticated_user_id !== user_id) {
    return res.status(403).json({ error: 'Solo puedes actualizar tu propio perfil' });
  }

  try {
    const updateData = {};
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bio !== undefined) updateData.bio = bio;
    if (country !== undefined) updateData.country = country;
    if (created_at !== undefined) updateData.created_at = created_at;
    if (username !== undefined) updateData.username = username;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Al menos un campo debe ser proporcionado' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', user_id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

