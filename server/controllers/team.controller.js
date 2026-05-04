import { supabase } from '../supabase.js';

const isTeamCeo = async (teamId, userId) => {
  if (!userId) return false;

  const { data, error } = await supabase
    .from('team_member')
    .select('role, team_id')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.role === 'ceo';
};

export const getTeams = async (req, res) => {
  const { game_id } = req.query;

  try {
    let query = supabase
      .from('teams')
      .select('*, games(name)');

    if (game_id) {
      query = query.eq('game_id', game_id);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createTeam = async (req, res) => {
  const { game_id, name, logo, description, owner_id } = req.body;

  if (!owner_id) {
    return res.status(400).json({ error: 'owner_id es obligatorio' });
  }

  try {
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert([{ game_id, name, logo, description, owner_id }])
      .select();

    if (teamError) throw teamError;
    if (!teamData || teamData.length === 0) {
      return res.status(500).json({ error: 'Error al crear el equipo' });
    }

    const teamId = teamData[0].id;

    const { data: memberData, error: memberError } = await supabase
      .from('team_member')
      .insert([{ team_id: teamId, user_id: owner_id, role: 'ceo', joined_at: new Date().toISOString() }])
      .select();

    if (memberError) throw memberError;

    res.status(201).json({ team: teamData[0], member: memberData[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateTeam = async (req, res) => {
  const { id } = req.params;
  const { user_id, name, logo, description } = req.body;

  try {
    if (!user_id) return res.status(400).json({ error: 'user_id requerido' });

    const isCeo = await isTeamCeo(id, user_id);
    if (!isCeo) return res.status(403).json({ error: 'Solo los CEO pueden actualizar el team' });

    const { data, error } = await supabase
      .from('teams')
      .update({ name, logo, description })
      .eq('id', id)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteTeam = async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  try {
    if (!user_id) return res.status(400).json({ error: 'user_id requerido' });

    const isCeo = await isTeamCeo(id, user_id);
    if (!isCeo) return res.status(403).json({ error: 'Solo los CEO pueden borrar el team' });

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Team eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};