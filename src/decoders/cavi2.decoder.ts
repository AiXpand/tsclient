const mandatoryKeys = ['EE_SIGN', 'EE_SENDER', 'EE_HASH', 'EE_PAYLOAD_PATH'];

export const cavi2Decoder = (message): any => {
    if (message.messageID) delete message.messageID;
    if (message.SB_IMPLEMENTATION) delete message.SB_IMPLEMENTATION;
    if (message.EE_FORMATTER) delete message.EE_FORMATTER;

    const transformed = {
        EE_FORMATTER: null,
    };

    mandatoryKeys.forEach((mandatoryKey) => {
        transformed[mandatoryKey] = message[mandatoryKey];
        delete message[mandatoryKey];
    });

    const eventType = message.type;
    delete message.type;

    let eeEventType = eventType;
    if (!['notification', 'heartbeat'].includes(eventType)) {
        eeEventType = 'payload';
    }

    transformed['EE_EVENT_TYPE'] = eeEventType.toUpperCase();

    const data = { ...message.data };
    delete message.data;
    const metadata = { ...message.metadata };
    delete message.metadata;

    transformed['EE_ID'] = message.sender.hostId;
    delete message.sender;

    transformed['EE_TIMESTAMP'] = message.time.hostTime;
    delete message.time;

    transformed['EE_TOTAL_MESSAGES'] = metadata.sbTotalMessages;
    delete metadata.sbTotalMessages;

    transformed['EE_MESSAGE_ID'] = metadata.sbCurrentMessage;
    delete metadata.sbCurrentMessage;

    if (eeEventType === 'payload') {
        transformed['SIGNATURE'] = eventType.toUpperCase();

        const captureMetadata = metadata.captureMetadata;
        delete metadata.captureMetadata;
        const pluginMetadata = metadata.pluginMetadata;
        delete metadata.pluginMetadata;

        Object.keys(captureMetadata).forEach((key) => {
            transformed[`_C_${key.toUpperCase()}`] = captureMetadata[key];
            delete captureMetadata[key];
        });

        Object.keys(pluginMetadata).forEach((key) => {
            transformed[`_P_${key.toUpperCase()}`] = pluginMetadata[key];
            delete pluginMetadata[key];
        });

        transformed['STREAM'] = data.identifiers.streamId;
        delete data.identifiers.streamId;
        transformed['INSTANCE_ID'] = data.identifiers.instanceId;
        delete data.identifiers.instanceId;
        transformed['ID'] = data.identifiers.payloadId;
        delete data.identifiers.payloadId;
        transformed['ID_TAGS'] = data.identifiers.idTags;
        delete data.identifiers.idTags;

        if (data.identifiers.initiatorId) {
            transformed['INITIATOR_ID'] = data.identifiers.initiatorId;
            delete data.identifiers.initiatorId;
        } else {
            transformed['INITIATOR_ID'] = null;
        }

        if (data.identifiers.sessionId) {
            transformed['SESSION_ID'] = data.identifiers.sessionId;
            delete data.identifiers.sessionId;
        } else {
            transformed['SESSION_ID'] = null;
        }

        delete data.identifiers;

        const value = Object.assign({}, data.value, data.specificValue);
        Object.keys(value).forEach((key) => {
            transformed[`${key.toUpperCase()}`] = value[key];
            delete value[key];
        });

        delete data.value;
        delete data.specificValue;

        transformed['TIMESTAMP_EXECUTION'] = data.time;
        delete data.time;

        if (!!data.img && !!data.img?.id) {
            transformed['IMG'] = data.img.id;
            delete data.img.id;
        }

        if (!!data.img && !!data.img?.height) {
            transformed['IMG_HEIGHT'] = data.img.height;
            delete data.img.height;
        }

        if (!!data.img && !!data.img?.width) {
            transformed['IMG_WIDTH'] = data.img.width;
            delete data.img.width;
        }
    }

    Object.keys(metadata).forEach((key) => {
        transformed[key.toUpperCase()] = metadata[key];
        delete metadata[key];
    });

    delete message.category;
    delete message.version;
    delete message.demoMode;

    return transformed;
};
