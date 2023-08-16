import { v4 as uuidv4 } from 'uuid';

/**
 * This is the base class that all the plugins must extend. It offers a common root for all the plugins
 * instantiated throughout the application.
 */
export abstract class AiXpandPlugin {
    static generateId() {
        return uuidv4().substring(0, 13);
    }
}
