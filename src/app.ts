import express from 'express';
import cors from 'cors';
import connectDB from './config/db';
import exampleRoutes from './routes/example.route';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', exampleRoutes);

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
});
