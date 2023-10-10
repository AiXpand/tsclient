export const camelToAiXpFormat = (input) => {
    return input.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
};

export const convertKeysToAiXpFormat = (obj) => {
    const newObj = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const snakeCaseKey = camelToAiXpFormat(key);
            newObj[snakeCaseKey] = obj[key];
        }
    }

    return newObj;
};

export const aiXpFormatToCamel = (s) => {
    return s.toLowerCase().replace(/([-_][a-z])/gi, ($1) => {
        return $1.toUpperCase().replace('-', '').replace('_', '');
    });
};

export const convertKeysToCamelFormat = (obj) => {
    const newObj = {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const camelCaseKey = aiXpFormatToCamel(key);
            newObj[camelCaseKey] = obj[key];
        }
    }

    return newObj;
};

export const urlSafeBase64ToBase64 = (urlSafeBase64: string): string => {
    return urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/');
};

export const base64ToUrlSafeBase64 = (base64: string): string => {
    return base64.replace(/\+/g, '-').replace(/\//g, '_');
};
