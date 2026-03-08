import express from 'express';
import cors from 'cors';
import { loadConfig } from '../config/env';
import { logger } from './utils/logger';
import routes from './routes';

const app = express();
const config = loadConfig();

app.use(express.json());
app.use(cors());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', routes);

const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, nodeEnv: config.nodeEnv });
});

export { app, server };
