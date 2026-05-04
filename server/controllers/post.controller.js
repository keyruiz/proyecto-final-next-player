import { supabase} from '../supabase.js';

export const getPosts = async (req, res) => {
  const { game, game_id } = req.query;
  const gameFilter = game_id || game;

  try {
    let query = supabase
      .from('posts')
      .select('*, games(name), users(profiles(username, avatar))');

    if (gameFilter && gameFilter !== 'Todos') {
      query = query.eq('game_id', gameFilter);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createPost = async (req, res) => {
  const { user_id, game_id, title, description, role, rank } = req.body;

  try {
    const { data: gameRecord, error: gameError } = await supabase
      .from('games')
      .select('id')
      .eq('id', game_id)
      .maybeSingle();

    if (gameError) throw gameError;
    if (!gameRecord) return res.status(400).json({ error: 'game_id no válido' });

    // Verificamos si ya tiene uno
    const { data: existingPost } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingPost) return res.status(400).json({ message: "Ya tienes un post activo" });

    const { data, error } = await supabase
      .from('posts')
      .insert([{ 
        user_id, 
        game_id, 
        title, 
        description, 
        role, 
        rank,
        is_active: true 
      }])
      .select();

    if (error) throw error;
    res.status(201).json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const { user_id, title, description, role, rank, is_active } = req.body;

  const { data, error } = await supabase
    .from('posts')
    .update({ title, description, role, rank, is_active })
    .eq('id', id)
    .eq('user_id', user_id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};

export const deletePost = async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('user_id', user_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: "Post eliminado" });
};