import 'reflect-metadata';

export const DataCaptureThread = (): ClassDecorator => {
    return function (target: any) {
        Reflect.defineMetadata('data-capture-thread', true, target);
    };
};
