import 'reflect-metadata';

export const Alerter = (): ClassDecorator => {
    return function (target: any) {
        Reflect.defineMetadata('plugin-instance-alerter', true, target);
    };
};
