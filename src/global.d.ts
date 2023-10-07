import type _fetch from 'node-fetch';

declare global {
  declare const fetch: typeof _fetch;
}
