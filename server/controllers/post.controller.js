import { supabase} from '../supabase.js';

export const getPosts = async (req, res) => {
  const { game } = req.query; 

  try {
    let query = supabase
      .from('posts')
      .select('*, profiles(username, avatar)');

   
    if (game && game !== 'Todos') {
      query = query.eq('game_name', game); 
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