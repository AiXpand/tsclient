/*

git clone git@github.com:AiXpand/tsclient.git
npm install 
npm run test:watch -- aixp.bc.payload.spec.ts

*/
import { beforeAll, describe, expect, test } from '@jest/globals';
import { AiXpBC } from './aixp.bc';

describe('AiXpand Blockchain Tests', () => {
    let mockAiXpandBCEngine;

    beforeAll(() => {
        mockAiXpandBCEngine = new AiXpBC({
            debugMode: true,
            fromFile: false,
            keyPair: {
                publicKey:
                    '3056301006072a8648ce3d020106052b8104000a034200047bed71522fff22fb93de3922e84d8cb5172a3d833ef6daa681f80fa65a8ab7d3c4183504b4b2b1ff390e6c62dca4109a4851e7588cfb19bf427a8dffd539102f',
                privateKey:
                    '308184020100301006072a8648ce3d020106052b8104000a046d306b020101042054bf5b9c2e0df0bcb2bbfc250df7a561b3443562851800d087434af937bec0ffa144034200047bed71522fff22fb93de3922e84d8cb5172a3d833ef6daa681f80fa65a8ab7d3c4183504b4b2b1ff390e6c62dca4109a4851e7588cfb19bf427a8dffd539102f',
            },
        });
    });

    test('verify with strange payload', () => {
      const payload = {
        "messageID": "9da078f1-a066-42aa-89a7-ed70b7b0cb40",
        "type": "moxa_01",
        "category": "general",
        "version": "3.28.173",
        "data": {
          "identifiers": {
            "streamId": "device-drivers",
            "instanceId": "a3b6973c-c8d5-4b79-a075-2d8310c61910",
            "payloadId": 78353,
            "initiatorId": "cavi2-staging",
            "sessionId": null,
            "idTags": []
          },
          "value": {},
          "specificValue": {
            "ee_timezone": "UTC+3",
            "ee_tz": "Europe/Bucharest",
            "ee_message_seq": 118458,
            "debug_payload_saved": false,
            "pipeline": "device-drivers",
            "is_alert": false,
            "is_new_raise": false,
            "is_new_lower": false,
            "is_alert_new_raise": false,
            "is_alert_new_lower": false,
            "is_alert_status_changed": false,
            "stream_name": "device-drivers",
            "tags": "",
            "id_tags": [],
            "collected": false,
            "dataset_builder_used": false,
            "moxa_state": {
              "modelName": "E1214",
              "deviceUpTime": "146:31:33",
              "inputs": [
                {
                  "diIndex": 0,
                  "diMode": 0,
                  "diStatus": 1
                },
                {
                  "diIndex": 1,
                  "diMode": 0,
                  "diStatus": 1
                },
                {
                  "diIndex": 2,
                  "diMode": 0,
                  "diStatus": 0
                },
                {
                  "diIndex": 3,
                  "diMode": 1,
                  "diCounterValue": 0,
                  "diCounterStatus": 0,
                  "diCounterReset": 0,
                  "diCounterOverflowFlag": 0,
                  "diCounterOverflowClear": 0
                },
                {
                  "diIndex": 4,
                  "diMode": 1,
                  "diCounterValue": 0,
                  "diCounterStatus": 0,
                  "diCounterReset": 0,
                  "diCounterOverflowFlag": 0,
                  "diCounterOverflowClear": 0
                },
                {
                  "diIndex": 5,
                  "diMode": 0,
                  "diStatus": 0
                }
              ],
              "relays": [
                {
                  "relayIndex": 0,
                  "relayMode": 1,
                  "relayPulseStatus": 0,
                  "relayPulseCount": 1,
                  "relayPulseOnWidth": 1,
                  "relayPulseOffWidth": 1,
                  "relayTotalCount": 1049,
                  "relayCurrentCount": 1049,
                  "relayCurrentCountReset": 0
                },
                {
                  "relayIndex": 1,
                  "relayMode": 0,
                  "relayStatus": 0,
                  "relayTotalCount": 137,
                  "relayCurrentCount": 137,
                  "relayCurrentCountReset": 0
                },
                {
                  "relayIndex": 2,
                  "relayMode": 0,
                  "relayStatus": 0,
                  "relayTotalCount": 4,
                  "relayCurrentCount": 4,
                  "relayCurrentCountReset": 0
                },
                {
                  "relayIndex": 3,
                  "relayMode": 0,
                  "relayStatus": 0,
                  "relayTotalCount": 4,
                  "relayCurrentCount": 4,
                  "relayCurrentCountReset": 0
                },
                {
                  "relayIndex": 4,
                  "relayMode": 0,
                  "relayStatus": 0,
                  "relayTotalCount": 13,
                  "relayCurrentCount": 13,
                  "relayCurrentCountReset": 0
                },
                {
                  "relayIndex": 5,
                  "relayMode": 1,
                  "relayPulseStatus": 0,
                  "relayPulseCount": 8,
                  "relayPulseOnWidth": 1,
                  "relayPulseOffWidth": 1,
                  "relayTotalCount": 565,
                  "relayCurrentCount": 565,
                  "relayCurrentCountReset": 0
                }
              ]
            },
            "img_in_payload": false
          },
          "time": "2023-10-25 14:08:11.589774",
          "img": {
            "id": null,
            "height": null,
            "width": null
          }
        },
        "metadata": {
          "sbTotalMessages": 118458,
          "sbCurrentMessage": "9da078f1-a066-42aa-89a7-ed70b7b0cb40",
          "captureMetadata": {},
          "pluginMetadata": {
            "DEBUG_SAVE_PAYLOAD": false,
            "ALIVE_TIME_MINS": 1322.67,
            "PLUGIN_REAL_RESOLUTION": 1.0,
            "PLUGIN_LOOP_RESOLUTION": 50,
            "ALERT_HELPER": "A=0, N=0, CT=NA, E=A[]=0.00 vs >=0.50 ",
            "DEMO_MODE": false,
            "PROCESS_DELAY": 1,
            "GRAPH_TYPE": [],
            "VERSION": "0.1.0.0"
          }
        },
        "time": {
          "deviceTime": "",
          "hostTime": "2023-10-25 14:08:11.682912",
          "internetTime": ""
        },
        "sender": {
          "id": "AiXp-ExecutionEngine",
          "instanceId": "AiXp-EE-v3.28.173",
          "hostId": "gts-staging"
        },
        "demoMode": false,
        "EE_FORMATTER": "cavi2",
        "EE_PAYLOAD_PATH": [
          "gts-staging",
          "device-drivers",
          "MOXA_01",
          "a3b6973c-c8d5-4b79-a075-2d8310c61910"
        ],
        "EE_MESSAGE_ID": "9da078f1-a066-42aa-89a7-ed70b7b0cb40",
        "EE_SIGN": "MEQCIGVMFK1PLeEkgAuEtALxhLbgndC1MUMWEGtjdaVwzLIzAiBC4x_-JdTzTsybSNpza87QY7VPPKfHPr5APp7JzF1pxQ==",
        "EE_SENDER": "aixp_AvDJaXULCUbtjvTFZikVGQM3SJoG7XXw3RK5U6LZHD7S",
        "EE_HASH": "b85ca6d4c3d7ac91368a30e03d65ee4623b42eb6fab0892f673f140b91867204"
      }                 
      const receivedMessage = JSON.stringify(payload);

      expect(mockAiXpandBCEngine.verify(receivedMessage)).toBe(true);
  });

  
  });
