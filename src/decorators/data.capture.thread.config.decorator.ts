import 'reflect-metadata';

export const DataCaptureThreadConfig = (): ClassDecorator => {
    return function (target: any) {
        Reflect.defineMetadata('data-capture-thread-config', true, target);
    };
};
