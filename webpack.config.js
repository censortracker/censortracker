require('dotenv').config()

const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const MergeJsonWebpackPlugin = require('merge-jsons-webpack-plugin')

const extensionName = 'CensorTracker'

function resolve(dir) {
  return path.join(__dirname, dir)
}

const BROWSER = process.env.BROWSER
const NODE_ENV = process.env.NODE_ENV || 'development'
const PRODUCTION = NODE_ENV === 'production'
const OUTPUT_SUB_DIR = PRODUCTION ? 'prod' : 'dev'

const isFirefox = BROWSER === 'firefox'
const isChromium = BROWSER === 'chrome'

const contentSecurityPolicy = {
  'Content-Security-Policy': `script-src 'self'; object-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com`,
}

const webWorkerConfig = {
  mode: NODE_ENV,
  target: isFirefox ? 'webworker' : 'web',
  entry: {
    background: './src/chrome/js/background.js',
  },
  output: {
    path: resolve(`dist/chrome/${OUTPUT_SUB_DIR}`),
    filename: '[name].js',
    publicPath: PRODUCTION ? '' : '/',
  },

  resolve: {
    extensions: ['.js', '.ts', '.json'],
    alias: {
      '@': resolve('src'),
      'Background': resolve('src/shared/js/background'),
    },
  },

  optimization: {
    minimize: true,
    minimizer: [],
    moduleIds: 'named',
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        use: 'eslint-loader',
        exclude: /node_modules/,
        enforce: 'pre',
      },
      {
        test: /\.js$/,
        use: 'babel-loader',
        exclude: /node_modules/,
        include: [
          resolve('src'),
        ],
      },
    ],
  },

}

const webConfig = {
  mode: NODE_ENV,
  // Also see: https://webpack.js.org/configuration/devtool/#devtool
  target: 'web',
  devtool: 'source-map',
  entry: {
    'popup': './src/shared/js/pages/popup.js',
    'options': './src/shared/js/pages/options.js',
    'advanced-options': './src/shared/js/pages/advanced-options.js',
    'proxy-options': './src/shared/js/pages/proxy-options.js',
    'ignore-editor': './src/shared/js/pages/ignore-editor.js',
    'proxied-websites-editor': './src/shared/js/pages/proxied-websites-editor.js',
    'translator': './src/shared/js/pages/translator.js',
  },
  output: {
    path: resolve(`dist/${BROWSER}/${OUTPUT_SUB_DIR}`),
    filename: '[name].js',
    publicPath: PRODUCTION ? '' : '/',
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': resolve('src'),
      'Background': resolve('src/shared/js/background'),
    },
  },
  module: {
    rules: [
      { test: /\.css$/, use: ['style-loader', 'css-loader']},
      {
        test: /\.svg$/,
        use: [
          {
            loader: 'svg-url-loader',
            options: {
              noquotes: true,
            },
          },
        ],
      },
      {
        test: /\.js$/,
        use: 'eslint-loader',
        exclude: /node_modules/,
        enforce: 'pre',
      },
      {
        test: /\.(js|jsx)$/,
        use: [
          {
            loader: 'babel-loader',
          }
        ],
        exclude: /node_modules/,
        include: [
          resolve('src'),
        ],
      },
      {
        test: /\.(ts|tsx)$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.svg$/,
        use: 'html-loader',
      },
      {
        test: /\.(png|jpe?g|gif)$/,
        use: [
          {
            loader: 'asset/resource',
            options: {
              name: '[name].[ext]',
              outputPath: `dist/${BROWSER}/${OUTPUT_SUB_DIR}/images/`,
            },
          },
        ],
      },
    ],
  },

  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: resolve('src/shared/images'),
          to: resolve(`dist/${BROWSER}/${OUTPUT_SUB_DIR}/images`),
        },
        {
          from: resolve('src/shared/css'),
          to: resolve(`dist/${BROWSER}/${OUTPUT_SUB_DIR}/css`),
        },
        {
          from: resolve('src/shared/_locales/'),
          to: resolve(`dist/${BROWSER}/${OUTPUT_SUB_DIR}/_locales`),
        },
        {
          from: resolve('src/shared/js/content-scripts'),
          to: resolve(`dist/${BROWSER}/${OUTPUT_SUB_DIR}/content-scripts`),
        },
      ],
    }),
    new HTMLWebpackPlugin({
      title: extensionName,
      filename: 'popup.html',
      template: 'src/shared/pages/popup.html',
      inject: true,
      chunks: ['popup', 'translator'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      filename: 'ignore-editor.html',
      template: 'src/shared/pages/ignore-editor.html',
      inject: true,
      chunks: ['ignore-editor', 'translator'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      filename: 'proxied-websites-editor.html',
      template: 'src/shared/pages/proxied-websites-editor.html',
      inject: true,
      chunks: ['proxied-websites-editor'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      filename: 'options.html',
      template: 'src/shared/pages/options.html',
      inject: true,
      chunks: ['options', 'translator'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      filename: 'advanced-options.html',
      template: 'src/shared/pages/advanced-options.html',
      inject: true,
      chunks: ['options', 'advanced-options', 'translator'],
      meta: contentSecurityPolicy,
    }),
    new MergeJsonWebpackPlugin({
      globOptions: {
        nosort: false,
      },
      files: [
        `./src/${BROWSER}/manifest/${BROWSER}.json`,
        './src/shared/manifest/base.json',
      ],
      output: {
        fileName: 'manifest.json',
      },
    }),
  ],
  optimization: {
    minimize: false,
    minimizer: [],
    moduleIds: 'named',
  },
}

if (isFirefox) {
  webConfig.entry.background = `./src/firefox/js/background.js`
  webConfig.entry.incognito_required = `./src/firefox/js/pages/incognito-required.js`
  webConfig.entry.installed = './src/firefox/js/pages/installed.js'
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: extensionName,
    filename: 'incognito-required-popup.html',
    template: 'src/firefox/pages/incognito-required-popup.html',
    inject: true,
    chunks: ['incognito_required'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: extensionName,
    filename: 'proxy-options.html',
    template: 'src/shared/pages/proxy-options.html',
    inject: true,
    chunks: ['proxy-options'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: extensionName,
    filename: 'installed.html',
    template: 'src/firefox/pages/installed.html',
    inject: true,
    chunks: ['translator', 'installed'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: extensionName,
    filename: 'incognito-required-tab.html',
    template: 'src/firefox/pages/incognito-required-tab.html',
    inject: true,
    chunks: ['translator', 'incognito_required'],
    meta: contentSecurityPolicy,
  }))
}

if (isChromium) {
  webConfig.entry.controlled = `./src/${BROWSER}/js/pages/controlled.js`
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: extensionName,
    filename: 'proxy-options.html',
    template: 'src/shared/pages/proxy-options.html',
    inject: true,
    chunks: ['proxy-options', 'controlled'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: extensionName,
    filename: 'controlled.html',
    template: `src/${BROWSER}/pages/controlled.html`,
    inject: true,
    chunks: ['controlled'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: extensionName,
    filename: 'installed.html',
    template: `src/${BROWSER}/pages/installed.html`,
    inject: true,
    chunks: ['translator'],
    meta: contentSecurityPolicy,
  }))
}

if (PRODUCTION) {
  // See https://git.io/JmiaL
  // See https://webpack.js.org/configuration/devtool/#production
  webConfig.devtool = 'nosources-source-map'

  // See https://webpack.js.org/configuration/optimization/#optimizationminimize
  webConfig.optimization.minimize = true
  webConfig.optimization.minimizer = [
    new TerserPlugin({
      terserOptions: {
        output: {
          comments: false,
        },
      },
    }),
  ]
  webWorkerConfig.devtool = 'nosources-source-map'
  webWorkerConfig.optimization.minimize = true
  webWorkerConfig.optimization.minimizer = [
    new TerserPlugin({
      terserOptions: {
        output: {
          comments: false,
        },
      },
    }),
  ]
}

module.exports = [webConfig, webWorkerConfig]
