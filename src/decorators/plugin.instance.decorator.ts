import 'reflect-metadata';

export const PluginInstance = (signature: string): ClassDecorator => {
    return function (target: any) {
        Reflect.defineMetadata('signature', signature, target);
        Reflect.defineMetadata('plugin-instance', true, target);
    };
};
