/**
 * @marketforge/api entrypoint. Importing @marketforge/config (transitively)
 * validates the environment fail-fast before the server binds.
 */
import { startServer } from './server.js';

startServer();
