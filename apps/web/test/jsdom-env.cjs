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
  'TextEncoder',
  'TextDecoder',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'structuredClone',
  'BroadcastChannel',
];

/**
 * jsdom ships its own AbortController/AbortSignal, but Node's `Request` rejects a signal
 * that came from another realm ("Expected signal to be an instance of AbortSignal"), and
 * React Router aborts navigations with one. The whole fetch family has to come from a
 * single realm, so these are replaced rather than filled in.
 */
/** jsdom's `crypto` has `getRandomValues` but no `randomUUID`, which every offline
 * write depends on for its idempotency key. */
const OVERRIDDEN_GLOBALS = ['AbortController', 'AbortSignal', 'crypto'];

class JsdomWithNodeGlobals extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const key of NODE_GLOBALS) {
      if (this.global[key] === undefined && globalThis[key] !== undefined) {
        this.global[key] = globalThis[key];
      }
    }
    for (const key of OVERRIDDEN_GLOBALS) {
      if (globalThis[key] === undefined) continue;
      // jsdom installs some of these as read-only accessors, so a plain assignment is
      // silently dropped.
      Object.defineProperty(this.global, key, {
        value: globalThis[key],
        writable: true,
        configurable: true,
      });
    }
  }
}

module.exports = JsdomWithNodeGlobals;
