export default {
  extends: 'stylelint-config-standard-scss',
  rules: {
    'scss/at-rule-no-unknown': [true, { ignoreAtRules: ['value'] }],
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global', 'local'] }],
    // Keep the existing BEM class names, camelCase IDs and CodeMirror classes.
    'selector-class-pattern': '^[a-z][a-zA-Z0-9_-]*$',
    'selector-id-pattern': '^[a-z][a-zA-Z0-9_-]*$',
    // Chrome 108 needs prefixed masks. Page and theme rules use cascade order.
    'property-no-vendor-prefix': [true, { ignoreProperties: ['-webkit-mask'] }],
    'no-descending-specificity': null,
    'color-function-notation': 'legacy',
    'color-function-alias-notation': 'with-alpha',
    'alpha-value-notation': 'number',
    'number-max-precision': 7,
    'media-feature-range-notation': 'prefix',
  },
}
