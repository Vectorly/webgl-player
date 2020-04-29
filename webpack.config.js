const webpack = require('webpack');

module.exports =(env) => {
 return require(`./webpack/${env}.config.js`)
};
