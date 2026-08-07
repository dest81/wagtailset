const path = require("path");

module.exports = {
  entry: {
    "wagtailset-draftail-anchor":
      "./static_src/wagtailsetdraftailanchors/js/wagtailset_draftail_anchor.js",
    "wagtailset-draftail-links":
      "./static_src/wagtailsetdraftailanchors/js/wagtailset_draftail_links.js",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
  output: {
    path: path.resolve(__dirname, "static/wagtailsetdraftailanchors/js/"),
    filename: "[name].js",
  },
};
