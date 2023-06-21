import { AiXpandPluginInstance } from './aixpand.plugin.instance';

/**
 * This is the base class that all the plugins must extend. It offers a common root for all the plugins
 * instantiated throughout the application.
 *
 * This is a generic class and expects a specific object of type `T` to be passed when extending it, for this children
 * classes need to know the type of the instance configuration object that they work with.
 */
export abstract class AiXpandPlugin<T extends object> {
    /**
     * This method should define how a plugin instance of the extending class looks like.
     *
     * It can take any values and can implement any logic as long as it outputs an `AiXpandPluginInstance` of the
     * extending class' configuration type.
     *
     * @param values
     */
    abstract makePluginInstance(...values: any): AiXpandPluginInstance<T>;
}
