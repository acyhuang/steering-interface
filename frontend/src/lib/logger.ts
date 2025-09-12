import { Logger } from '../logging/logger';
export { Logger } from '../logging/logger';
export { useLogger } from '../logging/context';
export const createLogger = (component: string): Logger => new Logger({ component }); 