#!/usr/bin/env node
import * as process from "process";
import "reflect-metadata"
import { AiXpBC } from "./utils";
import fs from "fs";

const [,, ...args] = process.argv;

const action = args[0];
const filename = args[1];

if (action !== 'generate') {
    console.log(`Unknown action: ${action}]`);
    process.exit(1);
}

const keyPair = AiXpBC.generateKeys();
const hexPair = {
    publicKey: keyPair.publicKey.export({ type: 'spki', format: 'der' }).toString('hex'),
    privateKey: keyPair.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex'),
    aixpAddr: AiXpBC.addressFromPublicKey(keyPair.publicKey),
};

console.log('=-=-=-=-=-=-=-= AiXpand Blockchain Address Generator =-=-=-=-=-=-=-=');
console.log(`   Your Address: ${hexPair.aixpAddr}`);
console.log('--------------------------------------------------------------------');
console.log(`   Your Public Key: ${hexPair.publicKey}`);
console.log(`   Your PRIVATE Key: ${hexPair.privateKey}`);
console.log('--------------------------------------------------------------------');
console.log('   Use these keys to setup the blockchain engine. The public/private keypair should be stored in');
console.log('   a SAFE place, and **should not** be committed to git. The address can also be deduced from the');
console.log('   public key.');
if (filename !== undefined) {
    console.log(' ');
    console.log(`   The values have also been saved to: ${filename} Make sure you don't accidentally commit this file.`);
}
console.log('=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-');

if (filename !== undefined) {
    fs.writeFileSync(filename, JSON.stringify(hexPair, null, 2), { encoding: 'utf8' });
}
