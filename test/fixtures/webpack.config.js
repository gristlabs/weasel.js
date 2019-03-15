/**
 * Test and develop a widget by running the following at the root of the git checkout:
 *
 *    bin/webpack-serve --config test/fixtures/projects/webpack.config.js
 *
 * It will build and serve the demo code with live-reload at
 *
 *    http://localhost:9000/
 */
'use strict';

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const fs = require('fs');
const glob = require('glob');
const path = require('path');

// Build each */index.ts as its own bundle.
const entries = {};
for (const fixture of glob.sync(`${__dirname}/*.ts`)) {
  const name = path.basename(fixture, '.ts');
  if (name.startsWith('webpack')) { continue; }
  entries[name] = fixture;
}

// Generic trivial html template for all projects.
const htmlTemplate = fs.readFileSync(`${__dirname}/template.html`, 'utf8');

module.exports = {
  mode: "development",
  entry: entries,
  output: {
    path: path.resolve(__dirname),
    filename: "build/[name].bundle.js",
    sourceMapFilename: "build/[name].bundle.js.map",
  },
  devtool: 'inline-source-map',
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    modules: [
      path.resolve('.'),
      path.resolve('./node_modules')
    ],
  },
  module: {
    rules: [
      { test: /\.tsx?$/,
        exclude: /node_modules/,
        include: [path.resolve("./lib"), path.resolve('./test')],
        use: [
          { loader: 'cache-loader' },
          { loader: 'ts-loader',
            options: {
              happyPackMode: true,  // see https://medium.com/webpack/typescript-webpack-super-pursuit-mode-83cc568dea79
              transpileOnly: true,  // disable type checker - we will use it in fork plugin
              experimentalWatchApi: true,
            }
          },
        ]
      }
    ]
  },
  plugins: [
    // see https://medium.com/webpack/typescript-webpack-super-pursuit-mode-83cc568dea79
    new ForkTsCheckerWebpackPlugin({ checkSyntacticErrors: true })
  ],
  serve: {
    content: [path.resolve(__dirname)],
    port: 9000,
    open: { path: "/", app: process.env.OPEN_BROWSER },

    // Serve a trivial little index page.
    add: (app, middleware, options) => {
      app.use((ctx, next) => {
        let name;
        if (ctx.url === '/') {
          ctx.type = 'html';
          ctx.body = Object.keys(entries).map((e) => `<a href="${e}">${e}</a><br>\n`).join('');
        } else if (entries.hasOwnProperty(name = path.basename(ctx.url, '.html'))) {
          ctx.type = 'html';
          ctx.body = htmlTemplate.replace('<NAME>', name);
        }
        return next();
      });
    },
  }
};
