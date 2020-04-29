const merge = require('webpack-merge');
const baseConfig = require('./base.config.js');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const RenameWebpackPlugin = require('rename-webpack-plugin');
const WebpackShellPlugin = require('webpack-shell-plugin');
const bonjour = require('bonjour')();


const S3Plugin = require('webpack-s3-plugin');
const fs = require('fs');


console.log('LRNFILE', process.env.LRNFILE, path.basename(process.env.LRNFILE || ''));
if (process.env.LRNFILE === undefined) {
  console.log('No LRNFILE variable set. Use command as (PUSHTAG optional):  LRNFILE=<path-to-lrn> PUSHTAG=<some-tag> yarn demo');
  process.exit(1)
} else if (!fs.existsSync(process.env.LRNFILE)) {
  console.log('Invalid LRNFILE variable set. File doesnot exist', process.env.LRNFILE);
  process.exit(1)
}
console.log('PUSHTAG', process.env.PUSHTAG);
if (process.env.PUSHTAG === undefined)
  console.log('No PUSHTAG found, not pushing to S3, only local build in demo/');

module.exports = merge(baseConfig, {
  mode: function() {
    if (process.env.NODE_ENV === "production") {
      return "production"
    } else {
      return "development"
    }
  }(),

  output: {
      path: path.resolve(__dirname, '../demo'),
      // TODO : path with versioning
  },
  plugins: [
    new webpack.EnvironmentPlugin({
      'IS_PRODUCTION': JSON.stringify(false),
      'IS_CORE_BUILD': JSON.stringify(true)
    }),
    new HtmlWebpackPlugin({
      template: 'src/demo/index.html',
      // title: 'HTML Webpack Plugin',
      // bar: 'bar',
      lrnFileName: path.basename(process.env.LRNFILE),
      mp4FileName: function() {
        try{
          return path.basename(process.env.MP4FILE)
        } catch (err) {
          console.log('MP4FILE is not valid, compare mode disabled; MP4FILE:', process.env.MP4FILE);
          return "undefined"
        }
      }()
    }),
    new CopyWebpackPlugin(function() {
      files = [
        {from: process.env.LRNFILE, to: path.basename(process.env.LRNFILE)}
      ];
      try {
        files.push({
          from: process.env.MP4FILE,
          to: path.basename(process.env.MP4FILE)
        })
      } catch (err) {
        // console.log('Err', err)
      }
      return files
    }())
  ],
  devServer: {
    before: function(app, server, compiler) {
      bonjour.publish({
        name: process.env.LRNFILE,
        port: this.port,
        type: 'http',
        subtypes: [ 'webpack' ]
      });
      services = [];
      const browser = bonjour.find({ type: 'http'}, function(service) {
        // console.log('Service', service)
        if (service.fqdn.indexOf('.lrn._http') > 0) {
          services.push(service)
        }
      });
      app.get('/bonjour', function(req, res) {
        data = [];
        services.forEach(function(s) {
          console.log(`Hosting at http://localhost:${s.port}/`);
          data.push({name: path.basename(s.name)+'.lrn', port: s.port, url: `http://localhost:${s.port}/`})
        });
        res.json({ data: data });
      });
    },
    compress: true,
    contentBase: path.resolve(__dirname, '../demo'),
    // port: 8008

  }
});

if (process.env.PUSHTAG) {
    console.log(`Pushing to vv-lrn-dist-public/demo/${process.env.PUSHTAG}`);
    console.log(`Demo Link: https://files.vectorly.io/demo/${process.env.PUSHTAG}/index.html`);
    module.exports.plugins.push(
      new S3Plugin({
        // Only upload css and js
        include: /.*\.(html|lrn|png|svg|mp4|js)/,
        // s3Options are required
        s3Options: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
        s3UploadOptions: {
          Bucket: 'vv-lrn-dist-public',
          ContentEncoding(fileName) {
            if (!process.env.DONOT_COMPRESS) {
              if ( /\.js(\?.*)?$/.test(fileName)) {
                return 'gzip'
              }
            }
          },
          /*
          cloudfrontInvalidateOptions: {
            DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
            Items: [`/demo/${process.env.PUSHTAG}/\*`]
          },
          */
          // Here we set the Content-Type header for the gzipped files to their appropriate values, so the browser can interpret them properly
          ContentType(fileName) {
            if (/\.js/.test(fileName)) {
              return 'text/javascript'
            }
          }
        },
        basePath: "demo/" + process.env.PUSHTAG
      })
    );
    module.exports.plugins.push(
      new WebpackShellPlugin({
        onBuildStart:['echo "Webpack Start"'],
        onBuildEnd:[`aws cloudfront create-invalidation --distribution-id ${process.env.CLOUDFRONT_DISTRIBUTION_ID} --paths /demo/${process.env.PUSHTAG}/*`]
      })
    )
}


if (!process.env.DONOT_COMPRESS && process.env.NODE_ENV === 'production') {
  module.exports.plugins.push(
    new CompressionPlugin({
      filename: '[file].gz',
      test: /\.js(\?.*)?$/i,
      deleteOriginalAssets: true,
    }),
    new RenameWebpackPlugin({
      originNameReg: /(.*).gz/,
      targetName: '$1'
    }),
  )
}
