import babel from 'rollup-plugin-babel';
import babelrc from 'babelrc-rollup';
import nodeResolve from 'rollup-plugin-node-resolve';

let pkg = require('./package.json');

export default {
  entry: 'src/slicer.js',
  plugins: [
    babel(babelrc()),
    nodeResolve({
             jsnext: true,
             main: true,
             browser: true,
    }),
  ],
  dest: pkg.main,
  format: 'iife',
  sourceMap: false
};
