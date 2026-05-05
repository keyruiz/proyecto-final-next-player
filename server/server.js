import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import postRoutes from './routes/post.routes.js';
import teamRoutes from './routes/team.routes.js';
import memberRoutes from './routes/member.routes.js';
import profileRoutes from './routes/profile.routes.js';
import steamRoutes from './routes/steam.routes.js';

dotenv.config();

const app = express();
app.use(express.json());

// Montamos las rutas
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/steam', steamRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});