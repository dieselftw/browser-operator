import { Router } from 'express';
import { getExamples } from '../controllers/example.controller';

const router = Router();

// Define routes
router.get('/', getExamples); // GET /api/examples

export default router;
