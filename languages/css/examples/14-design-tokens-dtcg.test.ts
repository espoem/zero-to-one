import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface DTCGToken {
  $value: string;
  $type?: string;
  $description?: string;
}

export type DTCGGroup = {
  [key: string]: DTCGToken | DTCGGroup | string | undefined;
};

export class DesignTokenResolver {
  private flatTokens = new Map<string, string>();

  loadTokens(group: DTCGGroup, prefix = ''): void {
    for (const [key, value] of Object.entries(group)) {
      if (key.startsWith('$')) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        if ('$value' in value) {
          this.flatTokens.set(path, (value as DTCGToken).$value);
        } else {
          this.loadTokens(value as DTCGGroup, path);
        }
      }
    }
  }

  resolveValue(path: string, visited = new Set<string>()): string {
    if (visited.has(path)) {
      throw new Error(`Circular dependency detected in design token alias: ${path}`);
    }
    visited.add(path);

    const rawValue = this.flatTokens.get(path);
    if (!rawValue) {
      throw new Error(`Token not found: ${path}`);
    }

    // Check for alias syntax: "{color.brand.primary}"
    const aliasMatch = rawValue.match(/^\{([^}]+)\}$/);
    if (aliasMatch) {
      const targetPath = aliasMatch[1]!;
      return this.resolveValue(targetPath, visited);
    }

    return rawValue;
  }

  generateCSS(): string {
    const lines: string[] = [':root {'];
    for (const [path] of this.flatTokens) {
      const resolved = this.resolveValue(path);
      const varName = `--${path.replace(/\./g, '-')}`;
      lines.push(`  ${varName}: ${resolved};`);
    }
    lines.push('}');
    return lines.join('\n');
  }
}

describe('Module 14: W3C Design Tokens (DTCG 2025.10)', () => {
  it('correctly resolves token hierarchies and aliases into CSS Custom Properties', () => {
    const tokenData: DTCGGroup = {
      color: {
        brand: {
          primary: {
            $value: 'oklch(0.65 0.25 140)',
            $type: 'color',
          },
          surface: {
            $value: '{color.brand.primary}',
            $type: 'color',
          },
        },
      },
      spacing: {
        base: {
          $value: '8px',
          $type: 'dimension',
        },
      },
    };

    const resolver = new DesignTokenResolver();
    resolver.loadTokens(tokenData);

    assert.equal(resolver.resolveValue('color.brand.primary'), 'oklch(0.65 0.25 140)');
    // Alias must resolve to the target token's value
    assert.equal(resolver.resolveValue('color.brand.surface'), 'oklch(0.65 0.25 140)');
    assert.equal(resolver.resolveValue('spacing.base'), '8px');

    const css = resolver.generateCSS();
    assert(css.includes('--color-brand-primary: oklch(0.65 0.25 140);'));
    assert(css.includes('--color-brand-surface: oklch(0.65 0.25 140);'));
    assert(css.includes('--spacing-base: 8px;'));
  });

  it('negative test: rejects circular token aliases with a descriptive error', () => {
    const circularData: DTCGGroup = {
      color: {
        a: { $value: '{color.b}' },
        b: { $value: '{color.a}' },
      },
    };

    const resolver = new DesignTokenResolver();
    resolver.loadTokens(circularData);

    assert.throws(
      () => resolver.resolveValue('color.a'),
      /Circular dependency detected/
    );
  });
});
