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
    this._server = new WebpackDevServer(webpack(config), {...config.devServer, noInfo: true});
    const port = this._port = config.devServer.port;
    await new Promise((resolve, reject) => this._server.listen(port, 'localhost', resolve).on('error', reject));
  }

  public async stop() {
    console.error("Stopping webpack-dev-server");
    this._server.close();
  }

  public getHost(): string {
    return `http://localhost:${this._port}`;
  }
}

export const server = new WebpackServer();
