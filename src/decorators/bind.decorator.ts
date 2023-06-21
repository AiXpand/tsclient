import 'reflect-metadata';
import { BindingOptions } from './binding.options';

const defaultOptions: BindingOptions = {
    isArray: false,
    nullable: false,
    alwaysSerialize: false,
};

export const reservedPropertyNames = ['ID_TAGS', 'LINKED_INSTANCES', 'SINGLE_INSTANCE'];

export const Bind = (configPropertyName: string, options: BindingOptions = {}): PropertyDecorator => {
    options = { ...defaultOptions, ...options };

    if (reservedPropertyNames.includes(configPropertyName)) {
        throw new Error(`"${configPropertyName}" is reserved and handled separately by the serializer.`);
    }

    return function (target: any, propertyKey: string | symbol) {
        const propertyMappings: Map<string, { propertyName: string; options: BindingOptions }> =
            Reflect.getMetadata('propertyMappings', target.constructor) || new Map();
        propertyMappings.set(propertyKey.toString(), { propertyName: configPropertyName, options });
        Reflect.defineMetadata('propertyMappings', propertyMappings, target.constructor);
    };
};
