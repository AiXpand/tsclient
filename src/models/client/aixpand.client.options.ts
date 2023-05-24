import { MqttOptions } from '../mqtt.options';
import { ConstructorOptions as EventEmitterConstructorOptions } from 'eventemitter2';
import { Dictionary } from '../dictionary';
import { BufferServiceInterface } from '../buffer.service.interface';

export interface PluginRegistration {
    payload?: any;
    instanceConfig: any;
}

export enum CacheType {
    MEMORY = 'memory',
    CUSTOM = 'custom',
}

export interface AiXpandClientOptions {
    mqtt: MqttOptions;
    name: string;
    fleet: string[];
    aixpNamespace?: string;
    emitterOptions?: EventEmitterConstructorOptions;
    consumerGroup?: string | null;
    plugins: Dictionary<PluginRegistration>;
    options?: {
        offlineTimeout?: number;
        bufferPayloadsWhileBooting: boolean;
        cacheType: CacheType;
        cacheService?: BufferServiceInterface;
    };
}
