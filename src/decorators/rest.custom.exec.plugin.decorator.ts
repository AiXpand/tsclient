import 'reflect-metadata';

export const RestCustomExecPlugin = (): ClassDecorator => {
    return function (target: any) {
        Reflect.defineMetadata('is-rest-custom-exec', true, target);
    };
};
