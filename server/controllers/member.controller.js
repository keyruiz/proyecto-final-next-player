import { supabase } from '../supabase.js';

export const getMembers = async (req, res) => {
  const { team_id } = req.query;

  try {
    let query = supabase
      .from('team_member')
      .select('*, profiles(username, avatar)');

    if (team_id) {
      query = query.eq('team_id', team_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createMember = async (req, res) => {
  const { team_id, user_id, role, joined_at } = req.body;
  const normalizedRole = (role || '').toLowerCase();

  if (!team_id || !user_id || !normalizedRole) {
    return res.status(400).json({ error: 'team_id, user_id y role son obligatorios' });
  }

  if (!['ceo', 'player'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'role debe ser "ceo" o "player"' });
  }

  try {
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', team_id)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team) return res.status(400).json({ error: 'team_id no válido' });

    const { data: existingMember } = await supabase
      .from('team_member')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingMember) {
      return res.status(400).json({ error: 'El usuario ya es miembro de este equipo' });
    }

    const { count, error: countError } = await supabase
      .from('team_member')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team_id);

    if (countError) throw countError;
    if (count >= 6) {
      return res.status(400).json({ error: 'El equipo ya tiene 6 miembros' });
    }

    if (normalizedRole === 'ceo') {
      const { data: existingCeo } = await supabase
        .from('team_member')
        .select('id')
        .eq('team_id', team_id)
        .eq('role', 'ceo')
        .maybeSingle();

      if (existingCeo) {
        return res.status(400).json({ error: 'Este equipo ya tiene un CEO' });
      }
    }

    const { data, error } = await supabase
      .from('team_member')
      .insert([{ team_id, user_id, role: normalizedRole, joined_at: joined_at || new Date().toISOString() }])
      .select();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateMember = async (req, res) => {
  const { id } = req.params;
  const { role, joined_at } = req.body;
  const normalizedRole = role ? role.toLowerCase() : undefined;

  if (!role && !joined_at) {
    return res.status(400).json({ error: 'role o joined_at son necesarios para actualizar' });
  }

  if (normalizedRole && !['ceo', 'player'].includes(normalizedRole)) {
    return res.status(400).json({ error: 'role debe ser "ceo" o "player"' });
  }

  try {
    const { data: member, error: memberError } = await supabase
      .from('team_member')
      .select('team_id, role')
      .eq('id', id)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });

    if (normalizedRole === 'ceo' && member.role !== 'ceo') {
      const { data: existingCeo } = await supabase
        .from('team_member')
        .select('id')
        .eq('team_id', member.team_id)
        .eq('role', 'ceo')
        .maybeSingle();

      if (existingCeo) {
        return res.status(400).json({ error: 'Este equipo ya tiene un CEO' });
      }
    }

    const updateData = {};
    if (normalizedRole) updateData.role = normalizedRole;
    if (joined_at) updateData.joined_at = joined_at;

    const { data, error } = await supabase
      .from('team_member')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteMember = async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('team_member')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Miembro eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};