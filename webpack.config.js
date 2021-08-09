require('dotenv').config()

const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const MergeJsonWebpackPlugin = require('merge-jsons-webpack-plugin')

const EXTENSION_NAME = 'Censor Tracker'

function resolve (dir) {
  return path.join(__dirname, dir)
}

const BUILDUP = process.env.BUILDUP || '1'
const BROWSER = process.env.BROWSER
const NODE_ENV = process.env.NODE_ENV || 'development'
const PRODUCTION = NODE_ENV === 'production'
const OUTPUT_SUB_DIR = PRODUCTION ? 'prod' : 'dev'

const isFirefox = BROWSER === 'firefox'
const isChromium = BROWSER === 'chrome'

const contentSecurityPolicy = {
  'Content-Security-Policy': 'script-src \'self\'; object-src \'self\'; ' +
    'style-src \'self\' https://fonts.googleapis.com; ' +
    'font-src \'self\' https://fonts.gstatic.com ',
}

const updateVersionInManifest = () => {
  const manifestFile = `./src/${BROWSER}/manifest/${BROWSER}.json`
  const file = fs.readFileSync(resolve(manifestFile))
  const object = JSON.parse(file)

  const [major, minor, patch] = object.version.split('.')

  object.version = `${major}.${minor}.${parseInt(patch) + 1}`
  fs.writeFileSync(manifestFile, JSON.stringify(object, null, '  '))
}

if (BUILDUP === '1') {
  updateVersionInManifest()
}

const webpackConfig = {
  mode: NODE_ENV,
  // Also see: https://webpack.js.org/configuration/devtool/#devtool
  devtool: 'source-map',

  entry: {
    background: `./src/${BROWSER}/js/background.js`,
    unavailable: `./src/${BROWSER}/js/ui/unavailable.js`,
    popup: './src/common/js/ui/popup.js',
    options: './src/common/js/ui/options.js',
    proxy_options: './src/common/js/ui/proxy_options.js',
    proxy_disabled: `./src/${BROWSER}/js/ui/proxy_disabled.js`,
    ignore_editor: './src/common/js/ui/ignore_editor.js',
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
      title: EXTENSION_NAME,
      filename: 'unavailable.html',
      template: 'src/common/pages/unavailable.html',
      inject: true,
      chunks: ['unavailable'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      title: EXTENSION_NAME,
      filename: 'proxy_unavailable.html',
      template: 'src/common/pages/proxy_unavailable.html',
      inject: true,
      chunks: ['unavailable'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      title: EXTENSION_NAME,
      filename: 'ignore_editor.html',
      template: 'src/common/pages/ignore_editor.html',
      inject: true,
      chunks: ['ignore_editor'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      title: EXTENSION_NAME,
      filename: 'proxy_disabled.html',
      template: 'src/common/pages/proxy_disabled.html',
      inject: true,
      chunks: ['proxy_disabled'],
      meta: contentSecurityPolicy,
    }),
    new MergeJsonWebpackPlugin({
      globOptions: {
        nosort: false,
      },
      files: [
        './src/common/manifest/base.json',
        `./src/${BROWSER}/manifest/${BROWSER}.json`,
        `./src/common/manifest/environments/${NODE_ENV}.json`,
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
  webpackConfig.entry.incognito_required = `./src/${BROWSER}/js/ui/incognito_required.js`
  webpackConfig.entry.translator = `./src/common/js/ui/translator.js`
  webpackConfig.entry.installed = `./src/firefox/js/ui/installed.js`
  webpackConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'additional_permissions_required.html',
    template: 'src/firefox/pages/additional_permissions_required.html',
    inject: true,
    chunks: ['incognito_required'],
    meta: contentSecurityPolicy,
  }))
  webpackConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'proxy_options.html',
    template: 'src/common/pages/proxy_options.html',
    inject: true,
    chunks: ['proxy_options'],
    meta: contentSecurityPolicy,
  }))
  webpackConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'options.html',
    template: 'src/common/pages/options.html',
    inject: true,
    chunks: ['options'],
    meta: contentSecurityPolicy,
  }))
  webpackConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'installed.html',
    template: 'src/firefox/pages/installed.html',
    inject: true,
    chunks: ['translator', 'installed'],
    meta: contentSecurityPolicy,
  }))
  webpackConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'incognito_access_required.html',
    template: 'src/firefox/pages/incognito_access_required.html',
    inject: true,
    chunks: ['translator', 'incognito_required'],
    meta: contentSecurityPolicy,
  }))
}

if (isChromium) {
  webpackConfig.entry.controlled = `./src/${BROWSER}/js/ui/controlled.js`
  webpackConfig.entry.translator = `./src/common/js/ui/translator.js`
  webpackConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'options.html',
    template: 'src/common/pages/options.html',
    inject: true,
    chunks: ['options'],
    meta: contentSecurityPolicy,
  }))
  webpackConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'proxy_options.html',
    template: 'src/common/pages/proxy_options.html',
    inject: true,
    chunks: ['proxy_options', 'controlled'],
    meta: contentSecurityPolicy,
  }))
  webpackConfig.plugins.push(new HTMLWebpackPlugin({
    title: EXTENSION_NAME,
    filename: 'controlled.html',
    template: `src/${BROWSER}/pages/controlled.html`,
    inject: true,
    chunks: ['controlled'],
    meta: contentSecurityPolicy,
  }))
  webpackConfig.plugins.push(new HTMLWebpackPlugin({
    title: 'CensorTracker',
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
  webpackConfig.devtool = 'none'

  // See https://webpack.js.org/configuration/optimization/#optimizationminimize
  webpackConfig.optimization.minimize = true

  // See: https://webpack.js.org/plugins/terser-webpack-plugin/
  webpackConfig.plugins.push(new TerserPlugin({
    terserOptions: {
      parallel: true,
      format: {
        comments: false,
      },
    },
    extractComments: false,
  }))
}

module.exports = webpackConfig
