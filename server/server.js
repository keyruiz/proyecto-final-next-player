import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import postRoutes from './routes/post.routes.js';

dotenv.config();

const app = express();
app.use(express.json());

// Montamos las rutas
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});