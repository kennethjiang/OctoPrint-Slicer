import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import babelrc from 'babelrc-rollup';
import nodeResolve from '@rollup/plugin-node-resolve';

let pkg = require('./package.json');

let plugins = [
    commonjs(),
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
  input: 'src/slicer.js',
  plugins,
  output: {
    file: pkg.main,
    format: 'iife',
    sourcemap: false
  }
};
