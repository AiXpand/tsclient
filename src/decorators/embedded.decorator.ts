import 'reflect-metadata';
import { BindingOptions } from './binding.options';
import { reservedPropertyNames } from './bind.decorator';

const defaultOptions: BindingOptions = {
    isArray: false,
    nullable: false,
    alwaysSerialize: false,
};

export const Embedded = (
    type: { new (...any): any },
    propertyName: string = null,
    options: BindingOptions = {},
): PropertyDecorator => {
    if (reservedPropertyNames.includes(propertyName)) {
        throw new Error(`"${propertyName}" is reserved and handled separately by the serializer.`);
    }

    options = { ...defaultOptions, ...options };

    return function (target: any, propertyKey?: string | symbol) {
        const embeddedProperties: Map<string, { embeddedType: { new (): any }; options: BindingOptions }> =
            Reflect.getMetadata('embeddedProperties', target.constructor) || new Map();
        embeddedProperties.set(propertyKey.toString(), { embeddedType: type, options });
        Reflect.defineMetadata('embeddedProperties', embeddedProperties, target.constructor);

        const propertyMappings: Map<string, { propertyName: string; options: BindingOptions }> =
            Reflect.getMetadata('propertyMappings', target.constructor) || new Map();
        propertyMappings.set(propertyKey.toString(), { propertyName, options });
        Reflect.defineMetadata('propertyMappings', propertyMappings, target.constructor);
    };
};
