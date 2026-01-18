const rspack = require('@rspack/core');

const targets = ["last 2 versions", "> 0.2%", "not dead", "Firefox ESR"];

module.exports = {
  entry: {
    main: './src/entry.ts'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript'
                }
              },
              env: { targets }
            }
          }
        ]
      },
      {
        test: /\.js$/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'ecmascript'
                }
              },
              env: { targets }
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'icon.png', to: '.' }
      ]
    })
  ]
};
