import 'reflect-metadata';

export const Pipeline = (): ClassDecorator => {
    return function (target: any) {
        Reflect.defineMetadata('aixpand-pipeline', true, target);
    };
};
