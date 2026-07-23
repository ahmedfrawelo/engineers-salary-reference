import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    linterOptions: {
      reportUnusedDisableDirectives: false
    }
  },
  ...compat.config({
    root: true,
    ignorePatterns: [
      'projects/**/*',
      '_upgrade_backups/**/*',
      'dist/**/*',
      'storybook-static/**/*'
    ],
    extends: ['plugin:storybook/recommended'],
    overrides: [
      {
        files: ['*.ts'],
        extends: [
          'eslint:recommended',
          'plugin:@typescript-eslint/recommended',
          'plugin:@angular-eslint/recommended',
          'plugin:@angular-eslint/template/process-inline-templates'
        ],
        rules: {
          '@angular-eslint/directive-selector': 'off',
          '@angular-eslint/component-selector': 'off',
          '@angular-eslint/prefer-inject': 'off',
          '@angular-eslint/no-empty-lifecycle-method': 'off',
          '@angular-eslint/use-lifecycle-interface': 'off',
          '@angular-eslint/no-output-on-prefix': 'off',
          '@angular-eslint/no-input-rename': 'off',
          '@angular-eslint/no-output-native': 'off',
          '@typescript-eslint/no-explicit-any': 'warn',
          '@typescript-eslint/no-unused-vars': 'off',
          '@typescript-eslint/no-unused-expressions': 'off',
          'no-useless-assignment': 'off',
          'preserve-caught-error': 'off',
          'no-useless-escape': 'off',
          'no-unsafe-optional-chaining': 'off',
          'no-empty': 'off',
          'no-control-regex': 'off',
          'prefer-rest-params': 'off',
          'prefer-const': 'off',
          'no-case-declarations': 'off',
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: [
                    '**/material-classification-copy/**',
                    '**/temp-bypass-permissions',
                    '**/pricing/ui/temp',
                    '**/pricing/ui/temp2',
                    '**/*.design-backup',
                    '**/core/logger.service',
                    '**/core/loading.service'
                  ],
                  message: 'Import from canonical production modules only.'
                }
              ]
            }
          ]
        }
      },
      {
        files: ['*.html'],
        extends: [
          'plugin:@angular-eslint/template/recommended',
          'plugin:@angular-eslint/template/accessibility'
        ],
        rules: {
          '@angular-eslint/template/click-events-have-key-events': 'off',
          '@angular-eslint/template/interactive-supports-focus': 'off',
          '@angular-eslint/template/eqeqeq': 'off',
          '@angular-eslint/template/role-has-required-aria': 'off',
          '@angular-eslint/template/prefer-control-flow': 'off',
          '@angular-eslint/template/label-has-associated-control': 'off',
          '@angular-eslint/template/no-autofocus': 'off',
          '@angular-eslint/template/elements-content': 'off'
        }
      },
      {
        files: ['src/app/core/**/*.ts'],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  group: [
                    'src/app/auth/**',
                    'src/app/pages/**',
                    '../../auth/**',
                    '../../../auth/**',
                    '../../../../auth/**',
                    '../../pages/**',
                    '../../../pages/**',
                    '../../../../pages/**'
                  ],
                  message:
                    'Core layer must not depend on auth/pages directly. Use core abstractions.'
                }
              ]
            }
          ]
        }
      },
      {
        files: ['src/app/features/settings/presentation/user-access-control/**/*.ts'],
        rules: {
          '@angular-eslint/prefer-standalone': 'off'
        }
      },
      {
        files: [
          'src/app/features/settings/presentation/user-access-control/components/user-access-control-hosted-section.base.ts'
        ],
        rules: {
          '@typescript-eslint/no-explicit-any': 'off'
        }
      },
      {
        files: [
          'src/app/pages/tender/suppliers/tender-suppliers.helper.core.internal.ts',
          'src/app/shared/data-grid/data-grid.component.part*.internal.ts',
          'src/app/shared/data-grid/data-grid.component.helper.part5.ts'
        ],
        rules: {
          '@typescript-eslint/ban-ts-comment': 'off'
        }
      }
    ]
  })
];
