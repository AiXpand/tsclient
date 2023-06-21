import 'reflect-metadata';

export const Alertable = (): ClassDecorator => {
    return function (target: any) {
        const hasPluginInstanceMetadata = Reflect.hasMetadata('plugin-instance', target);

        if (hasPluginInstanceMetadata) {
            Reflect.defineMetadata('plugin-instance-alertable', true, target);
        }
    };
};
