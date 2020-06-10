require('dotenv').config()

const path = require('path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HTMLWebpackPlugin = require('html-webpack-plugin')

function resolve (dir) {
  return path.join(__dirname, dir)
}

const webpackConfig = {
  mode: process.env.NODE_ENV || 'development',

  entry: {
    background: './src/chrome/js/background.js',
    refused: './src/chrome/js/ui/refused.js',
    popup: './src/chrome/js/ui/popup.js',
  },

  output: {
    path: resolve('dist'),
    libraryTarget: 'var',
    filename: process.env.NODE_ENV === 'production' ? '[name].min.js' : '[name].js',
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
              outputPath: 'dist/img/',
            },
          },
        ],
      },
    ],
  },

  plugins: [
    new webpack.NamedModulesPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: resolve('src/chrome/manifest.json'),
          to: resolve('dist'),
        },
        {
          from: resolve('src/chrome/images'),
          to: resolve('dist/images'),
        },
        {
          from: resolve('src/chrome/css'),
          to: resolve('dist/css'),
        },
      ],
    }),
    new HTMLWebpackPlugin({
      title: 'Censor Tracker',
      filename: 'popup.html',
      template: 'src/chrome/pages/popup.html',
      inject: false,
    }),
    new HTMLWebpackPlugin({
      title: 'Refused | Censor Tracker',
      filename: 'refused.html',
      template: 'src/chrome/pages/refused.html',
      inject: false,
    }),
  ],

  // node: {
  //   // prevent webpack from injecting mocks to Node native modules
  //   // that does not make sense for the client
  //   dgram: 'empty',
  //   fs: 'empty',
  //   net: 'empty',
  //   tls: 'empty',
  //   child_process: 'empty',
  //   // fix "Invalid y value for curve" issue:
  //   crypto: true,
  //   module: false,
  //   process: true,
  //   global: true,
  // },

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
      // module: false,
      // keep_fnames: true,
      // keep_classnames: true,
      // safari10: true,
      // mangle: {
      //   reserved: ['Block', 'BigInteger', 'ECSignature', 'ECPair', 'Point', 'HDNode'],
      // },
    },
  }))
}

module.exports = webpackConfig
