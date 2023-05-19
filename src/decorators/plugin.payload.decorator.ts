import 'reflect-metadata';

export const PluginPayload = (signature: string): ClassDecorator => {
    return function (target: any) {
        Reflect.defineMetadata('signature', signature, target);
        Reflect.defineMetadata('plugin-instance-payload', true, target);
    };
};
