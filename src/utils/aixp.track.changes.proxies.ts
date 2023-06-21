export function createChangeTrackingProxy<T extends object>(obj: T): T {
    const changeset = {};

    const proxyHandler: ProxyHandler<T> = {
        get(target: T, property: PropertyKey, receiver: any): any {
            const value = Reflect.get(target, property, receiver);

            if (Array.isArray(value)) {
                return createArrayProxy(value);
            }

            if (typeof value === 'object' && value !== null) {
                return createChangeTrackingProxy(value);
            }

            return value;
        },
        set(target: T, property: PropertyKey, value: any, receiver: any): boolean {
            const currentValue = Reflect.get(target, property, receiver);

            if (currentValue !== value) {
                changeset[`${String(property)}`] = value;
            }

            return Reflect.set(target, property, value, receiver);
        },
        deleteProperty(target: T, property: PropertyKey): boolean {
            delete changeset[`${String(property)}`];

            return Reflect.deleteProperty(target, property);
        },
        getOwnPropertyDescriptor(target: T, property: PropertyKey): PropertyDescriptor | undefined {
            return Reflect.getOwnPropertyDescriptor(target, property);
        },
        defineProperty(target: T, property: PropertyKey, descriptor: PropertyDescriptor): boolean {
            changeset[`${String(property)}`] = descriptor.value;
            return Reflect.defineProperty(target, property, descriptor);
        },
        ownKeys(target: T) {
            return Reflect.ownKeys(target);
        },
    };

    const proxy = new Proxy(obj, proxyHandler);

    Object.defineProperty(proxy, 'getChangeset', {
        value: function () {
            const allChanges = {};

            Object.keys(changeset).forEach((key) => {
                if (key === 'getChangeset') {
                    return;
                }

                allChanges[key] = changeset[key];
            });

            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object' && value !== null && value.getChangeset instanceof Function) {
                    const nestedChangeset = value.getChangeset();

                    if (nestedChangeset && Object.keys(nestedChangeset).length > 0) {
                        if (allChanges[`${key}`] === undefined) {
                            allChanges[`${key}`] = {};
                        }
                    }

                    Object.keys(nestedChangeset).forEach((nestedKey) => {
                        allChanges[`${key}`][`${nestedKey}`] = nestedChangeset[nestedKey];
                    });
                }
            }

            return allChanges;
        },
        writable: true,
        enumerable: false,
        configurable: true,
    });

    return proxy;
}

function createArrayProxy<T extends Array<any>>(arr: T): T {
    const changeset = {};

    const arrayProxyHandler: ProxyHandler<T> = {
        get(target: T, property: PropertyKey, receiver: any): any {
            if (property === 'length') {
                return Reflect.get(target, property, receiver);
            }

            const index = Number(property);

            if (!isNaN(index)) {
                const value = Reflect.get(target, property, receiver);

                if (typeof value === 'object' && value !== null) {
                    return createChangeTrackingProxy(value);
                }

                return value;
            }

            return Reflect.get(target, property, receiver);
        },
        set(target: T, property: PropertyKey, value: any, receiver: any): boolean {
            const index = Number(property);

            if (!isNaN(index)) {
                const currentValue = Reflect.get(target, property, receiver);

                if (currentValue !== value) {
                    changeset[`${index}`] = value;
                }
            }

            return Reflect.set(target, property, value, receiver);
        },
        deleteProperty(target: T, property: PropertyKey): boolean {
            const index = Number(property);

            if (!isNaN(index)) {
                delete changeset[`${index}`];
            }

            return Reflect.deleteProperty(target, property);
        },
        getOwnPropertyDescriptor(target: T, property: PropertyKey): PropertyDescriptor | undefined {
            return Reflect.getOwnPropertyDescriptor(target, property);
        },
        defineProperty(target: T, property: PropertyKey, descriptor: PropertyDescriptor): boolean {
            const index = Number(property);

            if (!isNaN(index)) {
                changeset[`${index}`] = descriptor.value;
            }

            return Reflect.defineProperty(target, property, descriptor);
        },
        ownKeys(target: T) {
            return Reflect.ownKeys(target);
        },
    };

    const arrayProxy = new Proxy(arr, arrayProxyHandler);

    Object.defineProperty(arrayProxy, 'getChangeset', {
        value: function () {
            const allChanges = {};

            Object.keys(changeset).forEach((key) => {
                allChanges[key] = changeset[key];
            });

            for (let i = 0; i < arr.length; i++) {
                const value = arr[i];
                if (typeof value === 'object' && value !== null && value.getChangeset instanceof Function) {
                    const nestedChangeset = value.getChangeset();

                    if (nestedChangeset && Object.keys(nestedChangeset).length > 0) {
                        if (allChanges[`${i}`] === undefined) {
                            allChanges[`${i}`] = {};
                        }
                    }
                    Object.keys(nestedChangeset).forEach((nestedKey) => {
                        allChanges[`${i}`][`${nestedKey}`] = nestedChangeset[nestedKey];
                    });
                }
            }

            return allChanges;
        },
        writable: true,
        enumerable: false,
        configurable: true,
    });

    return arrayProxy;
}
