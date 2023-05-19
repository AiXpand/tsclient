import 'reflect-metadata';

export const Embedable = (signatures: string | string[] = null): ClassDecorator => {
    return function (target: any) {
        if (!Array.isArray(signatures)) {
            Reflect.defineMetadata('signatures', [signatures], target);
        } else {
            Reflect.defineMetadata('signatures', signatures, target);
        }

        Reflect.defineMetadata('plugin-instance-part', true, target);
        Reflect.defineMetadata('plugin-instance-payload-part', true, target);
    };
};
