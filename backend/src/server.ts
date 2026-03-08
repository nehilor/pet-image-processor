import { loadConfig } from '../config/env';
import { logger } from './utils/logger';
import { app } from './app';

const config = loadConfig();
const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info('Server started', { port: PORT, nodeEnv: config.nodeEnv });
});

export { app, server };
