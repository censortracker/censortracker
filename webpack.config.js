require('dotenv').config()

const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const MergeJsonWebpackPlugin = require('merge-jsons-webpack-plugin')

const EXTENSION_NAME = 'Censor Tracker'

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
    background: './src/chrome/scripts/background.js',
  },
  output: {
    path: resolve(`dist/chrome/${OUTPUT_SUB_DIR}`),
    libraryTarget: 'var',
    filename: '[name].js',
    publicPath: PRODUCTION ? '' : '/',
  },

  resolve: {
    extensions: ['.js', '.ts', '.json'],
    alias: {
      '@': resolve('src'),
    },
  },

  optimization: {
    minimize: false,
    minimizer: [],
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
    popup: './src/common/scripts/pages/popup.js',
    options: './src/common/scripts/pages/options.js',
    advanced_options: './src/common/scripts/pages/advanced_options.js',
    proxy_options: './src/common/scripts/pages/proxy_options.js',
    proxy_disabled: `./src/${BROWSER}/scripts/pages/proxy_disabled.js`,
    ignore_editor: './src/common/scripts/pages/ignore_editor.js',
    proxied_websites_editor: './src/common/scripts/pages/proxied_websites_editor.js',
    translator: './src/common/scripts/pages/translator.js',
  },

  output: {
    path: resolve(`dist/${BROWSER}/${OUTPUT_SUB_DIR}`),
    libraryTarget: 'var',
    filename: '[name].js',
    // filename: `[name]${PRODUCTION ? '.min' : ''}.js`,
    publicPath: PRODUCTION ? '' : '/',
  },

  resolve: {
    extensions: ['.js', '.ts', '.json'],
    alias: {
      '@': resolve('src'),
    },
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
      {
        test: /\.svg$/,
        use: 'html-loader',
      },
      {
        test: /\.(png|jpe?g|gif)$/,
        use: [
          {
            loader: 'file-loader',
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
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: resolve('src/common/images'),
          to: resolve(`dist/${BROWSER}/${OUTPUT_SUB_DIR}/images`),
        },
        {
          from: resolve('src/common/css'),
          to: resolve(`dist/${BROWSER}/${OUTPUT_SUB_DIR}/css`),
        },
        {
          from: resolve('src/common/_locales/'),
          to: resolve(`dist/${BROWSER}/${OUTPUT_SUB_DIR}/_locales`),
        },
      ],
    }),
    new HTMLWebpackPlugin({
      title: EXTENSION_NAME,
      filename: 'popup.html',
      template: 'src/common/pages/popup.html',
      inject: true,
      chunks: ['popup'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      filename: 'ignore_editor.html',
      template: 'src/common/pages/ignore_editor.html',
      inject: true,
      chunks: ['ignore_editor'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      filename: 'proxied_websites_editor.html',
      template: 'src/common/pages/proxied_websites_editor.html',
      inject: true,
      chunks: ['proxied_websites_editor'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      filename: 'proxy_disabled.html',
      template: 'src/common/pages/proxy_disabled.html',
      inject: true,
      chunks: ['proxy_disabled'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      filename: 'options.html',
      template: 'src/common/pages/options.html',
      inject: true,
      chunks: ['options'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      filename: 'advanced_options.html',
      template: 'src/common/pages/advanced_options.html',
      inject: true,
      chunks: ['options', 'advanced_options'],
      meta: contentSecurityPolicy,
    }),
    new MergeJsonWebpackPlugin({
      globOptions: {
        nosort: false,
      },
      files: [
        './src/common/manifest/base.json',
        `./src/${BROWSER}/manifest/${BROWSER}.json`,
        // `./src/common/manifest/environments/${NODE_ENV}.json`,
      ],
      output: {
        fileName: 'manifest.json',
      },
    }),
  ],
  optimization: {
    minimize: false,
    minimizer: [],
  },
}

if (isFirefox) {
  webConfig.entry.background = `./src/firefox/scripts/background.js`
  webConfig.entry.incognito_required = `./src/${BROWSER}/scripts/pages/incognito_required.js`
  webConfig.entry.installed = './src/firefox/scripts/pages/installed.js'
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'incognito_required_popup.html',
    template: 'src/firefox/pages/incognito_required_popup.html',
    inject: true,
    chunks: ['incognito_required'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'proxy_options.html',
    template: 'src/common/pages/proxy_options.html',
    inject: true,
    chunks: ['proxy_options'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'installed.html',
    template: 'src/firefox/pages/installed.html',
    inject: true,
    chunks: ['translator', 'installed'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'incognito_required_tab.html',
    template: 'src/firefox/pages/incognito_required_tab.html',
    inject: true,
    chunks: ['translator', 'incognito_required'],
    meta: contentSecurityPolicy,
  }))
}

if (isChromium) {
  webConfig.entry.controlled = `./src/${BROWSER}/scripts/pages/controlled.js`
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'proxy_options.html',
    template: 'src/common/pages/proxy_options.html',
    inject: true,
    chunks: ['proxy_options', 'controlled'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'controlled.html',
    template: `src/${BROWSER}/pages/controlled.html`,
    inject: true,
    chunks: ['controlled'],
    meta: contentSecurityPolicy,
  }))
  webConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
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
  webConfig.devtool = 'none'

  // See https://webpack.js.org/configuration/optimization/#optimizationminimize
  webConfig.optimization.minimize = false

  // See: https://webpack.js.org/plugins/terser-webpack-plugin/
  webConfig.plugins.push(new TerserPlugin({
    terserOptions: {
      parallel: true,
      format: {
        comments: false,
      },
    },
    extractComments: false,
  }))
}

module.exports = [webConfig, webWorkerConfig]
