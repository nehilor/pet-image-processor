import { Router } from 'express';
import { updateJob } from '../controllers/jobs.controller';

const router = Router();

router.patch('/:jobId', updateJob);

export default router;
