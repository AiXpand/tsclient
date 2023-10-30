const stringify = require('json-stable-stringify');

obj = {
  "DEBUG_SAVE_PAYLOAD": false,
  "ALIVE_TIME_MINS": 1322.67,
  "PLUGIN_REAL_RESOLUTION": 1.0,
  "PLUGIN_LOOP_RESOLUTION": 50,
  "ALERT_HELPER": "A=0, N=0, CT=NA, E=A[]=0.00 vs >=0.50 ",
  "DEMO_MODE": false,
  "PROCESS_DELAY": 1,
  "GRAPH_TYPE": [1.1, 2.2, 3.3, 4.0, 5.1, 6.0, 7.2],
  "VERSION": "0.1.0.0"
}

console.log(stringify(obj));


