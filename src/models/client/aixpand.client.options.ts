import { MqttOptions } from '../mqtt.options';
import { ConstructorOptions as EventEmitterConstructorOptions } from 'eventemitter2';
import { Dictionary } from '../dictionary';

export interface PluginRegistration {
    payload?: any;
    instanceConfig: any;
}

export interface AiXpandClientOptions {
    mqtt: MqttOptions;
    name: string;
    fleet: string[];
    aixpNamespace?: string;
    emitterOptions?: EventEmitterConstructorOptions;
    consumerGroup?: string | null;
    plugins: Dictionary<PluginRegistration>;
}
