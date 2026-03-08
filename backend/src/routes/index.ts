import { Router } from 'express';
import uploadRoutes from './upload.routes';
import statusRoutes from './status.routes';

const router = Router();

router.use('/upload', uploadRoutes);
router.use('/', statusRoutes);

export default router;
