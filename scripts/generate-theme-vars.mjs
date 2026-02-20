#!/usr/bin/env node
/**
 * Generates assets/sass/libs/_theme_config.scss from _config.yml theme section.
 * Run before sass compilation (gulp sass) so theme colors and fonts are applied.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const configPath = path.join(rootDir, '_config.yml');
const outputPath = path.join(rootDir, 'assets/sass/libs/_theme_config.scss');

// Simple YAML parsing for the theme section (avoids adding a dependency)
function parseThemeFromConfig(content) {
  const theme = {};
  let inTheme = false;
  let inColors = false;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('theme:')) {
      inTheme = true;
      inColors = false;
      continue;
    }

    if (!inTheme) continue;

    // Exit theme section when we hit a top-level key (line starts without indent)
    if (trimmed && !line.startsWith(' ') && !line.startsWith('\t')) {
      break;
    }

    const themeIndent = line.search(/\S/);
    if (themeIndent <= 0 && trimmed) break;

    if (trimmed.startsWith('colors:')) {
      inColors = true;
      theme.colors = theme.colors || {};
      continue;
    }

    if (inColors) {
      const colorMatch = trimmed.match(/^(\w+):\s*["']?(#[0-9a-fA-F]{6})["']?/);
      if (colorMatch) {
        theme.colors[colorMatch[1]] = colorMatch[2];
      }
    } else {
      const fontMatch = trimmed.match(/^(font_family|font_family_fixed|font_google_url):\s*(.+)$/);
      if (fontMatch) {
        theme[fontMatch[1]] = fontMatch[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  return theme;
}

function generateScss(theme) {
  const lines = [
    '// Auto-generated from _config.yml theme section - do not edit directly',
    '// Run: npm run sass (or gulp sass) to regenerate after config changes',
    '',
    '$theme-font-family: null;',
    '$theme-font-family-fixed: null;',
    '$theme-palette-overrides: ();',
    ''
  ];

  if (theme.font_family) {
    lines[3] = `$theme-font-family: ${theme.font_family};`;
  }
  if (theme.font_family_fixed) {
    lines[4] = `$theme-font-family-fixed: ${theme.font_family_fixed};`;
  }

  // Color overrides - map human-readable config keys to internal palette keys
  const colorMap = {
    background: 'bg',
    background_secondary: 'bg-alt',
    text: 'fg',
    text_heading: 'fg-bold',
    text_muted: 'fg-medium',
    text_subtle: 'fg-light',
    border: 'border',
    field_background: 'border-bg',
    field_background_highlight: 'border-bg-alt',
    accent: 'accent1'
  };

  const colors = theme.colors || {};
  if (Object.keys(colors).length > 0) {
    const bgHex = colors.background || '#242629';
    const entries = [];
    if (colors.background) {
      entries.push('  bg: $theme-bg', '  bg-overlay: transparentize($theme-bg, 0.75)', '  bg-overlay-alt: transparentize($theme-bg, 0.5)', '  bg-ie-overlay: transparentize($theme-bg, 0.45)', '  bg-ie-overlay-alt: transparentize($theme-bg, 0.2)');
    }
    for (const [configKey, paletteKey] of Object.entries(colorMap)) {
      if (configKey === 'background') continue;
      const hex = colors[configKey];
      if (hex) entries.push(`  ${paletteKey}: ${hex}`);
    }
    lines.push(`$theme-bg: ${bgHex};`, `$theme-palette-overrides: (`, entries.join(',\n'), ');');
  }

  return lines.join('\n');
}

try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  const theme = parseThemeFromConfig(configContent);

  if (Object.keys(theme).length === 0) {
    // No theme config - write empty file that won't override anything
    const emptyContent = `// Auto-generated - no theme config in _config.yml
// Add a "theme:" section to _config.yml to customize colors and fonts.
$theme-font-family: null;
$theme-font-family-fixed: null;
$theme-palette-overrides: ();
`;
    fs.writeFileSync(outputPath, emptyContent);
    console.log('Theme config: none found, wrote empty overrides');
  } else {
    const scss = generateScss(theme);
    fs.writeFileSync(outputPath, scss);
    console.log('Generated _theme_config.scss from _config.yml');
  }
} catch (err) {
  console.error('Error generating theme config:', err.message);
  process.exit(1);
}
