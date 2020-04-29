const path = require('path');
const webpack = require('webpack');
const GitRevisionPlugin = require('git-revision-webpack-plugin');
const gitRevisionPlugin = new GitRevisionPlugin();
const { CleanWebpackPlugin } = require('clean-webpack-plugin');



module.exports = {
  entry: ['whatwg-fetch',  "./src/main.js"],
  output: {
    library: "vvgl",
    libraryTarget: "umd",
    libraryExport: "default",
    path: path.resolve(__dirname, '../build'),
    chunkFilename: 'vvgl.[name].js',
    filename: "vvgl.js"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader"
        },
      },
    ]
  },
  plugins: [

    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false
    }),
    new webpack.EnvironmentPlugin({
      'GIT_VERSION' : JSON.stringify(gitRevisionPlugin.version()),
      'GIT_COMMIT_HASH': JSON.stringify(gitRevisionPlugin.commithash()),
      'GIT_BRANCH': JSON.stringify(gitRevisionPlugin.branch())
    }),
  ],
  node: {
     fs: "empty"
  }
};
