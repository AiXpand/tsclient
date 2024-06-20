# AiXpand Network TypeScript client

Grant Announcement

This repository was made possible through the generous support of the research grant obtained from the project:

“156084 ReDeN - Decentralized Neural Network for the Analysis and Inference of Video Streams through Deep Learning Techniques, Energy Efficiency, and Positive Environmental Impact.”

This project was financed through:

Action 1.2.1 - Stimulating the Demand for Innovation in Enterprises through R&D Projects Conducted by Individual Enterprises or in Partnership with R&D Institutes and Universities, Aiming at Process and Product Innovation in Economic Sectors with Growth Potential.

Call for Projects No. 2, Innovative Technological Project, Competition 2022, Call Code: POC/1033/1/3/Stimulating the Demand for Innovation in Enterprises through R&D Projects Conducted by Individual Enterprises or in Partnership with R&D Institutes and Universities, Aiming at Process and Product Innovation in Economic Sectors with Growth Potential.

We express our gratitude for the funding and support that made this research and de

## Usage

This package's purpose is to aid developers in interacting with the AiXpand Network.

In order to install the package, run the following command:

`npm install --save @aixpand/client`

Usage example:

```typescript
import { AiXpandClient, AiXpandClientOptions, AiXpandEventType, AiXpandClientEvent } from '@aixpand/client';

const aixpOptions: AiXpandClientOptions = {
    mqtt: {
        protocol: 'mqtt',
        host: 'mqtt-host',
        port: 1883,
        username: 'username',
        password: 'password',
        session: {
            clean: true,
            clientId: null,
        },
    },
    name: 'client-internal-name',
    fleet: ['aixpand-node-name'],
    plugins: {},
};

const client = new AiXpandClient(aixpOptions);

client.boot();

// THIS IS AN EXAMPLE OF HOW TO INTERCEPT A SPECIFIC SYSTEM STREAM
client.getStream(AiXpandEventType.HEARTBEAT).subscribe((hearbeatData) => {
    console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
    console.log('Got heartbeat from: ', hearbeatData.sender.host);
    console.log('Known universe: ', client.getUniverse());
    console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');
});

// Successfully upstream connection
client.on(AiXpandClientEvent.AIXP_CLIENT_CONNECTED, () => console.log('Connected!'));

// Boot callback
client.on(AiXpandClientEvent.AIXP_CLIENT_BOOTED, (err, status) => console.log('CLIENT SUCCESSFULLY BOOTED!'));

// Connected fleet callback
client.on(AiXpandClientEvent.AIXP_CLIENT_FLEET_CONNECTED, (status) => console.log(status));

// Broker topic subscription callback
client.on(AiXpandClientEvent.AIXP_CLIENT_SYS_TOPIC_SUBSCRIBE, (err, data) => {
    if (err) {
        console.error(err);

        return;
    }

    console.log(data);
});
```
