import 'reflect-metadata';
import { BindingOptions } from '../decorators';

export const deserialize = <T extends object>(object: any, targetType: { new (): T }): T => {
    const instance = new targetType();

    const embeddedProperties: Map<string, { embeddedType: { new (): any }; options: BindingOptions }> =
        Reflect.getMetadata('embeddedProperties', targetType) || new Map();
    const propertyMappings: Map<string, { propertyName: string; options: BindingOptions }> =
        Reflect.getMetadata('propertyMappings', targetType) || new Map();

    const isDCT: boolean = Reflect.getMetadata('data-capture-thread-config', targetType) || false;

    if (isDCT) {
        // @ts-ignore
        console.log('deserializing DCT', targetType.getSchema(), object);
    }

    propertyMappings.forEach((property, key) => {
        if (!object) {
            return;
        }

        if (object.hasOwnProperty(property.propertyName)) {
            const embeddedConfig = embeddedProperties.get(key);
            if (embeddedConfig?.options.isArray) {
                const embeddedType = embeddedConfig.embeddedType;
                instance[key] = object[property.propertyName].map((item: any) => deserialize(item, embeddedType));
            } else if (embeddedConfig) {
                const embeddedType = embeddedConfig.embeddedType;
                instance[key] = deserialize(object[property.propertyName], embeddedType);
            } else {
                instance[key] = object[property.propertyName];
            }
        }
    });

    return instance;
};
