import { Router } from 'express';
import { interact } from '../controllers/example.controller';

const router = Router();

// Define routes
router.post('/interact', interact)

export default router;
