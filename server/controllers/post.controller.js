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