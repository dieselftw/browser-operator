import { Router } from 'express';
import { interact } from '../controllers/crust.controller';

const router = Router();

// Define routes
router.post('/interact', interact)

export default router;
