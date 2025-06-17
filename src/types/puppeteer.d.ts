import 'puppeteer';

declare module 'puppeteer' {
  export interface LaunchOptions {
    headless?: boolean | 'shell';
  }
}
