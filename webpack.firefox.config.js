require('dotenv').config()

const path = require('path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HTMLWebpackPlugin = require('html-webpack-plugin')
const MergeJsonWebpackPlugin = require('merge-jsons-webpack-plugin')

function resolve (dir) {
  return path.join(__dirname, dir)
}

const contentSecurityPolicy = {
  'Content-Security-Policy': '' +
    'script-src \'self\'; ' +
    'object-src \'self\'; ' +
    'style-src \'self\' https://fonts.googleapis.com; ' +
    'font-src \'self\' https://fonts.gstatic.com ',
}

const webpackConfig = {
  mode: process.env.NODE_ENV || 'development',

  entry: {
    background: './src/firefox/js/background.js',
    unavailable: './src/firefox/js/ui/unavailable.js',
    popup: './src/firefox/js/ui/popup.js',
    options: './src/firefox/js/ui/options.js',
    proxy_disabled: './src/firefox/js/ui/proxy_disabled.js',
    ignore_editor: './src/common/js/ui/ignore_editor.js',
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
          from: resolve('src/common/images'),
          to: resolve('dist/firefox/images'),
        },
        {
          from: resolve('src/common/css'),
          to: resolve('dist/firefox/css'),
        },
      ],
    }),
    new HTMLWebpackPlugin({
      title: 'Censor Tracker',
      filename: 'popup.html',
      template: 'src/common/pages/popup.html',
      inject: true,
      chunks: ['popup'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      title: 'Unavailable | Censor Tracker',
      filename: 'unavailable.html',
      template: 'src/common/pages/unavailable.html',
      inject: true,
      chunks: ['unavailable'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      title: 'Настройки | Censor Tracker',
      filename: 'options.html',
      template: 'src/common/pages/options.html',
      inject: true,
      chunks: ['options'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      title: 'Проксирование недоступно | Censor Tracker',
      filename: 'proxy_unavailable.html',
      template: 'src/common/pages/proxy_unavailable.html',
      inject: true,
      chunks: ['unavailable'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      title: 'Игнорируемые сайты | Censor Tracker',
      filename: 'ignore_editor.html',
      template: 'src/common/pages/ignore_editor.html',
      inject: true,
      chunks: ['ignore_editor'],
      meta: contentSecurityPolicy,
    }),
    new HTMLWebpackPlugin({
      title: 'Проксирование отключено | Censor Tracker',
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
        './src/common/manifest/firefox.json',
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

if (process.env.NODE_ENV === 'production') {
  // See: https://git.io/JmiaL
  // Also see: https://webpack.js.org/configuration/devtool/#devtool
  webpackConfig.devtool = 'source-map'
  webpackConfig.optimization.minimize = true
  // See: https://webpack.js.org/plugins/terser-webpack-plugin/
  webpackConfig.plugins.push(new TerserPlugin({
    terserOptions: {
      parallel: true,
    },
  }))
}

module.exports = webpackConfig
