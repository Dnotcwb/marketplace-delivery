/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [
    "./base.js",
    "plugin:@next/eslint-plugin-next/core-web-vitals",
  ],
  rules: {
    "@next/next/no-html-link-for-pages": "error",
  },
};
