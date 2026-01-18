import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            ...prettierPlugin.configs.recommended.rules,
            'prettier/prettier': 'warn',
        },
    },
    prettierConfig,
    {
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
        },
        ignores: ['node_modules/', 'coverage/', 'data/'],
    },
];
