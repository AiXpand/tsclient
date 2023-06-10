import 'reflect-metadata';

export type PluginInstanceOptions = {
    linkable?: boolean;
};

const defaultOptions: PluginInstanceOptions = {
    linkable: false,
};

export const PluginInstance = (signature: string, options: PluginInstanceOptions = {}): ClassDecorator => {
    options = { ...defaultOptions, ...options };

    return function (target: any) {
        Reflect.defineMetadata('signature', signature, target);
        Reflect.defineMetadata('plugin-instance', true, target);
        Reflect.defineMetadata('plugin-instance-options', options, target);
    };
};
