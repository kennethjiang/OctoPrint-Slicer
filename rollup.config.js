import babel from 'rollup-plugin-babel';
import babelrc from 'babelrc-rollup';
import nodeResolve from 'rollup-plugin-node-resolve';

let pkg = require('./package.json');

let plugins = [
    nodeResolve({
             jsnext: true,
             main: true,
             browser: true,
    }),
]

if (process.env.DEBUG !== 'true') {
    plugins.unshift(babel(babelrc()));
}

export default {
  entry: 'src/slicer.js',
  plugins,
  dest: pkg.main,
  format: 'iife',
  sourceMap: false
};
