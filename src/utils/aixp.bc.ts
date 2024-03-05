import * as crypto from 'crypto';
import * as fs from 'fs';
import * as elliptic from 'elliptic';
import * as asn1 from 'asn1.js';
import stringify from 'json-stable-stringify';

import hkdf from 'futoin-hkdf';

import { base64ToUrlSafeBase64, urlSafeBase64ToBase64 } from './aixp.helper.functions';
import { AiXpandException } from '../aixpand.exception';
import { Buffer } from "node:buffer";

const ec = new elliptic.ec('secp256k1');

const EE_SIGN = 'EE_SIGN';
const EE_SENDER = 'EE_SENDER';
const EE_HASH = 'EE_HASH';
const ADDR_PREFIX = 'aixp_';
const NON_DATA_FIELDS = [EE_SIGN, EE_SENDER, EE_HASH];
const SPKI = asn1.define('SPKI', function () {
    this.seq().obj(
        this.key('algorithm').seq().obj(this.key('id').objid(), this.key('namedCurve').objid()),
        this.key('publicKey').bitstr(),
    );
});

export type AiXpandBlockchainOptions = {
    fromFile: boolean;
    filePath?: string;
    keyPair?: {
        publicKey: string;
        privateKey: string;
    } | null;
    debugMode?: boolean;
};

export class AiXpBC {
    private keyPair: { publicKey: Buffer; privateKey: crypto.KeyObject | Buffer };
    private readonly compressedPublicKey: string;
    private readonly debugMode: boolean;

    constructor(options: AiXpandBlockchainOptions) {
        if (options.fromFile) {
            this.keyPair = this.loadOrCreateKeys(options.filePath);
        } else if (options.keyPair && options.keyPair.privateKey && options.keyPair.publicKey) {
            this.keyPair = this.parseKeys(options.keyPair);
        } else {
            this.keyPair = this.generateAndSaveKeys();
        }
        this.debugMode = options.debugMode || false;
        this.compressedPublicKey = this.constructCompressedPublicKey();
        if (this.debugMode) {
            console.log('AiXpand Blockchain address: ' + this.getAddress());
        }
    }
    
    static generateKeys() {
        return crypto.generateKeyPairSync('ec', {
            namedCurve: 'secp256k1',
            publicKeyEncoding: {
                type: 'spki',
                format: 'der',
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'der',
            },
        });
    }

    static compressPublicKey(publicKey: Buffer): string {
        const publicKeyBytes = SPKI.decode(publicKey, 'der').publicKey.data;
        const compressedPublicKeyB64 = Buffer.from(
            ec.keyFromPublic(publicKeyBytes, 'hex').getPublic(true, 'hex'),
            'hex',
        ).toString('base64');

        return base64ToUrlSafeBase64(compressedPublicKeyB64);
    }

    static addressFromPublicKey(publicKey: Buffer): string {
        return ADDR_PREFIX + AiXpBC.compressPublicKey(publicKey);
    }

    static addressToPublicKey(address: string): crypto.KeyObject {
        const pkB64 = address.replace(ADDR_PREFIX, '');
        const uncompressedPublicKeyHex = ec
        .keyFromPublic(Buffer.from(urlSafeBase64ToBase64(pkB64), 'base64').toString('hex'), 'hex')
        .getPublic(false, 'hex');

        // Manually create DER formatted public key
        const publicKeyDerManual = '3056301006072a8648ce3d020106052b8104000a034200' + uncompressedPublicKeyHex;
        const publicKeyObj = crypto.createPublicKey({
            key: Buffer.from(publicKeyDerManual, 'hex'),
            format: 'der',
            type: 'spki',
        });        
        return publicKeyObj;
    }

    getPublicKeyDER(): string {
        return this.keyPair.publicKey.toString('hex');
    }

    getPrivateKey(): crypto.KeyObject | Buffer {
        return this.keyPair.privateKey;
    }

    getAddress(): string {
        return ADDR_PREFIX + this.compressedPublicKey;
    }

    getHash(input: string | object) {
        let inputString;

        if (typeof input === 'object') {
            inputString = stringify(input);
        } else if (typeof input === 'string') {
            inputString = input;
        } else {
            throw new AiXpandException('Unsupported input type. Input must be a string or object.');
        }

        // Hash the input string
        const strDigest = crypto.createHash('sha256').update(inputString).digest('hex');
        const binDigest = Buffer.from(strDigest, 'hex');

        return {
            strHash: strDigest,
            binHash: binDigest,
        };
    }

    sign(input: string | object, format = 'json'): string | object {
        const { binHash } = this.getHash(input);
        const signatureB64 = this.signHash(binHash);

        return this.prepareMessage(input, signatureB64, format);
    }

    verify(fullJSONMessage: string): boolean {
        let hashResult = false;
        let signatureResult = false;
        let objReceived;

        try {
            objReceived = JSON.parse(fullJSONMessage);
        } catch (e) {
            return false;
        }

        const signatureB64 = objReceived[EE_SIGN];
        const pkB64 = objReceived[EE_SENDER] ? objReceived[EE_SENDER].replace(ADDR_PREFIX, '') : null;
        const receivedHash = objReceived[EE_HASH];
        const objData = Object.fromEntries(
            Object.entries(objReceived).filter(([key]) => !NON_DATA_FIELDS.includes(key)),
        );
        const strData = stringify(objData);
        const hash = crypto.createHash('sha256').update(strData).digest();
        const hashHex = hash.toString('hex');

        if (hashHex != receivedHash) {
          hashResult = false;          
          if (this.debugMode) {
            console.log(
              "Hashes do not match or public key is missing:\n",
              "  Computed: " + hashHex + "\n",
              "  Received: " + receivedHash + "\n", 
              "  Public key:" + pkB64 + "\n",
              "  Data: " + JSON.stringify(objData) + "\n",
              "  Stringify: '" + strData + "'",
            );  
          }
        }
        else {
          hashResult = true;
        }

        if (pkB64) {
            const signatureBuffer = Buffer.from(urlSafeBase64ToBase64(signatureB64), 'base64');

            const publicKeyObj = AiXpBC.addressToPublicKey(pkB64);

            signatureResult = crypto.verify(
                null,
                hash,
                {
                    key: publicKeyObj,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                },
                signatureBuffer,
            );

            if (this.debugMode) {
                console.log('Verify local hash: ' + signatureResult);
                const bHash = Buffer.from(receivedHash, 'hex');
                const signatureRecvResult = crypto.verify(
                    null,
                    bHash,
                    {
                        key: publicKeyObj,
                        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                    },
                    signatureBuffer,
                );

                if (signatureRecvResult) {
                    console.log(
                        'Signature is valid for received hash & signature meaning that the public key is valid as well as the signature. Most likely someone or something modified the payload',
                    );
                } else {
                    console.log('Verify ONLY on received hash & signature FAILED: ' + signatureRecvResult);
                }
            }
        }
        return hashResult && signatureResult;
    }

    private loadOrCreateKeys(filePath) {
        try {
            const savedKeys = fs.readFileSync(filePath, { encoding: 'utf8' });

            return this.parseKeys(JSON.parse(savedKeys));
        } catch (error) {
            return this.generateAndSaveKeys(filePath);
        }
    }

    private parseKeys(parsedKeys: { publicKey: string; privateKey: string }) {
        return {
            publicKey: Buffer.from(parsedKeys.publicKey, 'hex'),
            privateKey: this.createPrivateKey(Buffer.from(parsedKeys.privateKey, 'hex')),
        };
    }

    private createPrivateKey(buffer: Buffer): crypto.KeyObject {
        return crypto.createPrivateKey({
            key: buffer,
            format: 'der',
            type: 'pkcs8',
        });
    }

    private generateAndSaveKeys(filePath?: string) {
        const keyPair = AiXpBC.generateKeys();

        if (filePath) {
            const savedKeys = {
                publicKey: keyPair.publicKey.toString('hex'),
                privateKey: keyPair.privateKey.toString('hex'),
            };

            fs.writeFileSync(filePath, JSON.stringify(savedKeys, null, 2), { encoding: 'utf8' });
        }

        return keyPair;
    }

    private constructCompressedPublicKey(): string {
        return AiXpBC.compressPublicKey(this.keyPair.publicKey);
    }

    private signHash(binHash: Buffer): string {
        const signature = crypto.sign(null, binHash, {
            // @ts-ignore
            key: this.getPrivateKey(),
            format: 'der',
            type: 'pkcs8',
        });

        return base64ToUrlSafeBase64(signature.toString('base64'));
    }

    private prepareMessage(input: string | object, signatureB64: string, format: string): string | object {
        const message = Object.assign({}, input, {
            [EE_SIGN]: signatureB64,
            [EE_SENDER]: this.getAddress(),
            [EE_HASH]: this.getHash(input).strHash,
        });

        if (format === 'json') {
            return JSON.stringify(message);
        } else if (format === 'object') {
            return message;
        } else {
            throw new AiXpandException('Unsupported format. Format must be either "object" or "json".');
        }
    }


    // encrypt-decrypt area

    private deriveSharedKey(peerPublicKey: crypto.KeyObject): Buffer {
        // Assuming `this.keyPair.privateKey` is the private key object of the instance.
        // We need to convert the peer's public key to a format that the ECDH can use.
        const ecdh = crypto.createECDH('secp256k1');
        ecdh.setPrivateKey(this.keyPair.privateKey instanceof Buffer ? this.keyPair.privateKey : this.keyPair.privateKey.export({ type: 'sec1', format: 'der' }));

        // Compute the shared secret using the peer's public key.
        // Ensure the public key is in the correct format; if it's a string, convert it to a Buffer.
        // const peerPublicKeyBuffer = peerPublicKey instanceof Buffer ? peerPublicKey : peerPublicKey.export({ type: 'spki', format: 'der' });
        const peerPublicKeyBuffer = Buffer.from(peerPublicKey.export({ type: 'spki', format: 'der' }));
        const sharedSecret = ecdh.computeSecret(peerPublicKeyBuffer);

        // Use HKDF to derive a key from the shared secret.
        // crypto.createHkdf does not exist in Node's crypto module as of my last update.
        // You will need a custom HKDF implementation or use a library that provides HKDF.
        // For demonstration, here's a pseudo-implementation based on how you might expect to use it.
        // Note: This pseudo-code does not run as-is. You must replace it with an actual HKDF implementation.

        const key = hkdf(sharedSecret, 32, {
          info: 'AiXp handshake data',
          salt: Buffer.alloc(0), // Using an empty salt is safer than undefined.
          hash: 'SHA-256',
        });
      
        const hkdfKey = Buffer.from(key);        

        return hkdfKey;
    }

    encrypt(message: string, destinationAddress: string): string {
        const destinationPublicKey = AiXpBC.addressToPublicKey(destinationAddress);
    
        // Assuming deriveSharedKey replicates Python's __derive_shared_key functionality
        const sharedKey = this.deriveSharedKey(destinationPublicKey);
    
        // AES-GCM Encryption
        const iv = crypto.randomBytes(12); // Nonce
        const cipher = crypto.createCipheriv('aes-256-gcm', sharedKey, iv);
        let encrypted = cipher.update(message, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);
    
        // Prepend nonce to the ciphertext
        const encryptedData = Buffer.concat([iv, encrypted, cipher.getAuthTag()]);
    
        // Base64 encode
        return encryptedData.toString('base64');
    }
  

    decrypt(encryptedDataB64: string, sourceAddress: string): string {
        const sourcePublicKey = AiXpBC.addressToPublicKey(sourceAddress);
    
        // Base64 decode
        const encryptedData = Buffer.from(encryptedDataB64, 'base64');
    
        // Extract nonce and ciphertext
        const nonce = encryptedData.slice(0, 12);
        const ciphertext = encryptedData.slice(12, encryptedData.length - 16);
        const authTag = encryptedData.slice(encryptedData.length - 16);
    
        // Derive shared key
        const sharedKey = this.deriveSharedKey(sourcePublicKey);
    
        // AES-GCM Decryption
        const decipher = crypto.createDecipheriv('aes-256-gcm', sharedKey, nonce);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
    
        return decrypted.toString('utf8');
    }
     
}


