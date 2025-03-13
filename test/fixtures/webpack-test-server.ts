import {IMochaServer} from 'mocha-webdriver';
import * as path from 'path';
import * as webpack from 'webpack';
import * as WebpackDevServer from 'webpack-dev-server';

// tslint:disable:no-console

export class WebpackServer implements IMochaServer {
  // WebpackDevServer instance. See https://github.com/webpack/docs/wiki/webpack-dev-server
  private _server!: WebpackDevServer;
  private _port!: number;

  public async start() {
    const config = require(path.resolve(__dirname, 'webpack.config.js'));
    console.error("Starting webpack-dev-server");
    this._server = new WebpackDevServer({
      ...config.devServer,
      open: false,
    }, webpack(config));
    const port = this._port = config.devServer.port;

    await this._server.startCallback(() => {
      console.log(`Starting server on http://localhost:${port}`);
    });
  }

  public async stop() {
    console.error("Stopping webpack-dev-server");
    await this._server.stop();
  }

  public getHost(): string {
    return `http://localhost:${this._port}`;
  }
}

export const server = new WebpackServer();
