export default {
  extends: 'stylelint-config-standard-scss',
  rules: {
    'scss/at-rule-no-unknown': [true, { ignoreAtRules: ['value'] }],
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global', 'local'] }],
    // Keep the existing BEM class names and CodeMirror classes.
    'selector-class-pattern': '^[a-z][a-zA-Z0-9_-]*$',
    // Chrome 108 needs prefixed masks.
    'property-no-vendor-prefix': [true, { ignoreProperties: ['-webkit-mask'] }],
    'declaration-no-important': true,
    'selector-max-id': 0,
    'selector-no-qualifying-type': [true, { ignore: ['attribute'] }],
    'color-function-notation': 'legacy',
    'color-function-alias-notation': 'with-alpha',
    'alpha-value-notation': 'number',
    'number-max-precision': 7,
    'media-feature-range-notation': 'prefix',
  },
}
