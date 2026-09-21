const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const config = require('./webpack.config');

module.exports = merge(config, {
  mode: 'development',
  entry: './example/index.tsx',
  output: {
    path: require('path').resolve(__dirname, '../example-dist'),
    filename: 'main.js',
  },
  devtool: 'inline-source-map',
  devServer: {
    port: 8000,
    open: true,
    historyApiFallback: true,
    host: '0.0.0.0',
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'public/index.html',
    }),
  ],
});
