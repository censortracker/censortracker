require('dotenv').config()

const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const ZipPlugin = require('zip-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HTMLWebpackPlugin = require('html-webpack-plugin')

let { version } = require('./package.json')

function resolve (dir) {
  return path.join(__dirname, dir)
}

function buildUp (ver, sep = '+') {
  let [core, build] = ver.split('+')

  build = +build || 0
  return `${core}${sep}${build + 1}`
}

function updateJson (json, prop, value) {
  const file = fs.readFileSync(json)
  const object = JSON.parse(file)

  object[prop] = value
  fs.writeFileSync(json, JSON.stringify(object, null, '  '))
  console.info(`${json} updated`)
}

const oldVersion = version

version = buildUp(version)
console.info(`Version updated ${oldVersion} -> ${version}`)

updateJson(resolve('package.json'), 'version', version)
updateJson(resolve('src/firefox/manifest.json'), 'version', buildUp(oldVersion, '.'))

const webpackConfig = {
  mode: process.env.NODE_ENV || 'development',

  entry: {
    background: './src/firefox/js/background.js',
    unavailable: './src/firefox/js/ui/unavailable.js',
    popup: './src/firefox/js/ui/popup.js',
    options: './src/firefox/js/ui/options.js',
    proxy_disabled: './src/firefox/js/ui/proxy_disabled.js',
  },

  output: {
    path: resolve('dist/firefox'),
    libraryTarget: 'var',
    filename: `[name]${process.env.NODE_ENV === 'production' ? '.min' : ''}.js`,
    publicPath: process.env.NODE_ENV === 'production' ? '' : '/',
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
              outputPath: 'dist/firefox/img/',
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
          from: resolve('src/firefox/manifest.json'),
          to: resolve('dist/firefox/'),
        },
        {
          from: resolve('src/firefox/images'),
          to: resolve('dist/firefox/images'),
        },
        {
          from: resolve('src/firefox/css'),
          to: resolve('dist/firefox/css'),
        },
      ],
    }),
    new HTMLWebpackPlugin({
      title: 'Censor Tracker',
      filename: 'popup.html',
      template: 'src/firefox/pages/popup.html',
      inject: true,
      chunks: ['popup'],
      meta: {
        'Content-Security-Policy': 'script-src \'self\' \'unsafe-eval\'; object-src \'self\';',
      },
    }),
    new HTMLWebpackPlugin({
      title: 'Unavailable | Censor Tracker',
      filename: 'unavailable.html',
      template: 'src/firefox/pages/unavailable.html',
      inject: true,
      chunks: ['unavailable'],
      meta: {
        'Content-Security-Policy': 'script-src \'self\' \'unsafe-eval\'; object-src \'self\';',
      },
    }),
    new HTMLWebpackPlugin({
      title: 'Настройки | Censor Tracker',
      filename: 'options.html',
      template: 'src/firefox/pages/options.html',
      inject: true,
      chunks: ['options'],
      meta: {
        'Content-Security-Policy': 'script-src \'self\' \'unsafe-eval\'; object-src \'self\';',
      },
    }),
    new HTMLWebpackPlugin({
      title: 'Проксирование недоступно | Censor Tracker',
      filename: 'proxy_unavailable.html',
      template: 'src/firefox/pages/proxy_unavailable.html',
      inject: true,
      chunks: ['unavailable'],
      meta: {
        'Content-Security-Policy': 'script-src \'self\' \'unsafe-eval\'; object-src \'self\';',
      },
    }),
    new HTMLWebpackPlugin({
      title: 'Проксирование отключено | Censor Tracker',
      filename: 'proxy_disabled.html',
      template: 'src/firefox/pages/proxy_disabled.html',
      inject: true,
      chunks: ['proxy_disabled'],
      meta: {
        'Content-Security-Policy': 'script-src \'self\' \'unsafe-eval\'; object-src \'self\';',
      },
    }),
    // process.env.NODE_ENV === 'production'
    //   ? new ZipPlugin({
    //     filename: `censortracker-firefox-ext.v${version}.zip`,
    //     pathPrefix: `censortracker-firefox-ext.v${version}`,
    //   })
    //   : new ZipPlugin({
    //     filename: `censortracker-firefox-ext.v${version}-dev.zip`,
    //     pathPrefix: `censortracker-firefox-ext.v${version}-dev`,
    //   }),
  ],

  optimization: {
    minimize: false,
    minimizer: [],
  },
}

if (process.env.NODE_ENV === 'production') {
  webpackConfig.optimization.minimize = true
  webpackConfig.plugins.push(new TerserPlugin({
    terserOptions: {
      parallel: true,
    },
  }))
}

module.exports = webpackConfig
