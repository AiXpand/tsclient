import 'reflect-metadata';
import { REST_CUSTOM_EXEC_SIGNATURE } from '../abstract.rest.custom.exec.plugin';
import { BindingOptions } from '../decorators';
import { AiXpandPluginInstance } from '../models';

export type LinkInfo<T extends object> = {
    links: {
        instances: AiXpandPluginInstance<T>[];
        collector: AiXpandPluginInstance<T>;
    };
};

export const serialize = <T extends object>(
    instance: T,
    signature = null,
    tags: Map<string, string> = new Map<string, string>(),
    linkInfo: null | LinkInfo<T> = null,
    changeset = null,
): any => {
    if (
        !(
            Reflect.hasMetadata('plugin-instance', instance.constructor) ||
            Reflect.hasMetadata('plugin-instance-part', instance.constructor) ||
            Reflect.hasMetadata('data-capture-thread-config', instance.constructor) ||
            Reflect.hasMetadata('plugin-instance-alerter', instance.constructor)
        )
    ) {
        console.log(
            'Only Plugin Instances, Embedded Configs, Alerter Configs or Data Capture Threads can be serialized.',
        );
        return;
    }

    if (tags === null) {
        tags = new Map<string, string>();
    }

    const serializedObject: any = {};
    const isDataCaptureThread = Reflect.getMetadata('data-capture-thread-config', instance.constructor);
    const isPluginInstance = Reflect.getMetadata('plugin-instance', instance.constructor);
    const isPluginInstanceAlerter = Reflect.getMetadata('plugin-instance-alerter', instance.constructor);

    if (isPluginInstance) {
        signature = Reflect.getMetadata('signature', instance.constructor);

        if (Reflect.hasMetadata('is-rest-custom-exec', instance.constructor)) {
            tags.set('CUSTOM_SIGNATURE', signature);
        }

        if (tags.size) {
            serializedObject['ID_TAGS'] = {};
            tags.forEach((value, key) => {
                serializedObject['ID_TAGS'][`${key}`] = value;
            });
        }

        if (linkInfo && linkInfo.links.collector === null && linkInfo.links.instances.length === 0) {
            // single instance
            serializedObject['SINGLE_INSTANCE'] = true;
        }

        if (linkInfo && linkInfo.links.collector !== null) {
            // subordinated linked instance
            serializedObject['SINGLE_INSTANCE'] = false;
        }

        if (linkInfo && linkInfo.links.instances.length > 0) {
            // main linked instance
            serializedObject['LINKED_INSTANCES'] = linkInfo.links.instances.map(
                (instance: AiXpandPluginInstance<T>) => [instance.getStreamId(), instance.id],
            );
        }
    } else if (!isDataCaptureThread && !isPluginInstanceAlerter) {
        const partSignatures = Reflect.getMetadata('signatures', instance.constructor);
        if (!partSignatures.includes(signature) && !partSignatures.includes(REST_CUSTOM_EXEC_SIGNATURE)) {
            console.log(
                `Cannot serialize "${signature}"; Found EmbeddedConfig without "${signature}" registered signature.`,
            );
            return;
        }
    }

    const embeddedProperties: Map<string, { embeddedType: { new (): any }; options: BindingOptions }> =
        Reflect.getMetadata('embeddedProperties', instance.constructor) || new Map();
    const propertyMappings: Map<string, { propertyName: string; options: BindingOptions }> =
        Reflect.getMetadata('propertyMappings', instance.constructor) || new Map();

    propertyMappings.forEach((property, key) => {
        if (
            instance.hasOwnProperty(key) &&
            (!changeset || changeset[key] !== undefined || property.options.alwaysSerialize)
        ) {
            if (!instance[key] && property.options.nullable) {
                return;
            }

            const changesetToPass =
                changeset == null || property.options.alwaysSerialize === true ? null : changeset[key] ?? {};
            const embeddedConfig = embeddedProperties.get(key);
            if (embeddedConfig?.options.isArray) {
                serializedObject[property.propertyName] = instance[key].map((item: any) =>
                    serialize(item, signature, null, null, changesetToPass),
                );
            } else if (embeddedConfig) {
                serializedObject[property.propertyName] = serialize(
                    instance[key],
                    signature,
                    null,
                    null,
                    changesetToPass,
                );
            } else {
                serializedObject[property.propertyName] = instance[key];
            }
        }
    });

    return serializedObject;
};
