/**
 * Webpack配置文件
 * 用于打包微信公众号视频上传工具
 */
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  target: 'node',
  entry: {
    'wechat-mp-puppeteer-controller': './wechat-mp-puppeteer-controller.js',
    'account-manager': './account-manager.js',
    'chrome-debug-uploader': './chrome-debug-uploader.js',
    'chrome-debug-tag': './chrome-debug-tag.js',
    'wechat-mp-auto-injector': './wechat-mp-auto-injector.js',
    'chrome-debug-video-batch-delete-pure': './chrome-debug-video-batch-delete-pure.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env', { targets: { node: '16' } }]]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js']
  },
  plugins: [
      // 复制静态资源文件到dist目录
      new CopyPlugin({
        patterns: [
          { from: 'account-manager.html', to: '.' },
          { from: 'index.html', to: '.' },
          // 移除JS文件，这些文件现在通过webpack处理和压缩
        ]
      })
    ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            // 禁用一些可能导致问题的压缩选项
            drop_console: false, // 保留console语句以便调试
            drop_debugger: false, // 保留debugger语句
            conditionals: true,
            dead_code: true,
            evaluate: true,
            booleans: true,
            unused: true,
            if_return: true,
            join_vars: true,
            reduce_vars: true
          },
          mangle: false, // 禁用变量名混淆，保留原始变量名
          keep_classnames: true, // 保留类名
          keep_fnames: true, // 保留函数名
          format: {
            comments: false, // 删除注释
            beautify: false // 不美化代码，保持最小体积
          }
        },
        extractComments: false // 不提取注释到单独文件
      })
    ]
  },
  // 不打包node_modules中的依赖，避免重复打包和路径问题
  externals: [nodeExternals()],
  // 确保路径处理正确，特别是在不同操作系统环境中
  node: {
    __dirname: false,
    __filename: false
  }
};