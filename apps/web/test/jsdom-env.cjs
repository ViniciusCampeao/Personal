const JSDOMEnvironment = require('jest-environment-jsdom').default;

/**
 * jsdom ships no fetch/Response/streams, but the app talks to the API through `fetch`.
 * Rather than pulling in a polyfill, hand the test realm the ones Node already has.
 */
const NODE_GLOBALS = [
  'fetch',
  'Headers',
  'Request',
  'Response',
  'FormData',
  'Blob',
  'File',
  'AbortController',
  'AbortSignal',
  'TextEncoder',
  'TextDecoder',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'structuredClone',
  'BroadcastChannel',
];

class JsdomWithNodeGlobals extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const key of NODE_GLOBALS) {
      if (this.global[key] === undefined && globalThis[key] !== undefined) {
        this.global[key] = globalThis[key];
      }
    }
  }
}

module.exports = JsdomWithNodeGlobals;
